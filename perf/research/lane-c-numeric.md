# Lane C — number representation, arithmetic, per-CPU unimplemented instructions

All paths below are under
`/private/tmp/claude-501/-Volumes-Code-Amiga-nea-quickjs/16cb392e-cdad-4185-838c-ecaa322c3b16/scratchpad/perf/lane-c-numeric/`
unless they start with `/Volumes`. Nothing in the repository was modified.

Labels: **[M]** measured here (static count from compiler output / disassembly, or a run under
vamos). **[S]** verified by reading source. **[E]** estimate, basis given.
vamos is not cycle-accurate and emulates mathieeedoubbas natively, so no cycle numbers and no
instruction counts *inside* OS math libraries or trap handlers were measured.

## Tools built here (reusable by other lanes)

| file | what it does |
|---|---|
| `trapscan.py` | Amiga hunk parser (load files and objects) + capstone sweep; classifies trapping opcodes from the raw opcode words. `-v` lists hits with nearest symbol. Run with `venv/bin/python`. |
| `build_asm.sh CPU fpu\|soft` | recompiles every C file of the library to `asm/<cpu><variant>/*.s` with the Makefile's flags (`-O1`, regexp `-O0`, soft quickjs.c `-O0`) |
| `asmg/*.s` | the same with `-g`, which makes vbcc emit `debug <line>` markers |
| `mapfn.py asm.s source.c regex` | maps asm lines matching a regex to source line + C function (uses the `debug` markers) |
| `slice.py asm.s first last` | prints the asm generated for a source line range |
| `probes/count.py file.s [-v]` | instruction lines per global function |
| `vm/run.sh name 'loop body'` | runs a 10,000-iteration JS loop under vamos with `--profile-lib-calls` and prints mathieeedoubbas/trans calls per iteration (startup baseline of 29 calls subtracted) |
| `vm/vrun.sh` | vamos wrapper that retries when another agent holds vamos' shared `ram:` volume (the `path setup failed` error is that race, not a real failure) |

Caveat for anyone scanning the linked libraries directly: vbcc puts constant data in the CODE
hunk, so a linear sweep of `amiga/libs/*.library` reports ~1,470 bogus MOVEP, plus FScc/CMP2/CHK2
and FSINH/FLOGNP1 hits that are identical in the soft variants (i.e. data). The trustworthy
counts come from the compiler's assembly output plus the hand-written `.s` objects; they
reconcile exactly with the binary scan for the instructions that matter (FINTRZ: 35 both ways).

---------------------------------------------------------------------------------------------

## A. Instructions the target CPU does not implement

### Lists
68060 integer (confirmed by web search: Motorola 060SP `isp.doc`, M68060UM): 64-bit-result
MULU.L/MULS.L, 64-bit-dividend DIVU.L/DIVS.L, MOVEP, CAS2, CAS with misaligned EA, CHK2, CMP2.
All trap through vector 61 and are emulated by 68060.library.

FPU lists are from the M68000 PRM / user's manuals as I know them; the web search confirmed only
part (Apple technote: FINT, FINTRZ and the transcendentals are FPSP-emulated on the 68040).
68040: no FINT, FINTRZ, FMOVECR, FSCALE, FMOD, FREM, FGETEXP, FGETMAN, FSINCOS, any
transcendental, no packed decimal. 68060: FINT/FINTRZ are back in hardware; still missing the
transcendentals, FMOVECR, FSCALE/FMOD/FREM/FGETEXP/FGETMAN, FDBcc/FScc/FTRAPcc, packed decimal,
FMOVEM with dynamic register list, extended-precision immediates. FSGLDIV/FSGLMUL status on the
040 I could not confirm; there are none in the build, so it does not matter.

### Counts in the shipped build [M]
From `asm/*/` (compiler output, same flags as the Makefile) plus `trapscan.py -v` on
`/tmp/qjslib_680x0*/sharedlib_int64*.o` (the objects the shipped libraries were linked from; my
re-assembly of `sharedlib_int64.s` is byte-identical to `/tmp/qjslib_68060/sharedlib_int64.o`).

