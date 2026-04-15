#!/bin/bash
# Run all host compat/regression tests.  Should exit 0 if all pass,
# non-zero if any regress.  Meant for pre-commit / pre-push / CI.

set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
QJS="$ROOT/quickjs-master/build/qjs"

if [ ! -x "$QJS" ]; then
    echo "Host qjs not built yet — building..."
    cmake --build "$ROOT/quickjs-master/build" --target qjs_exe
fi

fails=0
total=0
for test in "$HERE"/*.mjs; do
    total=$((total + 1))
    name=$(basename "$test" .mjs)
    # test_extended_bundle needs qjs:std / qjs:os exposed on the host,
    # which is what --std does on upstream qjs.
    case "$name" in
        test_extended_bundle) flags="--std -m" ;;
        *)                    flags="-m" ;;
    esac
    if "$QJS" $flags "$test" 2>&1; then
        echo ""
    else
        echo "*** $name FAILED"
        fails=$((fails + 1))
    fi
done

echo
if [ "$fails" -eq 0 ]; then
    echo "all $total host tests passed"
    exit 0
else
    echo "$fails of $total host tests failed"
    exit 1
fi
