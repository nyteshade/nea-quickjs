#!/usr/bin/env python3
"""Compare the attribute TYPES in the Reaction wrappers with the headers.

Usage:
    python3 scripts/check_attr_types.py            # problems + summary
    python3 scripts/check_attr_types.py --verbose  # also what matched
    python3 scripts/check_attr_types.py --untyped  # also the attributes
                                                   # whose header gives
                                                   # no type
    python3 scripts/check_attr_types.py FILE...    # only these wrappers

Exit status is 1 if any type disagrees with its header, else 0.

Why this exists: scripts/check_constants.py proves that `tagID` is the
right number. It says nothing about `type`, and a wrong type does not
fail loudly either:

    text:  { tagID: X.Text,  type: 'int32' }   a JS string becomes 0
    left:  { tagID: X.Left,  type: 'uint32' }  -1 reads back 4294967295
    image: { tagID: X.Image, type: 'bool' }    any pointer becomes 1

A pass by hand at 0.224 fixed nine of these and was not kept. This is
that pass, as a script.

How it works:

  1. Each wrapper under quickjs-master/amiga/ffi/boopsi is read for its
     ATTRS entries, `name: { tagID: TABLE.Key, type: '...' }`. TABLE.Key
     is tied to a header name exactly as check_constants.py ties it
     (same code), so the two scripts cannot disagree about which
     #define an entry means.

  2. The NDK headers put the C type of an attribute in a comment after
     its #define, in brackets:

         #define CHOOSER_PopUp   (CHOOSER_Dummy+1)
             /* (BOOL) Make it a popup menu.  Defaults to TRUE. */

     That note is read for every #define. The autodocs
     (sdks/NDK3.2R4/Autodocs/*.doc) give the type the same way,
     `CHOOSER_PopUp (BOOL)` at the head of the attribute's entry, and
     are read as well: about a hundred attributes have a type there and
     none in the header.

     The sources do not always agree. integer.h says INTEGER_SkipVal is
     (BOOL) and describes an amount; integer_gc.doc says (WORD). When
     they disagree the wrapper may follow any of them, and --verbose
     shows the disagreement.

  3. The C type is sorted into a kind, and the wrapper's type must be
     one that kind allows:

         C type in the header              wrapper type
         BOOL                              bool
         STRPTR, char *, UBYTE *           string, string-owned, ptr
         any other pointer, APTR, BPTR     ptr
         BYTE, WORD, LONG, int             int32, enum
         UBYTE, UWORD, ULONG, Tag          uint32, int32, enum

     An unsigned C type may be 'int32': the 32 bits written are the
     same, and only a value above 0x7FFFFFFF would read back wrong,
     which a count or an index never is. A signed C type may not be
     'uint32': -1 is an ordinary value for those.

  4. Each wrapper's class library is looked up in the pragma files:
     the function that returns the class (XXX_GetClass) must be at the
     wrapper's `_classLibLvo` (-30 unless it says otherwise).

A header is not always right, or the wrapper knows better (the header
says UWORD and the class really takes a signed value). Say so on the
entry's line, with the reason:

    top: { tagID: X.Top, type: 'int32' },  /* check-attr-types: ok - reason */

Attributes whose header gives no type note are counted as "untyped";
--untyped lists them for a person to look at.
"""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_constants as cc    # noqa: E402  (the path line must come first)

ROOT = cc.ROOT
HEADERS = cc.HEADERS
WRAPPERS = os.path.join(ROOT, 'quickjs-master', 'amiga', 'ffi', 'boopsi')

# What each kind of C type allows the wrapper to say.
ALLOWED = {
    'bool':     {'bool'},
    'string':   {'string', 'string-owned', 'ptr'},
    'pointer':  {'ptr'},
    'signed':   {'int32', 'enum'},
    'unsigned': {'uint32', 'int32', 'enum'},
}

SIGNED = {'BYTE', 'WORD', 'LONG', 'SHORT', 'INT', 'INT8', 'INT16', 'INT32',
          'SIGNED', 'COUNT'}
