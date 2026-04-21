#!/usr/bin/env python3
"""Bundle quickjs-master/amiga/ffi/*.js into a single script for qjsc.

The Q2 FFI source files use ES modules (import/export) for IDE
ergonomics on Mac/Cursor, but qjsc -m emits a separate bytecode
array per module. The library loader evaluates a single blob, so we
flatten everything into one script with imports stripped.

Output: quickjs-master/gen/ffi-bundle.js — fed to qjsc to produce
gen/ffi.c. The .js sources stay as the source of truth.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFI = os.path.join(ROOT, 'quickjs-master/amiga/ffi')
OUT = os.path.join(ROOT, 'quickjs-master/gen/ffi-bundle.js')

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


def emit():
    with open(OUT, 'w') as out:
        out.write(
            '/* AUTO-GENERATED by scripts/bundle_ffi.py — DO NOT EDIT.\n'
            ' *\n'
            ' * Sources: quickjs-master/amiga/ffi/**.js\n'
            ' * Compile: ./quickjs-master/build/qjsc -ss -N qjsc_ffi \\\n'
            ' *            -o quickjs-master/gen/ffi.c \\\n'
            ' *            quickjs-master/gen/ffi-bundle.js\n'
            ' */\n\n'
            '"use strict";\n\n'
        )

        for name in ORDER:
            if name == '__VENDORED_ENUMERATION__':
                path = VENDORED_ENUMERATION
            else:
                path = os.path.join(FFI, name)

            with open(path) as f:
                text = f.read()

            stripped = strip_imports_exports(text)

            out.write(f'/* === {name} === */\n')
            out.write(stripped)
            out.write('\n\n')

    print(f'wrote {OUT} ({os.path.getsize(OUT)} bytes)')


if __name__ == '__main__':
    emit()
