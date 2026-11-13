#!/usr/bin/env python3
"""Split quickjs-master/amiga/extended/extended.js into bytecode blobs.

extended.js is one source file holding some thirty features, each a
defineFeature({...}) block with metadata and an install() body.
Compiled as one blob, every start of qjs had to read all of it (about
570 KB of heap and most of the start-up time, measured at 0.227) even
for a script using none of the features. This script compiles it as:

  qjsc_extended           the module evaluated at start-up: the file's
                          preamble, a compact _features table (name,
                          globals, requires per feature) built here at
                          build time, and the file's tail, which puts
                          an accessor on each global
  qjsc_ext_NN_<feature>   one classic script per feature, holding its
                          install() body; evaluated by the native
                          __qjs_loadFeature(NN) when the feature is
                          applied
  qjsc_ext_NN_registry    the last blob: every feature's metadata
                          without install(), for qjs.modules.list()

and writes them all to quickjs-master/gen/extended.c together with the
table the native indexes:

  qjsc_ext_features[], qjsc_ext_feature_sizes[], qjsc_ext_feature_count

extended.js is the source of truth but is never compiled as it stands:
defineFeature is a marker for this script, not a run-time function.
An install() body may use the module's `std`, `os` and
`nativeMemoryUsage`, which are handed to it as arguments; anything else
it needs from the module must be added to SHARED below.

Usage: python3 scripts/bundle_extended.py     (runs qjsc itself)
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'quickjs-master/amiga/extended/extended.js')
GEN = os.path.join(ROOT, 'quickjs-master/gen')
WORK = os.path.join(GEN, 'extended-parts')
OUT_C = os.path.join(GEN, 'extended.c')
QJSC = os.path.join(ROOT, 'quickjs-master/build/qjsc')

BLOCK_START = 'defineFeature({'
INSTALL_START = '\n    install() {\n'
BLOCK_END = '\n    },\n});\n'

# Module-level names an install() body may use, in argument order.
SHARED = ['std', 'os', 'nativeMemoryUsage']

# Inserted before the first manifest: fetches a feature's body.
LOADER = '''
/* ----------------------------------------------------------
 * Added by scripts/bundle_extended.py. Each feature's install() body
 * is a separate bytecode blob in the library; so is the registry, the
 * features' descriptions. __qjs_loadFeature evaluates blob `index`,
 * which leaves a function in globalThis.__qjs_extInstall.
 * ---------------------------------------------------------- */
const _loadFeatureNative = globalThis.__qjs_loadFeature;

delete globalThis.__qjs_loadFeature;

/**
 * Evaluate a blob and collect the function it leaves behind.
 *
 * @param {number} index - which blob
 * @returns {function} what the blob defined
 */
function _takeBlob(index) {
    _loadFeatureNative(index);

    const defined = globalThis.__qjs_extInstall;

    delete globalThis.__qjs_extInstall;

    return defined;
}

/**
 * Evaluate and run the install() body of one feature.
 *
 * @param {object} feature - the feature's record, as `this`
 * @param {number} index - which blob
 * @returns {undefined}
 */
function _loadFeature(feature, index) {
    _takeBlob(index).call(feature, %(shared)s);
}

/**
 * Read the features' descriptions.
 *
 * @returns {Array<object>} one object per feature, in source order
 */
function _loadRegistry() {
    return _takeBlob(%(registry)d)();
}

/* One row per feature: name, globals, requires. Written from the
 * defineFeature blocks at build time, so nothing but this table is
 * built when qjs starts. */
const _features = [];

(function (rows) {
    /* an indexed loop on purpose: destructuring and for-of go through
     * the iterator protocol, which cost more at start-up than
     * everything else this table does */
    for (let index = 0; index < rows.length; index++) {
        const row = rows[index];

        _features.push({
            name: row[0], globals: row[1], requires: row[2], index,
            applied: false, applying: false,
            accessors: null, overrides: null, whenApplied: null,
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

    # The module evaluated at start-up.
    main_js = os.path.join(WORK, 'extended_main.js')
    with open(main_js, 'w') as out:
        out.write('/* AUTO-GENERATED by scripts/bundle_extended.py from '
                  'amiga/extended/extended.js - DO NOT EDIT. */\n')
        out.write(preamble)
        out.write(LOADER % {'shared': ', '.join(SHARED),
                            'registry': len(features),
                            'rows': '\n'.join(rows)})
        out.write(tail)

    # One script per feature, then the registry.
    part_files = []
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
        part_files.append(path)

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
    part_files.append(path)

    main_c = os.path.join(WORK, 'main.c')
    parts_c = os.path.join(WORK, 'parts.c')
    run_qjsc(['-ss', '-m', '-N', 'qjsc_extended', '-o', main_c, main_js])
    run_qjsc(['-ss', '-C', '-o', parts_c] + part_files)

    with open(main_c) as f:
        main_text = f.read()
    with open(parts_c) as f:
        parts_text = f.read()

    arrays = re.findall(r'^const uint8_t (qjsc_ext_\w+)\[(\d+)\]', parts_text,
                        re.M)
    if len(arrays) != len(features) + 1:
        sys.exit(f'bundle_extended: {len(features)} features and a registry '
                 f'but {len(arrays)} arrays from qjsc')

    with open(OUT_C, 'w') as out:
        out.write('/* AUTO-GENERATED by scripts/bundle_extended.py - DO NOT '
                  'EDIT.\n * qjsc_extended is the module evaluated at '
                  'start-up; qjsc_ext_NN_* are the\n * feature bodies '
                  '__qjs_loadFeature(NN) evaluates on first use. */\n\n')
        out.write(main_text)
        out.write('\n')
        out.write(re.sub(r'^#include .*\n', '', parts_text, flags=re.M))
        out.write('\nconst uint8_t *const qjsc_ext_features[] = {\n')
        for array, _ in arrays:
            out.write('    %s,\n' % array)
        out.write('};\n\nconst uint32_t qjsc_ext_feature_sizes[] = {\n')
        for _, size in arrays:
            out.write('    %s,\n' % size)
        out.write('};\n\nconst uint32_t qjsc_ext_feature_count = %d;\n'
                  % len(arrays))

    for leftover in (main_c, parts_c):
        os.remove(leftover)

    main_size = int(re.search(r'qjsc_extended_size = (\d+)', main_text).group(1))
    total = sum(int(size) for _, size in arrays)
    print(f'wrote {OUT_C}: start-up module {main_size} bytes, '
          f'{len(features)} feature blobs and the registry {total} bytes')
    for (array, size), name in zip(arrays, names + ['(registry)']):
        print(f'  {int(size):6d}  {name}')


if __name__ == '__main__':
    main()
