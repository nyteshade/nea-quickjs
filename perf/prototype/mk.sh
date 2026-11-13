#!/bin/bash
# mk.sh <name> <base: O0|O1> <vc -O flag> [extra -D flags...]
# Compiles r2/tree/quickjs-master/quickjs.c (soft flags) and links a soft library from
# lane B's other objects (copied to obj/base_O0|O1).  Result: vms/<name>/libs/quickjs.library
R=/private/tmp/claude-501/-Volumes-Code-Amiga-nea-quickjs/16cb392e-cdad-4185-838c-ecaa322c3b16/scratchpad/perf/lane-a-dispatch/r2
name=$1; base=$2; O=$3; shift 3
export VBCC=$HOME/vbcc PATH=$HOME/vbcc/bin:$PATH
mkdir -p $R/obj/$name $R/logs; cd $R/tree/library/vbcc
ulimit -s 65520
for try in 1 2 3; do
$VBCC/bin/vc +aos68k -c -cpu=68020 $O -DJS_NAN_BOXING=0 -I$VBCC/targets/m68k-amigaos/include -I$VBCC/posixlib/include \
  -I../../sdks/AmiSSL-v5.26-SDK/Developer/include -I../../include -I../../quickjs-master -I../../vbcc-librarytemplate \
  -I../../library/vbcc -DQJS_VARIANT_NAME=020soft "$@" ${KEEPASM:+-k} ../../quickjs-master/quickjs.c -o $R/obj/$name/quickjs.o < /dev/null > $R/logs/mk.$name.log 2>&1 && break
done || { echo "COMPILE FAILED $name"; tail -5 $R/logs/mk.$name.log; exit 1; }
b=$R/obj/base_$base; o=$R/obj/$name/quickjs.o
$VBCC/bin/vlink -bamigahunk -Bstatic -nostdlib -mrel -M$R/obj/$name/lib.map $b/library.o $b/qjsfuncs.o $b/qjsfuncs_asm_all.o $b/execinline.o $b/qjs_dbg_stub.o $b/quickjs_libc_lib.o $b/amiga_ssl_lib.o $b/extended.o $b/ffi.o $b/sharedlib_worker.o $b/amiga_ffi.o $b/amiga_ffi_call.o $b/amiga_boopsi_call.o $b/sharedlib_mem.o $b/sharedlib_string.o $b/sharedlib_math_soft.o $b/sharedlib_time.o $b/sharedlib_strtod.o $b/sharedlib_printf.o $b/sharedlib_vbcc.o $b/sharedlib_int64_soft.o $b/sharedlib_int64_conv.o $b/sharedlib_dbl_helpers.o $b/sharedlib_posix.o $b/sharedlib_stdio.o $b/sharedlib_clib.o $b/sharedlib_fetch.o $o $b/dtoa.o $b/libregexp.o $b/libunicode.o -o $R/obj/$name/quickjs.library < /dev/null >> $R/logs/mk.$name.log 2>&1 || { echo "LINK FAILED $name"; tail -5 $R/logs/mk.$name.log; exit 1; }
rm -rf $R/vms/$name; cp -R $R/vms/template $R/vms/$name; cp $R/obj/$name/quickjs.library $R/vms/$name/libs/quickjs.library
echo "built $name: $(stat -f %z $R/obj/$name/quickjs.library) bytes, quickjs.o $(stat -f %z $o)"
