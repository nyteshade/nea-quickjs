#!/bin/bash
# check-tests.sh — compare captured Amiga test output against goldens.
#
# Usage: scripts/check-tests.sh <results-dir>
#
# <results-dir> is the directory you pulled from RAM:qjs-results/
# on the Amiga (scp, mount, whatever). Typical layout:
#
#   results/
#     SUMMARY
#     test_workers.txt
#     test_fetch.txt
#     test_net.txt
#
# Match rules are defined in amiga/tests/golden/ — see its README.md.
# Exits 0 if every golden pattern matches; non-zero on any mismatch.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GOLDEN_DIR="$ROOT/amiga/tests/golden"

if [ $# -ne 1 ]; then
    echo "usage: $0 <results-dir>" >&2
    exit 2
fi

RESULTS_DIR="$1"
if [ ! -d "$RESULTS_DIR" ]; then
    echo "error: results dir '$RESULTS_DIR' not found" >&2
    exit 2
fi

overall_fail=0

check_one() {
    local golden_file="$1"
    local output_file="$2"
    local label
    label="$(basename "$golden_file" .golden)"

    if [ ! -f "$output_file" ]; then
        echo "FAIL [$label]: missing $output_file"
        overall_fail=1
        return
    fi

    local line_fail=0
    local lineno=0
    while IFS= read -r line; do
        lineno=$((lineno + 1))
        case "$line" in
            ''|'#'*)  ;;
            LITERAL:*)
                pat="${line#LITERAL:}"
                pat="${pat# }"
                if ! grep -Fxq -- "$pat" "$output_file"; then
                    echo "FAIL [$label] line $lineno: LITERAL not found: $pat"
                    line_fail=1
                fi
                ;;
            CONTAINS:*)
                pat="${line#CONTAINS:}"
                pat="${pat# }"
                if ! grep -Fq -- "$pat" "$output_file"; then
                    echo "FAIL [$label] line $lineno: CONTAINS not found: $pat"
                    line_fail=1
                fi
                ;;
            REGEX:*)
                pat="${line#REGEX:}"
                pat="${pat# }"
                if ! grep -Eq -- "$pat" "$output_file"; then
                    echo "FAIL [$label] line $lineno: REGEX no match: $pat"
                    line_fail=1
                fi
                ;;
            *)
                echo "WARN [$label] line $lineno: unknown rule: $line"
                ;;
        esac
    done < "$golden_file"

    if [ $line_fail -eq 0 ]; then
        echo "OK   [$label]"
    else
        overall_fail=1
    fi
}

check_one "$GOLDEN_DIR/test_workers.golden" "$RESULTS_DIR/test_workers.txt"
check_one "$GOLDEN_DIR/test_fetch.golden"   "$RESULTS_DIR/test_fetch.txt"
check_one "$GOLDEN_DIR/test_net.golden"     "$RESULTS_DIR/test_net.txt"

if [ $overall_fail -eq 0 ]; then
    echo ""
    echo "All regression tests match golden output."
    exit 0
else
    echo ""
    echo "One or more regression tests failed to match golden output." >&2
    exit 1
fi
