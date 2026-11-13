# Lane B (measurement) notes

Lane dir (`$L`):
`/private/tmp/claude-501/-Volumes-Code-Amiga-nea-quickjs/16cb392e-cdad-4185-838c-ecaa322c3b16/scratchpad/perf/lane-b-measure`

Nothing in the repository
was modified (`git status` showed only the pre-existing `.claude/settings.local.json`).

## Status: complete (round 1)

Every number is MEASURED under vamos unless a line says ESTIMATE.

## What vamos is and what it lets us conclude

- amitools 0.6.0 with a built-in Musashi core. It is an instruction-level
  emulator: no cache, no pipeline, no bus timing. What I measured is
  **instructions executed** (exact, deterministic, repeatable to the instruction).
- Musashi also reports "total cycles" from per-opcode tables. I list it, but it
  is not cycle accurate for a 68020/030 and has no 68060 model at all.
- Supported CPUs: 68000, 68020, 68040 ("68030" is a 68020 with a flag). The
  68881 is emulated only with `-C 68040`; `-C 68020` takes an F-line exception.
  Musashi does not implement FMOD (`fpgen_rm_reg: unimplemented opmode 21`),
  so the 020fpu library cannot run JS `%` on non-integers here.
- exec.library (AllocPooled etc.) and, by default, mathieeedoubbas.library are
  Python traps costing one counted instruction. I ran the real OS 3.2.3
  mathieeedoubbas.library as 68k code (`-O mathieeedoubbas.library=mode:amiga`)
  so soft-float is counted; exec's allocator is never counted.
- Valid conclusions: which code runs, how often, instruction-count ratios
  between builds, and where instructions go. An instruction-count saving is a
  real saving on every 68k.
- Not valid: seconds on real hardware, the size of a gain on a given CPU,
  anything about cache misses (a 1.9 MB library on a 68030 with a 256-byte
  cache), branch prediction or superscalar effects on the 68060, FPU
  instruction timing, or the cost of FPSP traps on 040/060. Wall time under
  vamos is dominated by host effects (alloc.js takes 26 s only because of
  Python traps) and means nothing.

## Method (repeat with the tools in `tools/`)

1. `tools/hook.c` -> `hook.dylib`: native per-instruction hook installed with
   `m68k_set_instr_hook_callback` (exported by the Musashi .so). Exact PC
   histogram, shadow call stack for call counts and inclusive counts.
2. `tools/prof.py`: vamos wrapper, installs the hook, records segment addresses.
3. Symbols: relink the shipped objects with `vlink -M` (output is byte-identical
   to the shipped library), then `tools/mkasm.sh` + `tools/mkfuncs.py` name the
   anonymous static functions from `vc -S` / `vc -S -g` listings.
4. `tools/job.sh <vm> <cpu> <bench> <tag>` runs one profile into `prof/`.
5. `tools/report.py` (categories, top functions), `tools/opclass.py` (opcode
   classes), `tools/disppath.py` (per-dispatch path), `tools/summary.py` (tables).
6. Every figure below is "benchmark minus empty script" unless it says start-up.

Configurations: **soft-O0** = shipped 020soft, 68020, native maths library.
**soft-O1** = scratch build, quickjs.c at -O1, otherwise identical.
**fpu** = shipped 020fpu on the emulated 68040.

## Baseline: instructions executed, whole process

| benchmark | soft-O0 | soft-O1 | fpu (68040) | O1 vs O0 |
|---|---|---|---|---|
| empty (start-up) | 67,834,448 | 59,910,165 | 59,592,132 | -11.7 % |
| intloop 200k | 425,490,456 | 592,340,877 | 553,618,367 | +39 % |
| float 100k | 371,285,750 | 469,732,461 | 375,261,799 | +27 % |
| prop 100k | 374,569,912 | 427,386,391 | 400,542,421 | +14 % |
| array 100k | 327,907,343 | 443,269,962 | 411,490,892 | +35 % |
| call 100k | 284,024,501 | 365,769,574 | 343,450,760 | +29 % |
| strcat 100k | 326,883,296 | 393,341,911 | 372,790,458 | +20 % |
| alloc 50k | 494,513,641 | 532,100,362 | 513,731,844 | +8 % |
| regex 5k | 156,771,606 | 150,729,941 | 149,146,553 | -4 % |
| intdiv 100k | 451,533,713 | not run | fails (FMOD) | |
| intops 100k (control) | 301,143,372 | not run | 398,269,047 | |