| variant | trapping instructions |
|---|---|
| 020fpu | none on a 68020/030+6888x. (Would trap on an 040: 55 FINTRZ, 10 FSCALE, 4 FMOD, about 30 transcendentals, from the binary scan — only relevant if someone installs 020fpu on an 040/060.) |
| 040fpu | **35 FINTRZ**, nothing else. vbcc calls out for transcendentals, so no F-line transcendental is in our code. |
| 060fpu | **1 MULU.L 64-bit + 2 DIVU.L 64-bit**, all in hand-written `sharedlib_int64.s`. vbcc itself never emits the 64-bit forms (0 in all C output). FINTRZ ×61 / FINT ×2 are native on the 060. No FScc/FDBcc/FMOVECR/packed/dynamic FMOVEM in compiler output. |
| 060soft | the same 1 MULU.L 64 + 2 DIVU.L 64 in `sharedlib_int64_soft.s`. |
| 040soft, 020soft | none. |

`__mulint64_060`, `__divuint64_060` etc. are just extra labels on the 020 code
(`sharedlib_int64.s:19-24`, `:54-59`): the 060 build gets the trapping forms.

### Where the 35 FINTRZ of 040fpu sit [M] (`mapfn.py asmg/68040_quickjs.s ... fintrz`)
vbcc compiles every `(int)double` as `fintrz.x fp0 ; fmove.l fp0,d0`, also with `-cpu=68040`
(`probes/conv_68040fpu.s`). So on a real 68040 every double→int cast is an F-line trap into
68040.library.

Hot:
- `js_number()` quickjs.c:1546 — runs for every numeric result that came out as a double but is
  integral. **Includes OP_div with two int operands** (`sp[-2] = js_number((double)v1/(double)v2)`,
  quickjs.c:19466): `8/2` traps on a 68040.
- `JS_ToInt32Free` :13781 — `x|0`, `~~x`, shifts and bitwise ops on a double, typed-array stores.
- `JS_ToInt32SatFree` :13589 (`JS_ToInt32Clamp`: index/length arguments of string and array
  methods when passed a double), `JS_ToArrayLengthFree` :13885, `js_math_random` :47401 (every
  `Math.random()`), `js_string_fromCodePoint`, `js_string_indexOf`, `JS_ToUint8ClampFree`.
- `__flt64tosint64` / `__flt64touint64` in `sharedlib_int64.s` (2 FINTRZ each): every
  `(int64_t)double` — `JS_ToInt64Free`, `JS_ToInt64SatFree`, Date code.
Cold: `get_date_fields` ×2, `get_date_string` ×9 (Date formatting: up to 9 traps per call),
`fmt_float` in sharedlib_printf.c ×2-3, one each in dtoa.c/libregexp.c/libunicode.c/quickjs-libc
via `cutils.h:472`.

Also on the 040: `Math.sin/cos/exp/log/pow…` go through `sharedlib_math_fpu_aux.c` to
mathieeedoubtrans.library, which on an FPU machine uses 6888x transcendental opcodes, i.e. traps
inside the OS library [E: standard behaviour of the OS math libraries, not measured].

Trap cost [E]: order of 10^3 cycles per FPSP-emulated instruction (exception frame, FSAVE/
FRESTORE, decode, emulate, RTE); the inline alternative below is ~25 integer instructions.

### Where the 060 traps sit [M for call sites, S for the chain]
- **Every JS integer multiply.** OP_mul's int fast path is `r = (int64_t)v1 * v2`
  (quickjs.c:19418) → `jsr __mulint64_060` → `mulu.l d3,d5:d4` → trap. One trap per `a*b` with
  int operands on a 68060. Same in `js_binary_arith_slow`, `js_string_repeat`,
  `typed_array_is_oob`, `xorshift64star` (Math.random).
