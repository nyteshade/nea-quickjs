#!/bin/bash
# check.sh : every build against the reference outputs.
#   benchmarks + edge.js : must equal the unmodified soft -O0 library (base_O0x)
#   intdiv, modchk       : builds without R2_DIV must equal base_O0x; builds with R2_DIV must equal b_O0
cd /private/tmp/claude-501/-Volumes-Code-Amiga-nea-quickjs/16cb392e-cdad-4185-838c-ecaa322c3b16/scratchpad/perf/lane-a-dispatch/r2/logs
for n in "$@"; do bad=""
  for b in empty intloop float prop array call intops strcat alloc regex edge; do cmp -s base_O0x.$b.out $n.$b.out || bad="$bad $b"; done
  case $n in *b_O0|*b_O1|*ab*) ref=b_O0;; *) ref=base_O0x;; esac
  for b in intdiv modchk; do cmp -s $ref.$b.out $n.$b.out || bad="$bad $b(vs $ref)"; done
  echo "$n: ${bad:-all 13 outputs as expected}"; done
