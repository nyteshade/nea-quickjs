# Golden test outputs

These files are the canonical expected outputs for the regression
suite (`amiga/tests/run-tests.script`).

## Per-test match rules

The checker script (`scripts/check-tests.sh`) compares a fresh run
against each file here. Because some values are **intentionally not
byte-exact** (response body lengths, HTTP user agent, stat times),
the match uses **pattern lines** in the golden file:

- Lines starting with `LITERAL:` must appear verbatim in the output.
- Lines starting with `REGEX:` must match (full-line) as a POSIX
  extended regex.
- Lines starting with `CONTAINS:` must appear as a substring of some
  line in the output.
- Lines starting with `#` are comments.
- Blank lines are ignored.

The checker exits 0 if every pattern in every golden file matches.

## Files

| Golden file             | Matches against             |
| ----------------------- | --------------------------- |
| `test_workers.golden`   | `RAM:qjs-results/test_workers.txt` |
| `test_fetch.golden`     | `RAM:qjs-results/test_fetch.txt`   |
| `test_net.golden`       | `RAM:qjs-results/test_net.txt`     |

## Updating

When a test legitimately changes its output (new test case, reworded
summary, etc.), edit the golden file. When a test's numeric counts
change (22/0 → 23/0 etc.) update the LITERAL pass count line here.
