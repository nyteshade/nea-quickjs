#!/usr/bin/env python3
"""Split quickjs-master/amiga/extended/extended.js into bytecode blobs.

extended.js is one source file holding some thirty features, each a
defineFeature({...}) block with metadata and an install() body.
Compiled as one blob, every start of qjs had to read all of it (about
570 KB of heap and most of the start-up time, measured at 0.227) even
for a script using none of the features. This script compiles it as:

  qjsc_extended    the module evaluated on first use of any feature:
                   the file's preamble, a compact _features table
                   (name, globals, requires per feature) built here at
                   build time, and the file's tail, which applies
                   features. Compiled into quickjs.library, from
                   quickjs-master/gen/extended.c.
  <feature>        one classic script per feature, holding its
                   install() body: an entry of LIBS:quickjs/extended.qjsb
                   named after the feature, read and evaluated by the
                   native __qjs_loadFeatures when the feature is applied
  @registry        the last entry: every feature's metadata without
                   install(), for qjs.modules.list()

The entries are left in quickjs-master/gen/qjsb/extended/ for
`scripts/qjsb.py core` to pack (docs/QJSB-FORMAT.md). gen/extended.c
also gets the names the library registers as lazy properties when a
context starts (no JavaScript runs then, and no file is opened; the
module is evaluated the first time one of them is used):

  qjsc_ext_lazy_names[], qjsc_ext_lazy_tags[], qjsc_ext_lazy_count

extended.js is the source of truth but is never compiled as it stands:
defineFeature is a marker for this script, not a run-time function.
An install() body may use the module's `std`, `os` and
`nativeMemoryUsage`, which are handed to it as arguments; anything else
it needs from the module must be added to SHARED below.

Usage: python3 scripts/bundle_extended.py     (runs qjsc itself)
       python3 scripts/qjsb.py core           (then packs the .qjsb files)
"""
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qjsb                                             # noqa: E402
import qjsb_format                                      # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'quickjs-master/amiga/extended/extended.js')
GEN = os.path.join(ROOT, 'quickjs-master/gen')
WORK = os.path.join(GEN, 'extended-parts')
OUT_C = os.path.join(GEN, 'extended.c')
QJSC = os.path.join(ROOT, 'quickjs-master/build/qjsc')

BLOCK_START = 'defineFeature({'
INSTALL_START = '\n    install() {\n'
BLOCK_END = '\n    },\n});\n'

# The name of the registry's entry in extended.qjsb; no feature can be
# called this.
REGISTRY_ENTRY = '@registry'

# Module-level names an install() body may use, in argument order.
SHARED = ['std', 'os', 'nativeMemoryUsage']

# Inserted before the first manifest: fetches a feature's body.
LOADER = '''
/* ----------------------------------------------------------
 * Added by scripts/bundle_extended.py. Each feature's install() body
 * is a separate bytecode entry in LIBS:quickjs/extended.qjsb, named
 * after the feature; so is the registry, the features' descriptions
 * (entry "%(registry)s"). __qjs_loadFeatures(names) evaluates the named
 * entries in one opening of the file and returns the function each of
 * them defines.
 * ---------------------------------------------------------- */
const _loadFeaturesNative = globalThis.__qjs_loadFeatures;

delete globalThis.__qjs_loadFeatures;

/**
 * Read and evaluate entries of extended.qjsb.
 *
 * @param {Array<string>} names - the entries wanted
 * @returns {Array<function>} what each entry defined, in that order
 * @throws {Error} if the file or an entry cannot be read
 */
function _loadFeatureBodies(names) {
    return _loadFeaturesNative(names);
}

/**
 * Run the install() body of one feature, read earlier, and let go of
 * it.
 *
 * @param {object} feature - the feature's record, as `this`
 * @returns {undefined}
 */
function _runInstall(feature) {
    const install = feature.install;

    feature.install = null;
    install.call(feature, %(shared)s);
}

/**
 * Read the features' descriptions.
 *
 * @returns {Array<object>} one object per feature, in source order
 * @throws {Error} if the file cannot be read
 */
function _loadRegistry() {
    return _loadFeatureBodies(['%(registry)s'])[0]();
}

/* One row per feature: name, globals, requires. Written from the
 * defineFeature blocks at build time, so nothing but this table is
 * built when qjs starts. `install` is the feature's body once it has
 * been read from the file and until it has run. */
const _features = [];

(function (rows) {
    /* an indexed loop on purpose: destructuring and for-of go through
     * the iterator protocol, which cost more at start-up than
     * everything else this table does */
    for (let index = 0; index < rows.length; index++) {
        const row = rows[index];

        _features.push({
            name: row[0], globals: row[1], requires: row[2], index,
            applied: false, applying: false, whenApplied: null,
            install: null,
        });
    }
})([
%(rows)s
]);

'''


def split_source(text):
    """Return (preamble, [(name, head, body)], tail)."""
    # at the start of a line: the file's own comments show the form too
    starts = [m.start() for m in
              re.finditer('^' + re.escape(BLOCK_START), text, re.M)]
    if not starts:
        sys.exit('bundle_extended: no manifests found')

    features = []
    position = starts[0]
    for start in starts:
        if text[position:start].strip() and re.sub(
                r'/\*.*?\*/', '', text[position:start], flags=re.S).strip():
            sys.exit('bundle_extended: code between manifests near offset '
                     f'{position}; move it into a manifest or the preamble')

        end = text.index(BLOCK_END, start)
        block = text[start:end + len(BLOCK_END)]

        if block.count(INSTALL_START) != 1:
            sys.exit('bundle_extended: a manifest must have exactly one '
                     f'install() as its last member: {block[:120]!r}')

        cut = block.index(INSTALL_START)
        head = block[:cut]
        body = block[cut + len(INSTALL_START):len(block) - len(BLOCK_END)]
        name = re.search(r"name:\s*'([^']+)'", head).group(1)
        features.append((name, head, body))
        position = end + len(BLOCK_END)

    return text[:starts[0]], features, text[position:]


