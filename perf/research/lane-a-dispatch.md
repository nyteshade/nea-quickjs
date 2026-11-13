# Lane A: what the interpreter hot path costs in 68k instructions, and what it could cost

Everything here is static evidence from vbcc's own assembly output. Nothing was run
on a 68k or timed. "MEASURED" = counted from generated assembly by the scripts in this
directory. "ESTIMATED" = my arithmetic or design, basis stated.

## 0. Headline findings (all MEASURED unless marked)

1. **The shipped -O1 build has no single jump table for the opcode switch.** vbcc's
   optimizer splits the 246-case switch into a cascade of 5 range checks + 6 single
   compares. Dispatch cost depends on the opcode number: 13 instructions for opcodes
   1-51, **56 instructions / 16 memory accesses for opcodes 178-245**, which are
   exactly the short forms the compiler emits most (get_loc0-3, put_loc*, get_arg*,
   push_0-7, if_false8, goto8, call0-3, get_loc8...). The -O0 build has one table:
   11 instructions / 7 memory accesses for every opcode.
2. **-O1 does not inline anything** (`-O1` = `-O=991`: bit 5 "global" and bit 12
   "inlining" are off). `js_dup`, `js_int32`, `get_u32`, `get_u16`, `set_value`,
   `JS_FreeValue`, `js_bool`, `js_poll_interrupts` are real `jsr` calls on the hot
   path, each taking the 16-byte JSValue by value.
3. **A by-value JSValue argument is pushed with a byte loop**: 16 x `move.b (a)+,(a)+`
   + 4 x `dbra`, then returned through `movem d0/d1/a0/a1` store/reload pairs.
   `get_loc0` copies the same 16 bytes 7 times to push one local.
4. Net: **-O1 opcode bodies are no smaller than -O0 bodies** (get_loc0: 58 vs 54
   instructions) and -O1 dispatch is far worse, so per bytecode the shipped FPU -O1
   interpreter loop executes MORE instructions than the soft -O0 one
   (get_loc0: 114 vs 65; add: 133 vs 83; if_false8: 89 vs 41).
5. The same C shaped for vbcc (field-wise copies, no helper calls) compiles at -O1 to
   a 7-instruction dispatch and 10-25 instruction bodies (toy, section 5). So most of
   the available win needs no assembly at all.
6. vbcc: no computed goto (error 76), `__reg` on locals is silently ignored, no tail
   calls. Inline asm, `__reg` parameters and `__regargs` work.

## 1. Method and tools (all in this directory)

- `build.sh <name> <cpu> <flags>`: compiles `quickjs-master/quickjs.c` to
  `out/<name>.s` with the Makefile's exact include/define set (`-c` replaced by `-S`).
- `opnames.c/.txt`: opcode number -> name, generated from `quickjs-opcode.h`
  (246 opcodes, SHORT_OPCODES on).
- `opmap.py`: finds JS_CallInternal's dispatch tables in a `.s` and writes
  `out/<name>.map` (opcode -> case label).
- `dispcount.py`: tiny emulator of the compare/branch cascade; reports instructions and
  memory accesses from the dispatch label to the indirect `jmp` for every opcode value.
- `walk.py`: static path walker. Follows one execution path from a case label back to
  the dispatch label, entering every `jsr` whose target is in the file, with branch
  outcomes given as a T/N string. Counts instructions and memory accesses (one per
  memory operand, two for read-modify-write, one per register for `movem`, one for the
  stack push/pop of `jsr`/`rts`/`pea`).
- `scen.sh`, `table.py`: the scenario set and the table below. `toyscen.sh`: same for
  the toy interpreters in `probe/`.
- Branch outcome strings were chosen by reading the branch conditions in the traces
  (int operands, no overflow, non-refcounted values, interrupt counter not expired).
  Checked by eye for `fpu020_O1` and `soft020_O0`; reused for the other columns
  (walker reported no left-over decisions and no unexpected external calls), so the
  other columns may be off by a few instructions.
- Memory-access counts are operand-level, not bus cycles; a `.b` access counts as 1.

Builds made (all `-cpu=68020` unless named): fpu -O1 (shipped FPU flags), soft -O0
(shipped soft flags), soft -O1, soft -O2, fpu -O2, fpu -O1 -speed, fpu -O2 -speed,
fpu -O3, fpu `-O=1`, `-O=3/7/31/159/415/735`, `-O=5087`, `-O=5119`, fpu040 -O1,
fpu060 -O1.

## 2. Dispatch cost today (MEASURED, `dispcount.py`)

Instructions / memory accesses from loop top to the `jmp (aN)`, by opcode number.
Add 1 instruction for the `bra` back to the loop top at the end of each case
(counted in the body numbers in section 3).

| build | 1-51 | 52-66 | 72-149 | 151-177 | 178-245 |
|---|---|---|---|---|---|
| soft020 -O0 (shipped soft) | 11 / 7 | 11 / 7 | 11 / 7 | 11 / 7 | 11 / 7 |
| fpu020 -O1 (shipped FPU) | 13 / 6 | 18 / 7 | 43 / 13 | 51 / 15 | **56 / 16** |
| fpu040 -O1 | 13 / 6 | 18 / 7 | 38 / 13 | 46 / 15 | 51 / 16 |
| fpu060 -O1 | 13 / 6 | 18 / 7 | 43 / 13 | 51 / 15 | 56 / 16 |
| soft020 -O1 | 15 / 8 | 20 / 9 | 45 / 15 | 63 / 19 (155-177) | **70 / 22** |
| fpu020 -O2 | 8 / 3 | 13 / 4 | 32 / 7 | 37 / 8 | 42 / 9 |
| fpu020 `-O=1` (regalloc only) | 10 / 2 | 10 / 2 | 10 / 2 | 10 / 2 | 10 / 2 |