- **Number formatting of non-integers.** `js_dtoa` dtoa.c:1633-1634
  `while ((mant % radix) == 0) { mant /= radix; }` on a uint64: `__moduint64` = `__divuint64`
  (2 × DIVU.L 64/32) + `__mulint64` (1 × MULU.L 64) = 3 traps, then `__divuint64` = 2 more:
  **5 traps per stripped trailing digit**, when the mantissa is ≥ 2^32 (the normal case).
  `u64toa` dtoa.c:628-632 adds another ~5 per number ≥ 2^32. BigInt→string (`js_u64toa`,
  `mp_div1`, `udiv1norm`) likewise.
- **Date**: `get_date_fields` has 7 int64 divide/modulo sites and a multiply;
  `JS_SetThisTimeValue`, `js_Date_UTC`.
- Not hit by: int add/sub/compare, array indexing, int→string (`u32toa`, 32-bit divides).

`__moduint64` recomputes the remainder by multiplying back although `DIVU.L` already left it in
`d4` (`sharedlib_int64.s`, `.div64by32`), so `%` costs a divide *and* a multiply everywhere.
The 64/64 path (divisor ≥ 2^32) is a 64-iteration shift-subtract loop on every CPU.

### Correctness bugs found on the way (FPU variants only; 020soft is correct) [M]
Run of the shipped libraries under vamos (`vm/bug.js`; 020fpu cannot run under vamos because
Musashi lacks FLOGN):

| expression | 020soft | 040fpu and 060fpu |
|---|---|---|
| `65536*65536` | 4294967296 | **0** |
| `131072*98304` | 12884901888 | **0** |
| `Math.floor(3e9)` | 3000000000 | **2147483647** |
| `Math.floor(1794353317748.5)` | 1794353317748 | **2147483647** |
| `Math.floor(Infinity)`, `Math.floor(NaN)` | (vamos cannot run) | 2147483647, 2147483647/2147483646 |
| `1/Math.floor(-0)` | | Infinity (should be -Infinity) |
| `2**32` | 4294967296 | **4294967295.9999967** |

1. `__sint64toflt64` in `library/vbcc/sharedlib_int64.s` (the "fits in 32 bits" test): the
   `move.l (sp)+,d1` between `cmp.l` and `bne.s .s2f_big` overwrites the condition codes, so the
   branch tests `lo != 0`. Any int64 that is a non-zero multiple of 2^32 converts to 0.0, and
   every other value takes the slow path. Reproduced in isolation (`bugtest/t2_ours` vs vc.lib
   `bugtest/t2_vclib`). Applies to all three FPU variants (same source).
2. vbcc's `math_040.h` / `math_060.h` inline `floor/ceil/trunc/nearbyint` as
   `fmove.l fp0,d0 ; fmove.l d0,fp0` under a changed FPCR rounding mode, i.e. through a 32-bit
   integer (`~/vbcc/targets/m68k-amigaos/include/math_040.h:103-195`; reproduced in
   `bugtest/fl.c`). `js_math_floor/ceil` (quickjs.c:47257) compile to exactly that. Also four
   FPCR writes per call.
3. `pow()` in `sharedlib_math.c` is `exp(e*log(b))`: `2**32` is not exact.
4. `d = -0.0` at quickjs.c:19425 compiles to `fmove.d #$0000000000000000,fp0` (+0) in the FPU
   build (`slice.py asmg/68060_quickjs.s 19418 19428`): `0 * -5` yields +0. Not run-verified.
5. vbcc soft-float `(unsigned)double` is a plain `IEEEDPFix` (signed) call
   (`probes/conv_68020soft.s`, `_d2u`): values ≥ 2^31 cannot convert correctly. Not run-verified.

These need tasks; I did not file any (brief: research only).

---------------------------------------------------------------------------------------------

## B. Soft-float cost

### Call chain [M: `probes/conv_68020soft.s`]
vbcc `-amiga-softfloat` inlines the library call at each use; no wrapper function:

```
double add:   movem.l a,d0/d1 ; movem.l b,d2/d3 ; move.l a6,-(a7) ;
              move.l _MathIeeeDoubBasBase,a6 ; jsr -66(a6) ; move.l (a7)+,a6        6 instr
              -> library jump-table JMP -> IEEEDPAdd -> RTS ; result in d0/d1
compare:      same 6 with jsr -42(a6) (IEEEDPCmp) + tst.l d0 + Bcc                  8 instr
int->double:  move.l i,d0 ; save a6 ; load base ; jsr -36(a6) ; restore             5 instr
double->int:  movem.l d,d0/d1 ; save a6 ; load base ; jsr -30(a6) ; restore         5 instr
uint->double: jsr __ieeefltud (own asm helper)
int64<->double: jsr __sint64toflt64 etc. = C code in sharedlib_int64_conv.c making 3-5 more
              library calls each
negate:       jsr -60(a6) (IEEEDPNeg) — a library call to flip one bit
```
`d2/d3` are callee-saved, so every binary op also forces a `movem` save/restore of d2/d3 in the
enclosing function. `sharedlib_dbl_helpers.c` (`qjs_dbl_mul/add/from_long`) adds a C call on top
for the few Date sites that use it. Cost inside mathieeedoubbas: not measurable under vamos;
[E] 150-400 instructions per add/mul/div on a 68020 without FPU, from the nature of the
routines (unpack, align, 53-bit mantissa arithmetic, normalise, round, repack).

Static census of call sites in the 020soft build [M]: quickjs.c 206 (Cmp 73, Flt 38, Add 29,
Fix 22, Div 20, Sub 10, Mul 9, Neg 5), sharedlib_math_soft 93, int64_conv 23, strtod 21,
dtoa 14, printf 10. `JS_CallInternal` has only 6, all on float paths.

### Are the int32 fast paths intact? Yes. [S + M]
Source: OP_add/sub/mul/inc/dec/inc_loc/add_loc/comparisons/shifts all have the upstream
`JS_VALUE_IS_BOTH_INT` paths. Dynamic library-call counts, 020soft library under vamos
(`vm/run.sh`, calls per loop iteration):

| JS in a 10,000-iteration loop | soft-float calls / iteration |
|---|---|
| `s += i`, `i % 7`, `a[i & 7]`, `a[i&7] = i`, `i >>> 1`, `-i`, `a.length`, `String(i)`, `str.charCodeAt(i&7)`, `Date.now()` | **0** |
| `(i*3)\|0` | 0.01 |
| `i / 2` (both int) | **3.5** (Flt 2, Div 1, Fix 0.5) |
| `(i / 2) \| 0` | **4.0** |
| `Math.floor(i / 3)` | **5.7** |
| `(-i) % 7` (negative int operand) | **8.0** (Flt 2, Div, Floor, Mul, Sub, Tst, Fix) |
| `x < 2.5` (float) | 1 (Cmp) |
| `i < x` (int vs float) | 2 (Flt, Cmp) |
| `x + 0.5` | 1 |
| `x + 1`, `x++` (float var, int constant) | 2 (Flt, Add) |
| `(i * 0.5) \| 0` | 3 |
| `a[x \| 0]` | 1 (Fix) |
| `i * 300000` (overflows 28 % of the time) | 1.43 |
| `Math.random()` | 1 (Sub) + int64 work |
| `String(i + 0.5)` | 2 (the add); dtoa itself is integer-only: 0 |
| `parseInt("123")` | 1 (Fix) |

Places where doubles are used although integers would do [S]:
1. **OP_div never has an integer path** (quickjs.c:19442-19470). Two ints always go
   Flt, Flt, Div, then `js_number` → `double_is_int32` (two/three int64 shift helper calls) →
   Fix. An exact-division test with one `divsl.l` (quotient + remainder in one instruction)
   removes all of it when the result is an integer.
2. **OP_mod bails out to `js_binary_arith_slow` → `fmod` for any negative operand** (:19483);
   our `fmod` is `x - floor(x/y)*y`. An int path is valid whenever the remainder is non-zero or
   the dividend is non-negative.
