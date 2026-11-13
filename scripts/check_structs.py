#!/usr/bin/env python3
"""Compare the structure offsets in our JavaScript with the C compiler.

Usage:
    python3 scripts/check_structs.py             # check every wrapper
    python3 scripts/check_structs.py --layout Window   # print a layout
    python3 scripts/check_structs.py --verbose   # also list what matched

Exit status is 1 if any offset is wrong, else 0.

Why this exists: a struct wrapper reads a field with
`this.read16(Window.OFFSET.Width)`. If that number is wrong the script
reads (or writes) somebody else's memory, and nothing says so. The
numbers must come from the C headers, and the only authority on how a
header lays out a struct is the compiler.

How it works:

  1. Field NAMES are read from the struct's declaration in
     sdks/NDK3.2R4/Include_H (nested structs are followed, so
     `io_Message.mn_ReplyPort` is a field of struct IORequest).

  2. The OFFSET and SIZE of every field come from vbcc itself: a small
     C file of offsetof() and sizeof() expressions is compiled to
     assembly and the numbers are read back. Nothing here knows the
     Amiga's alignment rules; the compiler does.

  3. In each wrapper under quickjs-master/amiga/ffi/structs, a marker
     names the C struct:

         /* check-structs: struct Window */

     and a table gives the offsets the wrapper uses:

         static OFFSET = Object.freeze({
           Width:     8,
           ReplyPort: 14,     /* io_Message.mn_ReplyPort */
         });

     A key is the C field name. Where the field is inside a nested
     struct, or the key is friendlier than the C name, a comment on the
     same line gives the C path.

  4. Every table entry is compared with the compiler. Every
     `this.readN(...)` / `this.writeN(...)` in the file must go through
     the table, and N must match the field's size (reading 16 bits of
     a 32-bit field is reported). `static SIZE = n` is compared with
     sizeof.

  5. Every other file of the wrappers (the library wrappers, the
     BOOPSI classes) is searched for the same thing done by hand:
     `amiga.peekN(pointer + 4)` or `amiga.pokeN(pointer + OFFSET, ...)`.
     An address with something added to it is a field of a struct, and
     belongs in a wrapper with a checked table. Where it really is an
     element of a plain array, say so on that line or the one above:

         /* check-structs: a ULONG array */

Files with a marker are checked wherever they are under
quickjs-master/amiga/ffi; a struct wrapper need not live in structs/.

Needs vbcc: set VBCC, or have it at ~/vbcc.
"""
import glob
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEADERS = os.path.join(ROOT, 'sdks', 'NDK3.2R4', 'Include_H')
FFI = os.path.join(ROOT, 'quickjs-master', 'amiga', 'ffi')
STRUCTS = os.path.join(FFI, 'structs')
VBCC = os.environ.get('VBCC', os.path.expanduser('~/vbcc'))

SKIP_HEADER_DIRS = {'inline', 'pragma', 'pragmas', 'proto', 'clib'}

COMMENT = re.compile(r'/\*.*?\*/', re.S)
LINE_COMMENT = re.compile(r'//[^\n]*')


# ---------------------------------------------------------------- headers

