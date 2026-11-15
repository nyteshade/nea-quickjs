#!/usr/bin/env python3
"""Write, list and verify .qjsb files (QuickJS bytecode containers).

    python3 scripts/qjsb.py core [--out DIR]
        Pack the library's own three files from what the bundlers left
        in quickjs-master/gen/qjsb/ (run scripts/bundle_extended.py and
        scripts/bundle_ffi.py first):
            extended.qjsb   the extended features (URL, Buffer, ...)
            amiga.qjsb      the Exec/DOS/Intuition/Graphics wrappers
            reaction.qjsb   the BOOPSI and Reaction classes
        into amiga/libs/quickjs/ (or DIR), and write
        quickjs-master/gen/qjsb_stamp.h, the same version stamp for the
        library to compile in. `make -C library/vbcc qjsb` runs this.

    python3 scripts/qjsb.py stamp
        Write quickjs-master/gen/qjsb_stamp.h only.

    python3 scripts/qjsb.py compile OUT.qjsb --version N.N [--date D.M.YYYY]
            [--min-library N] [--main FILE.js] [NAME=FILE.js ...]
        Compile an add-on from ES modules. For OUT = hello.qjsb,
        --main is what `import ... from 'qjs:hello'` gives and
        NAME=FILE.js what `import ... from 'hello:NAME'` gives.
        --version and --date (default: today) go into the file's
        "$VER:" string, which the AmigaDOS command `version file
        hello.qjsb` prints. --min-library is the oldest quickjs.library
        that may load it, as LIBRARY_VERSION (240 for 0.240); the
        default is this tree's. An add-on is not tied to one library
        version, only to the engine's bytecode format.

    python3 scripts/qjsb.py list FILE.qjsb
    python3 scripts/qjsb.py verify FILE.qjsb [...]
        Show a file's header and index; check it completely (every
        blob's checksum, and that it matches this tree's engine).

The format is specified in docs/QJSB-FORMAT.md, add-ons in
docs/ADDONS.md.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qjsb_format as fmt                               # noqa: E402

ROOT = fmt.ROOT
GEN = os.path.join(ROOT, 'quickjs-master/gen')
PARTS = os.path.join(GEN, 'qjsb')
STAMP_H = os.path.join(GEN, 'qjsb_stamp.h')
OUT_DIR = os.path.join(ROOT, 'amiga/libs/quickjs')
QJSC = os.path.join(ROOT, 'quickjs-master/build/qjsc')

CORE_FILES = ('extended', 'amiga', 'reaction')
MAIN_ENTRY = '@main'        # as QJSB_MAIN_ENTRY in library/vbcc/qjsb_format.h


# The specifier of a static import or re-export.
IMPORT = re.compile(r'''(?:\bfrom|\bimport)\s*['"]([^'"]+)['"]''')


def compile_blob(source, module, name=None):
    """Bytecode of one JavaScript file, stripped, as qjsc -b writes it.

    module: compile as an ES module (else a classic script).
    name: the module's name as the engine will know it; for a module
    loaded from a container it must be the specifier it is imported by.
    """
    with tempfile.TemporaryDirectory() as work:
        target = os.path.join(work, 'out.bin')
        # A module keeps its debug information (-s, not -ss): the engine
        # finds the module a function belongs to, for import.meta and
        # import(), through the file name recorded there.
        command = [QJSC, '-b'] + (['-s', '-m'] if module else ['-ss', '-C'])
        if name:
            command += ['-n', name]
        if module:
            # qjsc compiles what a module imports unless told the import
            # is provided elsewhere; "scheme:name" specifiers are other
            # add-on modules or built in, never files to compile in.
            with open(source, encoding='utf-8') as handle:
                text = handle.read()
            for specifier in sorted(set(IMPORT.findall(text))):
                if ':' in specifier and not specifier.endswith(
                        ('.js', '.mjs', '.json')):
                    command += ['-M', specifier]
        command += ['-o', target, source]
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            sys.exit('qjsb: qjsc failed on %s:\n%s' % (source, result.stderr))
        with open(target, 'rb') as handle:
            return handle.read()


def write_parts(container, entries):
    """Leave a container's blobs in gen/qjsb/<container>/ for `core`.

    Called by the bundlers. entries is [(name, kind, blob)].
    """
    directory = os.path.join(PARTS, container)
    os.makedirs(directory, exist_ok=True)
    for stale in os.listdir(directory):
        os.remove(os.path.join(directory, stale))

    manifest = []
    for number, (name, kind, blob) in enumerate(entries):
        filename = '%02d.bin' % number
        with open(os.path.join(directory, filename), 'wb') as handle:
            handle.write(blob)
        manifest.append([name, kind, filename])
    with open(os.path.join(directory, 'manifest.json'), 'w') as handle:
        json.dump(manifest, handle, indent=1)


def read_parts(container):
    """[(name, kind, blob)] as write_parts left them."""
    directory = os.path.join(PARTS, container)
    try:
        with open(os.path.join(directory, 'manifest.json')) as handle:
            manifest = json.load(handle)
    except OSError:
        sys.exit('qjsb: no %s/manifest.json - run scripts/bundle_extended.py '
                 'and scripts/bundle_ffi.py first' % directory)
    entries = []
    for name, kind, filename in manifest:
        with open(os.path.join(directory, filename), 'rb') as handle:
            entries.append((name, kind, handle.read()))
    return entries


def write_stamp():
    """gen/qjsb_stamp.h: what the library compares a file's header with."""
    text = (
        '/* AUTO-GENERATED by scripts/qjsb.py - DO NOT EDIT.\n'
        ' * What a .qjsb file must have been built for to be loaded by\n'
        ' * this library: see docs/QJSB-FORMAT.md. */\n'
        '#define QJSB_BUILT_FOR      %du   /* LIBRARY_VERSION */\n'
        '#define QJSB_BC_VERSION     %du   /* BC_VERSION of quickjs.c */\n'
        '#define QJSB_ENGINE_STAMP   0x%08xul  /* atom and opcode lists */\n'
        % (fmt.library_version(), fmt.bytecode_version(), fmt.engine_stamp()))
    try:
        with open(STAMP_H) as handle:
            if handle.read() == text:
                return          # unchanged: do not make the library rebuild
    except OSError:
        pass
    with open(STAMP_H, 'w') as handle:
        handle.write(text)


