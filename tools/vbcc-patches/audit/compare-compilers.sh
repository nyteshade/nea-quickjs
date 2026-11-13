#!/bin/bash
# compare-compilers.sh <vbccm68k-A> <vbccm68k-B> [outdir]
#
# Compiles every C file of the library (three CPUs, FPU and soft) and of
# the CLI to assembly with each of two vbccm68k binaries, using the
# compile commands the Makefiles themselves would run, then lists every
# function whose code differs (fdiff.py). 167 compilations per compiler,
# about ten seconds per compiler on eight cores.
#
# Use it before trusting a rebuilt or patched compiler: "no differences"
# means the two compilers build byte-identical libraries; a short list
# is the complete set of functions to read.
#
# Nothing is written into the source tree: assembly goes to outdir
# (default: a new temporary directory, printed at the end).
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
A=${1:?usage: compare-compilers.sh <vbccm68k-A> <vbccm68k-B> [outdir]}
B=${2:?usage: compare-compilers.sh <vbccm68k-A> <vbccm68k-B> [outdir]}
OUT=${3:-$(mktemp -d)}
export VBCC=${VBCC:-$HOME/vbcc}
mkdir -p "$OUT/binA" "$OUT/binB"
ln -sf "$(cd "$(dirname "$A")" && pwd)/$(basename "$A")" "$OUT/binA/vbccm68k"
ln -sf "$(cd "$(dirname "$B")" && pwd)/$(basename "$B")" "$OUT/binB/vbccm68k"

# The compile commands, from the Makefiles (make -n runs nothing).
: > "$OUT/cmds.txt"
for cpu in 68020 68040 68060; do
  make -n -B -C "$ROOT/library/vbcc" CPU=$cpu fpu soft \
       OBJDIR_SOFT=@OUT@/${cpu}soft OBJDIR_FPU=@OUT@/${cpu}fpu LIBSDIR=@OUT@/libs < /dev/null 2> /dev/null \
    | /usr/bin/grep "/bin/vc " >> "$OUT/cmds.txt"
done
make -n -B -C "$ROOT/library/vbcc" -f Makefile.cli OBJDIR=@OUT@/cli CDIR=@OUT@/c < /dev/null 2> /dev/null \
  | /usr/bin/grep "/bin/vc .* -c " >> "$OUT/cmds.txt"
echo "$(wc -l < "$OUT/cmds.txt" | tr -d ' ') compile commands"

# vc runs the first vbccm68k on PATH, so each compiler gets its own PATH.
one() { # which, command line
  local which=$1 cmd=${2#*/bin/vc }
  cmd=${cmd//@OUT@/$OUT/asm$which}; cmd=${cmd/ -c / -S }; cmd=${cmd%.o}.s
  local out=${cmd##* }
  mkdir -p "$(dirname "$out")"
  ( cd "$ROOT/library/vbcc" && ulimit -s 65520 && PATH=$OUT/bin$which:$VBCC/bin:$PATH \
      "$VBCC/bin/vc" $cmd > "${out%.s}.log" 2>&1 < /dev/null ) || { echo "FAILED ($which): $out"; rm -f "$out"; }
}
for which in A B; do
  while IFS= read -r line; do
    one $which "$line" &
    while [ "$(jobs -r | wc -l)" -ge 8 ]; do sleep 0.2; done
  done < "$OUT/cmds.txt"
  wait
done

python3 "$HERE/fdiff.py" "$OUT/asmA" "$OUT/asmB" -L
rc=$?
echo "assembly and logs are in $OUT (fdiff.py -v -L $OUT/asmA $OUT/asmB shows the differences)"
exit $rc