Musashi cycles, benchmark minus empty, soft-O0 / soft-O1 (millions): intloop
2678 / 3414, float 2160 / 2603, prop 2213 / 2439, array 1916 / 2425, call
1606 / 1965, strcat 1887 / 2206, alloc 3066 / 3201, regex 613 / 616. The -O1
build is slower by this measure too.

Bytecodes dispatched (soft-O0, exact) and instructions per bytecode:

| | intloop | float | prop | array | call | strcat | alloc |
|---|---|---|---|---|---|---|---|
| bytecodes (M) | 4.20 | 2.70 | 3.20 | 3.41 | 2.20 | 2.12 | 2.35 |
| all instr / bytecode, soft-O0 | 85 | 112 | 96 | 76 | 98 | 122 | 182 |
| JS_CallInternal self / bytecode, soft-O0 | 58 | 59 | 52 | 53 | 70 | 52 | 60 |
| JS_CallInternal self / bytecode, soft-O1 | 103 | 101 | 78 | 92 | 114 | 95 | 95 |

## Where the instructions go

### soft-O0 native-math
| | intloop | float | prop | array | call | strcat | alloc | regex |
|---|---|---|---|---|---|---|---|---|
| instructions (M, minus empty) | 357.7 | 303.5 | 306.7 | 260.1 | 216.2 | 259.0 | 426.7 | 88.9 |
| JS_CallInternal self % | 68.1 | 52.6 | 53.9 | 68.9 | 70.7 | 42.8 | 33.0 | 12.6 |
| call glue % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.5 |
| property/shape/object % | 3.0 | 2.7 | 9.7 | 5.1 | 2.5 | 2.1 | 22.9 | 11.8 |
| allocator % | 0.0 | 0.0 | 0.0 | 0.0 | 0.5 | 6.6 | 13.7 | 11.1 |
| GC & free % | 3.6 | 3.2 | 5.7 | 4.4 | 5.5 | 5.7 | 10.9 | 6.1 |
| atoms & strings % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 15.3 | 0.4 | 3.5 |
| number helpers % | 5.9 | 4.0 | 7.3 | 5.2 | 2.8 | 5.7 | 1.6 | 1.4 |
| own libc % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| int64 helpers % | 1.1 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| float glue (sharedlib_math) % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| mathieeedoubbas (68k) % | 0.0 | 21.7 | 3.2 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| regexp engine % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 37.6 |
| other quickjs.c (small helpers) % | 18.3 | 15.8 | 20.2 | 16.3 | 17.3 | 19.8 | 14.0 | 12.4 |
| OS traps % | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.3 | 0.2 |
| everything else % | 0.0 | 0.1 | 0.0 | 0.1 | 0.6 | 1.8 | 3.2 | 2.8 |
| opcode: move.l (An)+,(An)+  [struct copy] % | 9.4 | 5.7 | 6.0 | 11.3 | 7.4 | 6.2 | 4.7 | 2.7 |
| opcode: move.l -(An),-(sp)  [struct pushed as argument] % | 2.9 | 2.8 | 4.1 | 2.9 | 4.1 | 3.6 | 3.0 | 3.4 |
| opcode: movem.l d0/d1/a0/a1 <-> mem  [struct return/store] % | 2.5 | 2.4 | 2.1 | 2.2 | 2.3 | 1.9 | 1.3 | 0.8 |
| opcode: inline memcpy template (byte/word/long loop) % | 3.5 | 2.4 | 4.8 | 3.1 | 2.5 | 5.2 | 3.5 | 7.1 |
| opcode: sum of the four copy patterns % | 18.3 | 13.2 | 16.9 | 19.6 | 16.3 | 17.0 | 12.5 | 14.1 |
| opcode: jsr/bsr + rts % | 5.5 | 4.8 | 6.0 | 5.0 | 5.9 | 7.3 | 8.2 | 7.4 |

