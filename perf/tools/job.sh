#!/bin/bash
# usage: job.sh <vm> <cpu> <bench> <tag>   (adds native math lib option for tag "nat")
L=/private/tmp/claude-501/-Volumes-Code-Amiga-nea-quickjs/16cb392e-cdad-4185-838c-ecaa322c3b16/scratchpad/perf/lane-b-measure
X=""; [ "$4" = nat ] && X="-O mathieeedoubbas.library=mode:amiga"
$L/tools/run.sh $1 $2 $3.js $4 $X > $L/logs/$1.$3.$4.log 2>&1