def command_core(arguments):
    """Pack the library's own three files."""
    out = OUT_DIR
    if arguments[:1] == ['--out']:
        out = os.path.abspath(arguments[1])
    os.makedirs(out, exist_ok=True)
    write_stamp()
    version, date = fmt.library_release()
    for container in CORE_FILES:
        entries = read_parts(container)
        ver = fmt.ver_string(container + '.qjsb', version, date)
        data = fmt.pack(entries, ver, flags=fmt.FLAG_EXACT)
        fmt.unpack(data)                    # what we wrote can be read
        path = os.path.join(out, container + '.qjsb')
        with open(path, 'wb') as handle:
            handle.write(data)
        print('wrote %s: %s, %d entries, %d bytes'
              % (os.path.relpath(path, ROOT), ver, len(entries), len(data)))
    return 0


def command_compile(arguments):
    """Compile an add-on container from ES modules."""
    if not arguments:
        sys.exit(__doc__)
    out = arguments[0]
    base = os.path.basename(out)
    if not base.endswith('.qjsb'):
        sys.exit('qjsb: the output must be named <add-on>.qjsb')
    addon = base[:-len('.qjsb')]

    entries = []
    version = None
    date = time.strftime('%d.%m.%Y').lstrip('0')
    minimum = fmt.library_version()
    rest = arguments[1:]
    while rest:
        if rest[0] in ('--main', '--version', '--date', '--min-library'):
            if len(rest) < 2:
                sys.exit('qjsb: %s needs a value' % rest[0])
            if rest[0] == '--main':
                entries.append((MAIN_ENTRY, fmt.KIND_MODULE,
                                compile_blob(rest[1], True, 'qjs:' + addon)))
            elif rest[0] == '--version':
                version = rest[1]
            elif rest[0] == '--date':
                date = rest[1]
            else:
                minimum = int(rest[1])
            rest = rest[2:]
        elif '=' in rest[0]:
            name, source = rest[0].split('=', 1)
            entries.append((name, fmt.KIND_MODULE,
                            compile_blob(source, True, addon + ':' + name)))
            rest = rest[1:]
        else:
            sys.exit('qjsb: expected an option or NAME=FILE.js, got %r'
                     % rest[0])
    if not entries:
        sys.exit('qjsb: nothing to compile')
    if version is None:
        sys.exit('qjsb: give the add-on a version: --version 1.0')

    try:
        ver = fmt.ver_string(base, version, date)
        data = fmt.pack(entries, ver, built_for=minimum)
    except fmt.QJSBError as error:
        sys.exit('qjsb: %s' % error)
    with open(out, 'wb') as handle:
        handle.write(data)
    print('wrote %s: %s, %d entries, %d bytes'
          % (out, ver, len(entries), len(data)))
    return 0


def describe(path, show):
    """Check one file completely; print its contents if show. True if good."""
    try:
        with open(path, 'rb') as handle:
            header, entries = fmt.unpack(handle.read())
    except (OSError, fmt.QJSBError) as error:
        print('%s: BAD: %s' % (path, error))
        return False

    mine = (fmt.bytecode_version(), fmt.engine_stamp())
    theirs = (header['bc_version'], header['stamp'])
    exact = bool(header['flags'] & fmt.FLAG_EXACT)
    problems = []
    if theirs != mine:
        problems.append('bytecode %d.%08x, this tree has %d.%08x'
                        % (theirs + mine))
    if exact and header['built_for'] != fmt.library_version():
        problems.append('only for library %s, this tree is %s'
                        % (fmt.version_text(header['built_for']),
                           fmt.version_text(fmt.library_version())))
    if not exact and header['built_for'] > fmt.library_version():
        problems.append('needs library %s or newer, this tree is %s'
                        % (fmt.version_text(header['built_for']),
                           fmt.version_text(fmt.library_version())))

    if show:
        print('%s: %s' % (path, header['ver']))
        print('  format %d, for quickjs.library %s%s, bytecode %d.%08x, '
              '%d bytes'
              % (header['format'], fmt.version_text(header['built_for']),
                 ' only' if exact else ' or newer',
                 header['bc_version'], header['stamp'], header['file_size']))
        print('  %8s %8s  %-6s  %s' % ('offset', 'length', 'kind', 'name'))
        for entry in entries:
            print('  %8d %8d  %-6s  %s'
                  % (entry['offset'], entry['length'],
                     fmt.KIND_NAMES.get(entry['kind'], '?'), entry['name']))
    for problem in problems:
        print('%s: MISMATCH: %s' % (path, problem))
    if not problems and not show:
        print('%s: ok, %s, %d entries' % (path, header['ver'], len(entries)))
    return not problems


def main(argv):
    if len(argv) < 1:
        sys.exit(__doc__)
    command, arguments = argv[0], argv[1:]
    if command == 'core':
        return command_core(arguments)
    if command == 'stamp':
        write_stamp()
        return 0
    if command == 'compile':
        return command_compile(arguments)
    if command in ('list', 'verify') and arguments:
        good = [describe(path, command == 'list') for path in arguments]
        return 0 if all(good) else 1
    sys.exit(__doc__)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
