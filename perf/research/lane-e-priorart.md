# Lane E: prior art and architectural options

Labels used throughout:
- **DOC** = read in a primary document this session (manual text extracted to `txt/` in this directory, or a fetched page). URL given.
- **MEASURED** = produced here with the local vbcc (`exp/` in this directory) or by grep of the engine source.
- **EST** = my extrapolation / arithmetic from DOC numbers. Not measured on any 68k.
- **MEM** = from memory, not re-verified this session. Treat as a lead, not a fact.

Local text extracts (pdftotext) for other lanes to grep:
`txt/030um.txt` (MC68030 User's Manual), `txt/040um.txt` (M68040UM), `txt/060um.txt` (M68060UM),
`txt/ertl-jilp.txt` (Ertl & Gregg 2003).

---------------------------------------------------------------------------
## A. 68k microarchitecture facts for an interpreter writer

### A1. Caches and prediction (DOC)

| CPU | I-cache | D-cache | Branch prediction |
|---|---|---|---|
| 68020 | 256 bytes (64 x 4-byte entries), direct mapped (MEM) | none | none |
| 68030 | 256 bytes, 16 lines x 4 longwords | 256 bytes, same shape | none |
| 68040 | 4 KB, 4-way, 16-byte lines | 4 KB, 4-way, copyback capable | none dynamic. Static: "optimized for the more common case of the branch taken" (Bcc taken 2 clocks, not taken 3) |
| 68060 | 8 KB, 4-way | 8 KB, 4-way | 256-entry 4-way branch cache, PC -> target, "five-state prediction model", branch folding |

Sources: 040UM s.1 and s.4; 060UM s.1, s.5.11; NXP MC680X0OPTAPP.txt.

### A2. The one fact that decides the dispatch question on the 68060 (DOC)

060UM Table 10-18 "JMP, JSR Execution Times":

| Instruction | not predicted | **predicted correctly as taken** |
|---|---|---|
| JMP (d16,PC), JMP xxx.WL | 3 | **0** |
| **Remaining JMP** (i.e. `jmp (An)`, `jmp (d8,An,Xn)`, memory indirect) | 5 | **5** |
| JSR (d16,PC), JSR xxx.WL | 3 | 1 |
| Remaining JSR | 5 | 5 |

Table 10-19: **RTS = 7 cycles, always** (returns are never predicted).
Table 10-17: Bcc predicted-taken 0, predicted-not-taken 1, **mispredicted 7**;
not-in-cache forward-taken 7, forward-not-taken 1, backward-taken 3, backward-not-taken 7.
Memory-indirect EA adds 3 cycles (Table 10-5).

Reading: **the 68060 branch cache gives no benefit to register-indirect or
table-indirect jumps.** An interpreter dispatch `jmp (An)` costs a flat 5
cycles however it is arranged. The whole Ertl & Gregg "give each opcode its own
indirect branch so the BTB can learn it" argument therefore does not apply to
any 68k CPU: 020/030/040 have no BTB and the 060's does not cover these jumps.
Only the path-length half of the threaded-code argument transfers.

### A3. Addressing modes and instructions that changed cost (DOC)

68030 (030UM s.11.6, instruction-cache case, clocks):
- fetch EA: `(An)`/`(An)+` 3, `(d16,An)` 4, `(d8,An,Xn)` 6, full-format `(bd,An,Xn)` 6-12, memory indirect 10-18.
- `JMP` 4 + jump-EA: `(An)` 2, `(d8,An,Xn)` 6, `([bd,An,Xn])` 10. So `jmp (An)` = 6, `jmp (d8,An,Xn)` = 10, `jmp ([tab,Dn*4])` = 14.
- Bcc taken 6; not taken 4 (.B) / 6 (.W, .L). BSR 6, JSR 4 + EA, **RTS 9**.
- Register ALU op 2. MULx.L 44, DIVS.L 90. Bit-field: BFTST reg 8, BFCHG/BFCLR/BFSET reg 14, memory 10-22.

68040 (040UM s.10.5-10.6, clocks, max of ea-calc/execute columns):
- Simple ops with `Dn`, `(An)`, `(An)+`, `(d16,An)`, abs: 1.
- **`(d8,An,Xn)` operand: 3. `(d8,PC,Xn)`: 5. Full-format `(bd,An,Xn)`: 7. Memory indirect: 10-12.**
- `JMP (An)` 3, `JMP (d16,An)` 4, `JMP (d8,An,Xn)` 6, `JMP ([bd,An,Xn])` 12. `JSR (An)` 3. **RTS 5.** BSR 2-3.
- Bcc taken 2, not taken 3. DBcc 3-4.
- MULx.L 20, DIVx.L 44. Bit-field register 4-7, memory ~9+. MOVEM ~ 2-3 + 1 per register.
- NXP note: "Prefer `add.l d7,a0` then `(a0)` over indexed addressing", "prefer individual move.l over movem when time-critical", "use as few instructions as possible, even if longer", "reschedule loads into address registers early", "avoid bitfield instructions", "avoid memory-indirect".

68060 (060UM s.10):
- Almost everything simple is 1 cycle, two per cycle when pairable. `(d8,An,Xi*SF)` costs 0 extra; `(bd,An,Xi)` +1; memory indirect +3.
- **Change/use stalls**: loading a register and using it as a base register in the next instruction: up to 2 cycles; as an index: 3 cycles for `Xi.w`, `Xi.l*2`, `Xi.l*8`, 2 cycles for `Xi.l*1`/`Xi.l*4`. (060UM s.10.2.) vbcc emits `d7.w*4` in its switch table load (MEASURED, see A6), which is the 3-cycle form.
- MULx.L 2 cycles (!), DIVx.L 38. Bit-field 6-14. MOVEM = n cycles (1 per register, pOEP-only). `NOP` 9 (pipeline sync). LINK 2, UNLK 1.
- **Not implemented, trap to software (060UM s.1, app. C)**: 64-bit `MULU.L/MULS.L <ea>,Dh:Dl`, 64-bit dividend `DIVU.L/DIVS.L <ea>,Dr:Dq`, MOVEP, CAS2, CHK2/CMP2, unaligned CAS; FPU: FMOVECR, FDBcc/FScc/FTRAPcc, packed decimal, transcendental functions. A NetBSD list measurement puts trapped 32x32->64 multiply at ~220,000/s on a 50 MHz 060 (about 230 cycles each) (DOC, mail-index.netbsd.org/port-m68k/1998/06/23).
  Relevance: any hand-written int64 helper for the 060 variant must not use the 64-bit-result forms; check what vbcc's `-cpu=68060` int64 helpers and our `sharedlib` int64 code actually emit (other lanes).
- Pairing (060UM s.10.1): second instruction must be "pOEP|sOEP" class (single-cycle standard ops, moves, TST...), at most one memory operand per pair, no dependence on the first's result except `move.l X,Rn` followed by use. `JMP/JSR/Bcc/BRA/MOVEM/MULx/bit-field/EXG/SWAP/PEA` are pOEP-only. A Bcc is "pOEP-but-allows-sOEP" when predicted not-taken or unpredicted-forward: **fall-through fast paths are free on the 060.**
- I-cache flush side effect: "The branch cache is automatically cleared by the hardware as part of any CINV or CPUSH operating on the instruction cache" (060UM s.5.11). Every instruction-cache flush costs all learned branch history.

### A4. Dispatch cost model per CPU (EST, built only from the DOC timings above)

Current shape (MEASURED from vbcc output of a 250-case switch, `exp/big.s`):
```
l259: move.b (a2)+,d0 ; moveq #0,d7 ; move.b d0,d7
      cmp.w #N,d7 ; bhi default
      move.l tab(pc,d7.w*4),a0 ; jmp (a0)
      ... handler ... ; bra l259
```

| Technique | 68030 clocks | 68040 clocks | 68060 cycles |
|---|---|---|---|
| vbcc switch (above, incl. the `bra` back) | ~39 (5+2+2+4+6+8+6+6) | ~17 (1+1+1+1+3+5+3+2) | ~10-13 (jmp 5 + up to 3+2 change/use stall, rest pairs/folds) |
| Token threaded, dispatch replicated at each handler tail: `move.b (a2)+,d0 ; move.l (a5,d0.l*4),a0 ; jmp (a0)` (d0 upper bits kept clear) | ~19 (5+8+6) | ~7 (1+3+3) | ~8-10 |
| Direct threaded, 32-bit handler addresses in the stream: `move.l (a2)+,a0 ; jmp (a0)` | ~11 (5+6) | ~4 (1+3) | ~6-8 |
| Call threading `jsr (a0)` ... `rts` + loop | ~35+ (8+6+9+6+loop) and vbcc pushes args (MEASURED `exp/fp.s`) | ~14+ | ~17+ (5+7+loop) |
| Subroutine threading (`jsr abs.l` stream, i.e. the simplest generated code) | BSR/JSR 6 + RTS 9 = 15 | 3 + 5 = 8 | 1 + 7 = 8 |
| Inlined template code (no dispatch at all) | 0 | 0 | 0 |

Savings per executed bytecode versus today's switch (EST):
- 68030: token threading saves ~20 clocks, direct threading ~28. At 25 MHz that is 0.8-1.1 us per bytecode.
- 68040: ~10 and ~13 clocks. Note `(d8,PC,Xn)` is 2 clocks slower than `(d8,An,Xn)` on the 040: keeping the table base in an address register is itself worth 2 clocks per dispatch.
- 68060: ~2-4 cycles. The flat 5-cycle `jmp (An)` and the change/use stall dominate and cannot be removed by any interpreter arrangement. Mitigation: load the next handler address early in the handler (hides the stall, NXP also recommends this for the 040) and use `.l*4` index.

To turn these into percentages one needs the average cycles per bytecode, which
lane A/B measure. With a guess of 100-190 clocks/bytecode on the 030 at -O1
(16-byte JSValue, refcounting), token threading is ~10-20% (EST on EST); on the
040 similar; on the 060 ~5-10%.

Ranking by CPU (EST):
- 68020/030: direct threading > token threading >> switch ~ call threading. But direct threading quadruples opcode bytes and the 030 has a 256-byte data cache; token threading with replicated tails is the sane choice. Replication grows the interpreter by ~10 bytes x 250 handlers = 2.5 KB, irrelevant to a 256-byte I-cache either way.
- 68040: same order. Table base in An, two-instruction form (not memory-indirect `jmp ([..])`, which is 12 clocks).
- 68060: dispatch style barely matters. What matters is the *number* of dispatches (superinstructions, fused compare-and-branch, operand-specialised opcodes) and predictable conditional branches (7-cycle mispredict vs 0/1).

### A5. Literature measurements and how far they transfer

- Ertl & Gregg, "The Structure and Performance of Efficient Interpreters", JILP 5 (2003) (DOC, `txt/ertl-jilp.txt`):
  - efficient interpreters execute 3.2%-13% indirect branches;
  - switch dispatch executes 5.9-6.6 (OCaml) / 7.9 (Yap) more native instructions per VM instruction than threaded code; total instruction count up to 1.76x;
  - BTB mispredicts 57-63% (threaded) vs 81-98% (switch) of dispatch branches;
  - with **no predictor**, threaded code is still 3.9-4.5 cycles per dispatch better than switch (simulated 4-wide RISC, 4-cycle penalty); switch is up to 2.02x slower overall for the tiny-instruction OCaml VM.
- Ertl's threading micro-benchmark page (DOC, complang.tuwien.ac.at/forth/threading/): pure-dispatch loop, seconds. **MIPS R3000 20 MHz (no branch prediction, the closest analogue to a 68030): direct 5.6, indirect 7.6, subroutine 13.0, switch 17.7, call 18.4.** MicroSPARC II 110 MHz: 6.1 / 8.0 / 6.2 / 14.6 / 12.6. So on predictor-less CPUs switch and call threading are ~2-3x slower than direct threading *when the VM instructions do almost nothing*. That is an upper bound; JS opcodes are 5-20x heavier than Forth primitives.
- Transfer to 68k (EST): the instruction-count result transfers and is amplified, because a 68030 pays 2-8 clocks per instruction and 6 per taken branch. The misprediction results do not transfer at all (A2).
- Gagnon & Hendren (SableVM, DOC via search snippet): inline-threaded interpretation 1.20-2.41x over switch, 1.15-2.14x over direct-threaded.
- Piumarta & Riccardi, "Optimizing direct threaded code by selective inlining", PLDI 1998: copies handler bodies end to end at run time; reported up to ~2x over direct threading for fine-grained bytecodes (MEM for the number).

### A6. vbcc facts found on the way (MEASURED, `exp/`)

- vbcc rejects GNU computed goto: `&&label` gives `error 76 ... identifier expected` (`exp/goto.c`). There is no C-level route to threaded dispatch with this compiler.
- Dense switch with 12 or 13 cases compiles to a **linear `cmp/beq` chain** (`exp/sw_68020.s`, `exp/s13.s`); 16+ cases get a jump table. A 250-case test split into table(0..163) + 8 linear compares + second table (`exp/big.s`). Lane A should check whether the real interpreter switch is split the same way; any opcode routed through the compare chain pays ~6 clocks per failed compare on an 030. Small `switch (tag)` statements in hot helpers are also compare chains.
- `-cpu=68060` output for the test switch is identical to `-cpu=68020` (`diff` of the two `.s` files shows only the header), i.e. vbcc does no 060 scheduling here.

---------------------------------------------------------------------------
## B. Prior art

### B1. Generated code and fast interpreters on 68k hosts

| System | What it did | Evidence |
|---|---|---|
| Deutsch & Schiffman Smalltalk-80 (1984), 68000 Sun workstation | Dynamic translation of bytecode methods to native 68k on first call, inline caches at send sites, LRU code cache that can be thrown away. The original JIT, on a ~10 MHz 68000. | Paper is a scan; numbers MEM: roughly 2x over their own good interpreter, native code ~5x the size of bytecode. Secondary DOC: "optimized interpreter is about 2x slower" (compilers.iecc.com/comparch/article/92-08-084) |
| JForth (Amiga) | Forth compiled to 68000 code, subroutine threaded with inlining | DOC softsynth.com/jforth; vendor claim 2-3x over traditional threaded Forth; pForth bench comment 21.5 s (Multi-Forth, indirect threaded) vs 8.82 s (JForth) on an A1000, unsourced |
| PC-Task 4.x (Amiga, 1996-98) | 486 emulator with "dynamic compilation" to 68k, needs 68020+, OS 2.0+ | DOC readmes: dynamic mode "considerably slower loading/start", "very memory intensive ... performance may be disappointing ... if you have slow memory"; 4.2 improved code-cache handling and self-modifying code |
| Kaffe JVM | JIT + interpreter listed for m68k (AmigaOS, NetBSD) | DOC github.com/kaffe/kaffe; NetBSD/m68k port needed correct cache flushing after codegen (mail-index.netbsd.org/port-mac68k/1999) |
| MuRedox (Amiga, current) | Generates per-program stub routines at run time to replace trapped FPU instructions on 040/060 | DOC aminet.net/package/util/boot/MuRedox. Shows run-time codegen is accepted practice on 040/060 Amigas |
| Self (Sun-3, 68020), Macintosh Common Lisp, Mops/Yerk Forth | native-code compilers for dynamic languages on 68k | MEM |

Pattern: every 68k system that got a large factor did it by **removing dispatch
and operand decoding** (native or subroutine-threaded code) plus **caching
dynamic lookups at the use site**. None got it from dispatch tweaks alone.

### B2. What AmigaOS requires of generated or modified code (DOC)

- `exec.library/CacheClearU()` (V37+) flushes I and D caches, pushing dirty data lines first. `CacheClearE(addr, len, CACRF_ClearI|CACRF_ClearD)` (V37+) does a range. Autodoc lists "self modifying code, building jump tables, run-time code patches, relocating code, loading code from disk" as mandatory uses. (d0.se/autodocs/exec.library/CacheClearE; Amiga Mail vol. 2 "68040 compatibility warning".)
- 68040/060 copyback: freshly written instructions can sit in the data cache and not be in RAM when the I-cache refills; the exec calls push them. Write first, flush second.
- "On some cache systems, including the 68030, partial clearing costs too much, so the entire cache may be cleared" (autodoc). On the 060 any I-cache flush also clears the whole branch cache (060UM 5.11).
- Consequences (EST): generate a function's code in one go and flush once; never patch code on a hot path (self-modifying inline caches in the Deegen/JSC style are a bad fit, keep cache state in data); no MMU or special memory attribute is needed, AllocMem memory is executable; needs Kickstart 2.04+.
- Many "fast 68k" machines today are JIT-emulated (UAE JIT, Emu68/PiStorm) (EST): there a cache flush invalidates the host's translations and generated-code churn is very expensive; indirect jumps are also relatively costly under a host JIT. Fewer dispatches helps there too; frequent regeneration hurts badly.

### B3. Modern small JS engines: what they do

| Engine | Value | Bytecode | Property access | Start-up |
|---|---|---|---|---|
| MicroQuickJS (Bellard, Dec 2025) (DOC github.com/bellard/mquickjs) | one CPU word; 31-bit int with 1-bit tag; else pointer, tag in the block | stack based, like QuickJS; atoms via indirect table; one-pass compiler, no AST | hash table per object, keys are interned strings | stdlib compiled by a build tool into C structures that live in ROM; bytecode runnable from ROM after relocation. Tracing compacting GC, no refcounts. "Speed comparable to QuickJS" |
| JerryScript (DOC jerryscript.net/internals) | 32-bit, 3 tag bits; 16-bit compressed pointers by default | CBC: compact CISC-like, stack oriented, 1-byte frequent opcodes | linked property list, hashmap from 16 properties, plus **LCache**: global (object, name) -> property lookup cache | snapshots, executable directly from ROM |
| Duktape (DOC wiki.duktape.org, duk_js_bytecode.h) | 8-byte packed NaN-box on 32-bit, optional fastint | register based, 32-bit instructions | hash part on larger objects; no inline caches (MEM) | optional ROM built-ins (MEM) |
| Hermes (DOC hermes doc/Design.md) | NaN-boxed 64-bit; compressed 32-bit heap values on 32-bit targets (MEM) | register based, 8-bit register operands with Long variants, constants via instructions, scope depth resolved at compile time | hidden classes + per-site property cache slots (MEM) | compiled ahead of time, bytecode file used in place, lazy per function |
| Moddable XS (DOC moddable.com/documentation/xs/preload) | 16-byte slots on 32-bit (MEM) | stack (MEM) | | **preload**: module bodies run at build time, resulting heap objects placed in flash |
| PrimJS (QuickJS fork) (DOC github.com/lynx-family/primjs) | as QuickJS | QuickJS bytecode | | "template interpreter leveraging stack caching and register optimizations" written in assembly; vendor reports +28% Octane over QuickJS (3735 vs 2904, M1 Max) |

Observations relevant here:
- **Nobody ships a 16-byte value on a 32-bit CPU for speed.** 4 or 8 bytes is universal. Our 16-byte struct JSValue is the outlier and every stack push, argument and return pays for it (other lanes quantify).
- The QuickJS family has no property inline caches. (MEASURED: no IC code in `quickjs-master/quickjs.c`; `quickjs.h:1240` says `JS_READ_OBJ_ROM_DATA (0) /* ... obsolete, broken by ICs */`, so quickjs-ng once had ICs, removed them, and left ROM-data loading disabled.) Shapes with a per-shape hash give ~1 probe per own-property lookup; the remaining cost is prototype-chain walks and global lookups.
- Start-up: all small engines avoid deserialising at boot (ROM structures, preload images, snapshots). This tree always copies bundled bytecode on load because the ROM flag is defined to 0; the bundled sources are large (`gen/ffi.c` 1.15 MB, `gen/extended.c` 0.79 MB of C array text) (MEASURED).
- PrimJS is the only data point for "hand-written assembly interpreter core for QuickJS bytecode": about 1.3x on a modern CPU with good prediction. On a 68030 the dispatch share is larger, so the same change should be worth at least that (EST).

---------------------------------------------------------------------------
## C. Compiler alternatives (multiplier, not the answer)

- bebbo amiga-gcc (DOC codeberg.org/bebbo/amiga-gcc): branches gcc 6.5.0b (default, "many hacks"), 10.4, 13.4, 15.2, 16.2; the newer ones support register parameters; builds natively on Apple-silicon macOS; ships vlink/vbcc in the same tree; libnix/clib2/newlib runtimes.
- gcc gives what vbcc lacks: computed goto (so `DIRECT_DISPATCH 1` works unmodified), global register variables (`register T x asm("a4")`), `-m68060`/`-mtune` scheduling, `__builtin_expect`, working 64-bit integer arithmetic (so the 8-byte NaN-boxed JSValue becomes usable), real inlining. vbcc: no computed goto (MEASURED), `-cpu=68060` changes nothing in the test (MEASURED).
- Only public like-for-like number found (DOC franke.ms/amiga/best-c-compiler.wiki, Dhrystone 2.1, 68020): vbcc 0.9e `-O4 -final -schedule` 6980; SAS/C 6.58 11961; gcc 2.95.3 -O3 13333; gcc 6.2.0 -O3 19047. That is 2.7x gcc 6 over vbcc 0.9e on one synthetic benchmark by the gcc port's author; vbcc 0.8j scored 13089 on the same page, so treat the 0.9e number with suspicion. Expect (EST) 1.3-2x on interpreter code from gcc -O2 versus vbcc -O1, more versus the -O0 soft build, before any NaN-boxing gain.
- Mixing compilers per object file (DOC vbcc m68k manual; m68k SysV ABI):
  - Same: arguments on the stack right to left, caller pops, d0/d1/a0/a1 scratch, d2-d7/a2-a6 preserved, int/pointer result in d0, 64-bit integer in d0:d1.
  - Different: vbcc also treats **fp0/fp1** as scratch (gcc: fp0/fp1 scratch too under SysV, check the amigaos port); vbcc returns float/double in fp0 with an FPU unless `-no-fpreturn`; **vbcc returns 8/12/16-byte structs in d0/d1/a0/a1 unless `-no-mreg-return`**, gcc returns structs larger than 8 bytes through a hidden pointer. Our 16-byte JSValue return is exactly this case. vbcc manual: "you must not link objects together that have been compiled with different settings".
  - Different runtime helpers (vbcc `__mulint64`-style vs libgcc `__muldi3`), different startup/library-base handling (`__saveds`, a6), different object format unless gcc emits hunk (bebbo's does).
  - Verdict (EST): feasible only across a narrow, explicitly declared boundary (for example the whole engine core built with gcc as one unit, glue in vbcc, boundary functions taking pointers and returning ints). Per-file mixing inside the engine is not realistic while JSValue is returned by value.
- Size of the likely win: the largest single compiler-dependent step available (EST 1.5-2.5x combined with 8-byte NaN boxing and direct threading). It is also the one the owner explicitly does not want to depend on, so it belongs in the plan as a parallel track.

---------------------------------------------------------------------------
## D. Feasibility sketch: template baseline compiler for this engine

What it is: per hot bytecode function, emit 68k by copying pre-assembled
handler bodies ("stencils") in bytecode order and patching operands (literal
index, local slot offset, branch displacement). Cold or complex opcodes become
`jsr helper` calls into the existing C code. No register allocation, no type
speculation.

What it would take (EST):
1. A stable machine-level interpreter state (pc/sp/var_buf/ctx in fixed registers). vbcc cannot give this from C; in practice the hot handlers must first exist as hand-written assembly. **That assembly core is the same work as a threaded "template interpreter", so do that first and reuse the bodies as stencils.**
2. Stencil table: ~40-60 hot opcodes (get_loc/put_loc/set_loc variants, push_i32/const, add/sub/lt/... int fast paths, if_true/if_false/goto, get_field/put_field fast path, call via helper, inc_loc, dup/drop). Others: one generic stencil `move.l #opcode_handler,a0 ; jsr (a0)`.
3. Branch fixups (two-pass), an exception/unwind story (helpers return a status, stencils test and branch to a common exit), a pc-recovery side table for backtraces and for `OP_with`/generators (or simply refuse to compile functions using generators, async, `with`, `eval`).
4. Code memory manager + one `CacheClearE` per compiled function; invalidation when a function is freed.
5. A hotness counter in `JSFunctionBytecode` and an entry trampoline.

Memory cost (EST): QuickJS bytecode averages roughly 2-3 bytes per instruction; 68k stencils for JSValue-typed ops with tag checks and refcount updates will be 20-60 bytes each. Expect **10-20x the bytecode size** for compiled functions (Deutsch-Schiffman saw ~5x with a far simpler object model, MEM; Deegen's `Add` stencil is 38 bytes fast path + 15 slow on x86-64, DOC arXiv 2411.11469 app. B). Only hot functions are compiled, so hundreds of KB, acceptable under the "enough RAM" assumption.

Speed-up range in the literature (DOC unless marked):
- CPython 3.13 copy-and-patch JIT: 2-9% over its (already specialising) interpreter; PEP for 3.15 claims 4-12% geomean; individual benchmarks from -20% to +100%.
- GNU R copy-and-patch (Kocourek 2025): 1.26x over the bytecode interpreter.
- V8 Sparkplug (non-optimising, keeps interpreter frame layout and ICs): 5-15% on real pages (V8 9.1 notes); +41% Speedometer / +45% JetStream over Ignition alone (v8.dev/blog/maglev).
- Deegen / LuaJIT Remake baseline JIT (with inline caches): 360% faster than PUC Lua; its interpreter alone is 179% faster than PUC Lua, so baseline JIT is ~1.65x over its own very good interpreter (EST from those two DOC figures).
- SableVM inline threading: 1.2-2.4x over switch.
- Classic rule: a template JIT without type specialisation removes dispatch and operand decode only. If dispatch+decode is D% of time, the ceiling is 1/(1-D).

Applied here (EST): on QuickJS most time is in tag checks, refcounting, 16-byte value copies and C helper calls, none of which a template JIT removes. Expect **1.2-1.5x over a good threaded assembly interpreter**, and 1.5-2.5x over today's switch, most of which the threaded interpreter already captures.

Per-CPU fit (EST from A):
- **68060: good fit.** The 5-cycle unpredictable `jmp (An)` per bytecode disappears; bytecode-level conditional branches become real Bcc that the branch cache folds to 0-1 cycles; straight-line stencils pair in the two pipelines; the 8 KB I-cache holds a hot loop's expanded code (a 300-bytecode loop at 30 bytes each is ~9 KB, borderline). Flush cost is paid once per function.
- **68040: reasonable fit.** Saves ~10 of ~17 dispatch clocks (the threaded interpreter already saved those); no branch prediction, so the extra gain over threading is small (taken Bcc 2 vs jmp-based 3+). 4 KB I-cache is easily exceeded by expanded code, whereas the interpreter's hot handlers stay resident.
- **68020/030: poor fit.** With a 256-byte I-cache neither the interpreter nor generated code stays cached, so nearly every instruction word is fetched from RAM; then *bytes executed* is the cost metric, and template code is 10-20x larger than bytecode+shared handlers... but the shared handlers are also uncached. The real issue is that the saving over a threaded interpreter is only the ~19 clocks of token dispatch per bytecode, bought with a compiler, a code cache and flushes that on the 030 clear the entire cache. Subroutine-threaded code (`jsr handler` per bytecode, 15 clocks) is not better than token threading (19) by enough to matter.
- Under UAE-JIT/Emu68 hosts: risky; double translation and flush sensitivity.

Conclusion (EST): a template JIT is a second-stage project that only makes
sense for 040/060 after (a) a compact JSValue and (b) an assembly threaded core
exist. Its incremental gain over (b) is modest on everything but the 060.

---------------------------------------------------------------------------
## Ranked recommendations (all gains EST unless marked)

1. **Hand-written 68k assembly core for the hot opcodes with token-threaded, tail-replicated dispatch, per-CPU variants** (PrimJS / LuaJIT-interpreter model). Rest of the opcodes fall back to the C switch. 030: ~20 clocks saved per bytecode plus pinned registers; 040: ~10 (table base in An, no PC-relative index, no memory-indirect); 060: dispatch saving small, win comes from fused fast paths, `.l*4` index, early next-handler load, fall-through hot paths. Expected 1.2-1.5x on 030/040, 1.1-1.3x on 060. Effort high (weeks), risk medium (must mirror C semantics exactly; differential-test against the C interpreter under vamos). Compiler independent.
   - Cheap precursor to test the idea: post-process vbcc's `.s` output of the interpreter function, replacing each `bra dispatch_top` with the dispatch sequence (and dropping the redundant range check). Effort low, risk low-medium, ~10-15% on 030/040.
2. **Fewer dispatches: superinstructions and operand-specialised opcodes chosen from measured opcode-pair frequencies.** The only dispatch lever that pays on the 060 (5 cycles flat per dispatch) and it pays everywhere. QuickJS already has some short opcodes; add fused compare+branch, get_loc+get_field, etc. 5-15%. Effort medium, risk low. Compiler independent.
3. **Compact JSValue (8 bytes)**: universal practice (B3). Needs either working int64 in vbcc or a two-word struct {tag,payload} with non-number doubles boxed or split; other lanes own the numbers. Likely the largest non-compiler structural gain.
4. **Start-up: stop deserialising and copying bundled bytecode at every launch** (ROM-data style in-place bytecode, lazy per-module loading, or a preloaded heap image as XS/JerryScript/mquickjs do). Attacks the 2 s start-up directly; gain to be measured by lane B. Effort medium.
5. **gcc (bebbo 6.5 or 13.x) as a parallel build of the whole engine core**: computed goto + NaN boxing + real optimisation, EST 1.5-2.5x, effort medium (toolchain, ABI boundary to the vbcc glue, library startup), risk medium. Not per-object mixing.
6. **Global (shape, atom) -> slot lookup cache in data (JerryScript LCache style)** for prototype-chain and global lookups; no code patching. 5-15% on method-heavy code, unmeasured. Effort medium.
7. **Template baseline compiler for 68060 (and 68040) only**, built from the assembly handlers of item 1. Additional 1.2-1.5x on the 060; poor fit for the 030. Effort very high, risk high. Defer.

Will NOT pay off:
- Dispatch replication / "one indirect branch per opcode" for prediction: no 68k predicts indirect jumps (DOC, A2).
- Call threading (function pointer per opcode): slower than the switch on every 68k (RTS 9/5/7 clocks, vbcc pushes arguments on the stack).
- Direct threading with 32-bit addresses in the bytecode: ~8 clocks better than token threading on an 030 but 3-4x bytecode size, a new bytecode format and relocation of the bundled bytecode; not worth it before items 1-3.
- Memory-indirect `jmp ([table,Dn*4])` one-instruction dispatch: fine on 020/030 (same 14 clocks as the two-instruction form), 12 clocks vs 6 on the 040, +3 on the 060.
- Bit-field instructions for tag extraction: 8-14 clocks on 030, 4-9 on 040, 6-8 on 060; use and/shift/swap.
- Self-modifying inline caches: each patch needs a cache flush (whole cache on 030, whole branch cache on 060).
- A JIT for the 68020/030.

## Could not determine
- Average clocks per bytecode and the dispatch share of run time (needed to turn A4 into percentages); lanes A/B.
- Deutsch-Schiffman's exact figures (scanned PDF), Piumarta-Riccardi's exact figures, PC-Task's JIT speed-up; quoted from memory or vendor text.
- Any published vbcc-vs-gcc comparison on interpreter-shaped code; only Dhrystone exists.
- Whether bebbo gcc's struct-return and fp-scratch conventions match vbcc's when `-no-mreg-return` is used; needs a test build (no m68k gcc installed).
- Real 68060 behaviour of change/use stalls around `jmp (An)`; manual wording covers address generation generally, not measured.
- Whether the real interpreter switch is split into table + compare chain like my 250-case toy.

## Sources
- M68060 User's Manual (text in `txt/060um.txt`): https://web-docs.gsi.de/~kraemer/COLLECTION/MOTOROLA/mc68060.pdf
- M68040 User's Manual (`txt/040um.txt`): https://www.nxp.com/files-static/32bit/doc/ref_manual/MC68040UM.pdf
- MC68030 User's Manual 2nd ed. (`txt/030um.txt`): https://www.vintageapple.org/macprogramming/pdf/MC68030_Enhanced_32_Bit_Microprocessor_Users_Manul_Second_Edition_1989.pdf
- NXP 680x0 optimisation notes: https://www.nxp.com/docs/en/supporting-information/MC680X0OPTAPP.txt
- 68060 product brief: https://www.nxp.com/docs/en/product-brief/M68060.pdf
- MPR on the 68060: https://www.cecs.uci.edu/~papers/mpr/MPR/ARTICLES/080502.pdf , https://www.cecs.uci.edu/~papers/mpr/MPR/ARTICLES/061505.pdf
- 68060 unimplemented instruction cost: https://mail-index.netbsd.org/port-m68k/1998/06/23/0004.html ; https://ftp.fau.de/mirrors/aminet/dev/misc/68060Guide.txt
- Ertl & Gregg 2003: https://jilp.org/vol5/v5paper12.pdf
- Ertl threading benchmarks: https://www.complang.tuwien.ac.at/forth/threading/
- Ertl & Gregg, optimizing indirect branch prediction: https://www.eecg.toronto.edu/~steffan/carg/readings/optimizing-indirect-branch-prediction.pdf
- Gagnon & Hendren inline threading: https://static.usenix.org/event/jvm01/gagnon/gagnon_html/node4.html
- Piumarta & Riccardi: https://bibtex.github.io/PLDI-1998-PiumartaR.html
- Deutsch & Schiffman: https://www.cs.tufts.edu/~nr/cs257/archive/peter-deutsch/efficient-smalltalk.pdf ; https://compilers.iecc.com/comparch/article/92-08-084
- CacheClearE autodoc: https://d0.se/autodocs/exec.library/CacheClearE ; WHDLoad cache notes: https://whdload.de/docs/en/cache.html
- JForth: https://www.softsynth.com/jforth ; PC-Task: https://en.wikipedia.org/wiki/Emulation_on_the_Amiga ; Kaffe: https://github.com/kaffe/kaffe ; MuRedox: http://aminet.net/package/util/boot/MuRedox
- MicroQuickJS: https://github.com/bellard/mquickjs
- JerryScript internals: https://jerryscript.net/internals/
- Hermes design: https://github.com/facebook/hermes/blob/main/doc/Design.md
- Duktape: https://wiki.duktape.org/compiler.html ; https://github.com/svaarala/duktape/blob/master/doc/bytecode.rst
- Moddable XS preload: https://moddable.com/documentation/xs/preload
- PrimJS: https://github.com/lynx-family/primjs
- Copy-and-patch: https://sillycross.github.io/assets/copy-and-patch.pdf ; Deegen: https://arxiv.org/abs/2411.11469 ; CPython JIT: https://peps.python.org/pep-0836/ ; R: https://ch-rigid.github.io/publications/kocourek_copyandpatch_2025.pdf
- V8 Sparkplug numbers: https://v8.dev/blog/maglev ; https://www.infoq.com/news/2021/06/v8-sparkplug-compiler/
- bebbo amiga-gcc: https://codeberg.org/bebbo/amiga-gcc ; compiler comparison: https://franke.ms/amiga/best-c-compiler.wiki
- vbcc m68k backend doc (ABI, -no-mreg-return): https://discmaster.textfiles.com/view/553/EuroCD%203.iso/Programming/vbcc/doc/vbccm68k.doc ; m68k ABI: https://m680x0.github.io/doc/abi
