#!/usr/bin/env python3
"""Compare the numeric constants in our JavaScript with the NDK headers.

Usage:
    python3 scripts/check_constants.py              # summary + problems
    python3 scripts/check_constants.py --verbose    # also list what matched
    python3 scripts/check_constants.py --unverified # also list what could
                                                    # not be tied to a header
    python3 scripts/check_constants.py FILE...      # only these JS files
    python3 scripts/check_constants.py --fix FILE...# rewrite each MISMATCH
                                                    # in FILE to the header's
                                                    # value (files must be
                                                    # named; review the diff)

Exit status is 1 if any value differs from its header, else 0.

Why this exists: constant tables in this project were typed by hand, and
a wrong value does not fail loudly - the OS just does something else
(WA_SimpleRefresh carried WA_PubScreen's value for months). Nobody
should have to trust a typed number, or a comment next to one.

How it works:

  1. Every `#define NAME expr` and every `enum { ... }` under
     sdks/NDK3.2R4/Include_H is read and evaluated to a 32-bit value.
     Expressions may use other defines, casts, shifts and arithmetic.

  2. Every `KEY: number` entry and every `.define('KEY', number)` call
     in the JS files is collected, with the table it belongs to (the
     nearest enclosing `const X = ...{`, `static X = ...{` or
     `class X`).

  3. Each entry is tied to a header name:
       - a KEY that is itself a header name (WA_Left, MEMF_CLEAR) is
         compared directly;
       - a short KEY (Min, in a table of slider attributes) is tied to
         PREFIX + KEY, where PREFIX is whatever prefix makes the most
         keys of that table match header names (SLIDER_).

  4. Each entry is then reported as one of:
       ok          same value as the header
       MISMATCH    the header says something else
       unverified  no header name could be tied to it; a person has to
                   look (see --unverified)

A table can state its prefix outright, which beats guessing, with a
comment anywhere inside or just above it:

    /* check-constants: prefix SLIDER_ */
    /* check-constants: prefix BVS_ header images/bevel.h */
    /* check-constants: skip */            (not an OS constant table)

and a single line can be excused with a trailing
`/* check-constants: skip */`, or tied to a header name that its key
does not resemble with a trailing `/* check-constants: is BVS_SBAR_HORIZ */`.
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEADERS = os.path.join(ROOT, 'sdks', 'NDK3.2R4', 'Include_H')

# Compiler glue, not definitions.
SKIP_HEADER_DIRS = {'inline', 'pragma', 'pragmas', 'proto', 'clib'}

JS_ROOTS = [
    os.path.join(ROOT, 'quickjs-master', 'amiga', 'ffi'),
    os.path.join(ROOT, 'quickjs-master', 'amiga', 'extended', 'extended.js'),
    os.path.join(ROOT, 'amiga', 'examples'),
]

MASK = 0xFFFFFFFF


# ---------------------------------------------------------------- headers

COMMENT = re.compile(r'/\*.*?\*/', re.S)
LINE_COMMENT = re.compile(r'//[^\n]*')
DEFINE = re.compile(r'^[ \t]*#[ \t]*define[ \t]+([A-Za-z_]\w*)(\([^)]*\))?[ \t]+(.+?)[ \t]*$',
                    re.M)
ENUM = re.compile(r'\benum\b[^{;]*\{([^}]*)\}', re.S)
CAST = re.compile(r'\(\s*(?:unsigned\s+|signed\s+)?(?:ULONG|LONG|UWORD|WORD|UBYTE|BYTE|'
                  r'APTR|STRPTR|long|int|short|char|unsigned|ULONG\s*\*|Tag|BOOL|'
                  r'uint32|int32|uint16|int16|uint8|int8)\s*\)')
NUMBER = re.compile(r'\b(0[xX][0-9A-Fa-f]+|\d+)[uUlL]*\b')
IDENT = re.compile(r'\b[A-Za-z_]\w*\b')
SAFE = re.compile(r'^[0-9xXa-fA-F\s()+\-*/|&~<>^]*$')


class Headers:
    """Every constant the NDK defines, by name."""

    def __init__(self):
        self.raw = {}        # name -> [(expr, header)]
        self.cache = {}      # name -> value or None
        self.where = {}      # name -> header (first definition)
        self.by_header = {}  # header -> [names]
        self._load()
        self._load_offsets()

    def _load(self):
        for path in sorted(glob.glob(os.path.join(HEADERS, '**', '*.h'),
                                     recursive=True)):
            rel = os.path.relpath(path, HEADERS)
            if rel.split(os.sep)[0] in SKIP_HEADER_DIRS:
                continue
            with open(path, encoding='latin-1') as handle:
                text = handle.read()
            text = text.replace('\\\n', ' ')
            text = COMMENT.sub(' ', text)
            text = LINE_COMMENT.sub('', text)

            # A header may #undef a name and define it again part way
            # down (texteditor.h does, for TEXTEDITOR_Dummy). Defines
            # after that point mean the NEW value, so once a name has
            # been defined twice in a file, later uses of it in that
            # file are replaced by its latest expression on the spot.
            in_file = {}                 # name -> latest expr in this file
            redefined = set()
            for name, params, expr in DEFINE.findall(text):
                if params:
                    continue             # a function-like macro
                if redefined:
                    expr = IDENT.sub(
                        lambda m: '(%s)' % in_file[m.group(0)]
                        if m.group(0) in redefined else m.group(0), expr)
                if name in in_file:
                    redefined.add(name)
                in_file[name] = expr
                self._add(name, expr, rel)

            for body in ENUM.findall(text):
                previous = None
                for item in body.split(','):
                    item = item.strip()
                    if not item:
                        continue
                    if '=' in item:
                        name, expr = [part.strip() for part in item.split('=', 1)]
                    else:
                        name = item
                        expr = '0' if previous is None else '(%s)+1' % previous
                    if not re.match(r'^[A-Za-z_]\w*$', name):
                        break
                    self._add(name, expr, rel)
                    previous = name

    def _load_offsets(self):
        """Library vector offsets, from the pragma files:
        `#pragma libcall IntuitionBase OpenWindow cc 801` puts OpenWindow
        at -0xcc from the library base."""
        self.offsets = {}    # function name -> {offset: header}
        pattern = re.compile(r'#pragma\s+(?:libcall|tagcall|syscall)\s+(?:\w+\s+)?'
                             r'(\w+)\s+([0-9A-Fa-f]+)\s+[0-9A-Fa-f]+\s*$', re.M)
        for path in sorted(glob.glob(os.path.join(HEADERS, 'pragmas', '*.h'))):
            with open(path, encoding='latin-1') as handle:
                text = handle.read()
            rel = os.path.relpath(path, HEADERS)
            for name, offset in pattern.findall(text):
                self.offsets.setdefault(name, {})[int(offset, 16)] = rel

    def _add(self, name, expr, header):
        self.raw.setdefault(name, []).append((expr, header))
        self.where.setdefault(name, header)
        self.by_header.setdefault(header, []).append(name)

    def value(self, name, _seen=()):
        """The value of a define, or None if it is not a plain number."""
        if name in self.cache:
            return self.cache[name]
        if name not in self.raw or name in _seen:
            return None
        result = self.evaluate(self.raw[name][0][0], _seen + (name,))
        self.cache[name] = result
        return result

    def evaluate(self, expr, _seen=()):
        expr = CAST.sub('', expr)
        expr = NUMBER.sub(lambda m: m.group(1), expr)

        failed = []

        def substitute(match):
            word = match.group(0)
            if re.match(r'^0[xX][0-9A-Fa-f]+$', word):
                return word
            inner = self.value(word, _seen)
            if inner is None:
                failed.append(word)
                return '0'
            return str(inner)

        expr = IDENT.sub(substitute, expr)
        if failed or not expr.strip() or not SAFE.match(expr):
            return None
        try:
            result = eval(expr, {'__builtins__': {}}, {})   # digits and operators only
        except Exception:
            return None
        if not isinstance(result, int):
            return None
        return result & MASK

    def all_values(self, name):
        """Every distinct value a name is given across the headers."""
        values = []
        for expr, _header in self.raw.get(name, []):
            value = self.evaluate(expr, (name,))
            if value is not None and value not in values:
                values.append(value)
        return values


# --------------------------------------------------------------------- JS

JS_TOKEN = re.compile(
    r"""(/\*.*?\*/|//[^\n]*)"""
    r"""|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)""", re.S)

