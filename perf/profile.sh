#!/bin/bash
# profile.sh - where do the instructions go? A per-function profile of
# the 020 soft library under vamos.
#
#   perf/profile.sh symbols            build the symbol table for the
#                                      library as it is built NOW
#                                      (needs a finished `make soft`;
#                                      takes a few minutes)
#   perf/profile.sh run <bench> [base] profile perf/bench/<bench>.js and
#                                      print the top functions; with
#                                      base, subtract that benchmark's
#                                      profile first (e.g. "empty")
#
# The symbol table has to match the library exactly, so run `symbols`
# again after every rebuild. Static functions have no linker symbol;
# they are named from `vc -S` listings of each source (tools/mkfuncs.py).
# Output goes to perf/out/profile/.
set -u
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(dirname "$HERE")
export VBCC=${VBCC:-$HOME/vbcc}; export PATH=$VBCC/bin:$PATH
OUT=$HERE/out/profile; OBJ=/tmp/qjslib_68020_soft; mkdir -p "$OUT/asm"
case "${1:-}" in
symbols)
  cd "$ROOT/library/vbcc"; ulimit -s 65520
  # the link line of the last soft build, with a map added
  LINK=$(make -n -B soft 2>/dev/null | /usr/bin/grep 'vlink .*quickjs.020soft.library' | tail -1)
  [ -n "$LINK" ] || { echo "cannot find the soft link command"; exit 1; }
  eval "$(echo "$LINK" | sed "s|-o [^ ]*quickjs.020soft.library|-M$OUT/lib.map -o $OUT/quickjs.library|")" < /dev/null
  cmp -s "$OUT/quickjs.library" "$ROOT/amiga/libs/quickjs.020soft.library" \
    || { echo "relinked library differs from amiga/libs/quickjs.020soft.library: run make soft first"; exit 1; }
  CF="+aos68k -cpu=68020 -DJS_NAN_BOXING=0 -I$VBCC/targets/m68k-amigaos/include -I$VBCC/posixlib/include -I../../sdks/AmiSSL-v5.26-SDK/Developer/include -I../../include -I../../quickjs-master -I../../vbcc-librarytemplate -I../../library/vbcc -DQJS_VARIANT_NAME=020soft"
  QF=$(make -n -B soft 2>/dev/null | /usr/bin/grep -o '\-DQJS_INTERP[^ ]*' | sort -u | tr '\n' ' ')
  one() { stem=$(basename "$1" .c); shift_opt=$2
    for g in "" "-g"; do sfx=.s; [ -n "$g" ] && sfx=.g.s
      for try in 1 2 3; do vc $CF $shift_opt ${3:-} $g -S "$1" -o "$OUT/asm/$stem$sfx" </dev/null >/dev/null 2>&1 && break; done
      [ -s "$OUT/asm/$stem$sfx" ] || echo "FAILED $stem$sfx"
    done; }
  one ../../quickjs-master/quickjs.c -O1 "$QF" &
  one ../../quickjs-master/libregexp.c -O0 &
  for f in ../../quickjs-master/dtoa.c ../../quickjs-master/libunicode.c ../../vbcc-librarytemplate/library.c qjsfuncs.c execinline.c quickjs_libc_lib.c amiga_ssl_lib.c sharedlib_worker.c amiga_ffi.c sharedlib_mem.c sharedlib_string.c sharedlib_math_soft.c sharedlib_time.c sharedlib_strtod.c sharedlib_printf.c sharedlib_vbcc.c sharedlib_int64_conv.c sharedlib_dbl_helpers.c sharedlib_posix.c sharedlib_stdio.c sharedlib_clib.c sharedlib_fetch.c; do one $f -O1 & done
  wait
  python3 "$HERE/tools/mkfuncs.py" "$OUT/lib.map" "$OUT/asm" "$ROOT" "$OUT/lib.funcs" && echo "symbols: $(/usr/bin/grep -c '^F' "$OUT/lib.funcs") functions"
  ;;
run)
  b=${2:?bench name}; base=${3:-}
  [ -f "$OUT/lib.funcs" ] || { echo "run 'perf/profile.sh symbols' first"; exit 1; }
  [ -f "$HERE/tools/hook.dylib" ] || cc -O2 -shared -o "$HERE/tools/hook.dylib" "$HERE/tools/hook.c" || exit 1
  prof() { W=$(mktemp -d); cp -R "${PERF_VM:-$HERE/.vm}" "$W/vm"; mkdir -p "$W/vols"
    cp "$ROOT/amiga/libs/quickjs.020soft.library" "$W/vm/libs/quickjs.library"; cp "$HERE/bench/$1.js" "$W/vm/"
    ( cd "$W/vm" && PROF_OUT="$OUT/$1.prof" PROF_FUNCS="$OUT/lib.funcs" "$HERE/tools/prof.py" -S --vols-base-dir "$W/vols" -l main:info -C 68020 -m 65536 -H disable -s 2048 --cwd sys: -V "sys:$PWD" -a libs:sys:libs -a s:sys:s -a c:sys:c -a t:sys:s -O mathieeedoubbas.library=mode:amiga -- c/qjs ${PERF_ARGS:-} $1.js < /dev/null > "$OUT/$1.raw" 2>&1 ); rm -rf "$W"; }
  prof "$b"; [ -n "$base" ] && prof "$base"
  if [ -n "$base" ]; then python3 "$HERE/tools/report.py" "$OUT/$b.prof" "$OUT/lib.funcs" --base "$OUT/$base.prof" --top ${TOP:-30}
  else python3 "$HERE/tools/report.py" "$OUT/$b.prof" "$OUT/lib.funcs" --top ${TOP:-30}; fi
  ;;
*) sed -n 2,18p "$0";;
esac