UNSIGNED = {'UBYTE', 'UWORD', 'ULONG', 'USHORT', 'UINT8', 'UINT16', 'UINT32',
            'UNSIGNED', 'TAG', 'UCOUNT', 'ULONG32', 'UNSIGNED LONG',
            'UNSIGNED SHORT', 'UNSIGNED INT', 'UNSIGNED CHAR', 'CHAR',
            'UINT', 'TEXT', 'UCHAR'}
STRINGS = {'STRPTR', 'CONST_STRPTR', 'CONST STRPTR', 'CHAR *', 'UBYTE *',
           'CONST CHAR *', 'CONST UBYTE *', 'TEXT *', 'UCHAR *'}
POINTERS = {'APTR', 'BPTR', 'CONST_APTR', 'APRR'}   # APRR: chooser.h's typo


def kind_of(c_type):
    """Sort the C type of a header note into a kind, or None if the
    note is not a type this script knows."""
    text = re.sub(r'\s+', ' ', c_type.strip()).upper()
    text = re.sub(r'\s*\*', ' *', text)           # "char*" and "char  *"
    if text in ('BOOL', 'BOOLEAN'):
        return 'bool'
    if text in STRINGS:
        return 'string'
    if text.endswith('*') or text in POINTERS:
        return 'pointer'
    if text in SIGNED:
        return 'signed'
    if text in UNSIGNED:
        return 'unsigned'
    return None


# ---------------------------------------------------------------- headers

DEFINE_LINE = re.compile(r'^[ \t]*#[ \t]*define[ \t]+([A-Za-z_]\w*)\b(.*)$')
NOTE = re.compile(r'/\*+\s*\(([^()]*)\)')


AUTODOCS = os.path.join(ROOT, 'sdks', 'NDK3.2R4', 'Autodocs')
# `    CHOOSER_PopUp (BOOL)` and texteditor's `    NAME -- [ISG], ULONG`
DOC_BRACKET = re.compile(r'^\s+([A-Z][A-Za-z0-9]*_\w+)\s+\(([^()]+)\)')
DOC_DASHES = re.compile(r'^\s+([A-Z][A-Za-z0-9]*_\w+)\s+--\s+\[[^\]]*\],\s*(.+?)\s*$')


def autodoc_notes(notes):
    """Add to `notes` the types the autodocs give: {name: [(C type
    text, file)]}. Only a type this script can sort is kept, so that
    `GA_Text (see below)` adds nothing."""
    for path in sorted(glob.glob(os.path.join(AUTODOCS, '*.doc'))):
        rel = os.path.join('Autodocs', os.path.basename(path))
        with open(path, encoding='latin-1') as handle:
            for line in handle:
                found = DOC_BRACKET.match(line) or DOC_DASHES.match(line)
                if not found or kind_of(found.group(2)) is None:
                    continue
                entry = (found.group(2).strip(), rel)
                listed = notes.setdefault(found.group(1), [])
                if entry[0] not in [c_type for c_type, _where in listed]:
                    listed.append(entry)
    return notes


def header_notes():
    """{header name: [(C type text, header file)]} for every #define
    that is followed by a comment opening with a bracketed type.

    The comment may be on the #define's own line or begin on one of
    the two lines after it; a blank line or another #define ends the
    search."""
    notes = {}
    for path in sorted(glob.glob(os.path.join(HEADERS, '**', '*.h'),
                                 recursive=True)):
        rel = os.path.relpath(path, HEADERS)
        if rel.split(os.sep)[0] in cc.SKIP_HEADER_DIRS:
            continue
        with open(path, encoding='latin-1') as handle:
            lines = handle.read().split('\n')
        for index, line in enumerate(lines):
            define = DEFINE_LINE.match(line)
            if not define:
                continue
            name = define.group(1)
            candidates = [define.group(2)]
            for following in lines[index + 1:index + 3]:
                if DEFINE_LINE.match(following) or not following.strip():
                    break
                candidates.append(following)
            for text in candidates:
                # only a comment that OPENS with the bracket is a type
                # note; "(see below)" in mid-sentence is not
                start = text.find('/*')
                if start < 0:
                    continue
                note = NOTE.match(text[start:])
                if note and name not in notes:
                    notes[name] = [(note.group(1).strip(), rel)]
                break
    return notes