3. Float-vs-float and int-vs-float comparisons have no inline path: they call
   `js_relational_slow` (function call, tag normalisation, then Cmp). Same upstream.
4. `x + 1` / `x++` on a double converts the int constant with a library call every time.
5. `double_is_int32` (:1486) and `JS_ToInt32Free` (:13755) extract the exponent with
   `(u64 >> 52) & 0x7ff`, which vbcc turns into `jsr __rshuint64` (+ `__lshint64` ×2); 48 + 41
   call sites of the 64-bit shift helpers exist in quickjs.c. On a big-endian 32-bit CPU the
   exponent is `(hi >> 20) & 0x7ff` on the first long.
6. `OP_add`/`OP_sub` overflow detection is done in emulated 64-bit arithmetic (see D).

Things that are fine: loop counters (`OP_inc_loc` checks `val == INT32_MAX`), array index and
length, number→string for ints, Date.now.

---------------------------------------------------------------------------------------------

## C. JSValue layout

### What the current 16-byte layout costs [M]
`struct { union u (8); int64_t tag; }` — the tag is written and compared as two longs.
In the shipped `-O1` FPU compile of quickjs.c (`asm/68020fpu/quickjs.s`, 250,292 instruction
lines):
- 19,341 `move.l (aX)+,(aY)+` struct-copy instructions (7.7 % of all instructions),
- 1,319 byte-copy loops (`moveq #3,d0 ; 4×move.b ; dbra`), 217 of them in `JS_CallInternal`:
  **vbcc pushes a struct argument with a byte loop — 16 `move.b` + 4 `dbra` per JSValue passed
  by value** (`probes/layout_16_fpu.s`, `_call2`),
- 2,501 `movem.l d0/d1/a0/a1,<temp>` for struct returns, each followed by a 4-long copy.

The OP_add int fast path as shipped (`slice.py asmg/68060_quickjs.s 19313 19339`), excluding
dispatch: copy both operands to temporaries (16 instr), tag test (4), 64-bit add (14), two
64-bit range compares (18), **`jsr js_int32`** (not inlined: an 18-instruction function that
copies a 16-byte template), `movem` + 16-byte copy back (10), sp adjust: **~85 executed
instructions for `a + b`**; the whole OP_add case is 114 lines, OP_mul 122, a comparison 53.
`js_float64` is two nested calls. `static inline` is honoured only at `-O3`
(`probes`: `jsr l1` disappears only with `-O3`); 145 call sites of `js_int32`, 48 of
`js_float64` in quickjs.c.

### Probes [M] `probes/layout.c`, `vc +aos68k -cpu=68020 -fpu=68881 -O1`, instruction lines
| operation | L16 shipped | L161 int32 tag | L12 | L8 struct halves | L80 boxed double | **L65 scalar halves** | L64 upstream uint64 |
|---|---|---|---|---|---|---|---|
| both-int tag test | 10 | 10 | 10 | 10 | 10 | 14 | 22 |
| `sp[0] = var_buf[idx]` | 12 | 12 | 11 | 9 | 9 | 9 | 9 |
| dup (refcount test + copy) | 25 | 24 | 23 | 22 | 22 | 16 | 16 |
| make int | 6 | 5 | 5 | 5 | 5 | 5 | 5 |
| make float | 8 | 8 | 8 | 7 | 14 + malloc | 6 | 15 |
| float add of two slots | 21 | 18 | 18 | 45 | 27 + malloc | 17 | 53 |
| int add, overflow-checked | 22 | 21 | 21 | 21 | 21 | 25 | 33 |
| **call f(ctx, v, v) → v** | 34 | 34 | 33 | 32 | 32 | **14** | 14 |
| `arr[idx]` load | 12 | 12 | 11 | 9 | 9 | 9 | 9 |

(Counts include prologue/epilogue. Soft-float counts differ by ≤ 4.)