### soft-O1 native-math
| | intloop | float | prop | array | call | strcat | alloc | regex |
|---|---|---|---|---|---|---|---|---|
| instructions (M, minus empty) | 532.4 | 409.8 | 367.5 | 383.4 | 305.9 | 333.4 | 472.2 | 90.8 |
| JS_CallInternal self % | 81.3 | 66.7 | 67.5 | 81.6 | 81.8 | 60.6 | 47.3 | 18.9 |
| call glue % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.4 |
| property/shape/object % | 2.0 | 1.9 | 6.7 | 3.3 | 1.7 | 1.6 | 18.1 | 10.2 |
| allocator % | 0.0 | 0.0 | 0.0 | 0.0 | 0.4 | 4.4 | 10.7 | 9.7 |
| GC & free % | 2.1 | 2.1 | 4.1 | 2.6 | 3.4 | 3.9 | 8.4 | 5.3 |
| atoms & strings % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 10.3 | 0.4 | 3.2 |
| number helpers % | 3.9 | 3.1 | 6.0 | 3.5 | 2.0 | 4.4 | 1.4 | 1.3 |
| own libc % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| int64 helpers % | 0.7 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| float glue (sharedlib_math) % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| mathieeedoubbas (68k) % | 0.0 | 16.3 | 2.6 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| regexp engine % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 36.8 |
| other quickjs.c (small helpers) % | 9.9 | 9.9 | 13.0 | 8.8 | 10.3 | 13.3 | 10.6 | 11.2 |
| OS traps % | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.3 | 0.2 |
| everything else % | 0.0 | 0.0 | 0.0 | 0.1 | 0.4 | 1.4 | 2.9 | 2.7 |
| opcode: move.l (An)+,(An)+  [struct copy] % | 6.3 | 4.2 | 5.0 | 7.6 | 5.3 | 4.7 | 4.3 | 2.7 |
| opcode: move.l -(An),-(sp)  [struct pushed as argument] % | 2.0 | 2.0 | 3.4 | 2.0 | 2.9 | 2.8 | 2.8 | 3.4 |
| opcode: movem.l d0/d1/a0/a1 <-> mem  [struct return/store] % | 1.7 | 1.8 | 1.7 | 1.5 | 1.6 | 1.5 | 1.1 | 0.8 |
| opcode: inline memcpy template (byte/word/long loop) % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 2.0 | 1.1 | 6.3 |
| opcode: sum of the four copy patterns % | 9.9 | 8.0 | 10.2 | 11.1 | 9.8 | 11.0 | 9.3 | 13.1 |
| opcode: jsr/bsr + rts % | 3.7 | 3.5 | 5.0 | 3.4 | 4.2 | 5.7 | 7.4 | 7.2 |

### 020fpu on 68040
| | intloop | float | prop | array | call | strcat | alloc | regex |
|---|---|---|---|---|---|---|---|---|
| instructions (M, minus empty) | 494.0 | 315.7 | 341.0 | 351.9 | 283.9 | 313.2 | 454.1 | 89.6 |
| JS_CallInternal self % | 79.9 | 78.1 | 67.9 | 80.0 | 80.4 | 58.1 | 45.2 | 17.7 |
| call glue % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.4 |
| property/shape/object % | 2.1 | 2.5 | 7.3 | 3.6 | 1.8 | 1.7 | 18.8 | 10.4 |
| allocator % | 0.0 | 0.0 | 0.0 | 0.0 | 0.4 | 4.7 | 11.2 | 9.8 |
| GC & free % | 2.3 | 2.7 | 4.4 | 2.8 | 3.6 | 4.2 | 8.7 | 5.3 |
| atoms & strings % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 11.0 | 0.4 | 3.2 |
| number helpers % | 4.3 | 3.8 | 6.3 | 3.8 | 2.1 | 4.6 | 1.5 | 1.4 |
| own libc % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| int64 helpers % | 0.8 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| float glue (sharedlib_math) % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| mathieeedoubbas (68k) % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| regexp engine % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 37.4 |
| other quickjs.c (small helpers) % | 10.7 | 12.9 | 14.0 | 9.6 | 11.2 | 14.2 | 11.0 | 11.4 |
| OS traps % | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.3 | 0.2 |
| everything else % | 0.0 | 0.0 | 0.0 | 0.1 | 0.4 | 1.4 | 3.0 | 2.7 |
| opcode: move.l (An)+,(An)+  [struct copy] % | 6.8 | 5.4 | 5.4 | 8.3 | 5.7 | 5.0 | 4.4 | 2.7 |
| opcode: move.l -(An),-(sp)  [struct pushed as argument] % | 2.1 | 2.7 | 3.7 | 2.2 | 3.1 | 3.0 | 2.9 | 3.4 |
| opcode: movem.l d0/d1/a0/a1 <-> mem  [struct return/store] % | 1.8 | 2.3 | 1.8 | 1.7 | 1.8 | 1.6 | 1.2 | 0.8 |
| opcode: inline memcpy template (byte/word/long loop) % | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 2.2 | 1.2 | 6.4 |
| opcode: sum of the four copy patterns % | 10.7 | 10.4 | 11.0 | 12.1 | 10.5 | 11.7 | 9.7 | 13.3 |
| opcode: jsr/bsr + rts % | 4.0 | 4.4 | 5.4 | 3.7 | 4.5 | 6.0 | 7.7 | 7.3 |