class Declarations:
    """Where each struct is declared, and the names of its fields."""

    def __init__(self):
        self.text = {}       # header -> comment-free text
        self.where = {}      # struct name -> header
        self.bodies = {}     # struct name -> body text
        for path in sorted(glob.glob(os.path.join(HEADERS, '**', '*.h'),
                                     recursive=True)):
            rel = os.path.relpath(path, HEADERS)
            if rel.split(os.sep)[0] in SKIP_HEADER_DIRS:
                continue
            with open(path, encoding='latin-1') as handle:
                text = handle.read()
            text = LINE_COMMENT.sub('', COMMENT.sub(' ', text))
            self.text[rel] = text
            for match in re.finditer(r'\bstruct\s+(\w+)\s*\{', text):
                name = match.group(1)
                body = self._body(text, match.end())
                if body is not None and name not in self.bodies:
                    self.bodies[name] = body
                    self.where[name] = rel

    @staticmethod
    def _body(text, start):
        depth = 1
        for index in range(start, len(text)):
            if text[index] == '{':
                depth += 1
            elif text[index] == '}':
                depth -= 1
                if depth == 0:
                    return text[start:index]
        return None

    def fields(self, struct):
        """[(c_name, nested_struct_or_None)] in declaration order.
        Bitfields and anonymous members are left out."""
        body = self.bodies.get(struct)
        if body is None:
            return []
        # Drop preprocessor lines and inline struct/union definitions'
        # bodies, keeping the declarator that follows them.
        body = re.sub(r'^[ \t]*#.*$', '', body, flags=re.M)
        flat = ''
        depth = 0
        for char in body:
            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
            elif depth == 0:
                flat += char
        result = []
        for statement in flat.split(';'):
            statement = ' '.join(statement.split())
            if not statement or '(' in statement:
                continue                      # empty, or a function pointer
            nested = None
            match = re.match(r'^(?:const\s+)?struct\s+(\w+)\s+(.*)$', statement)
            declarators = statement
            if match:
                nested, declarators = match.group(1), match.group(2)
            else:
                parts = statement.split(' ')
                # the type is everything up to the last word of the first declarator
                declarators = statement
            for index, declarator in enumerate(declarators.split(',')):
                declarator = declarator.strip()
                if ':' in declarator:
                    continue                  # a bitfield
                pointer = '*' in declarator
                name_match = re.search(r'([A-Za-z_]\w*)\s*(\[[^\]]*\]\s*)*$', declarator)
                if not name_match:
                    continue
                name = name_match.group(1)
                array = '[' in declarator
                by_value = nested if (nested and not pointer and not array) else None
                result.append((name, by_value))
        return result

    def flatten(self, struct, prefix='', chain=(), seen=()):
        """Every field path of a struct, nested structs expanded, as
        [(path, [(struct, field), ...])]: the chain says which struct
        each step of the path belongs to."""
        paths = []
        for name, nested in self.fields(struct):
            path = prefix + name
            steps = chain + ((struct, name),)
            paths.append((path, steps))
            if nested and nested in self.bodies and nested not in seen:
                paths += self.flatten(nested, path + '.', steps, seen + (struct,))
        return paths


# --------------------------------------------------------------- compiler

def measure(declarations, struct):
    """({path: (offset, size)}, sizeof) for one struct, from vbcc."""
    header = declarations.where.get(struct)
    if header is None:
        return None, None
    paths = declarations.flatten(struct)
    lines = ['#include <stddef.h>', '#include <exec/types.h>',
             '#include <%s>' % header,
             'const unsigned long T[] = {',
             '  sizeof(struct %s),' % struct]
    for path, steps in paths:
        # vbcc's offsetof() does not take a nested path (a.b), and it
        # will not fold &((struct X *)0)->a.b either, so a nested
        # offset is the sum of one offsetof() per level.
        offset = ' + '.join('offsetof(struct %s, %s)' % step for step in steps)
        last_struct, last_field = steps[-1]
        lines.append('  %s, sizeof(((struct %s *)0)->%s),'
                     % (offset, last_struct, last_field))
    lines.append('};')

    with tempfile.TemporaryDirectory() as work:
        source = os.path.join(work, 'layout.c')
        output = os.path.join(work, 'layout.s')
        with open(source, 'w') as handle:
            handle.write('\n'.join(lines) + '\n')
        environment = dict(os.environ, VBCC=VBCC,
                           PATH=os.path.join(VBCC, 'bin') + os.pathsep + os.environ['PATH'])
        run = subprocess.run(['vc', '+aos68k', '-S', '-I' + HEADERS, source, '-o', output],
                             capture_output=True, text=True, env=environment)
        if run.returncode != 0 or not os.path.exists(output):
            sys.stderr.write('vbcc could not lay out struct %s:\n%s\n'
                             % (struct, run.stdout + run.stderr))
            return None, None
        with open(output) as handle:
            numbers = [int(n) for n in re.findall(r'^\s*dc\.l\s+(-?\d+)', handle.read(), re.M)]

    if len(numbers) != 1 + 2 * len(paths):
        sys.stderr.write('unexpected compiler output for struct %s\n' % struct)
        return None, None
    layout = {}
    for index, (path, _steps) in enumerate(paths):
        layout[path] = (numbers[1 + 2 * index], numbers[2 + 2 * index])
    return layout, numbers[0]


