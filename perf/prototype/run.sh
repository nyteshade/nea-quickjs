#!/bin/bash
# run.sh <name> <bench>  -> logs/<name>.<bench>.out (program output) and prints "name bench instr"
R=/private/tmp/claude-501/-Volumes-Code-Amiga-nea-quickjs/16cb392e-cdad-4185-838c-ecaa322c3b16/scratchpad/perf/lane-a-dispatch/r2
B=/private/tmp/claude-501/-Volumes-Code-Amiga-nea-quickjs/16cb392e-cdad-4185-838c-ecaa322c3b16/scratchpad/perf/lane-b-measure
name=$1; bench=$2
W=$R/vms/$name.run.$bench; rm -rf $W; cp -R $R/vms/$name $W; cp ${BENCHDIR:-$B/bench}/$bench.js $W/; cd $W
V=$R/vols/$$; mkdir -p $V $R/prof
PROF_OUT=$R/prof/$name.$bench.prof $B/tools/prof.py -S --vols-base-dir $V -l main:info -C 68020 -m 65536 -H disable -s 2048 --cwd sys: -V sys:$PWD -a libs:sys:libs -a s:sys:s -a c:sys:c -a t:sys:s -O mathieeedoubbas.library=mode:amiga -- c/qjs $bench.js < /dev/null > $R/logs/$name.$bench.raw 2>&1
/usr/bin/grep -v -E "orphan|AllocSignal|FreeSignal|GetSysTime|exit code|total cycles|libmgr:|main: |^PROF " $R/logs/$name.$bench.raw > $R/logs/$name.$bench.out
n=$(/usr/bin/grep -o "instr=[0-9]*" $R/logs/$name.$bench.raw | cut -d= -f2)
echo "$name $bench $n" | tee $R/logs/$name.$bench.instr
rm -rf $V $W; [ -n "$KEEPPROF" ] || rm -f $R/prof/$name.$bench.prof
