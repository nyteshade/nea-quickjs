#!/bin/bash
# run.sh - compare the library's 64-bit helpers with vc.lib's.
#
#   perf/int64cmp/run.sh [config...]
#
#   config  one of 020fpu 040fpu 060fpu 020soft 040soft 060soft;
#           default is all six
#
# For each config i64test.c is built twice with the flags the library
# is built with: once linked against vc.lib (vbcc's own helpers) and
# once with the library's own (library/vbcc/sharedlib_int64.s and
# sharedlib_int64_conv.c, plus sharedlib_int64_fpu.s for an FPU config
# or sharedlib_int64_soft.s for a soft-float one) placed in front of
# vc.lib so that ours are the ones called. Both run under vamos
# and check.py verifies each against values computed on this machine;
# the two outputs are then diffed, which also shows the conversions C
# leaves undefined (lines marked '!').
#
# Needs vbcc ($VBCC, default ~/vbcc), amitools' vamos, python3. The
# soft-float configs need a real mathieeedoubbas.library in
# $PERF_VM/libs (default perf/.vm/libs), the same one measure.sh uses.
# Results are left in perf/out/int64cmp/. Exit status 1 on any wrong
# result from our helpers.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
export VBCC=${VBCC:-$HOME/vbcc}
export PATH=$VBCC/bin:$PATH
LIBV=$ROOT/library/vbcc
VM=${PERF_VM:-$ROOT/perf/.vm}
OUT=$ROOT/perf/out/int64cmp
mkdir -p "$OUT"
[ $# -gt 0 ] || set -- 020fpu 040fpu 060fpu 020soft 040soft 060soft
rc=0
for cfg in "$@"; do
  cpu=68${cfg:0:3}; kind=${cfg:3}
  W=$OUT/$cfg; rm -rf "$W"; mkdir -p "$W/libs"
  if [ "$kind" = fpu ]; then
    cf="-cpu=$cpu -fpu=68881"; lm=-lm881; af="-m$cpu -m68881"; extra=sharedlib_int64_fpu.s
  else
    cf="-cpu=$cpu"; lm=-lmieee; af="-m$cpu"; extra=sharedlib_int64_soft.s
    cp "$VM/libs/mathieeedoubbas.library" "$W/libs/" 2>/dev/null ||
      { echo "$cfg: no $VM/libs/mathieeedoubbas.library (set PERF_VM) - skipped"; rc=1; continue; }
  fi
  vasmm68k_mot -quiet -Fhunk -nowarn=62 $af "$LIBV/sharedlib_int64.s" -o "$W/ours.o" || { rc=1; continue; }
  vasmm68k_mot -quiet -Fhunk -nowarn=62 $af "$LIBV/$extra" -o "$W/extra.o" || { rc=1; continue; }
  vc +aos68k -c $cf -O1 "$LIBV/sharedlib_int64_conv.c" -o "$W/conv.o" || { rc=1; continue; }
  ours="$W/ours.o $W/extra.o $W/conv.o"
  vc +aos68k $cf -O1 "$HERE/i64test.c" $lm -o "$W/t_vclib" || { rc=1; continue; }
  vc +aos68k $cf -O1 "$HERE/i64test.c" $ours $lm -o "$W/t_ours" || { rc=1; continue; }
  for t in vclib ours; do
    ( cd "$W" && vamos -C 68040 -m 16384 -H disable -s 512 --cwd sys: -V "sys:$W" -a libs:sys:libs \
        -O mathieeedoubbas.library=mode:amiga -- t_$t < /dev/null > "$W/$t.out" 2> "$W/$t.err" )
  done
  echo "== $cfg"
  python3 "$HERE/check.py" "$W/vclib.out" || true
  python3 "$HERE/check.py" "$W/ours.out" || rc=1
  n=$(diff "$W/vclib.out" "$W/ours.out" | /usr/bin/grep -c '^>')
  echo "$cfg: $n lines differ between vc.lib and ours (diff $W/vclib.out $W/ours.out)"
done
exit $rc