# --------------------------------------------------------------------- JS

MARKER = re.compile(r'check-structs:\s*struct\s+(\w+)')
TABLE = re.compile(r'static\s+OFFSET\s*=\s*Object\.freeze\(\{(.*?)\}\)', re.S)
TABLE_ENTRY = re.compile(r"""^\s*(['"]?)([A-Za-z_]\w*)\1\s*:\s*(\d+|0[xX][0-9A-Fa-f]+)\s*,?\s*"""
                         r"""(?:/\*\s*([\w.\[\]]+)(?:\s*\+\s*(\d+)\s+as\s+(\d+)\s+bytes?)?[^*]*\*/)?\s*$""")
ACCESS = re.compile(r'\b(?:this|[a-z]\w*)\.(read|write)(8|16|32)\(\s*([^,)]+)')
SIZE = re.compile(r'static\s+SIZE\s*=\s*(\d+)')


def check_file(path, declarations, verbose):
    with open(path, encoding='utf-8') as handle:
        text = handle.read()
    rel = os.path.relpath(path, ROOT)
    problems = []
    notes = []

    marker = MARKER.search(text)
    if not marker and not ACCESS.search(text):
        return None, [], []                  # not a struct wrapper at all
    if not marker:
        return None, ['%s: no "check-structs: struct NAME" marker' % rel], []
    struct = marker.group(1)
    layout, total = measure(declarations, struct)
    if layout is None:
        return struct, ['%s: struct %s not found in the headers' % (rel, struct)], []

    table = TABLE.search(text)
    names = {}
    if not table:
        problems.append('%s: no static OFFSET table' % rel)
    else:
        for line in table.group(1).split('\n'):
            if not line.strip() or line.strip().startswith(('/*', '*', '//')):
                continue
            entry = TABLE_ENTRY.match(line)
            if not entry:
                problems.append('%s: cannot read OFFSET line: %s' % (rel, line.strip()))
                continue
            key, value, c_path = entry.group(2), int(entry.group(3), 0), entry.group(4) or entry.group(2)
            if c_path not in layout:
                problems.append('%s: OFFSET.%s names %s, which struct %s does not have'
                                % (rel, key, c_path, struct))
                continue
            offset, size = layout[c_path]
            # "/* dri_Resolution + 2 as 2 bytes */": a member of an
            # unnamed struct inside the field, which the compiler cannot
            # be asked about by name. It must at least lie inside it.
            if entry.group(5) is not None:
                inner, inner_size = int(entry.group(5)), int(entry.group(6))
                if inner + inner_size > size:
                    problems.append('%s: OFFSET.%s reaches past the end of %s.%s'
                                    % (rel, key, struct, c_path))
                    continue
                offset, size = offset + inner, inner_size
                c_path = '%s + %d' % (c_path, inner)
            names[key] = (c_path, offset, size)
            if value != offset:
                problems.append('%s: OFFSET.%s = %d, but %s.%s is at %d'
                                % (rel, key, value, struct, c_path, offset))
            elif verbose:
                notes.append('  ok   %s.%s = %d (%d bytes)' % (struct, c_path, offset, size))

    for match in ACCESS.finditer(text):
        kind, bits, argument = match.group(1), int(match.group(2)), match.group(3).strip()
        line = text.count('\n', 0, match.start()) + 1
        if re.match(r'^off\b', argument):
            continue                         # a helper's own parameter
        # `X.OFFSET.Planes + i * 4` indexes an array field.
        indexed = re.match(r'^\w+\.OFFSET\.(\w+)\s*\+', argument)
        named = re.match(r'^\w+\.OFFSET\.(\w+)$', argument) or indexed
        if not named:
            problems.append('%s:%d: %s%d(%s) does not go through the OFFSET table'
                            % (rel, line, kind, bits, argument))
            continue
        key = named.group(1)
        if key not in names:
            if table and not any(key in p for p in problems):
                problems.append('%s:%d: OFFSET.%s is not in the table' % (rel, line, key))
            continue
        c_path, _offset, size = names[key]
        if indexed:
            if size % (bits // 8) != 0:
                problems.append('%s:%d: %s%d steps through %s.%s, which is %d byte(s)'
                                % (rel, line, kind, bits, struct, c_path, size))
            continue
        if size != bits // 8:
            problems.append('%s:%d: %s%d on %s.%s, which is %d byte(s)'
                            % (rel, line, kind, bits, struct, c_path, size))

    declared = SIZE.search(text)
    if declared and int(declared.group(1)) not in (0, total):
        problems.append('%s: static SIZE = %s, but sizeof(struct %s) is %d'
                        % (rel, declared.group(1), struct, total))

    return struct, problems, notes


RAW_ACCESS = re.compile(r'\bamiga\.(peek|poke)(8|16|32)\(\s*([^,)]*\+[^,)]*)')
RAW_ALLOWED = re.compile(r'check-structs:')


def check_raw_offsets(path):
    """Problems for hand-computed field addresses in one file."""
    with open(path, encoding='utf-8') as handle:
        lines = handle.read().split('\n')
    rel = os.path.relpath(path, ROOT)
    problems = []
    if os.path.basename(path) == 'Struct.js':
        return []                # the base class: where offsets are added
    for index, line in enumerate(lines):
        match = RAW_ACCESS.search(COMMENT.sub(' ', line))
        if not match:
            continue
        # the statement may be wrapped, with the note on its last line
        near = ' '.join(lines[max(0, index - 1):index + 2])
        if RAW_ALLOWED.search(near):
            continue
        problems.append('%s:%d: %s%s(%s) adds an offset by hand; use a '
                        'struct wrapper with a checked OFFSET table'
                        % (rel, index + 1, match.group(1), match.group(2),
                           match.group(3).strip()))
    return problems


def main(argv):
    verbose = '--verbose' in argv
    declarations = Declarations()

    if '--layout' in argv:
        struct = argv[argv.index('--layout') + 1]
        layout, total = measure(declarations, struct)
        if layout is None:
            return 2
        print('struct %s (%s), %d bytes' % (struct, declarations.where[struct], total))
        for path, (offset, size) in sorted(layout.items(), key=lambda item: (item[1][0], -item[1][1])):
            print('  +%-4d %2d  %s' % (offset, size, path))
        return 0

    files = [a for a in argv if not a.startswith('--')]
    everything = not files
    if everything:
        files = sorted(glob.glob(os.path.join(STRUCTS, '*.js')))
        files = [f for f in files if os.path.basename(f) != 'Struct.js']
        # struct wrappers that live beside the class that uses them
        for path in sorted(glob.glob(os.path.join(FFI, '**', '*.js'),
                                     recursive=True)):
            if path in files or os.path.dirname(path) == STRUCTS:
                continue
            with open(path, encoding='utf-8') as handle:
                if MARKER.search(handle.read().split('*/', 1)[-1]) and \
                        TABLE.search(open(path, encoding='utf-8').read()):
                    files.append(path)

    bad = 0
    for path in files:
        struct, problems, notes = check_file(path, declarations, verbose)
        for note in notes:
            print(note)
        for problem in problems:
            print(problem)
        bad += len(problems)

    if everything:
        for path in sorted(glob.glob(os.path.join(FFI, '**', '*.js'),
                                     recursive=True)):
            for problem in check_raw_offsets(path):
                print(problem)
                bad += 1

    print()
    print('%d files, %d problem(s)' % (len(files), bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
