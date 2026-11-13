#!/usr/bin/env python3
"""Write the constant tables in our JavaScript from the NDK headers.

Usage:
    python3 scripts/gen_consts.py            # rewrite every table
    python3 scripts/gen_consts.py --check    # exit 1 if any table is stale
    python3 scripts/gen_consts.py --list     # print each table's names

Nobody types a constant's value. MANIFEST below says which names each
table holds, by header; this script looks the values up in
sdks/NDK3.2R4/Include_H and writes the table, each entry followed by
the expression the header gives for it:

    WA_InnerWidth:    0x80000076,   /* WA_Dummy + 0x13 */

To offer a new constant, add its name (or a pattern for its family) to
MANIFEST and run this script. Then rebuild the bundle.

A table lives between two marker comments inside a call to
CEnumeration.lazy(), which creates each case only when it is first
used, so a large table costs nothing at start-up:

    static consts = CEnumeration.lazy('IntuitionConsts', {
      /* consts-begin ... */
      ...
      /* consts-end */
    });

Selectors in MANIFEST:
    'WA_Left'         that one name
    're:WA_\\w+'       every name in the group's header that matches in
                      full, in the header's order
A name ending in _Dummy, or whose header value is not a plain number,
is left out. A name already written by an earlier group of the same
table is not repeated.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_constants import Headers, ROOT   # noqa: E402

FFI = os.path.join('quickjs-master', 'amiga', 'ffi')

# file, class name, [(group title, header, [selectors])]
MANIFEST = [
    (os.path.join(FFI, 'Intuition.js'), 'IntuitionConsts', [
        ('Window attributes: tags for OpenWindowTags', 'intuition/intuition.h',
         ['re:WA_\\w+']),
        ('Window flags: the value of WA_Flags', 'intuition/intuition.h',
         ['re:WFLG_\\w+']),
        ('IDCMP classes: the value of WA_IDCMP, and IntuiMessage.class',
         'intuition/intuition.h', ['re:IDCMP_\\w+']),
        ('Mouse button codes: IntuiMessage.code for IDCMP_MOUSEBUTTONS',
         'intuition/intuition.h',
         ['SELECTDOWN', 'SELECTUP', 'MENUDOWN', 'MENUUP', 'MIDDLEDOWN', 'MIDDLEUP']),
        ('Menu and menu item flags', 'intuition/intuition.h',
         ['MENUENABLED', 'MIDRAWN', 'CHECKIT', 'ITEMTEXT', 'COMMSEQ', 'MENUTOGGLE',
          'ITEMENABLED', 'HIGHFLAGS', 'HIGHIMAGE', 'HIGHCOMP', 'HIGHBOX', 'HIGHNONE',
          'CHECKED', 'ISDRAWN', 'HIGHITEM', 'MENUTOGGLED']),
        ('Menu numbers: "nothing chosen" values', 'intuition/intuition.h',
         ['MENUNULL', 'NOMENU', 'NOITEM', 'NOSUB']),
        ('Menu item layout: pixels to leave for the checkmark (left) and '
         'the Amiga-key shortcut (right); LOW for a low-resolution screen',
         'intuition/intuition.h',
         ['CHECKWIDTH', 'COMMWIDTH', 'LOWCHECKWIDTH', 'LOWCOMMWIDTH']),
        ('Gadget flags, activation and types', 'intuition/intuition.h',
         ['re:GFLG_\\w+', 're:GACT_\\w+', 're:GTYP_\\w+']),
        ('Screen types', 'intuition/screens.h',
         ['WBENCHSCREEN', 'PUBLICSCREEN', 'CUSTOMSCREEN']),
        ('Screen attributes: tags for OpenScreenTags', 'intuition/screens.h',
         ['re:SA_\\w+']),
        ('Overscan types: the value of SA_Overscan', 'intuition/screens.h',
         ['re:OSCAN_\\w+']),
        ('DrawInfo pen numbers: indexes into dri_Pens', 'intuition/screens.h',
         ['DETAILPEN', 'BLOCKPEN', 'TEXTPEN', 'SHINEPEN', 'SHADOWPEN', 'FILLPEN',
          'FILLTEXTPEN', 'BACKGROUNDPEN', 'HIGHLIGHTTEXTPEN', 'BARDETAILPEN',
          'BARBLOCKPEN', 'BARTRIMPEN', 'NUMDRIPENS']),
        ('Image attributes', 'intuition/imageclass.h', ['re:IA_\\w+']),
        ('sysiclass: attributes, sizes and which image', 'intuition/imageclass.h',
         ['re:SYSIA_\\w+', 're:SYSISIZE_\\w+', 're:[A-Z]+IMAGE', 'MENUCHECK', 'AMIGAKEY',
          'MENUMX', 'MENUSUB']),
        ('Image drawing states', 'intuition/imageclass.h', ['re:IDS_\\w+']),
        ('frameiclass frame types', 'intuition/imageclass.h', ['re:FRAME_\\w+']),
        ('Gadget attributes', 'intuition/gadgetclass.h',
         ['re:GA_\\w+', 're:PGA_\\w+', 're:STRINGA_\\w+', 're:LAYOUTA_\\w+']),
        ('Interconnection (icclass) attributes', 'intuition/icclass.h',
         ['re:ICA_\\w+', 're:ICTARGET_\\w+', 're:ICM_\\w+', 're:ICSPECIAL_\\w+']),
        ('BOOPSI root methods', 'intuition/classusr.h', ['re:OM_\\w+']),
    ]),
    (os.path.join(FFI, 'Exec.js'), 'ExecConsts', [
        ('Memory flags for AllocMem / AllocVec', 'exec/memory.h', ['re:MEMF_\\w+']),
        ('Break signals: add to an Exec.Wait mask so Ctrl-C ends the wait',
         'dos/dos.h', ['re:SIGBREAKF_\\w+']),
        ('Node types', 'exec/nodes.h', ['re:NT_\\w+']),
        ('Message port actions', 'exec/ports.h', ['re:PA_\\w+']),
        ('Device commands and flags', 'exec/io.h', ['re:CMD_\\w+', 're:IOF_\\w+']),
        ('Device errors: IORequest.error', 'exec/errors.h', ['re:IOERR_\\w+']),
    ]),
    (os.path.join(FFI, 'Dos.js'), 'DosConsts', [
        ('Open() modes', 'dos/dos.h', ['re:MODE_\\w+']),
        ('Seek() positions', 'dos/dos.h', ['re:OFFSET_\\w+']),
        ('Lock() types', 'dos/dos.h',
         ['SHARED_LOCK', 'ACCESS_READ', 'EXCLUSIVE_LOCK', 'ACCESS_WRITE']),
        ('Truth values', 'dos/dos.h', ['DOSTRUE', 'DOSFALSE']),
        ('Return codes for a program', 'dos/dos.h', ['re:RETURN_\\w+']),
        ('File protection bits', 'dos/dos.h', ['re:FIBF_\\w+']),
        ('IoErr() codes', 'dos/dos.h', ['re:ERROR_\\w+']),
    ]),
    (os.path.join(FFI, 'Graphics.js'), 'GraphicsConsts', [
        ('Drawing modes for SetDrMd', 'graphics/rastport.h',
         ['JAM1', 'JAM2', 'COMPLEMENT', 'INVERSVID']),
        ('Font styles and flags', 'graphics/text.h',
         ['FS_NORMAL', 're:FSF_\\w+', 're:FPF_\\w+']),
        ('BitMap flags for AllocBitMap', 'graphics/gfx.h', ['re:BMF_\\w+']),
    ]),
    (os.path.join(FFI, 'GadTools.js'), 'GadToolsConsts', [
        ('Gadget kinds', 'libraries/gadtools.h', ['re:\\w+_KIND']),
        ('Gadget tags', 'libraries/gadtools.h', ['re:GT[A-Z]*_\\w+']),
        ('Where a gadget\'s label goes', 'libraries/gadtools.h', ['re:PLACETEXT_\\w+']),
        ('NewMenu entry types', 'libraries/gadtools.h', ['re:NM_\\w+']),
    ]),
    (os.path.join(FFI, 'Asl.js'), 'AslConsts', [
        ('Requester types', 'libraries/asl.h',
         ['ASL_FileRequest', 'ASL_FontRequest', 'ASL_ScreenModeRequest']),
        ('File requester tags', 'libraries/asl.h', ['re:ASLFR_\\w+']),
        ('Font requester tags', 'libraries/asl.h', ['re:ASLFO_\\w+']),
        ('Screen mode requester tags', 'libraries/asl.h', ['re:ASLSM_\\w+']),
    ]),
    (os.path.join(FFI, 'Diskfont.js'), 'DiskfontConsts', [
        ('AvailFonts() flags', 'diskfont/diskfont.h', ['re:AFF_\\w+']),
    ]),
    (os.path.join(FFI, 'structs', 'TimerRequest.js'), 'TimerConsts', [
        ('Units: the second argument of OpenDevice', 'devices/timer.h', ['re:UNIT_\\w+']),
        ('Commands: TimerRequest.command', 'devices/timer.h', ['re:TR_\\w+']),
    ]),
]

BEGIN = '/* consts-begin - written by scripts/gen_consts.py from the NDK headers; do not edit */'
END = '/* consts-end */'


def literal(value, expr, headers=None):
    """How to write a value: as the header writes it where possible."""
    expr = expr.strip()
    plain = re.match(r'^\(?\s*(-?\s*(?:0[xX][0-9A-Fa-f]+|\d+))[uUlL]*\s*\)?$', expr)
    if plain:
        text = plain.group(1).replace(' ', '')
        if text.lower().startswith('0x'):
            return '0x' + text[2:].upper()
        return text
    # Another name for an existing constant: write it the same way.
    alias = re.match(r'^\(?\s*([A-Za-z_]\w*)\s*\)?$', expr)
    if alias and headers is not None and alias.group(1) in headers.raw:
        return literal(value, headers.raw[alias.group(1)][0][0], headers)
    if value >= 0xFFFF0000 and re.search(r'^\(?\s*-', expr):
        return str(value - (1 << 32))            # the header wrote a negative
    if value <= 0xFF and '0x' not in expr.lower():
        return str(value)                        # counted in decimal there
    if value > 0xFFFF:
        return '0x%08X' % value
    return '0x%04X' % value


def note(expr):
    """The header's expression, as a trailing comment; nothing for a
    plain number."""
    expr = ' '.join(expr.split())
    if re.match(r'^\(?\s*-?\s*(?:0[xX][0-9A-Fa-f]+|\d+)[uUlL]*\s*\)?$', expr):
        return ''
    while expr.startswith('(') and expr.endswith(')') and _balanced(expr[1:-1]):
        expr = expr[1:-1].strip()
    expr = re.sub(r'\s*([+|])\s*', r' \1 ', expr)
    expr = expr.replace('*/', '* /')
    return '   /* %s */' % expr


def _balanced(text):
    depth = 0
    for char in text:
        if char == '(':
            depth += 1
        elif char == ')':
            depth -= 1
            if depth < 0:
                return False
    return depth == 0


def build(headers, groups):
    """(lines of the table, [names]) for one table."""
    lines, names, seen = [], [], set()
    for title, header, selectors in groups:
        chosen = []
        in_header = headers.by_header.get(header, [])
        for selector in selectors:
            if selector.startswith('re:'):
                pattern = re.compile(selector[3:])
                matches = [n for n in in_header if pattern.fullmatch(n)]
            else:
                matches = [selector] if selector in in_header else []
                if not matches:
                    sys.stderr.write('gen_consts: %s is not defined in %s\n'
                                     % (selector, header))
            for name in matches:
                if name in seen or name.endswith('_Dummy'):
                    continue
                expr = next(e for e, h in headers.raw[name] if h == header)
                value = headers.evaluate(expr, (name,))
                if value is None:
                    continue
                seen.add(name)
                chosen.append((name, value, expr))
        if not chosen:
            continue
        width = max(len(name) for name, _v, _e in chosen) + 1
        if lines:
            lines.append('')
        lines.append('/* %s (%s) */' % (title, header))
        for name, value, expr in chosen:
            lines.append('%s %s,%s' % ((name + ':').ljust(width), literal(value, expr, headers),
                                      note(expr)))
            names.append(name)
    return lines, names


OLD_CLASS = r'static consts = class %s extends CEnumeration \{\s*static \{.*?\n    \}\n  \};'
NEW_CALL = r"static consts = CEnumeration\.lazy\('%s', \{\n(.*?)\n  \}\);"


def render(text, class_name, lines):
    """The file's text with its table replaced."""
    body = '\n'.join(('    ' + line) if line else '' for line in [BEGIN] + lines + [END])
    call = "static consts = CEnumeration.lazy('%s', {\n%s\n  });" % (class_name, body)

    current = re.search(NEW_CALL % re.escape(class_name), text, re.S)
    if current:
        return text[:current.start()] + call + text[current.end():]
    old = re.search(OLD_CLASS % re.escape(class_name), text, re.S)
    if old:
        return text[:old.start()] + call + text[old.end():]
    raise SystemExit('gen_consts: no consts table for %s found' % class_name)


def main(argv):
    check = '--check' in argv
    listing = '--list' in argv
    headers = Headers()
    stale = 0

    for rel, class_name, groups in MANIFEST:
        path = os.path.join(ROOT, rel)
        with open(path, encoding='utf-8') as handle:
            text = handle.read()
        lines, names = build(headers, groups)

        if listing:
            print('%s  %s  (%d)' % (rel, class_name, len(names)))
            print('  ' + ' '.join(names))
            continue

        # Names a table had before must still be there: scripts use them.
        before = set(re.findall(r"%s\.define\('(\w+)'" % re.escape(class_name), text))
        lost = sorted(before - set(names))
        if lost:
            sys.stderr.write('gen_consts: %s would lose %s\n' % (class_name, ', '.join(lost)))

        new = render(text, class_name, lines)
        if new != text:
            stale += 1
            if check:
                print('stale: %s' % rel)
            else:
                with open(path, 'w', encoding='utf-8') as handle:
                    handle.write(new)
                print('wrote %s  %s  (%d constants)' % (rel, class_name, len(names)))
        elif not check:
            print('same  %s  %s  (%d constants)' % (rel, class_name, len(names)))

    return 1 if (check and stale) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
