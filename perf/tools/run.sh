#!/bin/bash
# usage: run.sh <vm> <cpu> <script.js> [profile-tag] [extra vamos opts...]
# vm: soft|softO1|fpu|softN ; with a profile-tag writes prof/<vm>.<cpu>.<script>.<tag>.prof
L=/private/tmp/claude-501/-Volumes-Code-Amiga-nea-quickjs/16cb392e-cdad-4185-838c-ecaa322c3b16/scratchpad/perf/lane-b-measure
vm=$1; cpu=$2; js=$3; tag=$4; shift 4
case $vm in soft|softN) F=$L/map/soft020_O0.funcs;; softO1) F=$L/map/soft020_O1.funcs;; fpu) F=$L/map/fpu020.funcs;; esac
cd $L/vms/$vm; cp $L/bench/$js . 2>/dev/null
if [ -n "$tag" ]; then export PROF_OUT=$L/prof/$vm.$cpu.${js%.js}.$tag.prof PROF_FUNCS=$F; mkdir -p $L/prof; fi
V=$L/vols/$$; mkdir -p $V
$L/tools/prof.py -S --vols-base-dir $V -l main:info -C $cpu -m 65536 -H disable -s 2048 --cwd sys: -V sys:$PWD -a libs:sys:libs -a s:sys:s -a c:sys:c -a t:sys:s "$@" -- c/qjs $js < /dev/null 2>&1 | /usr/bin/grep -v "orphan\|AllocSignal\|FreeSignal\|GetSysTime\|exit code" | sed 's/^.*total cycles/total cycles/'; rm -rf $V
