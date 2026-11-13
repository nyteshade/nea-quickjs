#!/usr/bin/env python3
"""Bundle quickjs-master/amiga/ffi/*.js into scripts and compile them.

The FFI source files use ES modules (import/export) for IDE ergonomics,
but the library evaluates precompiled classic scripts, so the sources
are concatenated in dependency order with imports stripped.

Three scripts are written to quickjs-master/gen/:

  ffi_lazy.js    the handler that loads a bundle on first use
                 (a copy of amiga/ffi/lazy.js)
  ffi_core.js    group 0: enumerations, structs, library wrappers
  ffi_boopsi.js  group 1: the BOOPSI / Reaction classes

and compiled, by this script, into quickjs-master/gen/ffi.c, which
holds the arrays qjsc_ffi_lazy, qjsc_ffi_core and qjsc_ffi_boopsi plus
the tables of names the library registers as lazy properties when a
context starts:

  qjsc_ffi_lazy_globals[] / _global_tags[] / _global_count
  qjsc_ffi_lazy_amiga_paths[] / _amiga_names[] / _amiga_tags[] / _amiga_count

The name tables come from the index files (`everyGlobal`, `libs`,
`structsByLib`, `boopsiGlobals`), so they cannot drift from what the
bundles publish. The .js sources stay the source of truth.

Usage: python3 scripts/bundle_ffi.py     (runs qjsc itself)
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFI = os.path.join(ROOT, 'quickjs-master/amiga/ffi')
GEN = os.path.join(ROOT, 'quickjs-master/gen')
OUT_LAZY = os.path.join(GEN, 'ffi_lazy.js')
OUT_CORE = os.path.join(GEN, 'ffi_core.js')
OUT_BOOPSI = os.path.join(GEN, 'ffi_boopsi.js')
OUT_C = os.path.join(GEN, 'ffi.c')
QJSC = os.path.join(ROOT, 'quickjs-master/build/qjsc')

CORE_GROUP = 0
BOOPSI_GROUP = 1
FFI_TAG_BASE = 1000     # as in amiga/ffi/lazy.js and amiga_ffi.c

# Dependency order — base classes / helpers first, then libs and structs,
# then index.js wiring. ES module resolver would do this for us, but
# concatenation needs explicit order.
ORDER = [
    # Vendored Enumeration (re-emitted inline to avoid path issues)
    '__VENDORED_ENUMERATION__',
    # Foundations
    'CEnumeration.js',
    'ptrOf.js',
    'LibraryBase.js',
    # Struct base
    'structs/Struct.js',
    # Leaf structs (no inter-struct deps)
    'structs/MsgPort.js',
    'structs/IntuiMessage.js',
    'structs/TextAttr.js',
    'structs/Image.js',
    'structs/Gadget.js',
    'structs/RastPort.js',
    'structs/DrawInfo.js',
    'structs/Menu.js',         # MenuItem loaded later by name; circular-safe
    'structs/MenuItem.js',     # references Menu via global lookup
    'structs/IntuiText.js',    # needs ptrOf
    'structs/BitMap.js',
    'structs/ColorMap.js',
    'structs/ViewPort.js',       # needs ColorMap
    'structs/FileInfoBlock.js',
    'structs/InputEvent.js',
    'structs/IORequest.js',    # needs ptrOf
    'structs/TimerRequest.js', # extends IORequest
    # Mid-level structs
    'structs/Screen.js',  # needs TextAttr
    'structs/TagItem.js',
    'structs/NewWindow.js',  # needs ptrOf
    'structs/Window.js',  # needs Screen, RastPort, MsgPort, IntuiMessage
    # Library wrappers (each needs LibraryBase + CEnumeration + ptrOf)
    'Exec.js',
    'Dos.js',
    'Graphics.js',
    'GadTools.js',
    'Asl.js',
    'Diskfont.js',
    'Intuition.js',  # needs Window, Screen, Image
    'ScreenFont.js', # needs Intuition, Graphics, DrawInfo
    # BOOPSI / Reaction infrastructure. Each layer depends on the
    # previous. EventKind must come before any class wrapper so the
    # class's module-load-time define() calls resolve.
    'boopsi/EventKind.js',         # CEnumeration with core IDCMP kinds
    'boopsi/BOOPSIBase.js',        # root class; ATTRS table driver
    'boopsi/GadgetBase.js',        # extends BOOPSIBase; GA_* attrs
    'boopsi/ImageBase.js',         # extends BOOPSIBase; IA_* attrs
    # Images — pure imageclass subclasses, simplest to load first.
    'boopsi/images/Label.js',
    'boopsi/images/Led.js',
    'boopsi/images/Bevel.js',
    'boopsi/images/Glyph.js',
    'boopsi/images/DrawList.js',
    'boopsi/images/Bitmap.js',
    # Interactive gadgets (all extend GadgetBase directly).
    'boopsi/gadgets/Button.js',    # also extends EventKind at load time
    'boopsi/gadgets/CheckBox.js',
    'boopsi/gadgets/RadioButton.js',
    'boopsi/gadgets/Slider.js',
    'boopsi/gadgets/Scroller.js',
    'boopsi/gadgets/Integer.js',
    'boopsi/gadgets/StringGadget.js',
    'boopsi/gadgets/Chooser.js',
    'boopsi/gadgets/ClickTab.js',
    'boopsi/gadgets/ListBrowser.js',
    'boopsi/gadgets/Palette.js',
    'boopsi/gadgets/Space.js',
    'boopsi/gadgets/FuelGauge.js',
    'boopsi/gadgets/SpeedBar.js',
    'boopsi/gadgets/GetFile.js',
    'boopsi/gadgets/GetFont.js',
    'boopsi/gadgets/GetScreenMode.js',
    'boopsi/gadgets/GetColor.js',
    'boopsi/gadgets/DateBrowser.js',
    'boopsi/gadgets/TextEditor.js',
    'boopsi/gadgets/SketchBoard.js',
    'boopsi/gadgets/TapeDeck.js',
    'boopsi/gadgets/ColorWheel.js',
    'boopsi/gadgets/GradientSlider.js',
    # Layout containers — must load before Window (which holds a Layout).
    'boopsi/gadgets/Layout.js',
    'boopsi/gadgets/Page.js',      # extends Layout
    'boopsi/gadgets/Virtual.js',   # extends Layout
    'boopsi/classes/Window.js',
    'boopsi/classes/Requester.js',
    # Wiring for the BOOPSI bundle (amiga.boopsi.* and its globals)
    'boopsi/index.js',
    # Wiring (sets up globals + amiga.<libname>.X)
    'index.js',
]

VENDORED_ENUMERATION = os.path.join(
    ROOT, 'quickjs-master/amiga/extended/vendor/ne-enumeration/enumeration.mjs'
)


def strip_imports_exports(text):
    """Remove `import ... from '...'` lines, strip `export` and
    `export default` keywords. `export default Foo` (a bare default
    re-export) is dropped entirely since the symbol is already
    declared above."""
    out = []

    for line in text.split('\n'):
        # Drop import statements (single-line; multi-line not used)
        if re.match(r'^\s*import\s.*from\s', line):
            continue

        # Drop bare `export default <Identifier>` lines — the symbol
        # is already declared as `class Foo` above.
        if re.match(r'^\s*export\s+default\s+\w+\s*;?\s*$', line):
            continue

        # `export default class Foo {` → `class Foo {`
        line = re.sub(
            r'^(\s*)export\s+default\s+', r'\1', line
        )

        # `export class/function/const/let` → drop `export `
        line = re.sub(r'^(\s*)export\s+', r'\1', line)

        out.append(line)

    return '\n'.join(out)


DECLARATION = re.compile(
    r'^(?:class|const|let|var|function\*?|async\s+function\*?)\s+'
    r'([A-Za-z_$][\w$]*)', re.M)


def read_source(name):
    """The text of one source file, imports and exports stripped."""
    if name == '__VENDORED_ENUMERATION__':
        path = VENDORED_ENUMERATION
    else:
        path = os.path.join(FFI, name)

    with open(path) as f:
        return strip_imports_exports(f.read())


def object_literal_names(text, variable):
    """The property names of `const <variable> = { ... };` in text.

    Understands the two shapes the index files use: shorthand names
    (`Exec, Dos,`) and `Name: value` pairs. Nested literals are not
    descended into; use nested_literal_names for those.
    """
    match = re.search(r'const\s+%s\s*=\s*\{(.*?)\n\};' % re.escape(variable),
                      text, re.S)
    if not match:
        match = re.search(r'const\s+%s\s*=\s*\{(.*?)\};' % re.escape(variable),
                          text, re.S)
    if not match:
        sys.exit(f'bundle_ffi: cannot find `const {variable} = {{...}}`')

    body = re.sub(r'/\*.*?\*/', '', match.group(1), flags=re.S)
    body = re.sub(r'\{[^{}]*\}', '', body)          # drop nested literals

    names = []
    for part in body.split(','):
        part = part.strip()
        if part:
            names.append(part.split(':')[0].strip())
    return names


def nested_literal_names(text, variable):
    """For `const v = { key: { A, B }, ... };` return [(key, name)]."""
    match = re.search(r'const\s+%s\s*=\s*\{(.*?)\n\};' % re.escape(variable),
                      text, re.S)
    if not match:
        sys.exit(f'bundle_ffi: cannot find `const {variable} = {{...}}`')

    body = re.sub(r'/\*.*?\*/', '', match.group(1), flags=re.S)
    pairs = []
    for key, inner in re.findall(r'([A-Za-z_$][\w$]*)\s*:\s*\{([^{}]*)\}', body):
        for name in inner.split(','):
            name = name.strip()
            if name:
                pairs.append((key, name.split(':')[0].strip()))
    return pairs


def write_bundle(path, title, names, shared_in=(), shared_out=()):
    """Concatenate the named sources into one classic script.

    The whole script is one function body, so nothing it declares
    becomes a global: a bundle publishes only what its index file
    assigns to globalThis and amiga. (Until 0.226 the single bundle was
    compiled as a module, which scoped it the same way.)

    shared_out: names handed to a later bundle through
    globalThis.__qjs_ffiShared, which lazy.js collects and removes.
    shared_in: names taken from there at the top of this bundle.
    """
    with open(path, 'w') as out:
        out.write(
            '/* AUTO-GENERATED by scripts/bundle_ffi.py - DO NOT EDIT.\n'
            f' * {title}\n'
            ' * Sources: quickjs-master/amiga/ffi/**.js\n'
            ' */\n\n'
            '(function () {\n'
            '"use strict";\n\n'
        )

        if shared_in:
            out.write('const {\n  ' + ',\n  '.join(shared_in) +
                      ',\n} = globalThis.__qjs_ffiShared;\n\n')

        for name in names:
            out.write(f'/* === {name} === */\n')
            out.write(read_source(name) + '\n\n')

        if shared_out:
            out.write('globalThis.__qjs_ffiShared = {\n  ' +
                      ',\n  '.join(shared_out) + ',\n};\n\n')

        out.write('})();\n')

    print(f'wrote {path} ({os.path.getsize(path)} bytes)')


def declared_names(names):
    """Top-level declarations of the named sources, index files apart."""
    declared = []
    for name in names:
        if os.path.basename(name) != 'index.js':
            declared += DECLARATION.findall(read_source(name))
    return declared


def emit():
    """Write the three scripts qjsc compiles into gen/ffi.c."""
    core = [n for n in ORDER if not n.startswith('boopsi/')]
    boopsi = [n for n in ORDER if n.startswith('boopsi/')]

    core_declared = declared_names(core)
    boopsi_declared = declared_names(boopsi)

    # What the BOOPSI sources use from the core: every core declaration
    # whose name appears in them as a word and is not redeclared there.
    boopsi_text = '\n'.join(read_source(n) for n in boopsi)
    boopsi_words = set(re.findall(r'[A-Za-z_$][\w$]*', boopsi_text))
    shared = [n for n in dict.fromkeys(core_declared)
              if n in boopsi_words and n not in boopsi_declared]

    write_bundle(OUT_CORE, 'Core FFI wrappers (group 0).', core,
                 shared_out=shared)
    write_bundle(OUT_BOOPSI, 'BOOPSI / Reaction wrappers (group 1).', boopsi,
                 shared_in=shared)

    core_index = read_source('index.js')
    boopsi_index = read_source('boopsi/index.js')

    core_globals = object_literal_names(core_index, 'everyGlobal')
    boopsi_globals = object_literal_names(boopsi_index, 'boopsiGlobals')

    core_amiga = [['', n] for n in object_literal_names(core_index, 'libs')]
    core_amiga += [['', n] for n in
                   ('ScreenFont', 'LibraryBase', 'CEnumeration', 'Struct')]
    core_amiga += [[lib, n] for lib, n in
                   nested_literal_names(core_index, 'structsByLib')]

    for name in core_globals:
        if name not in core_declared:
            sys.exit(f'bundle_ffi: global {name} is not declared by the core')
    for name in boopsi_globals:
        if name not in boopsi_declared:
            sys.exit(f'bundle_ffi: global {name} is not declared by boopsi')

    with open(os.path.join(FFI, 'lazy.js')) as f:
        lazy = f.read()

    with open(OUT_LAZY, 'w') as out:
        out.write('/* AUTO-GENERATED by scripts/bundle_ffi.py from '
                  'amiga/ffi/lazy.js - DO NOT EDIT. */\n')
        out.write(lazy)

    print(f'wrote {OUT_LAZY} ({os.path.getsize(OUT_LAZY)} bytes); '
          f'{len(shared)} core names shared with the BOOPSI bundle')

    # Compile the three scripts into gen/ffi.c and add the tables of
    # names the library registers as host lazy properties.
    result = subprocess.run(
        [QJSC, '-ss', '-C', '-o', OUT_C, OUT_LAZY, OUT_CORE, OUT_BOOPSI],
        capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit('bundle_ffi: qjsc failed:\n' + result.stderr)

    globals_table = ([(name, CORE_GROUP) for name in core_globals] +
                     [(name, BOOPSI_GROUP) for name in boopsi_globals])
    # the whole amiga.boopsi table arrives with the BOOPSI bundle
    amiga_table = ([(path, name, CORE_GROUP) for path, name in core_amiga] +
                   [('', 'boopsi', BOOPSI_GROUP)])

    with open(OUT_C, 'a') as out:
        out.write('\n/* Lazy names: see qjs_install_lazy_globals in '
                  'library/vbcc/amiga_ffi.c.\n * The tag of a name is '
                  '1000 + its group (0 core, 1 BOOPSI). */\n')
        out.write('const char *const qjsc_ffi_lazy_globals[] = {\n')
        for name, _ in globals_table:
            out.write('    "%s",\n' % name)
        out.write('};\n\nconst uint16_t qjsc_ffi_lazy_global_tags[] = {\n')
        for _, group in globals_table:
            out.write('    %d,\n' % (FFI_TAG_BASE + group))
        out.write('};\n\nconst uint32_t qjsc_ffi_lazy_global_count = %d;\n'
                  % len(globals_table))

        out.write('\n/* amiga.<path>.<name>; an empty path is amiga.<name> '
                  '*/\nconst char *const qjsc_ffi_lazy_amiga_paths[] = {\n')
        for path, _, _ in amiga_table:
            out.write('    "%s",\n' % path)
        out.write('};\n\nconst char *const qjsc_ffi_lazy_amiga_names[] = {\n')
        for _, name, _ in amiga_table:
            out.write('    "%s",\n' % name)
        out.write('};\n\nconst uint16_t qjsc_ffi_lazy_amiga_tags[] = {\n')
        for _, _, group in amiga_table:
            out.write('    %d,\n' % (FFI_TAG_BASE + group))
        out.write('};\n\nconst uint32_t qjsc_ffi_lazy_amiga_count = %d;\n'
                  % len(amiga_table))

    print(f'wrote {OUT_C}: {len(globals_table)} lazy globals, '
          f'{len(amiga_table)} lazy amiga names')


if __name__ == '__main__':
    emit()