VALUE = r"""(\(?\s*-?(?:0[xX][0-9A-Fa-f]+|\d+)(?:\s*(?:<<|>>|\+|-|\||\*)\s*(?:0[xX][0-9A-Fa-f]+|\d+))*\s*\)?)"""
ENTRY = re.compile(r"""(?:^|[{,(\s])(['"]?)([A-Za-z_$][\w$]*)\1\s*:\s*""" + VALUE + r"""\s*(?=[,}\n/])""")
DEFINE_CALL = re.compile(r"""\.define\(\s*['"]([A-Za-z_]\w*)['"]\s*,\s*""" + VALUE + r"""\s*[,)]""")
# `const WM_OPEN = n;` and also `const PGA_Freedom = n;`: header names are
# not all upper case.
CONST = re.compile(r"""^\s*(?:export\s+)?const\s+([A-Z][A-Za-z0-9]*_[A-Za-z0-9_]+)\s*=\s*""" + VALUE + r"""\s*;""")
# A number standing alone in code, tied to nothing by its position:
# `tag === 0x8003000F`, `amiga.call(base, -48, ...)`. Only two shapes are
# taken for possible OS constants: a hex literal above 0xFF that is not
# an all-ones mask, and a negative multiple of 6 from -30 down (a library
# vector offset). Such a line needs `check-constants: is NAME` or
# `check-constants: skip` with the reason beside it.
BARE = re.compile(r"""(?<![\w.$])(-\s*\d+|0[xX][0-9A-Fa-f]+)\b""")
GENERATED_BEGIN = 'consts-begin'
GENERATED_END = 'consts-end'
TABLE_OPEN = re.compile(r"""(?:const|let|var|static)\s+([A-Za-z_$][\w$]*)\s*=[^=;]*\{\s*$"""
                        r"""|class\s+([A-Za-z_$][\w$]*)[^{]*\{\s*$""")
