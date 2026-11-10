#!/usr/bin/env python3
"""Measure how much a reader has to hold in their head for each example.

Usage:
    python3 scripts/example_load.py                 # table for amiga/examples
    python3 scripts/example_load.py --markdown      # same, as a Markdown table
    python3 scripts/example_load.py --index         # description, run line
                                                    # and load, for README.md
    python3 scripts/example_load.py FILE [FILE...]  # just these files

"Cognitive load" here is a mechanical estimate, not a judgement of the
code's quality. It counts things a reader must track at once:

    decisions   if / case / for / while / catch / ?: / && / ||
    depth       deepest brace nesting
    longest     lines in the longest single function (the top-level
                script counts as one function for what is left over)
    plumbing    raw hex constants of 3+ digits, peek/poke calls and
                amiga.call() - places where the reader needs the NDK
                headers open to follow along

    load = decisions + 3 * max(0, depth - 3) + longest / 10 + plumbing / 2

    under 25  low       can be read in one sitting, top to bottom
    under 50  medium    needs a second pass
    50 up     high      a reference, not a first read

The weights are a choice, made once and kept fixed so files can be
compared with each other and with their own earlier versions. Comments
and string contents are ignored, so explaining more never raises the
score.
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXAMPLES = os.path.join(ROOT, 'amiga', 'examples')

TOKEN = re.compile(
    r"""(/\*.*?\*/|//[^\n]*)"""                      # comment
    r"""|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)""",
    re.S)

DECISION = re.compile(r'\b(?:if|case|for|while|catch)\b|\?(?![.?])|&&|\|\|')
PLUMBING = re.compile(r'\b0x[0-9a-fA-F]{3,}\b|\b(?:peek|poke)(?:8|16|32)\b'
                      r'|\bamiga\.call\b')
CONTROL = re.compile(r'^\s*(?:\}?\s*)?(?:if|else|for|while|switch|try|catch|'
                     r'finally|do)\b')
FUNCTION = re.compile(r'\bfunction\b|=>\s*\{\s*$|^\s*(?:static\s+)?'
                      r'(?:async\s+)?(?:get\s+|set\s+)?\*?\s*[A-Za-z_$][\w$]*'
                      r'\s*\([^)]*\)\s*\{\s*$')


def strip(text):
    """Blank out comments and string contents, keeping line structure."""
    def blank(match):
        body = match.group(0)
        keep = '""' if match.group(2) else ''
        return keep + '\n' * body.count('\n')
    return TOKEN.sub(blank, text)


def measure(path):
    with open(path, encoding='utf-8', errors='replace') as handle:
        raw = handle.read()

    raw_lines = raw.split('\n')
    code_lines = strip(raw).split('\n')
    code = [line for line in code_lines if line.strip()]
    nonblank = [line for line in raw_lines if line.strip()]

    decisions = sum(len(DECISION.findall(line)) for line in code)
    plumbing = sum(len(PLUMBING.findall(line)) for line in code)

    depth = 0
    max_depth = 0
    open_functions = []          # (depth at open, lines so far)
    longest = 0
    in_functions = 0             # code lines that sit inside any function

    for line in code:
        if open_functions:
            in_functions += 1
            open_functions = [(d, n + 1) for d, n in open_functions]

        starts_function = bool(FUNCTION.search(line)) and not CONTROL.match(line)

        for char in line:
            if char == '{':
                depth += 1
                max_depth = max(max_depth, depth)
                if starts_function:
                    open_functions.append((depth, 1))
                    starts_function = False
            elif char == '}':
                while open_functions and open_functions[-1][0] == depth:
                    longest = max(longest, open_functions.pop()[1])
                depth = max(0, depth - 1)

    # Whatever is not inside a function is the top-level script.
    longest = max(longest, len(code) - in_functions)

    load = decisions + 3 * max(0, max_depth - 3) + longest / 10 + plumbing / 2
    band = 'low' if load < 25 else 'medium' if load < 50 else 'high'

    return {
        'file': os.path.basename(path),
        'code': len(code),
        'comments': round(100 * (len(nonblank) - len(code)) / max(1, len(nonblank))),
        'decisions': decisions,
        'depth': max_depth,
        'longest': longest,
        'plumbing': plumbing,
        'load': round(load),
        'band': band,
    }


HEADER_LINE = re.compile(r'^\s*(?:/?\*+)?\s?(.*?)\s*(?:\*/)?\s*$')


def describe(path):
    """Pull the one-sentence description and the Run: line out of a
    file's header comment (see amiga/examples/STYLE.md, section 1)."""
    with open(path, encoding='utf-8', errors='replace') as handle:
        text = handle.read()

    end = text.find('*/')
    header = text[:end] if text.lstrip().startswith('/*') and end > 0 else ''
    lines = [HEADER_LINE.match(line).group(1) for line in header.split('\n')]

    name = os.path.basename(path)
    description, run = '', ''
    collecting = False

    for line in lines:
        if not description and not collecting:
            if line.startswith(name):
                description = line[len(name):].lstrip(' -')
                collecting = True
            continue
        if collecting:
            if not line.strip():
                collecting = False       # first paragraph ends here
            else:
                description += ' ' + line.strip()
            continue
        if line.startswith('Run:'):
            run = line[len('Run:'):].strip()

    return description.strip(), run


COLUMNS = ['file', 'code', 'comments', 'decisions', 'depth', 'longest',
           'plumbing', 'load', 'band']


def main(argv):
    markdown = '--markdown' in argv
    index = '--index' in argv
    paths = [a for a in argv if not a.startswith('--')]
    if not paths:
        paths = sorted(glob.glob(os.path.join(EXAMPLES, '*.js')))

    rows = [measure(path) for path in paths]

    if index:
        print('| Example | What it is | Run | Load |')
        print('|---|---|---|---|')
        for path, row in zip(paths, rows):
            description, run = describe(path)
            print('| `%s` | %s | `%s` | %d %s |'
                  % (row['file'], description, run, row['load'], row['band']))
    elif markdown:
        print('| ' + ' | '.join(COLUMNS) + ' |')
        print('|' + '---|' * len(COLUMNS))
        for row in rows:
            print('| ' + ' | '.join(str(row[c]) for c in COLUMNS) + ' |')
    else:
        print('%-28s %5s %5s %5s %5s %7s %8s %5s  %s' % tuple(COLUMNS))
        for row in rows:
            print('%-28s %5d %4d%% %5d %5d %7d %8d %5d  %s'
                  % tuple(row[c] for c in COLUMNS))

    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
