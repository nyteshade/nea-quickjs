# Host tests — `amiga/tests/host/`

Tests that run against the host macOS `qjs` binary (built from
`quickjs-master/`) for fast iteration. These verify JavaScript-only
logic without needing Amiga hardware or an emulator.

## Running

Build the host qjs once:

    cmake --build quickjs-master/build --target qjs_exe

Then:

    ./quickjs-master/build/qjs -m amiga/tests/host/<test>.mjs

Or run the full host suite:

    amiga/tests/host/run-all.sh

## What belongs here

- Compatibility tests for vendored JS libraries (ne-enumeration,
  ne-extension, ne-basic-extensions)
- Logic tests for pure-JS extended features (URL, path, TextEncoder,
  etc.) where the behaviour doesn't depend on Amiga specifics
- Regression tests catching issues specific to QuickJS-ng 0.12.1

## What does NOT belong here

- Anything that needs `qjs:std` or `qjs:os` from `quickjs.library`
  (put those in `amiga/tests/` and run in emulator/Amiga)
- Anything that tests fetch, AmiSSL, dos.library — those are emulator
  only
- Network tests (use mocks)

## Expected run time

The full host suite should complete in under 1 second. If tests get
slow, split them or move heavy integration tests to emulator.