Shape of the -O1 cascade (fpu020, `out/fpu020_O1.s` line ~65060): fetch (7 instr, the
opcode is stored to the frame and reloaded twice), table for 1-51, table for 52-66,
single compares for 67, 68, 69, 70, 71, table for 72-149, compare for 150, table for
151-177, table for 178-245. Between the range tests the register allocator inserts
`move.l a3,(364,a7)` spill stores; those stores are what interrupt vbcc's
compare-chain -> jump-table recognition (`calc_case_table`, `machines/m68k/machine.c`
line ~3970; JUMP_TABLE_DENSITY 0.8, JUMP_TABLE_LENGTH 8). The cause is my reading of
the output, not proven by patching the compiler.

Which optimizer bit breaks the table (MEASURED): `-O=1` gives one 246-entry table;
`-O=3` and every higher value tried (7, 31, 159, 415, 735, 991, 1023) gives the split
cascade. So it is bit 1 (the optimizer itself), not a specific later pass.

No bounds check can be removed in C: the table path is
`moveq #0; move.b (pc)+; cmp.l #245; bhi default; move.l tab(pc,d*4),a; jmp (a)`.

`-speed`: object size 1,004,860 vs 1,003,652 bytes, dispatch and all scenario counts
identical to plain -O1. No effect on this code.

## 3. Per-opcode cost today (MEASURED, `table.py` -> `out/table.md`)

Format: `dispatch+body=total instructions / total memory accesses`. Fast paths only:
int operands, no overflow, values not refcounted, own property found on first probe.

