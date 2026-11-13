#!/bin/bash
# check-compiler.sh [path-to-vbccm68k]
#
# Says whether a vbccm68k has the "constant reloaded at the exit label"
# bug (README.md in this directory). Compiles exit-reload.c the way
# "vc +aos68k -cpu=68020 -O1" does and looks at what follows the call to
# g(): any instruction that writes d0 before the rts destroys the value
# f() is returning.
#
# With no argument it tests the vbccm68k that vc would run (first on PATH).
# Exit status: 0 good, 1 bad, 2 could not compile.
HERE=$(cd "$(dirname "$0")" && pwd)
CC=${1:-$(command -v vbccm68k)}
[ -x "$CC" ] || { echo "no vbccm68k (give its path, or put it on PATH)"; exit 2; }
OUT=$(mktemp -d)
"$CC" -quiet "$HERE/exit-reload.c" -o="$OUT/exit-reload.s" -O=991 -cpu=68020 < /dev/null > "$OUT/log" 2>&1 \
  || { echo "COMPILE FAILED: $CC"; cat "$OUT/log"; rm -rf "$OUT"; exit 2; }
bad=$(awk '/^\tjsr\t_g$/ {seen=1; next}
           seen && /^\trts/ {exit}
           seen && /,d0$/ {print}' "$OUT/exit-reload.s")
rm -rf "$OUT"
if [ -n "$bad" ]; then
  echo "BAD:  $CC overwrites the return value after the call:$bad"
  exit 1
fi
echo "GOOD: $CC ($(shasum "$CC" | cut -c1-12))"