# --------------------------------------------------------------- wrappers

ATTR = re.compile(r"""^\s*['"]?([A-Za-z_$][\w$]*)['"]?\s*:\s*\{\s*tagID:\s*"""
                  r"""([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?\s*,\s*"""
                  r"""type:\s*['"]([\w-]+)['"]""")
EXCUSED = re.compile(r'check-attr-types:\s*ok\b\s*-?\s*(.*?)\s*\*/')
IMPORT = re.compile(r"import\s*\{([^}]*)\}\s*from\s*'([^']+)'")
CLASS_LIB = re.compile(r"static\s+_classLibName\s*=\s*'([^']*)'")
CLASS_LVO = re.compile(r"static\s+_classLibLvo\s*=\s*(-?\d+)")
PUBLIC_ID = re.compile(r"static\s+_publicClassID\s*=\s*'([^']+)'")
CLASS_OPEN = re.compile(r"^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?")


def tables_of(path, matcher, cache):
    """{(table, key): header name or None} for the constant tables of
    one wrapper file, tied to the headers by check_constants.py."""
    if path not in cache:
        by_table = {}
        for entry in cc.read_js(path):
            by_table.setdefault(entry.table, []).append(entry)
        tied = {}
        for table, entries in by_table.items():
            matcher.resolve(entries)
            for entry in entries:
                ok = entry.status == 'ok'
                tied[(table, entry.key)] = entry.header_name if ok else None
        cache[path] = tied
    return cache[path]


def read_wrapper(path):
    """The ATTRS entries and class facts of one wrapper file.

    Returns (attrs, imports, classes):
      attrs    [(line, name, table, key, type, excuse)]; key is None for
               `tagID: SOME_CONSTANT`
      imports  {imported name: file it comes from}
      classes  [{'name', 'lib', 'lvo', 'public', 'line'}]
    """
    with open(path, encoding='utf-8') as handle:
        lines = handle.read().split('\n')
    attrs, imports, classes = [], {}, []
    for match in IMPORT.finditer('\n'.join(lines)):
        source = os.path.normpath(os.path.join(os.path.dirname(path),
                                               match.group(2)))
        for name in match.group(1).split(','):
            name = name.strip().split(' as ')[-1].strip()
            if name:
                imports[name] = source
    current = None
    for number, line in enumerate(lines, 1):
        opened = CLASS_OPEN.match(line)
        if opened:
            current = {'name': opened.group(1), 'lib': None, 'lvo': None,
                       'public': None, 'line': number,
                       'extends': opened.group(2)}
            classes.append(current)
        if current is not None:
            for pattern, field in ((CLASS_LIB, 'lib'), (CLASS_LVO, 'lvo'),
                                   (PUBLIC_ID, 'public')):
                found = pattern.search(line)
                if found and current[field] is None:
                    value = found.group(1)
                    current[field] = int(value) if field == 'lvo' else value
        attr = ATTR.match(line)
        if attr:
            excuse = EXCUSED.search(line)
            attrs.append((number, attr.group(1), attr.group(2), attr.group(3),
                          attr.group(4), excuse.group(1) if excuse else None))
    return attrs, imports, classes


def wrapper_files(arguments):
    if arguments:
        return [os.path.abspath(a) for a in arguments]
    return sorted(glob.glob(os.path.join(WRAPPERS, '**', '*.js'),
                            recursive=True))


def class_function(headers, library):
    """(function name, offset, pragma file) of the function that returns
    the class of `library` ('gadgets/button.gadget'), or None.

    The pragma file is named for the library; the function is the one
    called *_GetClass with the lowest offset (layout.gadget has two)."""
    base = os.path.basename(library).split('.')[0]
    wanted = os.path.join('pragmas', base + '_pragmas.h')
    best = None
    for name, offsets in headers.offsets.items():
        if not name.endswith('_GetClass'):
            continue
        for offset, pragma in offsets.items():
            if pragma == wanted and (best is None or offset < best[1]):
                best = (name, offset, pragma)
    return best