DIRECTIVE = re.compile(r'check-constants:\s*(skip|prefix\s+(\S+)(?:\s+header\s+(\S+))?)')
IS_NAME = re.compile(r'check-constants:\s*is\s+([A-Za-z_]\w*)')


def js_number(text):
    text = text.strip()
    if not re.match(r'^[0-9xXa-fA-F\s()+\-*|<>]+$', text):
        return None
    try:
        return eval(text, {'__builtins__': {}}, {}) & MASK
    except Exception:
        return None


def blank_comments(line_text):
    """Remove comments and string contents from one line."""
    def blank(match):
        return '' if match.group(1) else match.group(0)
    return JS_TOKEN.sub(blank, line_text)


class Entry:
    def __init__(self, path, line, table, key, value, forced_prefix, header_hint):
        self.path, self.line, self.table = path, line, table
        self.key, self.value = key, value
        self.forced_prefix, self.header_hint = forced_prefix, header_hint
        self.defined = False    # came from a .define('KEY', n) call
        self.generated = False  # lies between gen_consts.py's markers
        self.bare = False       # a literal alone in code, with no key
        self.status = None      # 'ok' | 'mismatch' | 'unverified'
        self.header_name = None
        self.expected = None
        self.note = ''


def read_js(path):
    """Every numeric constant entry in a JS file."""
    bare_literals = not path.endswith('extended.js')
    with open(path, encoding='utf-8', errors='replace') as handle:
        raw_lines = handle.read().split('\n')

    entries = []
    stack = []               # [(table name, brace depth at open, directive)]
    depth = 0
    pending = None           # a directive on a comment line before a table
    in_block_comment = False
    generated = False        # between gen_consts.py's two markers
    in_template = False      # inside a `...` string that spans lines

    for number, raw in enumerate(raw_lines, 1):
        directive = DIRECTIVE.search(raw)
        if GENERATED_BEGIN in raw:
            generated = True
        elif GENERATED_END in raw:
            generated = False

        # Track block comments so entries inside doc comments are ignored.
        code = raw
        if in_block_comment:
            end = code.find('*/')
            if end < 0:
                if directive:
                    pending = directive
                continue
            code = code[end + 2:]
            in_block_comment = False
        code = blank_comments(code)
        if '/*' in code:
            code = code[:code.index('/*')]
            in_block_comment = True

        if directive and not code.strip():
            pending = directive
            if stack and stack[-1][2] is None:
                stack[-1] = (stack[-1][0], stack[-1][1], directive)
            continue

        # For the bare-literal search, strings are text, not code. One
        # that closes on its own line is removed here; a template that
        # runs on leaves a lone backquote, which opens or closes it.
        plain = JS_TOKEN.sub('', code)
        text_only = False        # the whole line is inside a template
        if in_template:
            close = plain.find('`')
            plain = '' if close < 0 else plain[close + 1:]
            in_template = close < 0
            text_only = in_template
        if '`' in plain:
            plain = plain[:plain.index('`')]
            in_template = True

        opened = TABLE_OPEN.search(code)
        line_skip = bool(directive and directive.group(1) == 'skip' and code.strip())

        def table_state():
            name, forced, hint, skip = '(top level)', None, None, False
            for table_name, _depth, table_directive in stack:
                name = table_name
                if table_directive is not None:
                    if table_directive.group(1) == 'skip':
                        skip = True
                    else:
                        forced, hint = table_directive.group(2), table_directive.group(3)
            return name, forced, hint, skip

        if not line_skip and not text_only:
            found = []
            defined_keys = set()
            for match in DEFINE_CALL.finditer(code):
                found.append((match.group(1), match.group(2)))
                defined_keys.add(match.group(1))
            if not found:
                constant = CONST.match(code)
                if constant:
                    found.append((constant.group(1), constant.group(2)))
            if not found and not opened:
                for match in ENTRY.finditer(code):
                    found.append((match.group(2), match.group(3)))

            name, forced, hint, skip = table_state()
            # Structure offset tables are check_structs.py's business:
            # it asks the compiler, which this script cannot.
            if name == 'OFFSET':
                skip = True
            if not skip:
                for key, value_text in found:
                    value = js_number(value_text)
                    if value is None:
                        continue
                    entry = Entry(path, number, name, key, value, forced, hint)
                    entry.defined = key in defined_keys
                    entry.generated = generated
                    named = IS_NAME.search(raw)
                    entry.is_name = named.group(1) if named else None
                    entries.append(entry)

                # Numbers on this line that no entry accounts for. Only
                # in the FFI wrappers and the examples: extended.js is
                # full of hex that is arithmetic (UTF-16, SHA-256).
                if not found and bare_literals:
                    named = IS_NAME.search(raw)
                    for match in BARE.finditer(plain):
                        text = match.group(1).replace(' ', '')
                        value = int(text, 0)
                        if text.startswith('-'):
                            if value > -30 or value % 6:
                                continue
                        elif value <= 0xFF or (value & (value + 1)) == 0:
                            continue
                        entry = Entry(path, number, name, text, value & MASK,
                                      None, None)
                        entry.bare = True
                        entry.is_name = named.group(1) if named else None
                        entries.append(entry)

        for char in code:
            if char == '{':
                depth += 1
            elif char == '}':
                while stack and stack[-1][1] == depth:
                    stack.pop()
                depth = max(0, depth - 1)

        if opened:
            table_name = opened.group(1) or opened.group(2)
            # The brace that opened it is the last '{' counted above.
            stack.append((table_name, depth, pending))
            pending = None
        elif code.strip():
            pending = None

    return entries


