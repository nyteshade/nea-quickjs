#!/bin/bash
# cmpout.sh <ref> <name>... : program output identical to the reference build?
cd /private/tmp/claude-501/-Volumes-Code-Amiga-nea-quickjs/16cb392e-cdad-4185-838c-ecaa322c3b16/scratchpad/perf/lane-a-dispatch/r2/logs
ref=$1; shift
for n in "$@"; do bad=""; for b in empty intloop float prop array call intdiv intops strcat alloc regex; do cmp -s $ref.$b.out $n.$b.out || bad="$bad $b"; [ -s $n.$b.instr ] || bad="$bad $b(norun)"; done; echo "$n vs $ref: ${bad:-all 11 outputs identical}"; done
