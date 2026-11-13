# perf/ - 68k speed work

Research and tools from the 2026-11-12 investigation into making the
engine faster on 68020-68060. The ranked plan and its tasks are in Fina
(tag `perf-68k`).

- `research/` - the five research lanes' notes and the shared brief.
- `prototype/` - the C-only interpreter prototype as it was measured
  (`r2-quickjs.patch`, `results.md`), the unrun assembly-core sketch
  (`asmcore/`), and verified integer arithmetic routines (`arith/`).
- `tools/` - an exact executed-instruction counter and profiler for qjs
  under vamos (`hook.c` + `prof.py`), with reporting scripts.
- `bench/` - the console benchmarks, plus `edge.js` and `modchk.js`,
  whose output must not change.
- `int64cmp/` - checks the library's 64-bit integer helpers (multiply,
  divide, modulo, shifts, conversions to and from double) against
  vc.lib and against exact values, for all six variants. Rerun with
  `PERF_VM=<dir with libs/mathieeedoubbas.library> perf/int64cmp/run.sh`
  after any change to `library/vbcc/sharedlib_int64*`; it must report
  `0 wrong` for every `ours.out`.
- `mathcheck/` - compiles the FPU variants' floor/ceil/trunc/round/
  fmod/ldexp/frexp/pow replacements for this machine and compares them
  with the host libm: `perf/mathcheck/run.sh`, must end with `0 wrong`.
  The same script checks the library's snprintf (`sharedlib_printf.c`)
  against the host's over 8000 conversions (`printfcheck.c`).

The scripts under `prototype/` and `tools/` still carry the absolute
scratch paths they were written with; `measure.sh` here is the
repository-relative entry point.

All figures are executed-instruction counts under an emulator. They are
exact and repeatable, but they are not seconds: no cache, trap or FPU
timing is modelled.