# --------------------------------------------------------------- matching

def squash(text):
    return text.replace('_', '').lower()


class Matcher:
    def __init__(self, headers):
        self.headers = headers
        self.by_suffix = {}          # squashed suffix -> [(prefix, name)]
        for name in headers.raw:
            parts = name.split('_')
            for cut in range(1, len(parts)):
                prefix = '_'.join(parts[:cut]) + '_'
                suffix = squash('_'.join(parts[cut:]))
                self.by_suffix.setdefault(suffix, []).append((prefix, name))

    def candidates(self, key):
        return self.by_suffix.get(squash(key), [])

    def resolve(self, entries):
        """Tie each entry of one table to a header name."""
        direct, short = [], []
        for entry in entries:
            # A small negative multiple of 6 named after a library
            # function is a vector offset: check it against the pragmas.
            signed = entry.value - (1 << 32) if entry.value & 0x80000000 else entry.value
            if -6000 <= signed <= -6 and signed % 6 == 0 and entry.key in self.headers.offsets:
                known = self.headers.offsets[entry.key]
                if -signed in known:
                    entry.status = 'ok'
                    entry.header_name = entry.key
                    entry.offset_header = known[-signed]
                else:
                    entry.status = 'mismatch'
                    entry.header_name = entry.key
                    entry.expected = (-sorted(known)[0]) & MASK
                    entry.offset_header = sorted(known.values())[0]
                continue
            if getattr(entry, 'is_name', None):
                # `is OpenWindow` beside a negative number names a
                # library function: check its vector offset.
                known = self.headers.offsets.get(entry.is_name)
                if known and signed < 0:
                    entry.header_name = entry.is_name
                    if -signed in known:
                        entry.status = 'ok'
                        entry.offset_header = known[-signed]
                    else:
                        entry.status = 'mismatch'
                        entry.expected = (-sorted(known)[0]) & MASK
                        entry.offset_header = sorted(known.values())[0]
                    continue
                self._compare(entry, entry.is_name)
                continue
            if entry.bare:
                entry.status = 'unverified'
                entry.note = 'a bare literal: name it, or say `is NAME` / `skip`'
                continue
            # Between gen_consts.py's markers every key is a header name
            # in full, underscore or not (JAM1, TEXTPEN, SELECTDOWN).
            if entry.key in self.headers.raw and ('_' in entry.key or entry.generated or
                    (entry.key.isupper() and len(entry.key) >= 4 and entry.defined)):
                direct.append(entry)
            else:
                short.append(entry)

        for entry in direct:
            self._compare(entry, entry.key)

        if not short:
            return

        forced = short[0].forced_prefix
        prefixes = [forced] if forced else self._vote(short)

        # Without a stated prefix, a table only counts as an OS constant
        # table if its best prefix AGREES with the headers for at least
        # a quarter of the keys it explains (and for two or more). Otherwise
        # the keys are ordinary property names that happen to resemble
        # header names - `innerWidth: 300` is not BEVEL_InnerWidth - and
        # calling them mismatches would bury the real ones.
        if not forced:
            trusted = []
            for prefix in prefixes:
                explained = agreed = 0
                for entry in short:
                    names = [n for p, n in self.candidates(entry.key) if p == prefix]
                    if not names:
                        continue
                    explained += 1
                    if any(entry.value in self.headers.all_values(n) for n in names):
                        agreed += 1
                # A quarter, not a half: a table typed from memory can be
                # mostly wrong (GetScreenMode had 14 of 25 wrong) and must
                # still be recognised. A lone entry counts if it agrees.
                if (agreed >= 2 and agreed * 4 >= explained) or \
                   (len(short) == 1 and agreed == 1):
                    trusted.append(prefix)
            prefixes = trusted

        for entry in short:
            chosen = None
            for prefix in prefixes:
                for candidate_prefix, name in self.candidates(entry.key):
                    if candidate_prefix != prefix:
                        continue
                    if entry.header_hint and self.headers.where.get(name) != entry.header_hint:
                        continue
                    chosen = name
                    break
                if chosen:
                    break
            if chosen:
                self._compare(entry, chosen)
            else:
                entry.status = 'unverified'
                same = [name for _p, name in self.candidates(entry.key)
                        if entry.value in self.headers.all_values(name)]
                if same:
                    entry.note = 'same value as ' + ', '.join(sorted(set(same))[:3])

    def _vote(self, entries):
        """Prefixes that tie the most keys of a table to header names,
        best first. A prefix must explain at least two keys, or the only
        key, to count."""
        votes = {}
        for entry in entries:
            for prefix in {p for p, _n in self.candidates(entry.key)}:
                votes[prefix] = votes.get(prefix, 0) + 1
        # Prefer prefixes whose values also agree: that is what tells
        # SLIDER_ from SCROLLER_ when both have a Min.
        agree = {}
        for entry in entries:
            for prefix, name in self.candidates(entry.key):
                if entry.value in self.headers.all_values(name):
                    agree[prefix] = agree.get(prefix, 0) + 1
        need = 2 if len(entries) > 1 else 1
        ranked = [p for p in votes if votes[p] >= need]
        ranked.sort(key=lambda p: (-agree.get(p, 0), -votes[p], p))
        return ranked[:3]

    def _compare(self, entry, name):
        values = self.headers.all_values(name)
        entry.header_name = name
        if not values:
            entry.status = 'unverified'
            entry.note = name + ' is not a plain number in the headers'
        elif entry.value in values:
            entry.status = 'ok'
        else:
            entry.status = 'mismatch'
            entry.expected = values[0]


