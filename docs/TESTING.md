# Regression testing

`quickjs.library` is validated against three canonical tests. The
suite runs on a real Amiga (or Amiberry) because the point is to
verify behavior on the target, not simulate it on the host.

## What the suite covers

| Test                        | What it proves                                        |
| --------------------------- | ----------------------------------------------------- |
| `amiga/c/test_workers`      | Native Worker primitive: isolation, concurrency, cleanup, leak-free over 100 cycles |
| `tests/test_fetch.js`       | fetch() over HTTP and HTTPS, JSON, 404, ArrayBuffer, headers |
| `tests/test_net.js`         | `qjs:net` module: probe, reprobe, status shape        |
| `tests/test_buffer.js`      | Node Buffer subset: construction, encodings, read/write ints, compare, search, fill, copy, subarray |

Last known-good baselines (library revision 0.081):

- `test_workers` — **59/0 pass**
- `test_fetch`   — **22/0 pass**
- `test_net`     — **8/0 pass**
- `test_buffer`  — **60/0 pass** (host qjs run; Amiga baseline pending)

## Running the suite on the Amiga

```
stack 65536
execute tests/run-tests.script
```

The script writes each test's output to `RAM:qjs-results/`:

```
RAM:qjs-results/
  SUMMARY
  test_workers.txt
  test_fetch.txt
  test_net.txt
```

Prerequisites:

- `quickjs.library` 0.080+ in `LIBS:` (or via assigns).
- `stack 65536` before running — the CLI refuses to start below this
  (see `qjs -e 'print(5)'` error message for details).
- For `test_fetch.js`: working `bsdsocket.library` and AmiSSL.
- For `test_net.js`: nothing extra — the test reflects what's
  installed.

## Checking results on the host

Pull `RAM:qjs-results/` off the Amiga (scp, shared volume, floppy,
whatever) and run:

```
scripts/check-tests.sh path/to/results/
```

The checker compares each output against a golden file in
`amiga/tests/golden/` using three match rules:

- `LITERAL:` — exact line must appear.
- `CONTAINS:` — substring must appear on some line.
- `REGEX:` — line must match a POSIX extended regex.

This avoids brittle byte-exact diffs while still locking in the
structural invariants (test names, pass counts, section headers).

Exit code `0` means every pattern matched; non-zero means at least
one test regressed.

## Updating goldens

When a test legitimately changes (new case added, count bumps,
labels reworded), edit the corresponding `.golden` file in
`amiga/tests/golden/`. Keep changes surgical — the goal is to let
unrelated regressions stand out.

## Adding a new test

1. Write the JS test under `amiga/tests/test_<name>.js`.
2. Add an invocation to `amiga/tests/run-tests.script` that writes
   to `RAM:qjs-results/test_<name>.txt`.
3. Create `amiga/tests/golden/test_<name>.golden` with the minimum
   set of LITERAL/CONTAINS/REGEX patterns that prove the test ran
   to completion.
4. Add a row to the table at the top of this file.
