#!/bin/bash
# runall.sh <name>... : all benchmarks for each build, 8 at a time
R=/private/tmp/claude-501/-Volumes-Code-Amiga-nea-quickjs/16cb392e-cdad-4185-838c-ecaa322c3b16/scratchpad/perf/lane-a-dispatch/r2
cd $R
for n in "$@"; do for b in empty intloop float prop array call intdiv intops strcat alloc regex; do echo "$n $b"; done; done | xargs -P 8 -L 1 ./run.sh > /dev/null