# ------------------------------------------------------------------- main

def fix_file(path, entries):
    """Rewrite the mismatched literals of one file to the header values.
    Returns how many were changed."""
    with open(path, encoding='utf-8') as handle:
        lines = handle.read().split('\n')
    changed = 0
    for entry in entries:
        if entry.status != 'mismatch':
            continue
        line = lines[entry.line - 1]
        pattern = re.compile(
            r"""((?:['"]?)""" + re.escape(entry.key) + r"""(?:['"]?)\s*[:,=]\s*\(?\s*)"""
            r"""(0[xX][0-9A-Fa-f]+|\d+)""")
        match = pattern.search(line)
        if not match:
            print('  could not rewrite line %d of %s' % (entry.line, path))
            continue
        old = match.group(2)
        if old.lower().startswith('0x'):
            new = '0x%0*X' % (len(old) - 2, entry.expected)
        else:
            new = str(entry.expected)
        lines[entry.line - 1] = line[:match.start(2)] + new + line[match.end(2):]
        changed += 1
    if changed:
        with open(path, 'w', encoding='utf-8') as handle:
            handle.write('\n'.join(lines))
    return changed


def js_files(arguments):
    if arguments:
        return [os.path.abspath(a) for a in arguments]
    files = []
    for root in JS_ROOTS:
        if os.path.isfile(root):
            files.append(root)
        else:
            files += sorted(glob.glob(os.path.join(root, '**', '*.js'), recursive=True))
    return files


