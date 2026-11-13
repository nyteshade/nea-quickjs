#!/bin/bash
# run.sh - check the FPU variants' maths replacements on this machine.
#
#   perf/mathcheck/run.sh
#
# Compiles library/vbcc/sharedlib_math_round.c and sharedlib_math_pow.c
# for the host (see hostcheck.c) and compares floor, ceil, trunc, round,
# nearbyint, lround, ldexp, frexp, fmod and pow with the host's libm
# over several million operands. Prints the wrong results, if any, and
# exits 1. Needs a C compiler (cc).
#
# This checks the algorithms, not the 68k code: amiga/tests/
# test_fpu_numeric.js does that, on an Amiga or under vamos.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=$HERE/../out/mathcheck
mkdir -p "$OUT"
# -ffp-contract=off: no fused multiply-add, which the 68k does not have
cc -O1 -ffp-contract=off -DQJS_HOST_TEST -o "$OUT/hostcheck" "$HERE/hostcheck.c" -lm || exit 1
"$OUT/hostcheck" || exit 1
# The soft-float variants' primitives (exp, log, sin, atan, sqrt ...),
# library/vbcc/sharedlib_math_prim.c, against libm: see primcheck.c.
cc -O1 -ffp-contract=off -DQJS_HOST_TEST -o "$OUT/primcheck" "$HERE/primcheck.c" -lm || exit 1
"$OUT/primcheck"