def string_list(head, member):
    """The strings of `member: ['a', 'b'],` in a feature's head."""
    match = re.search(r'\b%s:\s*\[(.*?)\]' % member, head, re.S)
    if not match:
        return []
    return re.findall(r"'([^']*)'", match.group(1))


def run_qjsc(arguments):
    """Run qjsc and stop on failure."""
    result = subprocess.run([QJSC] + arguments, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit('bundle_extended: qjsc failed:\n' + result.stderr)


def main():
    with open(SOURCE) as f:
        preamble, features, tail = split_source(f.read())

    os.makedirs(WORK, exist_ok=True)
    for stale in os.listdir(WORK):
        os.remove(os.path.join(WORK, stale))

    names = [name for name, _, _ in features]
    rows = []
    for name, head, _ in features:
        requires = string_list(head, 'requires')
        for required in requires:
            if required not in names:
                sys.exit(f"bundle_extended: '{name}' requires unknown "
                         f"feature '{required}'")
        rows.append('    [%r, %r, %r],' % (name, string_list(head, 'globals'),
                                           requires))

    # The module evaluated on first use of any feature.
    main_js = os.path.join(WORK, 'extended_main.js')
    with open(main_js, 'w') as out:
        out.write('/* AUTO-GENERATED by scripts/bundle_extended.py from '
                  'amiga/extended/extended.js - DO NOT EDIT. */\n')
        out.write(preamble)
        out.write(LOADER % {'shared': ', '.join(SHARED),
                            'registry': REGISTRY_ENTRY,
                            'rows': '\n'.join(rows)})
        out.write(tail)

    # One script per feature, then the registry: the entries of
    # extended.qjsb.
    entries = []
    for index, (name, _, body) in enumerate(features):
        identifier = re.sub(r'\W', '_', name)
        path = os.path.join(WORK, 'ext_%02d_%s.js' % (index, identifier))
        with open(path, 'w') as out:
            out.write('/* AUTO-GENERATED by scripts/bundle_extended.py: the '
                      "install() body of feature '%s'. */\n" % name)
            out.write('globalThis.__qjs_extInstall = function (%s) {\n'
                      '"use strict";\n' % ', '.join(SHARED))
            out.write(body)
            out.write('\n};\n')
        entries.append((name, qjsb_format.KIND_SCRIPT,
                        qjsb.compile_blob(path, False)))

    path = os.path.join(WORK, 'ext_%02d_registry.js' % len(features))
    with open(path, 'w') as out:
        out.write('/* AUTO-GENERATED by scripts/bundle_extended.py: every '
                  "feature's metadata, without install(). */\n")
        out.write('globalThis.__qjs_extInstall = function () {\n'
                  '"use strict";\nreturn [\n')
        for _, head, _ in features:
            out.write('{' + head[len(BLOCK_START):].rstrip().rstrip(',')
                      + '\n},\n')
        out.write('];\n};\n')
    entries.append((REGISTRY_ENTRY, qjsb_format.KIND_SCRIPT,
                    qjsb.compile_blob(path, False)))

    qjsb.write_parts('extended', entries)

    main_c = os.path.join(WORK, 'main.c')
    run_qjsc(['-ss', '-m', '-N', 'qjsc_extended', '-o', main_c, main_js])

    with open(main_c) as f:
        main_text = f.read()

    with open(OUT_C, 'w') as out:
        out.write('/* AUTO-GENERATED by scripts/bundle_extended.py - DO NOT '
                  'EDIT.\n * What quickjs.library itself holds of the '
                  'extended features: qjsc_extended,\n * the module '
                  'evaluated on first use of any of them, and the names '
                  'that\n * trigger it. The features themselves are in '
                  'LIBS:quickjs/extended.qjsb. */\n\n')
        out.write(main_text)

        # Every name a feature lists, for the library to register as a
        # host lazy property, with the feature's index as its tag. `qjs`
        # comes last with an index one past the features: it loads the
        # start-up module and nothing else.
        lazy = []
        for index, (name, head, _) in enumerate(features):
            for global_name in string_list(head, 'globals'):
                lazy.append((global_name, index))
        lazy.append(('qjs', len(features)))

        out.write('\n/* Lazy names: see qjs_install_lazy_globals in '
                  'library/vbcc/amiga_ffi.c. */\n')
        out.write('const char *const qjsc_ext_lazy_names[] = {\n')
        for global_name, _ in lazy:
            out.write('    "%s",\n' % global_name)
        out.write('};\n\nconst uint16_t qjsc_ext_lazy_tags[] = {\n')
        for _, index in lazy:
            out.write('    %d,\n' % index)
        out.write('};\n\nconst uint32_t qjsc_ext_lazy_count = %d;\n'
                  % len(lazy))

    os.remove(main_c)

    main_size = int(re.search(r'qjsc_extended_size = (\d+)', main_text).group(1))
    total = sum(len(blob) for _, _, blob in entries)
    print(f'wrote {OUT_C}: start-up module {main_size} bytes, kept in the '
          f'library; {len(features)} feature blobs and the registry '
          f'{total} bytes, for extended.qjsb')
    for name, _, blob in entries:
        print(f'  {len(blob):6d}  {name}')


if __name__ == '__main__':
    main()