def main(argv):
    verbose = '--verbose' in argv
    show_untyped = '--untyped' in argv
    paths = wrapper_files([a for a in argv if not a.startswith('--')])

    headers = cc.Headers()
    matcher = cc.Matcher(headers)
    notes = autodoc_notes(header_notes())
    cache = {}

    counts = {'ok': 0, 'wrong': 0, 'untyped': 0, 'excused': 0, 'untied': 0}
    problems = 0

    for path in paths:
        rel = os.path.relpath(path, ROOT)
        attrs, imports, classes = read_wrapper(path)
        own = tables_of(path, matcher, cache)
        lines = []

        for number, name, table, key, js_type, excuse in attrs:
            # Which file defines the table? This one, or an import.
            source = own
            if key is not None and not any(t == table for t, _k in own):
                if table in imports and os.path.isfile(imports[table]):
                    source = tables_of(imports[table], matcher, cache)
            if key is None:
                # `tagID: ICA_TARGET`: a constant, its own header name
                header_name = table if table in headers.raw else None
            else:
                header_name = source.get((table, key))

            if header_name is None:
                counts['untied'] += 1
                lines.append('  UNTIED line %d: %s - %s%s is not tied to a '
                             'header name (run check_constants.py)'
                             % (number, name, table, '.' + key if key else ''))
                problems += 1
                continue

            # Every source that gives a type this script can sort.
            given = [(c_type, where, kind_of(c_type))
                     for c_type, where in notes.get(header_name, [])]
            typed = [g for g in given if g[2] is not None]
            said = ', '.join('(%s) in %s' % (c_type, where)
                             for c_type, where, _kind in typed)

            if excuse is not None:
                counts['excused'] += 1
                if verbose:
                    lines.append('  excused %s: %s (%s)'
                                 % (name, header_name, excuse or 'no reason'))
                if not excuse:
                    lines.append('  WRONG line %d: %s - check-attr-types: ok '
                                 'needs its reason' % (number, name))
                    problems += 1
                continue
            if not typed:
                counts['untyped'] += 1
                if show_untyped:
                    lines.append("  untyped line %d: %s '%s' - %s has %s"
                                 % (number, name, js_type, header_name,
                                    'the note (%s)' % given[0][0] if given
                                    else 'no type note'))
                continue
            if any(js_type in ALLOWED[kind] for _t, _w, kind in typed):
                counts['ok'] += 1
                if verbose:
                    disagree = len({kind for _t, _w, kind in typed}) > 1
                    lines.append("  ok   %s '%s' - %s is %s%s"
                                 % (name, js_type, header_name, said,
                                    '  (the sources disagree)' if disagree
                                    else ''))
            else:
                counts['wrong'] += 1
                problems += 1
                wanted = sorted({t for _t, _w, kind in typed
                                 for t in ALLOWED[kind]})
                lines.append("  WRONG line %d: %s is '%s', but %s is %s: use %s"
                             % (number, name, js_type, header_name, said,
                                ' or '.join("'%s'" % t for t in wanted)))

        for info in classes:
            if not info['lib'] or info['public']:
                continue            # a base class, or a class found by name
            lvo = info['lvo'] if info['lvo'] is not None else -30
            found = class_function(headers, info['lib'])
            if found is None:
                lines.append('  note: %s - no pragma file gives a *_GetClass '
                             'for %s; its vector offset %d is unchecked'
                             % (info['name'], info['lib'], lvo))
                continue
            names = [n for n, offsets in headers.offsets.items()
                     if n.endswith('_GetClass') and offsets.get(-lvo) == found[2]]
            if names:
                if verbose:
                    lines.append('  ok   %s: %s is at %d (%s)'
                                 % (info['name'], names[0], lvo, found[2]))
            else:
                problems += 1
                lines.append('  WRONG line %d: %s calls vector %d of %s, but '
                             '%s is at %d (%s)'
                             % (info['line'], info['name'], lvo, info['lib'],
                                found[0], -found[1], found[2]))

        if lines:
            print(rel)
            print('\n'.join(lines))

    print()
    print('%d files: ok %d   WRONG %d   untied %d   excused %d   untyped %d'
          % (len(paths), counts['ok'], counts['wrong'], counts['untied'],
             counts['excused'], counts['untyped']))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
