#!/bin/bash
# run.sh - test library/vbcc/sharedlib_softfp.s, the soft-float variants'
# own IEEE 754 arithmetic, against the host's.
#
#   library/vbcc/tests/softfp/run.sh [random-count] [68020|68060]
#
# gen.c (host) writes operand pairs with the results this Mac's doubles
# give; sftest.c (68k, run under vamos) calls each routine through its
# jump table and compares bit for bit. Default 20000 random pairs on top
# of the fixed list, about 370000 checks. The second argument assembles
# the file for that CPU: 68060 selects the code that avoids the 64-bit
# MULU.L and DIVU.L forms, which is run on the emulated 68020 all the
# same (it uses only 68020 instructions).
#
# Needs vbcc in $VBCC (default ~/vbcc) and amitools' vamos. Work files
# go to ${TMPDIR:-/tmp}/qjs-softfp-test. Exit status 0 means PASS.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
export VBCC=${VBCC:-$HOME/vbcc} PATH=${VBCC:-$HOME/vbcc}/bin:$PATH
count=${1:-20000}; cpu=${2:-68020}
T=${TMPDIR:-/tmp}/qjs-softfp-test; mkdir -p "$T"
cc -O1 -o "$T/gen" "$HERE/gen.c" || exit 2
"$T/gen" "$T/vectors.bin" "$count" || exit 2
vasmm68k_mot -quiet -Fhunk -nowarn=62 -m$cpu "$HERE/../../sharedlib_softfp.s" -o "$T/softfp.o" || exit 2
vc +aos68k -cpu=68020 -O1 -c "$HERE/sftest.c" -o "$T/sftest.o" < /dev/null || exit 2
vc +aos68k -cpu=68020 "$T/sftest.o" "$T/softfp.o" -o "$T/sftest" < /dev/null || exit 2
cd "$T" && vamos -C 68020 -m 16384 -s 512 -H disable -- sftest vectors.bin < /dev/null 2>&1 | tee "$T/out.txt"
tail -1 "$T/out.txt" | /usr/bin/grep -q '^PASS'