- **L64 (upstream `JS_NAN_BOXING=1`, `uint64_t`)**: tag extraction `(int)(v >> 32)` becomes
  64-bit shift code/helper calls; float get/set needs 64-bit add/sub. This is the path that was
  miscompiled, and even when correct it is slow with vbcc. Do not go back to it as is.
- **L8 (8-byte struct of two longs)**: copies shrink, but vbcc still passes struct arguments
  with a byte loop and still returns through `movem`+copy, so calls barely improve (34 → 32).
- **L65 (8-byte `unsigned long long` carrier, halves reached by pointer cast, no shifts)**:
  vbcc moves a `long long` as two `move.l`, pushes it as two `move.l`, returns it in d0/d1. The
  call probe drops from 34 to 14 instructions and all byte loops disappear. On big-endian the
  tag is simply the first long. With a *double-favouring* encoding (doubles stored unmodified;
  every other type has first long ≥ 0xFFF80000 with the tag in its low bits) a float result is
  one `fmove.d fp0,(a1)` with no tag write, and a float operand is used straight from memory
  (`fadd.d (-8,a2),fp0`). No 64-bit shift or add is generated anywhere (checked in
  `probes/layout_65_fpu.s`), so the old vbcc miscompile is not on the path.
  What it needs: (a) NaN canonicalisation wherever a NaN with the sign bit set can enter:
  typed-array/DataView float reads, `JS_NewFloat64` from host code, FNEG of a NaN, the soft
  library's NaN results — unchecked, such a value would alias a tagged pointer (memory safety,
  not just a wrong answer); (b) accessors only work on lvalues (`((int32_t*)&v)[0]`), so
  rvalue uses such as `JS_VALUE_GET_TAG(f())` need a temporary — the compiler flags each one;
  (c) `JS_MKVAL/JS_MKPTR` constants become 64-bit integer constants.
- **L80 (8 bytes, doubles boxed on the heap)**: every float result allocates. Even on
  soft-float machines an allocation costs about as much as the arithmetic. Rejected.
- **L12**: indexing needs `muls.l #12` or shift-and-add instead of a scaled index or `lsl #4`;
  struct passing still uses byte loops; saves 25 % memory only. Rejected.
- **L161 (keep 16 bytes, make the tag `int32_t` + pad)**: removes one `move.l #0` per tag write
  and the 64-bit compares on `v.tag`. One-line header change, no ABI change in practice (the
  low long stays at offset 12). Small but nearly free.

### Public ABI impact of an 8-byte value [S]
LVO functions take and return JSValues through pointers (`*val_ptr`, `*result`), so register
assignments of the 198 LVO entry points do not change; the pointed-to object shrinks from 16 to
8 bytes. Mechanical edits: 48 `movem.l d0/d1/a0/a1,(a4)` + 89 "push 16 bytes" sequences in
`library/vbcc/qjsfuncs_asm_all.s`, 48 `movem` sites across `bridge_asm.s` (8),
`bridge_asm_batch1.s` (18), `bridge_asm_batch2.s` (22). Every client must be rebuilt against
the new header (the CLI ships with the library; third-party clients break → bump the library
version and refuse old openers). `JSValue` arrays in C glue (`argv`), `quickjs_libc_lib.c`,
`amiga_ffi.c` recompile unchanged if they only use the macros (only 1 direct `.tag`/
`sizeof(JSValue)` use found in `library/vbcc/*.c` + `src/*.c`).

### Memory traffic
Interpreter stack slots, local/arg buffers, `JSProperty` values, fast-array storage and closure
variables all halve. A 10,000-element array goes from 160 KB to 80 KB; on a 68030 with a
256-byte data cache and a 68040 with 4 KB that is twice the elements per cache line.

---------------------------------------------------------------------------------------------

## D. CPU-specific arithmetic worth hand-coding

All candidates below were assembled and checked against reference results under vamos:
`arith/hand.s` + `arith/t.c`: 20,000 cases incl. edge values, **0 mismatches** [M];
`arith/d2i.c` + `arith/d2it.c`: 40,000 doubles, **0 mismatches** [M].

