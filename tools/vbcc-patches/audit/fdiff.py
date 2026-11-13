#!/usr/bin/env python3
"""fdiff.py <asmdirA> <asmdirB> [-v] [-L]

Compare two trees of vbccm68k assembly output function by function and
list every function whose code differs. Used to measure what a compiler
change does to the whole library (see ../README.md).

  -v   also print a unified diff of each differing function
  -L   renumber the lNNN labels inside each function before comparing,
       so that functions which differ only because an earlier function
       used more or fewer labels are not reported

A file is cut at every "cnop 0,4" that is followed by a label: a global
one (_name) or a numeric one (lNNN, a static function or a data item).
Static functions have no name in vbcc's output; they are reported by
label, as "l1234 (after _SomeGlobal)". A compiler built with
name-static-functions.patch writes "; FUNC name" in front of them and
then they are reported by name. Nothing in a file is skipped: the text
before the first function is compared too, as "<head>".
"""
import sys, os, re, difflib

def split(path):
    """Cut one assembly file into chunks.

    @param path: file to read
    @returns: list of (name, lines) in file order
    """
    chunks = []
    name, cur, last_global = '<head>', [], '<head>'
    lines = open(path, encoding='latin-1').read().split('\n')
    n = len(lines)
    for i, ln in enumerate(lines):
        if ln == '\tcnop\t0,4' and i + 1 < n:
            nxt = lines[i + 1]
            new = None
            if nxt.startswith('; FUNC ') and i + 2 < n:
                new = '%s (static, %s)' % (nxt[7:], lines[i + 2])
            elif re.match(r'^_[A-Za-z0-9_]+$', nxt):
                new = last_global = nxt
            elif re.match(r'^l\d+$', nxt):
                new = '%s (after %s)' % (nxt, last_global)
            if new is not None:
                chunks.append((name, cur))
                name, cur = new, []
        cur.append(ln)
    chunks.append((name, cur))
    return chunks

def canon(name, lines):
    """Renumber labels in order of first appearance.

    @param name: chunk name
    @param lines: chunk text
    @returns: (name, lines) with every lNNN replaced by L0, L1, ...
    """
    seen = {}
    def r(m):
        return seen.setdefault(m.group(0), 'L%d' % len(seen))
    out = [re.sub(r'\bl\d+\b', r, l) for l in lines]
    return re.sub(r'\bl\d+\b', 'l#', name), out

def main():
    """Walk tree A, compare each .s file with its namesake in tree B."""
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    if len(args) != 2:
        sys.exit(__doc__)
    a, b = args
    verbose, relabel = '-v' in sys.argv, '-L' in sys.argv
    nfiles = nchunks = ndiff = 0
    for root, _, files in sorted(os.walk(a)):
        for f in sorted(files):
            if not f.endswith('.s'):
                continue
            pa = os.path.join(root, f)
            rel = os.path.relpath(pa, a)
            pb = os.path.join(b, rel)
            nfiles += 1
            if not os.path.exists(pb):
                print('MISSING in B: ' + rel)
                ndiff += 1
                continue
            ca, cb = split(pa), split(pb)
            if relabel:
                ca = [canon(n, l) for n, l in ca]
                cb = [canon(n, l) for n, l in cb]
            nchunks += len(ca)
            if [x[0] for x in ca] != [x[0] for x in cb]:
                print('%s: the two files do not have the same functions '
                      '(%d and %d chunks); try -L' % (rel, len(ca), len(cb)))
                ndiff += 1
                continue
            for (name, la), (_, lb) in zip(ca, cb):
                if la != lb:
                    ndiff += 1
                    print('%s: %s' % (rel, name))
                    if verbose:
                        for d in difflib.unified_diff(la, lb, 'A', 'B', n=3, lineterm=''):
                            print('    ' + d)
    print('files=%d chunks=%d differing=%d' % (nfiles, nchunks, ndiff))
    sys.exit(1 if ndiff else 0)

main()
