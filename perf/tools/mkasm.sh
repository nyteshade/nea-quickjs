#!/bin/bash
# usage: mkasm.sh <outdir> <quickjs-opt e.g. -O0|-O1> [fpu]   (run from tree/library/vbcc copy)
L=/private/tmp/claude-501/-Volumes-Code-Amiga-nea-quickjs/16cb392e-cdad-4185-838c-ecaa322c3b16/scratchpad/perf/lane-b-measure
export VBCC=$HOME/vbcc PATH=$HOME/vbcc/bin:$PATH
out=$1; qopt=$2; var=$3; mkdir -p $out; cd $L/tree/library/vbcc; ulimit -s 65520
if [ "$var" = fpu ]; then VF="-fpu=68881 -DQJS_VARIANT_NAME=020fpu"; else VF="-DQJS_VARIANT_NAME=020soft"; fi
CF="+aos68k -cpu=68020 -DJS_NAN_BOXING=0 -I$VBCC/targets/m68k-amigaos/include -I$VBCC/posixlib/include -I../../sdks/AmiSSL-v5.26-SDK/Developer/include -I../../include -I../../quickjs-master -I../../vbcc-librarytemplate -I../../library/vbcc $VF"
one() { # src opt
  stem=$(basename $1 .c)
  for g in "" "-g"; do
    sfx=.s; [ -n "$g" ] && sfx=.g.s
    for try in 1 2 3; do vc $CF $2 $g -S $1 -o $out/$stem$sfx </dev/null >/dev/null 2>&1 && break; done
    [ -s $out/$stem$sfx ] || echo "FAILED $stem$sfx"
  done
}
one ../../quickjs-master/quickjs.c $qopt &
one ../../quickjs-master/libregexp.c -O0 &
for f in ../../quickjs-master/dtoa.c ../../quickjs-master/libunicode.c ../../vbcc-librarytemplate/library.c qjsfuncs.c execinline.c quickjs_libc_lib.c amiga_ssl_lib.c sharedlib_worker.c amiga_ffi.c sharedlib_mem.c sharedlib_string.c sharedlib_math_soft.c sharedlib_math.c sharedlib_time.c sharedlib_strtod.c sharedlib_printf.c sharedlib_vbcc.c sharedlib_int64_conv.c sharedlib_dbl_helpers.c sharedlib_posix.c sharedlib_stdio.c sharedlib_clib.c sharedlib_fetch.c; do one $f -O1 & done
wait