1. **Overflow-checked int32 add/sub/mul straight from the V flag.** vbcc inline-asm functions
   (`long mulv(__reg("d0") long,__reg("d1") long,__reg("a0") long*) = "\tmuls.l\td1,d0\n\tsvs\t(a0)";`)
   work. The 32-bit `MULS.L` sets V when the product does not fit, so JS `a*b` needs **no
   64-bit multiply at all**: `muls.l d1,d0 ; bvs slow` replaces sign-extension, a call to
   `__mulint64` (19 instructions, 4 multiplies, the 060 trap), two 64-bit compares and, in the
   FPU build, four `fmove.x` saves/restores of fp0/fp1 around the call (quickjs.c:19418,
   ~60 instructions before the result is stored). The overflow path computes
   `(double)a * (double)b` directly, which is what JS specifies anyway. `add.l ; bvs` likewise
   replaces ~32 instructions of emulated 64-bit add + range check. In portable C the
   `((a^r)&(b^r)) < 0` idiom costs 5 instructions with vbcc (`probes`, `_add_int`).
2. **060-safe 32×32→64 unsigned multiply** from four `MULU.W` (`_umul64_w`, 22 instructions,
   no trap on any CPU; MULU.W is 2 cycles on the 060) for `__mulint64_060`. Keep the single
   `mulu.l d3,d5:d4` for 020/030/040.
3. **060-safe 64-bit divide**: by a divisor < 65536 with four chained `DIVU.W`
   (`_udiv64_16`; covers `% 10`, `% radix`, and 10^9 can be done as two steps or kept as a
   32-bit path); return quotient and remainder together so `%` stops costing a multiply. For
   general 32-bit divisors on the 060 a shift-subtract or FPU-assisted routine is needed; the
   existing 64-iteration loop can stay for the rare ≥ 2^32 divisor.
4. **Integer-only double→int32 and "is this double an int32"** from the two halves
   (`arith/d2i.c`): no FPU instruction, no library call, no 64-bit helper. Replaces FINTRZ
   (040 trap), `IEEEDPFix` (soft variants) and the `__rshuint64/__lshint64` calls in
   `double_is_int32`/`JS_ToInt32Free`. vbcc compiles the C version to 47/83 lines; hand asm
   ~15/25. On 020+ `bfffo` is the natural instruction for the reverse (int→double
   normalisation) in soft builds.
5. **040 `floor/ceil/trunc`** need a correct implementation anyway (bug 2 above): integer bit
   masking on the stored double (clear fraction bits, adjust by one) is correct for all
   magnitudes and uses no FPCR writes.
6. **Soft variants: negate/abs/sign tests as bit operations** on the high long instead of
   `IEEEDPNeg`/`Abs`/`Tst` calls; an inline integer compare for doubles (sign/magnitude compare
   of two longs with NaN check, ~12 instructions) instead of the 73 `IEEEDPCmp` call sites.
7. **Bit-field instructions**: `bfextu (a0){1:11},d0` for the exponent is one instruction, but
   memory bit-field operations are microcoded and slow on 040/060; `move.l (a0),d0 ; swap d0 ;
   lsr.w #4,d0 ; and.w #$7ff,d0` is as fast or faster everywhere [E, from the timing tables].
   Not worth a per-CPU variant. `bfffo` (item 4) is the only one that earns its place.

---------------------------------------------------------------------------------------------

## Ranking by likely benefit

1. **8-byte JSValue, scalar carrier with 32-bit-half access, double-favouring NaN box (L65).**
   All six variants. Halves value copies and memory; removes the byte-loop argument passing
   (call probe 34 → 14 instructions [M]); float results need no tag write. Speed-up of real
   code is an estimate: 15-30 % of interpreter time, basis: 7.7 % of all instructions are 16-byte
   copy moves plus 1,319 byte loops and 2,501 return copies. Effort large (header variant, NaN
   canonicalisation audit, ~185 mechanical asm edits, ABI break). Risk high.
