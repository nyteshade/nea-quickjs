#!/bin/bash
# stack-tests.sh - the growable stack under vamos, with every setting.
#
#   perf/stack-tests.sh <label> [library] [cpu]
#
#   label    names this run; outputs go to perf/out/<label>-<case>/
#   library  defaults to amiga/libs/quickjs.020soft.library
#   cpu      68020 (default) or 68040; an FPU variant needs 68040
#
# Runs amiga/tests/test_stack_chain.js once per case below, each with
# other qjs options, on a task stack of 16 KB so that qjs really moves
# to the 64 KB block its start-up code allocates (measure.sh's usual
# 2 MB would hide that). What happens when the system has no memory
# for a block is tested by the script itself, by having requests
# refused (os.stackInfo(n)): vamos stops when its memory runs out
# instead of returning NULL. Then two checks no script can make from
# the inside:
#   - after qjs has ended, vamos reports the memory nobody freed
#     ("orphan"); the run that recursed deeply must leave no more
#     behind than a run of an empty script;
#   - a loop of 200,000 function calls must leave no more behind
#     either (before the frame arena every call leaked its frame).
#
# Needs PERF_VM to name a template directory whose c/qjs was built
# from this tree's qjs.c with -DQJS_NO_STACK_CHECK and the default
# __stack of 64 KB (the options --stack-floor and --stack-chunk do not
# exist in an older qjs). See the header of measure.sh for the rest.
#
# A healthy run prints one "... passed, 0 failed" line per case and
# "orphans: same as an empty run" twice.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(dirname "$HERE")
label=${1:?usage: stack-tests.sh <label> [library] [cpu]}
lib=${2:-$ROOT/amiga/libs/quickjs.020soft.library}
cpu=${3:-68020}
VM=${PERF_VM:-$HERE/.vm}
[ -x "$VM/c/qjs" ] || { echo "no $VM/c/qjs - see the header of this script"; exit 1; }

# case name : qjs options : what the INFO line of the test must show
cases=(
  "default::floor 64 KB, block 128 KB, cap 1024 KB"
  "floor256:--stack-floor 256:floor 256 KB, block 128 KB, cap 1024 KB"
  "chunk64:--stack-chunk 64:floor 64 KB, block 64 KB, cap 1024 KB"
  "cap512:--stack-size 512:floor 64 KB, block 128 KB, cap 512 KB"
  "all:--stack-floor 128 --stack-chunk 96 --stack-size 2048:floor 128 KB, block 96 KB, cap 2048 KB"
  "nocap:--stack-size 0:floor 64 KB, block 128 KB, cap none"
  "nogrow:--stack-chunk 0:floor 64 KB, block 0 KB, cap 1024 KB"
)
for c in "${cases[@]}"; do
  name=${c%%:*}; rest=${c#*:}; args=${rest%%:*}; want=${rest#*:}
  PERF_CPU=$cpu PERF_STACK=16 PERF_ARGS="$args" PERF_BENCH_DIR=$ROOT/amiga/tests \
    "$HERE/measure.sh" "$label-$name" "$lib" test_stack_chain > /dev/null 2>&1
  out=$HERE/out/$label-$name/test_stack_chain.out
  if /usr/bin/grep -q "^INFO $want" "$out"; then sizes="sizes as asked"; else sizes="SIZES NOT AS ASKED"; fi
  echo "$name: $(tail -1 "$out" | cut -c1-40) ($sizes)"
  /usr/bin/grep "^FAIL" "$out"
done

W=$(mktemp -d)
run_plain() {   # run_plain <memKiB> <script> [qjs options]  -> raw vamos output
  mem=$1; script=$2; shift 2
  rm -rf "$W/vm"; cp -R "$VM" "$W/vm"; cp "$lib" "$W/vm/libs/quickjs.library"; cp "$script" "$W/vm/"
  ( cd "$W/vm" && vamos -S -C "$cpu" -m "$mem" -H disable -s 16 --cwd sys: -V "sys:$PWD" \
      -a libs:sys:libs -a s:sys:s -a c:sys:c -a t:sys:s \
      -O mathieeedoubbas.library=mode:amiga -- c/qjs "$@" "$(basename "$script")" < /dev/null 2>&1 )
}
# What is left allocated after qjs has ended.
orphans() { /usr/bin/grep "orphan" | sed 's/.*orphan: //' | sort | awk '{print $2}' | tr '\n' ' '; }
cat > "$W/empty.js" <<'EOF'
print('empty');
EOF
cat > "$W/calls.js" <<'EOF'
function f(a) { return a + 1; }
let s = 0;
for (let i = 0; i < 200000; i++) s = f(s);
print(s);
EOF
base=$(run_plain 65536 "$W/empty.js" | orphans)
deep=$(run_plain 65536 "$ROOT/amiga/tests/test_stack_chain.js" | orphans)
calls=$(run_plain 65536 "$W/calls.js" | orphans)
for pair in "deep recursion:$deep" "200,000 calls:$calls"; do
  what=${pair%%:*}; got=${pair#*:}
  if [ "$got" = "$base" ]; then echo "orphans after $what: same as an empty run"
  else echo "ORPHANS after $what: $got (an empty run: $base)"; fi
done
rm -rf "$W"
