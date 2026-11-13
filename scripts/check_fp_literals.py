#!/usr/bin/env python3
"""check_fp_literals.py - find floating-point constants that vbcc does not
convert to the nearest double.

    python3 scripts/check_fp_literals.py [file.c ...]

Why: vbcc converts a decimal constant such as 1.7976931348623157e308
with its own arithmetic and can be several units in the last place off
(that one came out as 0x7feffffffffffff9 instead of 0x7fefffffffffffff,
and 2.2250738585072014e-308 as 0x0010000000000003). It also folds -0.0
to +0.0 and 1.0/0.0 to 0. A constant that is wrong in the binary is
wrong on every Amiga, FPU or not, and nothing at run time can see it.

The script pulls every floating-point literal out of the given C files
(default: the sources the library is built from), compiles each as
"double f(void) { return <literal>; }" with vbcc for 68020 soft-float,
reads the two 32-bit words the compiler loads, and compares them with
the correctly rounded value (Python's float()). It lists each literal
that differs with the files it occurs in, and exits 1 if there are any.

Fix a reported constant by building the value from its bit pattern (see
JS_NEG_ZERO in quickjs.c, qjs_dbl_bits in sharedlib_math_soft.c), not by
adding digits. Comments and strings are skipped; code inside "#if 0" or
another compiler's #ifdef is not, so a hit may be in dead code: look
before fixing.

Needs vbcc in $VBCC (default ~/vbcc).
"""
import os
import re
import struct
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT = [
    'quickjs-master/quickjs.c', 'quickjs-master/dtoa.c', 'quickjs-master/libregexp.c',
    'quickjs-master/libunicode.c', 'quickjs-master/cutils.h', 'quickjs-master/quickjs.h',
    'quickjs-master/quickjs-libc.c', 'quickjs-master/dtoa.h',
    'library/vbcc/qjsfuncs.c', 'library/vbcc/quickjs_libc_lib.c', 'library/vbcc/amiga_ffi.c',
    'library/vbcc/sharedlib_math_soft.c', 'library/vbcc/sharedlib_math.c',
    'library/vbcc/sharedlib_math_fpu_aux.c', 'library/vbcc/sharedlib_libm.c',
    'library/vbcc/sharedlib_time.c',
    'library/vbcc/sharedlib_strtod.c', 'library/vbcc/sharedlib_printf.c',
    'library/vbcc/sharedlib_int64_conv.c', 'library/vbcc/sharedlib_dbl_helpers.c',
    'library/vbcc/sharedlib_posix.c', 'library/vbcc/sharedlib_stdio.c',
    'library/vbcc/sharedlib_clib.c', 'library/vbcc/sharedlib_fetch.c',
    'library/vbcc/sharedlib_worker.c', 'library/vbcc/sharedlib_vbcc.c',
    'src/amiga_ssl.c',
]
# Wrong constants that vbcc never compiles: each sits in the #else of an
# "#if defined(__VBCC__)" whose vbcc branch builds the value from bits.
# (literal, file) -> why. A new occurrence anywhere else is still reported.
NOT_FOR_VBCC = {
    ('1.7976931348623157e+308', 'quickjs-master/quickjs.c'): 'Number.MAX_VALUE, other compilers',
    ('9.2233720368547758e18', 'quickjs-master/quickjs.c'): 'JS_TWO_POW_63, other compilers',
}

LITERAL = re.compile(r'(?<![\w.])((?:\d+\.\d*|\.\d+)(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+)[fFlL]?(?![\w.])')


def strip(text):
    """Blank out comments, strings and character constants."""
    def blank(m):
        return re.sub(r'[^\n]', ' ', m.group(0))
    return re.sub(r'/\*.*?\*/|//[^\n]*|"(?:\\.|[^"\\\n])*"|\'(?:\\.|[^\'\\\n])*\'', blank, text, flags=re.S)


def main():
    files = sys.argv[1:] or [os.path.join(ROOT, f) for f in DEFAULT]
    where = {}
    for path in files:
        if not os.path.exists(path):
            continue
        with open(path, errors='replace') as fh:
            text = strip(fh.read())
        for no, line in enumerate(text.split('\n'), 1):
            for m in LITERAL.finditer(line):
                where.setdefault(m.group(1), []).append('%s:%d' % (os.path.relpath(path, ROOT), no))
    lits = sorted(where)
    if not lits:
        print('no floating-point literals found')
        return 0
    vbcc = os.environ.get('VBCC', os.path.expanduser('~/vbcc'))
    env = dict(os.environ, VBCC=vbcc, PATH=os.path.join(vbcc, 'bin') + ':' + os.environ['PATH'])
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, 'lits.c')
        with open(src, 'w') as fh:
            for i, lit in enumerate(lits):
                fh.write('double c_%d(void) { return %s; }\n' % (i, lit))
        asm = os.path.join(tmp, 'lits.s')
        res = subprocess.run(['vc', '+aos68k', '-cpu=68020', '-O1', '-S', src, '-o', asm],
                             env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT)
        if not os.path.exists(asm):
            sys.stdout.write(res.stdout.decode(errors='replace'))
            print('vbcc failed')
            return 2
        got = {}
        cur = None
        words = []
        with open(asm, errors='replace') as fh:
            for line in fh:
                t = line.strip()
                m = re.match(r'_c_(\d+)$', t)
                if m:
                    cur = int(m.group(1))
                    words = []
                    continue
                m = re.match(r'(?:move\.l\s+#\$?([0-9a-fA-F]+)|moveq\s+#(-?\d+)),(d[01])$', t)
                if cur is not None and m:
                    val = int(m.group(1), 16) if m.group(1) else int(m.group(2)) & 0xffffffff
                    words.append((m.group(3), val))
                if t == 'rts' and cur is not None:
                    d = dict(words)
                    if 'd0' in d and 'd1' in d:
                        got[cur] = (d['d0'] << 32) | d['d1']
                    cur = None
    bad = 0
    unknown = 0
    for i, lit in enumerate(lits):
        want = struct.unpack('>Q', struct.pack('>d', float(lit)))[0]
        if i not in got:
            unknown += 1
            print('??   %s: could not read the compiled value (%s)' % (lit, where[lit][0]))
            continue
        if got[i] != want:
            places = set(w.rsplit(':', 1)[0] for w in where[lit])
            if len(where[lit]) == 1 and all((lit, f) in NOT_FOR_VBCC for f in places):
                print('skip %s: wrong under vbcc but not compiled by it (%s)' %
                      (lit, NOT_FOR_VBCC[(lit, list(places)[0])]))
                continue
            bad += 1
            print('BAD  %s: vbcc %016x, correct %016x' % (lit, got[i], want))
            print('     ' + ', '.join(where[lit][:6]) + (' ...' if len(where[lit]) > 6 else ''))
    print('%d literals, %d wrong, %d unreadable' % (len(lits), bad, unknown))
    return 1 if bad or unknown else 0


if __name__ == '__main__':
    sys.exit(main())