| scenario (opcode #) | fpu020 -O1 (ships) | soft020 -O0 (ships) | soft020 -O1 | fpu020 -O2 | fpu020 -O=1 | fpu020 -O=5087 (inlined; does not assemble) |
|---|---|---|---|---|---|---|
| push_i32 (1) | 13+43=56 / 55 | 11+55=66 / 55 | 15+45=60 / 59 | 8+43=51 / 52 | 10+57=67 / 46 | 15+38=53 / 53 |
| push_1 (181) | 56+32=88 / 53 | 11+30=41 / 44 | 70+34=104 / 61 | 42+32=74 / 45 | 10+31=41 / 35 | 38+28=66 / 43 |
| get_loc0 (197) | 56+58=114 / 90 | 11+54=65 / 80 | 70+60=130 / 98 | 42+58=100 / 84 | 10+56=66 / 74 | 38+23=61 / 36 |
| get_loc8 (193) | 56+59=115 / 89 | 11+59=70 / 84 | 70+61=131 / 97 | 42+59=101 / 83 | 10+63=73 / 77 | 38+28=66 / 40 |
| get_loc idx16 (87) | 43+69=112 / 94 | 11+82=93 / 96 | 45+72=117 / 98 | 32+69=101 / 89 | 10+86=96 / 91 | 20+51=71 / 66 |
| get_arg0 (209) | 56+58=114 / 91 | 11+54=65 / 80 | 70+60=130 / 99 | 42+58=100 / 84 | 10+56=66 / 74 | 38+23=61 / 37 |
| get_loc0_loc1 (196) | 56+107=163 / 157 | 11+105=116 / 153 | 70+109=179 / 165 | 42+107=149 / 152 | 10+111=121 / 148 | 38+42=80 / 55 |
| put_loc8 (194) | 56+75=131 / 99 | 11+81=92 / 98 | 70+77=147 / 107 | 42+75=117 / 93 | 10+83=93 / 94 | 38+55=93 / 71 |
| put_loc idx16 (88) | 43+86=129 / 104 | 11+103=114 / 110 | 45+89=134 / 108 | 32+86=118 / 99 | 10+108=118 / 110 | 20+60=80 / 71 |
| dup (17) | 13+55=68 / 78 | 11+55=66 / 80 | 15+57=72 / 82 | 8+55=63 / 75 | 10+57=67 / 75 | 15+39=54 / 55 |
| drop (14) | 13+45=58 / 56 | 11+47=58 / 60 | 15+47=62 / 60 | 8+45=53 / 53 | 10+51=61 / 60 | 15+21=36 / 31 |
| add int+int (156) | 51+82=133 / 86 | 11+72=83 / 72 | 63+91=154 / 98 | 37+83=120 / 83 | 10+78=88 / 70 | 33+77=110 / 74 |
| lt int<int (165) | 51+55=106 / 71 | 11+51=62 / 59 | 63+57=120 / 77 | 37+55=92 / 64 | 10+54=64 / 55 | 33+48=81 / 59 |
| if_false8 not taken (234) | 56+33=89 / 39 | 11+30=41 / 31 | 70+35=105 / 47 | 42+33=75 / 32 | 10+33=43 / 24 | 38+27=65 / 36 |
| if_false8 taken (234) | 56+37=93 / 40 | 11+37=48 / 35 | 70+39=109 / 48 | 42+37=79 / 33 | 10+38=48 / 25 | 38+34=72 / 39 |
| goto8 (236) | 56+18=74 / 26 | 11+19=30 / 18 | 70+20=90 / 34 | 42+18=60 / 19 | 10+19=29 / 11 | 38+14=52 / 24 |
| inc_loc (146) | 43+54=97 / 68 | 11+53=64 / 62 | 45+56=101 / 72 | 32+57=89 / 67 | 10+56=66 / 58 | 33+48=81 / 59 |
| add_loc (147) | 43+69=112 / 64 | 11+72=83 / 65 | 45+76=121 / 72 | 32+69=101 / 61 | 10+75=85 / 59 | 33+83=116 / 81 |
| get_field own, 1st probe (64) | 18+190=208 / 206 | 11+214=225 / 209 | 20+192=212 / 210 | 13+192=205 / 205 | 10+215=225 / 207 | 20+130=150 / 134 |

fpu040 -O1 and fpu060 -O1 bodies are within 1 instruction of fpu020 -O1 for every row.

JS-to-JS call, fpu020 -O1 (MEASURED in pieces, callee with 1 arg, 1 local, no closure
vars, returns an int): `call1` dispatch 56 + caller side of `call1` 231 (239 mem)
+ JS_CallInternal prologue to first dispatch 188 (152 mem, plus `__vbcc_alloca` not
counted) + `return` dispatch 13 + `return` to `rts` 68 (83 mem) = **about 556
instructions** per call/return pair, excluding the callee's own body. The C frame is
748 bytes of locals + 12 saved registers (`sub.w #748,a7`), plus the alloca'd JS frame.
JS_CallInternal is 11,338 instruction lines at fpu020 -O1.

### 3.1 How much of that is the 16-byte JSValue (MEASURED, fpu020 -O1 traces)

Instructions on the path that only move a JSValue (struct copies, pushes of the four
longs, `movem d0/d1/a0/a1` return shuffles, the `dbra` of the byte loops), and call
overhead (`jsr` + `rts`):

| opcode | body instr | value-copy instr | jsr+rts |
|---|---|---|---|
| get_loc0 | 58 | 32 | 4 |
| get_loc8 | 59 | 32 | 4 |
| put_loc8 | 75 | 36 | 6 |
| push_i32 | 43 | 16 | 4 |
| dup | 55 | 32 | 4 |
| drop | 45 | 24 | 4 |
| add | 82 | 20 | 2 |
| lt | 55 | 16 | 2 |
| inc_loc | 54 | 16 | 2 |
| get_field | 190 | 68 | 14 |

So 30-55% of each simple opcode body is copying the 16-byte struct. But this is mostly
the *by-value call ABI*, not the size as such: in the toy (section 5), going from 16
to 8 bytes with clean C saves only 0-7 instructions per opcode (get_loc8 15 -> 12,
put_loc8 21 -> 14, dup 12 -> 10) and 2-6 memory accesses.

The 64-bit tag itself costs little in compares: `JS_VALUE_GET_TAG` casts to int32, so
tag tests read only the low long (`move.l (360,a7),d1 / or.l / bne`). Its cost is the
extra 8 bytes per copy. Separately, `add`/`add_loc` do the sum in **int64** and range
check it with `subx` chains (about 25 of add's 82 instructions) where `add.l` + `bvs`
would do; that is the C source's `(int64_t)a + b` idiom, not the JSValue layout.

## 4. Optimisation levels (MEASURED)

| flags | compiles? | time | quickjs.o bytes | notes |
|---|---|---|---|---|
| soft -O0 | yes | 1 s | 1,301,360 | single jump table |
| fpu `-O=1` | yes | 3 s | 1,227,940 | single table, 10-instr dispatch, pc in a4 |
| fpu -O1 (=`-O=991`) | yes | 5 s | 1,003,652 | cascade dispatch; 17 "warning 175: this code is weird" (not JS_CallInternal) |
| soft -O1 | yes, first try | 5 s | 1,011,464 | cascade dispatch, worst case 70 instr |
| fpu -O1 -speed | yes | 6 s | 1,004,860 | same code on the hot path |
| fpu -O2 (=`-O=1023` + scheduler) | yes | 19 s | 1,011,836 | cascade, worst case 42; bodies unchanged; 31 warning 175 incl. JS_CallInternal |
| soft -O2 | yes | 28 s | - | not analysed further |
| fpu -O2 -speed | yes | 20 s | 1,012,980 | same as -O2 on the hot path |
| fpu `-O=5087` (-O1 + inlining bit) | compiles, **output does not assemble** | 39 s | - | 3 x `lea dN,aM` (4 vasm errors); .s is 8.8 MB vs 4.2 MB; bodies 20-60% smaller where it worked |
| fpu `-O=5119` (-O2 + inlining) | compiles, **output does not assemble** | 446 s | - | `lea d0,a3`, `lea a3,a0` etc., 4 sites |
| fpu -O3 (all bits + cross-module) | **did not finish**: killed after 15 min at 14 GB RSS, no output | - | - | |

Warning 175 is emitted by `loop.c` when a jump enters a loop body; loop optimisation is
skipped for that function. It is not by itself a miscompile.

None of these builds was executed. "Compiles" means vbcc produced assembly; only the
rows with an object size were assembled.

68040/68060 code generation (MEASURED by diff of the .s files): `-cpu=68060` differs
from `-cpu=68020` in about 550 instruction lines out of 250,000 (FP conversion and
64-bit helper call sites). `-cpu=68040` differs more (245,742 vs 250,306 instruction
lines) but the interpreter loop is the same shape. No `move16` anywhere. The three CPU
variants are effectively the same code in the hot path.

## 5. What vbcc can emit when the C is shaped for it (MEASURED on a toy)

`probe/t8_clean.c`: a 32-case interpreter loop with the shipped value layout
(`-DWIDE`: 8-byte union + two tag longs) or an 8-byte one (`-DCOMPACT`: tag long +
payload long). Hot ops written field-wise with macros, slow paths as out-of-line calls
taking pointers. It is a toy: the real function has many more live variables, so the
real result will have more spills. In the real -O1 build pc, sp, var_buf and ctx do
live in registers (a4, a5, d6, d4), so the toy is not unrealistic.

Dispatch at -O1 and -O2: one table, 7 instructions / 2 memory accesses
(`move.b (a3)+,d1; moveq #0,d7; move.b d1,d7; cmp.w #31,d7; bhi; move.l tab(pc,d7.w*4),a6; jmp (a6)`).
Bodies (instructions incl. the `bra` back / memory accesses; decision strings checked
on WIDE -O1 only):

| op | WIDE -O1 | COMPACT -O1 | WIDE -O2 | WIDE -O0 |
|---|---|---|---|---|
| push_i32 (byte-assembled immediate) | 22 / 7 | 21 / 6 | 22 / 7 | 39 / 23 |
| push_1 | 6 / 3 | 5 / 2 | 6 / 3 | 19 / 13 |
| get_loc0 | 10 / 9 | 10 / 7 | 13 / 11 | 26 / 23 |
| get_loc8 | 15 / 12 | 12 / 8 | 16 / 12 | 31 / 27 |
| put_loc8 | 21 / 14 | 14 / 8 | 21 / 14 | 35 / 30 |
| add | 17 / 9 | 17 / 9 | 26 / 15 | 36 / 27 |
| lt | 13 / 8 | 13 / 8 | 22 / 11 | 32 / 19 |
| if_false8 not taken / taken | 14 / 5, 17 / 6 | same | 11 / 6, 14 / 7 | 32 / 24 |
| goto8 | 8 / 4 | 8 / 4 | 5 / 3 | 21 / 16 |
| dup | 12 / 11 | 10 / 7 | 12 / 11 | 26 / 23 |
| inc_loc | 10 / 5 | 11 / 5 | 14 / 7 | 28 / 18 |
| add_loc | 25 / 10 | 25 / 10 | 29 / 13 | 43 / 33 |

-O2 is not better than -O1 here. A second toy (`probe/t7_switch.c`, 12 cases) at -O2
lost its jump table to a linear compare chain because constant propagation put some
case constants in registers: vbcc's table recognition is fragile, so any change to the
switch must be checked in the .s every time.

## 6. vbcc capabilities that matter (checked in docs at `~/vbcc/src/vbcc/doc/` and by compiling `probe/t*.c`)

| feature | status | evidence |
|---|---|---|
| computed goto / labels as values | **no** | `probe/t1_goto.c`: "error 76: identifier expected" at `&&a`; not in vbcc.texi |
| `__reg("a2")` on a local variable | **accepted and ignored** | `probe/t2_reglocal.c`: `pc` requested in a2 ends up in a0/a1, `acc` (d7) in d1 |
| `__reg` on a global | accepted and ignored (plain BSS variable) | `probe/t6_globalreg.c` |
| `__reg` on parameters | works | `probe/t3_regparm.c`; doc "Register Parameters" warns it "may force vbcc to create worse code" (visible: a2->a1->a2 shuffles) |
| `__regargs` / `-fastcall` | works (`jsr @h`, args in d0/a0/d1) | `probe/t5_regargs.c`, vbccm68k.texi |
| tail calls | **no** | `return h(...)` and indirect `tab[*pc](...)` both compile to `jsr` + `rts` |
| inline assembly | works: `f(__reg(...) args) = "asm text";` and `__asm("...")` | `probe/t4_asm.c`; doc: must not add control-flow edges, must preserve callee-saved registers unless `__regsused` says otherwise |
| function inlining | only with optimizer bit 12 (-O3, or `-O=`); the inlined quickjs.c does not assemble | section 4 |
| jump tables | yes, recognised from compare chains, easily defeated by the optimizer | section 2 |
| `__noinline`, `__regsused`, `__section` | documented | vbcc_main.texi |

Consequence: a threaded interpreter cannot be written in vbcc C (no computed goto, no
tail calls, cannot pin pc/sp). Register pinning is only possible at function
boundaries (`__reg` parameters), i.e. for calling into an assembly core.

## 7. Designs and estimates

All numbers in this section are ESTIMATED unless a row says measured. Basis: counting
the instructions of the hand-written handlers in `asmcore/` (which assemble with
vasm but were never executed) or reusing the toy counts from section 5.

### (0) Not asked for, but first: fix the build, no design change

- 0a. Give JS_CallInternal a single jump table. Options, cheapest first: compile
  quickjs.c at `-O=1` (measured: 10-instruction dispatch for every opcode, bodies
  equal to -O1 for the short forms and up to 25% longer for the idx16 forms; object
  22% larger and the rest of the engine loses
  -O1); or split JS_CallInternal into its own file and build only that at `-O=1`/-O0;
  or post-process the .s (the cascade is mechanical: 5 tables + 6 compares -> 1
  table); or fix the table recognition in the local vbcc source.
  Hot short opcodes go from 56 (FPU) / 70 (soft at -O1) to 10-11 dispatch
  instructions: get_loc0 114 -> ~68, goto8 74 -> ~29, if_false8 89 -> ~43.
- 0b. Do NOT flip the soft variants to -O1 as things stand: measured soft -O1 dispatch
  is 70 instructions for opcodes 178-245 against 11 at -O0; bodies are equal. The
  interpreter loop would get slower per bytecode; only non-interpreter code gains.
- 0c. Clean C for the 30 hottest cases (macros, field-wise copies, pointer-taking slow
  paths, `add.l`-style overflow test instead of int64). Toy-measured: 7 + 10-25.

### (1) Threaded dispatch tail replicated per opcode

Not expressible in vbcc C. Achievable by post-processing the assembly (replace each
`bra <dispatch>` with the dispatch sequence: 229 sites at fpu -O1) or in an assembly
core. With a single table, replication saves exactly the 1 `bra` per opcode and, on
CPUs that predict indirect jumps per site, mispredictions. Estimate: 1 instruction of
~18 (clean C) or of ~11 (asm). About 10 instr x 229 sites of code growth for the
post-processed C variant. Low value on its own; the big dispatch win is 0a.

### (2) pc / sp / frame pinned in address registers

Not controllable in vbcc C (`__reg` on locals ignored). In the shipped -O1 code pc is
already in a4 and sp in a5 across the loop, var_buf in d6 (moved to an address
register per use), ctx in d4; the optimizer still writes `sf` back to the frame at
every case end (`move.l a3,(364,a7)`). Pinning is only real inside an assembly core,
where it removes the per-use reloads: there the fetch is `move.b (a2)+,d7`.

### (3) Hand-written 68k core for the hot opcodes, C switch as fallback

Files: `asmcore/core_v16.s` (today's 16-byte layout) and `asmcore/core_v8.s` (8-byte
layout). Both assemble (`vasmm68k_mot -m68020`); neither has been run.

Register plan: a2 = pc, a3 = sp, a4 = var_buf, a5 = arg_buf, a6 = handler table,
d7 = opcode with bits 8-31 kept zero, d6 = cached interrupt countdown, d5 = constant
-9 (first refcounted tag). All callee-saved in the vbcc ABI, so C helpers can be
called without saving. Entry from C through a `__reg`-parameter function; any
non-fast case rewinds pc and returns to the C switch for that opcode.

Dispatch tail (3 instructions, 2 reads), replicated in every handler:

    move.b  (a2)+,d7
    move.l  (a6,d7.w*4),a0
    jmp     (a0)

Handlers written (executed-path instruction counts include the 3-instruction tail):

| handler | V16 instr / mem | V8 instr / mem | today fpu -O1 | today soft -O0 |
|---|---|---|---|---|
| get_loc0 (int) | 11 / 10 | 8 / 6 | 114 / 90 | 65 / 80 |
| get_loc8 | 14-15 / 11 | 11 / 7 | 115 / 89 | 70 / 84 |
| put_loc8 (old value not refcounted) | 15 / 12 | 10 / 8 | 131 / 99 | 92 / 98 |
| push_i32 | 7 / 7 | 5 / 5 | 56 / 55 | 66 / 55 |
| add int+int | 11 / 7 | 11 / 7 | 133 / 86 | 83 / 72 |
| lt int<int | 15 / 8 | not written | 106 / 71 | 62 / 59 |
| if_false8 not taken / taken | 12 / 4, 14 / 5 | not written | 89, 93 | 41, 48 |
| lt + if_false8 fused, loop continues | 11 / 6 | 12 / 6 | 195 (two opcodes) | 103 |

Example, `add` on today's layout (from `core_v16.s`):

    op_add:
        move.l  -4(a3),d0       ; tag.lo(b)
        or.l    -20(a3),d0      ; | tag.lo(a), JS_TAG_INT == 0
        bne.s   add_slow
        move.l  -32(a3),d0
        add.l   -16(a3),d0
        bvs.s   add_slow        ; overflow: C makes a double
        move.l  d0,-32(a3)
        lea     -16(a3),a3
        NEXT

Assumed loop `for (i = 0; i < n; i++) s += i` as 9 opcodes per iteration
(get_loc x4, add, put_loc, inc_loc, lt, if_true8; the sequence is assumed, I did not
dump real bytecode). Instructions per iteration, composed from the tables above:

| variant | instr / iteration | basis |
|---|---|---|
| fpu020 -O1 today | ~1010 | measured parts |
| soft020 -O0 today | ~600 | measured parts |
| whole file at `-O=1` | ~620 | measured parts |
| clean C, today's layout, -O1 | ~180 | toy-measured parts |
| asm core, today's layout | ~110 | hand count |
| asm core + lt/if fused | ~95 | hand count |
| asm core, 8-byte value, fused | ~75 | hand count |

These are instruction counts for a pure-integer loop, the best case for all of this.
Property access, calls, allocation and string work spend their time in C runtime
functions that none of (1)-(5) touches; `get_field` is 190 body instructions today and
an asm fast path would still need the shape lookup (~25-30 instructions, estimate).
Real programs will gain much less than the ratios above; another lane measures time.

CPU differences for the core (from memory of the Motorola manuals unless marked; the
only thing verified this session is the 68060 cache/branch-cache description in the
NXP 040-to-060 porting note):

- 68020 / 68030: 256-byte instruction cache (030 adds a 256-byte data cache). The
  interpreter never fits, so nearly every instruction word is a bus fetch: minimise
  instruction count AND bytes. Prefer `(aN)+` / `-(aN)` and `moveq`, 16-bit
  displacements, short branches; avoid memory-indirect modes (`jmp ([a6,d7.w*4])` is
  slow here: use the two-instruction form). A 4-entry-per-line burst fill on the 030
  favours straight-line handlers. The 16-byte value costs 4 reads + 4 writes per copy,
  every one a bus cycle on the 020: this is where the 8-byte layout pays most.
- 68040: 4 KB + 4 KB caches. A core of 30 handlers (roughly 1-1.5 KB, estimate from
  22-44 bytes per handler in the listings) plus the 1 KB table fits; the C switch
  (11,338 instructions) does not. Complex addressing modes cost extra cycles on the
  040; `move.l (a6,d7.w*4),a0` is still fine. Align handler entries to 4 bytes.
- 68060: 8 KB + 8 KB four-way caches, branch cache, dual-issue pipeline (verified:
  NXP porting note). Order handler instructions so adjacent pairs do not depend on
  each other (e.g. put the `lea -16(a3),a3` between the compare and the branch, not
  next to a use of a3). From memory, unverified: the 060 does not predict
  `jmp (An)` (flat ~5 cycles), while a correctly predicted `Bcc` is 0-1 cycles and a
  mispredicted one 7. If that is right, replicating the dispatch tail buys no
  prediction benefit on the 060, and superinstructions (fewer indirect jumps) matter
  more there than anywhere else. Avoid instructions the 060 traps and emulates
  (64-bit `mulu.l`/`divu.l`, `movep`, `cmp2`/`chk2`): none are in the core.
- A single core source with two `NEXT` macros (020/030/040 two-instruction form,
  060 form to be chosen by measurement) is enough; the handlers themselves do not
  need per-CPU variants.

### (4) Cheaper JSValue layout

Option: 8-byte struct `{ uint32 tag; uint32 payload; }` with doubles NaN-boxed across
both longs, the tag adjustment done with 32-bit arithmetic on the first long only.
This avoids the int64 maths that the Makefile comment says vbcc miscompiled, and an
8-byte struct is returned in d0/d1. Measured effect in clean C (toy, section 5): 0-7
instructions and 2-6 memory accesses per opcode. In the asm core: get_loc0 11 -> 8,
put_loc8 15 -> 10, push_i32 7 -> 5 (hand counts). Also halves the JS stack, every
property slot and every array element, and every by-value call in the rest of the
engine (16 bytes pushed bytewise today). It changes the library ABI: the header says
JSValue passes as 16 stack bytes and returns in d0/d1/a0/a1, and the knowledge base
records 102 hand-written LVO wrappers plus the CLI trampolines that encode this.
A half measure with no ABI change does not exist: the size is the ABI.

### (5) Superinstructions

Upstream already has get_loc0_loc1, add_loc, inc_loc, dec_loc, get_loc8/put_loc8 and
the 8-bit branch forms. Each fused pair removes one dispatch: today that is 11-70
instructions, after 0a about 10, in the asm core 3. Candidates that also remove work,
not just a dispatch: compare + conditional branch (`lt`/`lte`/`gt`/`strict_eq` +
`if_false8`/`if_true8`), which skips materialising the boolean (asm: 11 vs 15+12);
`get_loc` + `get_field`; `push_i8` + `add`. Requires a peephole in the bytecode
emitter (`resolve_labels`) and regenerating the precompiled bytecode in `gen/*.c` with
the matching qjsc. Worth little before 0a/0c (dispatch is a small share of 114), more
after the asm core (3 of 11).

## 8. Ranking

1. Single jump table for JS_CallInternal (0a). Measured dispatch 56 -> 10-11 for the
   commonest opcodes on the FPU variants. Effort: hours to a day. Risk: low.
2. Clean C for the ~30 hottest cases (0c). Toy-measured 5x fewer instructions on
   integer paths. Effort: days. Risk: medium (diverges from upstream; must re-check
   the .s for the table every build).
3. Assembly core (3). About another 1.7x over clean C on integer paths (estimate).
   Effort: weeks. Risk: high (GC/refcount invariants, exception paths, generators
   re-entering mid-function).
4. 8-byte JSValue (4). Largest effect on 68020/030 memory traffic; ABI break.
5. Superinstructions (5), after 2 or 3.
6. Threading alone (1) and -O2/-O3/-speed/inlining flags: not worth it / not usable.

## 9. Not determined

- Run-time effect of any of this. No code here was executed.
- Whether a `-O=1` build of quickjs.c is correct on an Amiga, and what it costs the
  non-interpreter code (parser, GC, property lookup lose -O1).
- Dynamic opcode and opcode-pair frequencies. The "hot opcode" list and the loop
  bytecode sequence are assumptions from QuickJS's design, not dumps.
- The exact reason vbcc splits the table (I read it as allocator spill stores between
  the compares; not confirmed in the compiler).
- 68060 indirect-jump timing and prediction, 68040 addressing-mode costs: from memory.
- Why `-O=5087`/`-O=5119` emit `lea dN,aM`; whether those 3-4 sites can be patched.
- Whether -O3 would ever finish (stopped at 15 min / 14 GB).
- Branch-decision strings for the -O2, `-O=1`, soft -O1 and `-O=5087` columns were
  not individually re-read.

---------------------------------------------------------------------------------------

# ROUND 2: the C-only prototype, measured with lane B's instruction counter

Everything in this part is MEASURED (executed instructions under vamos/Musashi with
lane B's `tools/prof.py` hook, 68020, real mathieeedoubbas.library as 68k code) unless
a line says ESTIMATE. Instruction counts are not seconds; see lane B's notes for what
that does and does not prove.

## Where things are (`r2/`)

- `r2/r2-quickjs.patch`: the whole change, one file (`quickjs-master/quickjs.c`),
  +400/-40 lines, applies with `patch -p1`. Generated by `r2/apply_r2.py` from
  `r2/quickjs.c.orig`. Every edit is behind a macro:
  - `-DR2_TABLE_PRAGMA=1` (c): `#pragma opt 1` before JS_CallInternal, `#pragma opt 991`
    after it (use with `-O1`; `=0` restores `opt 0` for an `-O0` build).
  - `-DR2_FAST=1` (a1): inside JS_CallInternal only, `js_dup`, `JS_FreeValue`,
    `set_value`, `js_int32`, `js_bool`, `get_u16/get_i16/get_u32`,
    `js_poll_interrupts`, `JS_IsException/IsUninitialized/IsUndefined/IsNull/IsObject`
    become macros (pointer based, no by-value JSValue arguments).
  - `-DR2_FAST=2` (a2): a1 plus field-wise int32 fast paths placed in front of the
    original case bodies (the original code stays as the fallback): push_0..7,
    push_i8/i16/i32, push_const8, dup, drop, get/put/set_loc/arg/var_ref short forms,
    get_loc/put_loc/set_loc/get_arg/put_arg/set_arg, get_loc_check, put_loc_check,
    add, sub, mul (inline-asm `muls.l` + `svs`), add_loc, inc/dec, post_inc/post_dec,
    inc_loc/dec_loc, neg, shl, sar, and/or/xor, the eight compares, if_true8/if_false8,
    get_field and put_field (own data property), get_array_el (fast array, int index);
    `BREAK` becomes `continue`.
  - `-DR2_DIV` (b): int32 `/` (exact quotient) and `%` (any signs) without doubles.
  - `-DR2_PRIME_VARBUF`: also keeps var_buf in an address register (about 0.5 %).
- With no macro defined the patched source builds a library **byte-identical** to the
  shipped `quickjs.020soft.library` (`cmp`), at -O0 and at -O1 to lane B's -O1 build.
- `r2/mk.sh` builds (only quickjs.o is recompiled; the other 30 objects are lane B's),
  `r2/run.sh` / `r2/runall.sh` run, `r2/check.sh` compares outputs,
  `r2/results.py` -> `r2/results.md` makes the tables, `r2/mks.sh` makes listings.
- The repository was not touched (`git status`: only the pre-existing settings file).

## Results

Executed instructions, millions, whole process including start-up:

| build | empty | intloop | float | prop | array | call | intdiv | intops | strcat | alloc | regex |
|---|---|---|---|---|---|---|---|---|---|---|---|
| soft -O0 (shipped) | 67.8 | 425.5 | 371.3 | 374.6 | 327.9 | 284.0 | 451.5 | 301.1 | 326.9 | 494.5 | 156.8 |
|   + (b) int / and % | 67.8 | 425.5 | 372.1 | 374.6 | 327.9 | 284.0 | 349.2 | 301.1 | 326.9 | 494.5 | 156.8 |
|   + (a1) helper macros | 66.0 | 242.1 | 256.8 | 232.4 | 217.1 | 180.9 | 341.6 | 187.2 | 242.7 | 394.4 | 147.2 |
|   + (a2) int fast paths | 66.0 | 197.5 | 248.9 | 210.2 | 184.1 | 167.4 | 318.4 | 157.4 | 231.4 | 379.4 | 145.0 |
|   + (a2)+(b) | 66.0 | 197.5 | 249.7 | 210.2 | 184.1 | 167.4 | 217.6 | 157.4 | 231.4 | 379.8 | 145.0 |
|   (c) only: pragma opt 1 on the loop | 67.9 | 432.9 | 376.3 | 379.4 | 333.4 | 286.0 | 456.7 | 306.6 | 329.7 | 498.5 | 157.1 |
|   + (c)+(a2)+(b) | 65.9 | 174.7 | 238.7 | 196.6 | 169.5 | 156.2 | 201.3 | 140.9 | 220.6 | 369.1 | 144.0 |
| soft -O1 (FPU-style flags) | 59.9 | 592.3 | 469.7 | 427.4 | 443.3 | 365.8 | 582.2 | 431.3 | 393.3 | 532.1 | 150.7 |
|   + (c) pragma opt 1 on the loop | 58.5 | 408.9 | 358.6 | 348.0 | 313.4 | 269.0 | 440.6 | 289.0 | 303.8 | 452.0 | 143.6 |
|   + (c)+(a1) | 56.8 | 224.5 | 243.4 | 211.7 | 202.2 | 165.2 | 329.8 | 174.0 | 220.2 | 353.7 | 134.2 |
|   + (c)+(a2) | 56.8 | 165.6 | 229.4 | 182.7 | 160.3 | 146.6 | 296.6 | 131.7 | 202.9 | 333.5 | 131.6 |
|   + (c)+(a2)+(b) | 56.8 | 165.6 | 230.0 | 182.7 | 160.3 | 146.6 | 192.9 | 131.7 | 202.9 | 333.5 | 131.6 |
|   (a2)+(b) without (c) | 59.6 | 502.9 | 440.9 | 354.0 | 405.2 | 322.3 | 448.2 | 387.1 | 370.1 | 495.4 | 145.8 |

Instructions per bytecode, (benchmark - empty) / lane B's dispatch counts:

| build | intloop | float | prop | array | call | strcat | alloc |
|---|---|---|---|---|---|---|---|
| soft -O0 (shipped) | 85 | 112 | 96 | 76 | 98 | 122 | 182 |
|   + (a1) | 42 | 71 | 52 | 44 | 52 | 83 | 140 |
|   + (a2)+(b) | 31 | 68 | 45 | 35 | 46 | 78 | 134 |
|   + (c)+(a2)+(b) | 26 | 64 | 41 | 30 | 41 | 73 | 129 |
| soft -O1 | 127 | 152 | 115 | 112 | 139 | 157 | 201 |
|   + (c) | 83 | 111 | 90 | 75 | 96 | 116 | 167 |
|   + (c)+(a1) | 40 | 69 | 48 | 43 | 49 | 77 | 126 |
|   + (c)+(a2)+(b) | 26 | 64 | 39 | 30 | 41 | 69 | 118 |

Best build against the shipped soft library, whole process: intloop 425.5 -> 165.6
(-61 %), float -38 %, prop -51 %, array -51 %, call -48 %, intdiv -57 %, strcat -38 %,
alloc -33 %, regex -16 %, start-up -16 %. Against the -O1 configuration the FPU
libraries are built with: intloop -72 %, prop -57 %, call -60 %.

Size: quickjs.library 1,968,740 (shipped soft) -> 1,991,224 with (a2)+(b) at -O0;
1,678,836 (-O1) -> 1,701,536 with (c)+(a2)+(b).

## Correctness checks

- `r2/check.sh`: for all 12 builds the 10 benchmarks that do not use `%` on negative
  numbers, plus `r2/mybench/edge.js` (554 lines: all arithmetic/compare/bit operators
  over 23x23 operand pairs incl. overflow, INT32_MIN/MAX, -0, strings, null,
  undefined; inc/dec at the limits; TDZ errors; getters/setters, prototype chain,
  frozen object, array holes and out-of-range, typed array, closures, generators,
  exceptions, recursion) print exactly what the unmodified library prints.
- `intdiv.js` prints -1794517301 with the shipped library and -1794917301 with (b).
  **The patched value is the correct one** (node prints -1794917301). The shipped soft
  library computes `%` wrongly when the operands have different signs:
  `r2/mybench/modchk.js` shows `1 % -2 = -1` (should be 1), `-7 % 5 = 3` (should
  be -2); 65 of 264 probe results differ from node, 35 remain with (b) (the cases (b)
  leaves to the old path: divisor 0 or -1, zero result of a negative dividend,
  non-int32 operands).
- Two more differences between the SHIPPED soft library and node showed up in
  edge.js under vamos (not touched by the patch, all builds agree with the shipped
  one): `-1 * 0` gives +0 instead of -0, and `<`/`<=` with a NaN operand return true
  (`0 < "x"`). 102 of 554 lines. Seen under vamos with the OS 3.2.3 maths library;
  not checked on hardware.
- Not tested: anything beyond those scripts (no test262, no GUI/FFI code, no async),
  the FPU variants (the patch was only built with the soft flags; the "-O1" rows are
  the soft library with FPU-style optimisation flags), 68040/68060 builds, real
  hardware.

## What vbcc would not emit well

1. With the real optimizer (`-O1` without the pragma) the patch barely helps (0.83 of
   baseline on intloop): the switch is still the five-table cascade and the fast paths
   get poor code. An earlier variant of the patch with block-local temporaries did
   reach 242.6 M on intloop at plain -O1 (vs 592.3), but the final variant with
   function-level scratch variables is 502.9 M there. Plain -O1 is unpredictable for
   this function; `#pragma opt 1` is what makes the result stable.
2. `#pragma opt` is documented as "only for debugging, do not use", is not
   macro-expanded, and must restore the exact command-line value by hand.
3. Under opt 1 the register allocator has 5 address registers and 2 data registers
   (d6/d7) for variables and hands them to the variables with the highest use count,
   each use weighted x10 per enclosing loop, `do { } while (0)` included. Statement
   macros written with do/while took pc's register away (dispatch back to 11
   instructions with pc in memory). Fixed by `if (1) {...} else (void)0` macros and by
   a dead "priming" statement in nested do/while that raises the weight of `opcode`,
   one scratch int and var_buf. `register` does not help (worth 200, the hot variables
   have thousands). `__reg` on locals is ignored (round 1).
4. Dispatch is 10 instructions + 1 branch per opcode (fetch through a copy of pc,
   `cmp.l #245` bounds check, table load, `jmp`); 3 in assembly.
5. Overflow: no way to branch on V from C. The xor idiom costs 9 instructions for add
   (13 for the whole int path after the tag test) against `add.l` + `bvs`. Inline
   assembly cannot contain a branch; `svs` to a memory byte works and is used for mul.
6. Tag tests are `lea (-32,a3),a0 ; move.l (12,a0),d0` pairs; int pushes write the
   64-bit tag as two 6-byte immediate moves; the refcount test is a `cmp.l #imm32`.
7. Block-local temporaries are always in memory under opt 1.
8. By-value JSValue arguments are still byte loops; they are now only on slow paths.
9. `vc` passes `-D` values through a shell unquoted: a define containing spaces fails.

## Revised estimate for the assembly core (ESTIMATE)

Basis: static instruction counts of the opt-1 listing (`r2/asm/cabv_O1.s`) against the
hand-written handlers of `asmcore/`, weighted by the 21 opcodes per iteration of
intloop (from a host bytecode dump, `r2/host/*.dump`).

- intloop now costs 26 instructions per bytecode (11 dispatch + about 15 body). The
  same 21 opcodes in the assembly core: 3 dispatch + about 8.4 body = about 11.4.
  That is about 2.3x fewer on a pure integer loop, i.e. intloop 165.6 M -> about
  105 M whole process.
- prop/array/call (39-41 per bytecode now): the core saves the dispatch and the simple
  opcodes, roughly 12-15 per bytecode, so about 1.4-1.5x, unless the call sequence
  (JS_CallInternal prologue, 748-byte frame) is redesigned as well.
- float (64 per bytecode, soft-float dominated) and strcat/alloc: 1.1-1.25x.
- Round 1 said "about 1.7x over clean C" for integer paths. The measured C baseline
  (26) is worse than the toy suggested (17-25 including dispatch), so the remaining
  gap on integer code is larger (2.3x), and on everything else smaller.

## Bytecode actually executed by the benchmarks

`let`/`const` loop variables compile to `get_loc_check`/`put_loc_check` (16-bit
index, TDZ test), not the short `get_loc0..3` forms: round 1's assumed loop sequence
was wrong. intloop iteration: get_loc_check x5, get_arg0, lt, if_false8, push_3, mul,
add, push_2, sar, xor, dup, put_loc_check x2, drop x2, post_inc, goto8. Dumps of all
benchmark functions are in `r2/host/`.
