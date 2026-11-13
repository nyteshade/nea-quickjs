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

The scripts under `prototype/` and `tools/` still carry the absolute
scratch paths they were written with; `measure.sh` here is the
repository-relative entry point.

All figures are executed-instruction counts under an emulator. They are
exact and repeatable, but they are not seconds: no cache, trap or FPU
timing is modelled.
