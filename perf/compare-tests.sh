#!/bin/bash
# compare-tests.sh - run the console tests from amiga/tests on a library
# and compare what the scripts print with an earlier run.
#
#   perf/compare-tests.sh <label> [library] [baseline-label]
#
# Results go to perf/out/<label>/. With a baseline label, each test is
# reported as "same" or "DIFF" against perf/out/<baseline-label>/, after
# dropping vamos's own log lines (they start with a timestamp and carry
# addresses that differ from run to run). Tests that need a window or a
# network are not in the list.
set -u
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(dirname "$HERE")
label=${1:?usage: compare-tests.sh <label> [library] [baseline-label]}
lib=${2:-$ROOT/amiga/libs/quickjs.020soft.library}; base=${3:-}
TESTS="test_assert_timers test_buffer test_core test_crypto test_events test_extended test_fs test_inspect test_node_extras test_node_overnight test_regex test_stream test_util test_comprehensive test_all test_amiga_ffi test_ffi_classes test_child_process"
PERF_BENCH_DIR=$ROOT/amiga/tests "$HERE/measure.sh" "$label" "$lib" $TESTS > /dev/null 2>&1
script_output() { /usr/bin/grep -v -E '^[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]+ ' "$1"; }
for t in $TESTS; do
  new=$HERE/out/$label/$t.out
  if [ -z "$base" ]; then echo "$t $(cut -d' ' -f2 "$HERE/out/$label/$t.instr")"; continue; fi
  old=$HERE/out/$base/$t.out
  if diff <(script_output "$old") <(script_output "$new") > /dev/null; then
    echo "same $t $(cut -d' ' -f2 "$HERE/out/$base/$t.instr") -> $(cut -d' ' -f2 "$HERE/out/$label/$t.instr")"
  else
    echo "DIFF $t"; diff <(script_output "$old") <(script_output "$new") | cut -c1-160 | head -6
  fi
done
