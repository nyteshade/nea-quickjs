#!/usr/bin/env python3
"""check_dcmp.py - prove that no C file of the soft-float library compares
doubles with a bare C operator.

    python3 scripts/check_dcmp.py <workdir> <compiler and flags...> -- <file.c>...

Run it through the Makefile, which supplies the real flags:

    make -C library/vbcc check-dcmp

Why: on a soft-float build vbcc compiles "a < b" on doubles into a call
of the maths library's compare vector, "jsr -42(a6)" with a6 loaded from
MathIeeeDoubBasBase (or "-48(a6)", test against zero, for "a == 0.0"),
and branches on the -1/0/+1 it returns. That cannot express a NaN, so
such a comparison gives a wrong answer for NaN operands. The engine uses
the D_LT/D_LE/D_GT/D_GE/D_EQ/D_NE macros of quickjs-master/dcmp.h
instead. This script compiles each file to assembly and counts the
compiler's own compare calls; any at all is a bare comparison that has
crept in, and the script names the file and fails.

Single-precision compares (MathIeeeSingBasBase) are counted too.

With -g in the flags the assembly carries "debug <line>" markers; the
script prints the last marker before each call, which is near, but not
always exactly at, the offending source line.
"""
import os
import re
import subprocess
import sys


def scan(asm_path):
    """Return a list of (description, line marker) for compare calls."""
    found = []
    prev = ''
    marker = '?'
    with open(asm_path, errors='replace') as fh:
        for raw in fh:
            text = raw.strip()
            if not text:
                continue
            m = re.match(r'debug\s+(\d+)', text)
            if m:
                marker = m.group(1)
                continue
            m = re.match(r'jsr\s+(-42|-48)\(a6\)', text)
            if m:
                b = re.search(r'_MathIeee(Doub|Sing)BasBase', prev)
                if b:
                    kind = 'compare' if m.group(1) == '-42' else 'test against zero'
                    found.append(('%s (%s precision)' % (kind, 'double' if b.group(1) == 'Doub' else 'single'), marker))
            prev = text
    return found


def main():
    args = sys.argv[1:]
    if '--' not in args or len(args) < 4:
        print(__doc__)
        return 2
    split = args.index('--')
    workdir, compiler, sources = args[0], args[1:split], args[split + 1:]
    os.makedirs(workdir, exist_ok=True)
    bad = 0
    for src in sources:
        out = os.path.join(workdir, os.path.basename(src) + '.s')
        cmd = 'ulimit -s 65520; ' + ' '.join(compiler) + ' -S ' + src + ' -o ' + out
        res = subprocess.run(['/bin/bash', '-c', cmd], stdin=subprocess.DEVNULL,
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        if res.returncode != 0 or not os.path.exists(out):
            print('FAIL %s: did not compile' % src)
            sys.stdout.write(res.stdout.decode(errors='replace')[-2000:])
            bad += 1
            continue
        found = scan(out)
        if found:
            bad += 1
            print('FAIL %s: %d bare comparison(s)' % (src, len(found)))
            for what, marker in found:
                print('     %s near line %s' % (what, marker))
        else:
            print('ok   %s' % src)
    if bad:
        print('%d file(s) failed. Use the D_xx macros of quickjs-master/dcmp.h.' % bad)
        return 1
    print('no bare double comparison in %d file(s)' % len(sources))
    return 0


if __name__ == '__main__':
    sys.exit(main())
