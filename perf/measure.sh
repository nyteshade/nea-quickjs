#!/bin/bash
# measure.sh - count the 68k instructions a library executes on the
# benchmarks, and save each benchmark's output for comparison.
#
#   perf/measure.sh <label> [library] [bench...]
#
#   label    names this run; results go to perf/out/<label>/
#   library  defaults to amiga/libs/quickjs.020soft.library
#   bench    names from perf/bench/ without .js; default is all of them
#
# Needs a template directory, perf/.vm (not in git), holding
#   c/qjs                         a CLI built to run under vamos (see the
#                                 "vamos recipe": -DQJS_NO_STACK_CHECK and
#                                 a large __stack)
#   libs/mathieeedoubbas.library  a real one, for the soft-float variants
# and amitools' vamos for the python named in tools/prof.py.
#
# PERF_CPU=68040 selects the emulated CPU (needed for the FPU variants).
#
# Prints "<bench> <instructions>" per benchmark. Counts are exact and
# repeatable; they are not seconds.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(dirname "$HERE")
label=${1:?usage: measure.sh <label> [library] [bench...]}; shift
lib=${1:-$ROOT/amiga/libs/quickjs.020soft.library}; [ $# -gt 0 ] && shift
[ $# -gt 0 ] || set -- empty intloop float prop array call intdiv intops strcat alloc regex edge modchk
VM=$HERE/.vm
[ -x "$VM/c/qjs" ] || { echo "no $VM/c/qjs - see the header of this script"; exit 1; }
[ -f "$HERE/tools/hook.dylib" ] || cc -O2 -shared -o "$HERE/tools/hook.dylib" "$HERE/tools/hook.c" || exit 1
OUT=$HERE/out/$label; mkdir -p "$OUT"
WORK=$(mktemp -d)
one() {
  b=$1; W=$WORK/$b; mkdir -p "$W/vols"; cp -R "$VM" "$W/vm"
  cp "$lib" "$W/vm/libs/quickjs.library"; cp "$HERE/bench/$b.js" "$W/vm/"
  ( cd "$W/vm" && PROF_OUT=$W/prof "$HERE/tools/prof.py" -S --vols-base-dir "$W/vols" \
      -l main:info -C ${PERF_CPU:-68020} -m 65536 -H disable -s 2048 --cwd sys: -V "sys:$PWD" \
      -a libs:sys:libs -a s:sys:s -a c:sys:c -a t:sys:s \
      -O mathieeedoubbas.library=mode:amiga -- c/qjs $b.js < /dev/null > "$W/raw" 2>&1 )
  /usr/bin/grep -v -E "orphan|AllocSignal|FreeSignal|GetSysTime|exit code|total cycles|libmgr:|main: |^PROF " "$W/raw" > "$OUT/$b.out"
  n=$(/usr/bin/grep -o "instr=[0-9]*" "$W/raw" | cut -d= -f2)
  echo "$b ${n:-FAILED}" > "$OUT/$b.instr"
}
for b in "$@"; do one "$b" & while [ "$(jobs -r | wc -l)" -ge 6 ]; do sleep 1; done; done; wait
for b in "$@"; do cat "$OUT/$b.instr"; done | tee "$OUT/instr.txt"
rm -rf "$WORK"