"other quickjs.c" is almost entirely three tiny helpers vbcc does not inline:
`js_dup` (17-18 instr/call), `get_u16` operand fetch (19 instr at -O0 through
an inlined generic memcpy of 2 bytes, 9 at -O1) and `js_int32` (15 instr to
build one JSValue). In intloop they are called 1.4 M times each = 19 % of the
benchmark. Own libc (memcpy, memset, strlen in sharedlib_string.c) is below
0.05 % everywhere; int64 helpers peak at 1.1 % (`i * 3` goes through
`mulint64`). Neither matters.

## Start-up (shipped 020soft, empty script, 67.8 M instructions, 470 M Musashi cycles)

Inclusive: installing the bundled JS (`QJS_InstallExtended_impl`) 80.9 %, split
into reading bytecode `JS_ReadObject` 38.1 % (atoms 13.7 %, `bc_byte_swap`
6.2 %, `bc_csum` 5.4 %) and running the top-level code `JS_EvalFunction`
39.5 %. Across those, `JS_RunGC` runs 5 times = 21.4 %. `JS_FreeRuntime` at
exit = 16.2 %. Runtime/context creation outside the bundle is under 3 %.
ESTIMATE: 470 M Musashi cycles would be about 19 s at 25 MHz and 34 s at
14 MHz if the tables were right; they are not validated, so one stopwatch
reading on a real machine is needed before quoting a start-up time.

## Answers to the other lanes

1. **-O0 has the cheaper interpreter loop: confirmed.** Same bytecode stream
   (4,200,020 dispatches in intloop), `JS_CallInternal` self is 243.6 M at -O0
   and 433.0 M at -O1 (58 vs 103 instructions per bytecode). At -O1 there is a
   block of about 30 instructions executed on 86 % of dispatches that does not
   exist at -O0, which fits the five-range-table explanation. The shipped FPU
   libraries are -O1 and carry this cost (94 per bytecode in intloop).
2. **JSValue copying: 13-20 % of all executed instructions at -O0, 8-13 % at
   -O1, as a strict lower bound** (four recognisable patterns: post-increment
   long copies, struct pushed as argument, d0/d1/a0/a1 struct return, inline
   memcpy template). It excludes the `lea`s that set the copies up (12 % of
   intloop) and field-by-field moves, so the true share is higher; counting
   every `lea` and mem-to-mem move gives a ceiling of about 32 % for intloop.
   I can support "about a fifth to a third", not 55 %, for whole benchmarks;
   single simple opcodes can still be higher. Real memcpy calls are negligible.
3. **Integer `/` and `%` do go through soft-float: confirmed.** intdiv costs
   150 M instructions more than the shift/mask control for 300k operations,
   about 500 per operation, and 22.7 % of the benchmark (87.0 M) is inside
   mathieeedoubbas. The float benchmark spends 21.7 % (66.0 M, about 130
   instructions per double operation, DERIVED from 5 operations per
   iteration) inside it. intloop spends 0.0 % there.

## The places that matter most

1. Interpreter dispatch and operand handling in `JS_CallInternal`: 33-71 % of
   every non-regex benchmark. Turning on -O1 as it stands makes it 14-39 %
   worse, not better.
2. Non-inlined helpers and 16-byte JSValue traffic: 14-20 % in three helpers
   plus at least 13-20 % in copy instructions.
3. Soft-float through the library: about 22 % of float-heavy and of integer
   divide/modulo code.
4. Start-up: 5 GC passes (21 %), exit teardown (16 %), byte-swap plus
   checksum of the bytecode (12 %).

## Could not determine

Real seconds on any 68k; 68060 behaviour; cache effects; whether the 040/060
FPU builds emit FMOD (which traps on real 040/060); allocator cost inside
exec.library; why soft-O0 float differs from fpu in the last printed digit.
