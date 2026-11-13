#!/bin/bash
# verify-all.sh - everything that can be checked on the Mac before a
# release is handed to the Amiga.
#
#   perf/verify-all.sh <label> [benchmark-baseline-label]
#
# Runs, against the binaries now in amiga/libs/ (check the version
# lines it prints last: a failed build leaves the previous ones):
#   - the 18 console tests, compared with the saved 0.231 run (t231)
#   - the benchmarks, counting instructions; with a baseline label,
#     their output is compared with perf/out/<baseline>/
#   - every regression test on 020soft, 040soft and 060soft
#   - those that an FPU variant can run under vamos on 040fpu and 060fpu
#   - check_examples, check_feature_globals, the REPL harness
# A healthy run prints only "... passed, 0 failed" / "pass 0 fail"
# lines, the instruction counts, the three check summaries and the
# version strings. 020fpu cannot run the maths tests in this emulator.
cd "$(dirname "$0")/.." || exit 1
label=${1:?usage: verify-all.sh <label> [benchmark-baseline-label]}; base=${2:-}
T="test_numeric_edge test_fpu_numeric test_compiler_regressions test_dynamic_import test_stack_limit test_ffi_lists test_led test_reaction_events test_persistence test_screen_font"
F="test_fpu_numeric test_compiler_regressions test_dynamic_import test_stack_limit test_ffi_lists"
[ -d perf/out/t231 ] && perf/compare-tests.sh "t$label" amiga/libs/quickjs.020soft.library t231 | /usr/bin/grep -v '^same'
perf/measure.sh "v$label" > /dev/null; tr '\n' ' ' < "perf/out/v$label/instr.txt"; echo
if [ -n "$base" ]; then for b in intloop float prop array call intdiv intops strcat alloc regex edge modchk; do
  cmp -s "perf/out/$base/$b.out" "perf/out/v$label/$b.out" || echo "DIFF $b"; done; fi
for v in 020soft 040soft 060soft; do
  PERF_BENCH_DIR=$PWD/amiga/tests perf/measure.sh "t$label$v" amiga/libs/quickjs.$v.library $T >/dev/null 2>&1
  for t in $T; do echo "$v $t: $(/usr/bin/grep -v -E '^[0-9]{2}:' "perf/out/t$label$v/$t.out" | tail -1 | cut -c1-50)"; done
done
for v in 040fpu 060fpu; do
  PERF_CPU=68040 PERF_BENCH_DIR=$PWD/amiga/tests perf/measure.sh "t$label$v" amiga/libs/quickjs.$v.library $F >/dev/null 2>&1
  for t in $F; do echo "$v $t: $(/usr/bin/grep -c PASS "perf/out/t$label$v/$t.out") pass $(/usr/bin/grep -c FAIL "perf/out/t$label$v/$t.out") fail"; done
done
python3 scripts/check_examples.py 2>&1 | tail -1
python3 scripts/check_examples.py --past-open 2>&1 | tail -1
python3 scripts/check_feature_globals.py 2>&1 | tail -1
node tools/repl-harness/harness.js 2>&1 | tail -1
for v in 020fpu 020soft 040fpu 040soft 060fpu 060soft; do strings amiga/libs/quickjs.$v.library | /usr/bin/grep 'VER.*quickjs' | head -1; done
strings amiga/c/qjs | /usr/bin/grep 'VER: qjs'