def main(argv):
    verbose = '--verbose' in argv
    fix = '--fix' in argv
    if fix and not [a for a in argv if not a.startswith('--')]:
        print('--fix needs the files to rewrite named on the command line')
        return 2
    show_unverified = '--unverified' in argv
    paths = js_files([a for a in argv if not a.startswith('--')])

    headers = Headers()
    matcher = Matcher(headers)

    totals = {'ok': 0, 'mismatch': 0, 'unverified': 0}
    mismatches = []

    for path in paths:
        tables = {}
        for entry in read_js(path):
            tables.setdefault(entry.table, []).append(entry)

        rel = os.path.relpath(path, ROOT)
        for table, entries in tables.items():
            matcher.resolve(entries)
        if fix:
            count = fix_file(path, [e for es in tables.values() for e in es])
            if count:
                print('%s: rewrote %d value(s)' % (rel, count))
        for table, entries in tables.items():
            counts = {'ok': 0, 'mismatch': 0, 'unverified': 0}
            for entry in entries:
                counts[entry.status] += 1
                totals[entry.status] += 1

            # A table where nothing at all ties to a header is not an OS
            # constant table (pixel sizes, colours, ...): say so once.
            interesting = counts['ok'] or counts['mismatch']
            if not interesting and not show_unverified:
                continue

            source = sorted({getattr(e, 'offset_header', None) or headers.where[e.header_name]
                             for e in entries
                             if getattr(e, 'offset_header', None) or e.header_name in headers.where})
            if verbose or counts['mismatch'] or (show_unverified and counts['unverified']):
                print('%s  %s  [%d ok, %d MISMATCH, %d unverified]%s'
                      % (rel, table, counts['ok'], counts['mismatch'],
                         counts['unverified'],
                         '  <- ' + ', '.join(source) if source else ''))
            for entry in entries:
                if entry.status == 'mismatch':
                    text = ('  MISMATCH line %d: %s = 0x%X, but %s is 0x%X (%s)'
                            % (entry.line, entry.key, entry.value, entry.header_name,
                               entry.expected,
                               getattr(entry, 'offset_header', None) or headers.where[entry.header_name]))
                    print(text)
                    mismatches.append(rel + text)
                elif entry.status == 'unverified' and show_unverified:
                    print('  unverified line %d: %s = 0x%X%s'
                          % (entry.line, entry.key, entry.value,
                             '  (' + entry.note + ')' if entry.note else ''))
                elif entry.status == 'ok' and verbose:
                    print('  ok   %s = 0x%X  (%s)' % (entry.key, entry.value, entry.header_name))

    print()
    print('%d files, %d header names known' % (len(paths), len(headers.raw)))
    print('ok %d   MISMATCH %d   unverified %d'
          % (totals['ok'], totals['mismatch'], totals['unverified']))
    return 1 if totals['mismatch'] else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
