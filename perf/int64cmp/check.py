#!/usr/bin/env python3
"""check.py <output-file>... - verify i64test output against exact values.

Every line of i64test's output names an operation, its operands and the
result the 68k helper produced, in hexadecimal. This recomputes each
result with Python's integers and floats and prints the lines that are
wrong. Lines whose operation ends in '!' are conversions C leaves
undefined (out of range, NaN): they are not checked.
Exit status 1 if any file has a wrong line or does not end in "done".
"""
import struct
import sys

M = (1 << 64) - 1


def s(v):
    """Reinterpret an unsigned 64-bit value as signed."""
    return v - (1 << 64) if v >> 63 else v


def tdiv(a, b):
    """C division: truncate toward zero."""
    q = abs(a) // abs(b)
    return -q if (a < 0) != (b < 0) else q


def dbl(bits):
    """The double with this bit pattern."""
    return struct.unpack('>d', struct.pack('>Q', bits))[0]


def bits(d):
    """The bit pattern of a double."""
    return struct.unpack('>Q', struct.pack('>d', d))[0]


def expect(op, a, b):
    """The exact result of one operation, as an unsigned 64-bit value."""
    if op == 'mul':
        return (a * b) & M
    if op == 'divu':
        return a // b
    if op == 'modu':
        return a % b
    if op == 'divs':
        return tdiv(s(a), s(b)) & M
    if op == 'mods':
        return (s(a) - tdiv(s(a), s(b)) * s(b)) & M
    if op == 'shl':
        return (a << b) & M
    if op == 'shru':
        return a >> b
    if op == 'shrs':
        return (s(a) >> b) & M
    if op == 's2d':
        return bits(float(s(a)))
    if op == 'u2d':
        return bits(float(a))
    if op in ('d2s', 'd2u'):
        return int(dbl(a)) & M
    raise ValueError(op)


def check(path):
    """Check one output file; True if every line is right and it is complete."""
    bad = n = skipped = 0
    done = False
    for line in open(path, errors='replace'):
        f = line.split()
        if f == ['done']:
            done = True
            continue
        if len(f) != 4:
            continue
        op = f[0]
        if op.endswith('!'):
            skipped += 1
            continue
        a = int(f[1], 16)
        b = 0 if f[2] == '-' else int(f[2], 16 if len(f[2]) == 16 else 10)
        got = int(f[3], 16)
        want = expect(op, a, b)
        n += 1
        if got != want:
            bad += 1
            if bad <= 25:
                print('  WRONG %s: got %016x want %016x' % (' '.join(f[:3]), got, want))
    print('%s: %d checked, %d wrong, %d undefined-in-C not checked%s'
          % (path, n, bad, skipped, '' if done else ', INCOMPLETE (no "done" line)'))
    return bad == 0 and done


if __name__ == '__main__':
    ok = [check(p) for p in sys.argv[1:]]
    sys.exit(0 if all(ok) else 1)