2. **Hand-coded int arithmetic in the interpreter: V-flag add/sub/mul, integer OP_div when
   exact, integer OP_mod for negative operands.** All variants. Removes the 060 trap on every
   int multiply, ~4 soft-float calls per `i/2`, 8 per negative `%`, the FINTRZ trap per exact
   division on the 040. Per-operation instruction counts [M]; whole-program gain [E] 5-20 %
   on arithmetic-heavy code, far more on the 060 for multiply-heavy loops. Effort small-medium,
   risk low (each path verified against the reference here).
3. **Integer-only double→int32 / is-int32 (item D4)** in `js_number`, `JS_ToInt32Free`,
   `JS_ToInt32SatFree`, `JS_ToArrayLengthFree`, `double_is_int32`. Removes all hot FINTRZ
   traps on the 040, one library call per conversion on soft variants, and the 64-bit shift
   helper calls on all. Effort small, risk low.
4. **060-safe `__mulint64_060`/`__divuint64_060`/`__moduint64_060`** (D2, D3) and remainder
   returned from the divide. 060fpu/060soft only: number formatting of fractions goes from
   5 traps per digit to none; Date and BigInt likewise. Effort small, risk low.
5. **Out-of-line `js_int32`/`js_float64`/`js_bool`** made macros or forced inline. All
   variants; ~25 instructions saved per int result [M]. Overlaps with the compiler-flag lane
   (`-O3` inlines but is a different risk).
6. **`int32_t` tag (L161)** if (1) is not done. All variants, a few percent [E], trivial.
7. **Soft variants: inline bit-level negate/abs/compare** (D6). 020soft/040soft/060soft;
   helps float-heavy code only. Medium effort (compiler emits the calls, so it needs macros at
   the engine's compare sites).

Would not pay off: boxed doubles, a 12-byte value, the upstream `uint64_t` NaN box unchanged,
bit-field instructions for field extraction, replacing mathieeedoubbas wholesale with our own
soft-float before items 2-3 remove most of its callers from integer-valued code.

Before any FPU variant is recommended to users, the correctness bugs in section A must be fixed:
today 020soft is the only variant that computes `65536*65536` and `Math.floor(3e9)` correctly.

## Not determined
- Real cycle costs of the FPSP/ISP traps and of mathieeedoubbas routines (no cycle-accurate
  emulator or real hardware; vamos emulates the math library natively).
- Dynamic frequency of the 040/060 traps on real workloads (static sites and call chains only).
- Whether 020fpu shows the `65536*65536` bug at run time (same source, but vamos cannot run
  that variant); whether bugs 4 and 5 show up at run time.
- Exact 68040/68060 unimplemented-FPU lists from a primary source (the manuals were not
  retrievable; only the integer list and FINT/FINTRZ/transcendentals were confirmed by search).
- End-to-end speed-up of an 8-byte JSValue: needs a prototype build; only micro-probes exist.

## CHECKPOINT (2026-11-12, paused on coordinator request)

Background work at the time of the pause:
- `find / -iname mathieeedoubbas.library` (search for a real OS math library binary to measure
  soft-float internals). Killed, never completed, no result. Not needed: vamos emulates the
  library natively, so it would not have been usable there anyway.
- `build_asm.sh` runs for all six variants (compiler output into `asm/`). Had already finished;
  outputs complete and used in the notes above.
- vamos runs (`vm/run.sh`, `vm/vrun.sh`): none in flight. No processes of this lane remain.

State: round-1 work for this lane is complete. NOTES.md is final, six knowledge-base facts are
stored, the report was delivered.

Remaining (not started, would be round-2 work):
- File tasks for the five correctness bugs in section A (none filed).
- Run-verify bugs 4 (`-0.0` literal) and 5 (soft `(unsigned)double`), and the 020fpu variant
  (needs an emulator with full 6888x support; vamos stops at FLOGN).
- Prototype build with the 8-byte value (layout L65) to get an end-to-end number.
- Confirm the 68040/68060 FPU unimplemented lists against the Motorola manuals.
