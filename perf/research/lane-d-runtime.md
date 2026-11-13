# Lane D — runtime under the interpreter loop, and start-up

Research only; nothing in the repository was touched. Everything below was
built and run in this directory (`LANE` = the directory holding this file).

Conventions: **[M]** = measured here (how is stated), **[S]** = verified by
reading source or generated assembly, **[E]** = estimate (basis stated).

## 0. Method and tools (reusable by other lanes)

- `link.sh` / `linkfpu.sh` relink `quickjs.library` from the objects `make`
  left in `/tmp/qjslib_68020_soft` and `/tmp/qjslib_68020` (copied to `obj/`,
  `objfpu/`), with any object overridden. **[M]** an unmodified relink is
  byte-identical to the shipped `quickjs.020soft.library` and
  `quickjs.020fpu.library`, so one-object experiments are exact.
- `runv.sh <library> <tag> <qjs args>` runs qjs under vamos in an isolated
  root (`vmr/<tag>`), prints Musashi's `total cycles` (from `vamos -v`) and
  the exec call counts (`--profile-libs exec.library`). It retries because
  concurrent vamos runs collide on `~/.vamos/volumes/ram`.
- `prof/pcsample.py` + `prof/resolve.py` + `prof/group.py`: a PC-sampling
  profiler. It patches vamos's `Machine.run` to record the PC after every
  211-cycle block and resolves against a vlink map. `prof/quickjs.library`
  is the 020fpu `-O1` build with every file-scope `static` function made
  global (1,593 of them) so the map names them; its total cycle count equals
  the stock build's (402,183,633 vs 402,183,185). Caveats: helpers defined
  `static inline` in headers stay anonymous and are booked to the preceding
  global symbol (`_fetch_destroy` = cutils.h/quickjs.h/list.h helpers,
  `_AmigaPoolCleanup` = aa_alloc/aa_free/aa_usable/aa_zero, `_LibraryFunctions`
  = a_malloc etc.); on a tight deterministic loop the samples alias with the
  loop period, so read those per-function numbers as coarse.
- **What a "cycle" is**: Musashi's cycle table in 68040 mode. It is not
  cycle-accurate for any real CPU; it has no cache model and no penalty for
  misaligned access. Use it for ratios between builds, not for seconds.
- **vamos implements exec in Python.** `AllocPooled`/`FreePooled` cost zero
  68k cycles there and a lot of host time: of the 2.06 s wall start-up, about
  1.0 s is vamos's own pool emulation **[M]**. So (a) wall time under vamos
  overstates the allocator, and (b) the cycle counts below contain *no* ROM
  allocator cost at all. On a real Amiga the ROM cost comes on top.

## A. Our own C library

### A1. What exists [S]

`library/vbcc/sharedlib_mem.c`:
- One exec pool for the whole library, created in `CustomLibInit`
  (`qjsfuncs.c:533`): `CreatePool(MEMF_PUBLIC, puddle 64 KB, thresh 16 KB)`,
  stored in `QJSLibBase.iMemPool`.
- Every `js_malloc` is one `AllocPooled`, every `js_free` one `FreePooled`.
  No size classes, no free lists of our own.
- 8-byte header per block: `{ULONG total; ULONG magic}`. `usable` = `total-8`.
- `realloc` never shrinks, grows by alloc + `CopyMem` + free.
- `calloc` zero-fills with a C long loop (`aa_zero`).
- **No Forbid/Permit and no semaphore** anywhere in the file. The pool lives
  on the single shared library base, so two programs that have
  `quickjs.library` open at once allocate from the same exec pool with no
  arbitration. exec's V39/V40 pool calls do not protect a pool against
  concurrent use (per the exec autodoc; not tested here) — a latent
  corruption risk independent of speed. Worker tasks use the separate
  `malloc()` shim (AllocVec, safe).
- The libc-style `malloc/calloc/free/realloc` shims use `AllocVec` + the same
  header with a different magic.
- `alloca` is a real stack alloca (`alloca_68k.s`), not a heap call.

Call chain for one allocation **[S, from the -O1 assembly]**:
`js_malloc` → `js_malloc_rt` → `(*mf.js_malloc)` = `a_malloc` → `AmigaAlloc`
(tag switch) → `aa_alloc` → `__AllocPooled` (LVO stub) → ROM; then
`(*mf.js_malloc_usable_size)` = `a_usable` → `AmigaAllocUsable` → `aa_usable`.
Nine calls before and after the ROM does any work; `js_free_rt` is the same
shape (usable chain first, then free chain).

### A2. String/memory functions [S][M]

The premise "byte loops in C at -O1" is only half true:

- vbcc's own `<string.h>` (first on the include path) defines `memcpy`,
  `memset`, `strlen`, `strcpy`, `strcmp`, `strncmp`, `strcat`, `strrchr` as
  **inline assembly** (`__asm_memcpy` etc.). For 68020+ the inline memcpy is
  already a long-word loop with word/byte alignment handling and a `dbf` tail.
  **[M]** `quickjs.o` has no reference to `_memcpy`, `_memset`, `_strlen`,
  `_strcmp`; the copies of those in `sharedlib_string.c` are dead weight for
  the engine.
- What the engine really calls **[M, jsr counts in the 020fpu assembly]**:
  `_memmove` 6 sites, `_memcmp` 8, `_memchr` 4, `_strchr` 3, `_strstr` 1.
  These are the byte loops. Inner loops as compiled (`-cpu=68020 -O1`; the
  68060 output is identical apart from the `machine` line):

```
memmove (ascending)            memcmp                         memset (unused by engine)
l48 move.l a2,a0               l20 move.l d1,(12+l24,a7)  <- stores the counter every byte
    addq.l #1,a2                   move.b (a1),d0             l60 move.b d2,(a0)+
    move.b (a0),(a1)+              cmp.b  (a0),d0                 move.l d1,d0
    move.l d1,d0                   beq    l19                     subq.l #1,d1
    subq.l #1,d1               l19 addq.l #1,a1                   tst.l  d0
    tst.l  d0                      addq.l #1,a0                   bne    l60
    bne    l48                     move.l d1,d0
                                   subq.l #1,d1
7 instructions per BYTE            tst.l  d0 / bne l20        10 instructions per byte
```

- `memmove` matters: `Array.prototype.shift` (quickjs.c:42602) moves
  `count*16` bytes through it, as do typed-array `set`/`copyWithin`/`subarray`
  copies. 16-byte JSValues × 7 instructions per byte = 112 instructions per
  array element moved.
- The inline `memcpy` is itself misused for tiny fixed sizes: cutils.h's
  `get_u32()`/`get_u16()`/`put_u32()` are `memcpy(&v, tab, 4)`. **[M]** vbcc
  emits each as an out-of-line function doing four `move.b` through a stack
  temporary (9 instructions + call/return ≈ 13) where 68020+ needs one
  `move.l (a0),d0`. 314 call sites in quickjs.c (operand fetch in the
  interpreter, the bytecode reader, the checksum).
- Compiler-generated struct copies: **[M]** when a 16-byte JSValue is passed
  by value *from behind a pointer* (`use(*p)`, `use(pr->u.value)`), vbcc
  copies it with `moveq #3,d0 / 4× move.b (a0)+,(a1)+ / dbra` — 16 byte moves
  and 4 loop branches, then `sub.w #16,a0` — instead of four `move.l`.
  1,309 such loops in the 020fpu assembly of quickjs.c. `-speed` and `-O2` do
  not change it (tested on a 9-line reproduction, `inl/c.c`). Copies between
  two pointers (`*d = *s`) and pushes from stack locals do use `move.l`.

### A3. Measured: assembly memmove/memcmp

`str/mem020.s`: long-word `memmove` (both directions: align destination,
16-byte unrolled `move.l` ×4 block loop, long tail, byte tail) and `memcmp`
(`cmpm.l` loop, byte-wise recheck of the first differing long). Linked into
the 020fpu library in place of the C versions.

| Workload (`vm/bench_alloc.js`: objects, arrays, strings, `keep.shift()` on 500 elements) | Musashi cycles |
|---|---|
| stock 020fpu | 2,813,214,006 |
| + asm memmove/memcmp | 2,252,139,485 (**−19.9%**) **[M]** |

Profile of the stock run **[M]**: `_memmove` alone is 22.2% of all samples.
A functional check (`vm/t_mm.js`: shift/unshift/splice/copyWithin, string
ordering, sort) prints identical output on both libraries.

### A4. Per-CPU design for the copy/compare primitives

Selection is at build time: the Makefile already passes `-m$(CPU)` to vasm,
so one source with `ifd`-style conditionals (or three small files) picked by
`$(CPU)` is enough. No run-time dispatch.

68020/68030 **[E, basis: 256-byte I-cache, bus-cycle cost of misaligned longs]**
- Align the *destination* to 4 with byte moves, then `move.l (a0)+,(a1)+`.
  A misaligned source costs an extra bus cycle per long read; a misaligned
  destination costs it on every write, so align the destination.
- Unroll ×4 (16 bytes — exactly one JSValue) and close the loop with
  `subq.l #1,dn / bne.s`. The whole loop is 12 bytes; unrolling further buys
  nothing but I-cache pressure on the 020/030. `dbra` is fine here too (its
  16-bit count needs an outer loop above 1 MB, which is why the prototype
  uses subq/bne).
- Below 16 bytes go straight to the tail; do not pay the alignment preamble.
- `memcmp`/string equality: `cmpm.l (a0)+,(a1)+` with a byte-wise recheck on
  mismatch. `memchr`/`strchr`: byte loop with `dbne`-style exit is adequate;
  they are 0.0x% in every profile taken.

68040 **[E, from the 68040 user manual's description of MOVE16]**
- Same long loop for anything under a few hundred bytes.
- `MOVE16 (a0)+,(a1)+` only when: length ≥ ~256 bytes, both pointers have the
  same offset mod 16 (so one alignment preamble fixes both), and the data is
  not about to be read again. MOVE16 writes a whole line without first
  reading the destination line into the cache; that is its entire benefit,
  and it is real only for large copies of data that is not already cached.

68060 **[E]**
- Long loop with `subq/bne` (the branch cache folds a predicted loop branch;
  DBcc is not the preferred form on the 060).
- MOVE16 is implemented but is a win only for large copies from uncached
  source; for cached data four `move.l` are faster.

**When MOVE16 is a loss, and why it ranks last here:** the engine's copies
are 16-byte JSValues, property arrays of 32–128 bytes, strings of tens of
bytes. **[M]** 95.6% of all blocks allocated during start-up are ≤ 256 bytes.
MOVE16 needs 16-byte co-alignment the allocator does not provide, bypasses
the cache for data the interpreter touches next, and can only matter for
multi-kilobyte ArrayBuffer copies. Not worth carrying.

The far bigger win in this area is not a faster memcpy but **not calling
one**: direct unaligned loads for `get_u16/get_u32/put_u32` on 68020+
(`x/gu/cutils.h`; **[M]** −2.2% of start-up cycles by itself, and it is in
every operand fetch of the interpreter — lane A's territory), and getting
vbcc to stop byte-copying struct arguments.

### A5. Small-object allocator

Allocation pattern **[M, from `vamos -l exec:info` trace of an empty-script
run, 020fpu; sizes as vamos logs them, i.e. rounded to 8]**:

| | |
|---|---|
| AllocPooled / FreePooled calls, empty script | 26,005 / 26,004 |
| … with `--no-extensions` | 1,591 / 1,590 |
| live at end of start-up | 15,320 blocks, 1,407,040 bytes (122,560 of them our 8-byte headers) |
| freed before teardown | 10,685 (41%) — the rest (15,319) are freed one by one at exit |
| payload ≤ 32 bytes | 36.3% of allocations |
| payload ≤ 64 | 68.0% |
| payload ≤ 256 | 95.6% |
| most common payloads | 32 (7,232), 48 = JSObject (4,758), 88 (2,899), 40 (2,745), 96 (1,180) |

`bench_alloc.js` (30,000 loop iterations): 271,680 AllocPooled calls — about
nine heap blocks per iteration of `{a,b,c:'k'+n}; [i,o]`.

What `js_malloc_usable_size` requires **[S]**: its signature is
`size_t (*)(const void *ptr)` — no runtime, no opaque. The size must be
recoverable from the pointer alone, in O(1), and must be a true lower bound
on writable bytes, because the engine (a) adds it to `malloc_size` on every
malloc and subtracts it on every free (the GC trigger depends on it),
(b) appends to a string in place when `usable ≥ needed` (quickjs.c:5090),
(c) reports slack from `js_realloc2`. Returning 0 is legal but disables GC
pacing. So: a size word immediately before the block, or slabs aligned so
the size class can be read from a slab header found by masking the pointer.

Design:
- One arena **per JSRuntime** (hang it off the `opaque` already passed to the
  malloc functions). Single owner ⇒ no locking, and it removes the shared-pool
  hazard in A1. Teardown releases the slabs wholesale.
- Chunk = `(size + 4 + 7) & ~7`, minimum 16. Classes every 8 bytes up to 264
  (32 lists) — covers 95.6% of blocks. One LIFO free list per class, linked
  through the first payload long.
- 4-byte header = usable size (low bit set marks a large block). Payload is
  4-aligned, which is all a 68k needs. Halves today's 8-byte header.
- Refill by bumping through 32 KB slabs obtained from exec (`AllocMem`, or
  the pool with a threshold above the slab size). Slabs are not returned
  until the runtime dies; "assume enough RAM" makes that acceptable.
- Large blocks go to exec with an 8-byte header.
- `realloc`: size classes give built-in slack; grow = alloc + copy + free.
- Fast paths in assembly (`alloc/s3/fm_fast.s`): malloc is 16 instructions on
  a free-list hit, free is 12, usable is 5.

Measured with the prototype (`alloc/`; state in file statics, slabs from the
existing pool):

| Build (020fpu) | start-up cycles | exec pool calls | `bench_alloc` cycles | pool calls |
|---|---|---|---|---|
| stock | 402,183,185 | 52,009 | 2,813,214,006 | 543,359 |
| fm1: size classes behind the existing `AmigaAlloc` | 396,450,603 (−1.4%) | 2,317 | | |
| fm2: + malloc table points straight at the allocator | 388,997,684 (−3.3%) | 2,317 | | |
| fm3: + assembly fast paths | 386,733,054 (−3.8%) | 2,317 | 2,604,570,071 (**−7.4%**) | 158 |

All **[M]**. These are 68k-side savings only. The profile says the glue
(js_malloc_rt … LVO stub) is 10.3% of start-up cycles and 14.3% of
`bench_alloc`; the prototype recovers about half because `js_malloc` →
`js_malloc_rt` → indirect call is still there. Folding the size-word read
into `js_malloc_rt`/`js_free_rt` (a macro instead of the indirect
`js_malloc_usable_size` call) would take most of the rest **[E]**.

What it saves on a real Amiga in addition **[E]**: 95.5% of the calls into
exec's pool code disappear. ROM `AllocPooled` walks the puddle list calling
`Allocate` (first fit over each puddle's free-chunk list); `FreePooled` finds
the puddle by address and `Deallocate` walks that puddle's sorted free list.
With a 1.4 MB heap that is ~22 puddles. At a guessed 100–300 instructions per
call × 52,009 calls that is 5–15 M instructions on top of the measured
start-up — unmeasurable under vamos, so treat the allocator's true gain as
"7% measured plus an unknown ROM share that grows with heap size".

Outside evidence: upstream QuickJS's 2026-06-04 changelog lists "added custom
malloc for small blocks (11% faster on bench-v8)" — on machines whose system
malloc is already far better than exec pools.

## B. Engine data structures

### B1. Sizes and offsets under `-DJS_NAN_BOXING=0`, vbcc, 68020 [M]

Obtained by appending `sizeof`/`offsetof` constants to a copy of quickjs.c
and reading the assembled values (`qjs/quickjs_sizes.c`).

| Type | bytes | notes |
|---|---|---|
| JSValue | 16 | 8-byte union + `int64_t tag`; only the low long of the tag (offset 12) is ever examined |
| JSProperty | 16 | one JSValue per property slot |
| JSGCObjectHeader | **20** | fields end at 16; see below |
| JSObject | 48 | header 20, shape @20, prop @24, first_weak_ref @28, union @32 (16) |
| JSShape | 50 | + 8 per property + 4 per hash slot in front |
| JSShapeProperty | 8 | `hash_next:26, flags:6`, atom |
| JSString / JSAtomStruct | 20 | refcount, len/wide, hash/kind/atom_type, hash_next, first_weak_ref; chars at +20 |
| JSVarRef | 40 | |
| JSFunctionBytecode | 94 | cpool @62, realm @58 |
| JSStackFrame | 46 | cur_sp @42 |
| JSMapRecord | 58 | key @26, value @42 |
| JSRuntime / JSContext | 270 / 520 | |

Wasteful for a 32-bit big-endian machine:

1. **JSGCObjectHeader is 20 bytes for 16 bytes of content [M].**
   `JSGCObjectTypeEnum gc_obj_type : 4` makes vbcc size the struct as if the
   bit-field unit were a 4-byte enum, while still overlaying it on the byte
   at offset 4 (reproduced in 9 lines, `qjs/hdr.c`: enum-typed field → 20,
   `uint8_t`-typed → 16, `link` at offset 8 in both). Declaring the field
   `uint8_t` returns 4 bytes on every object, shape, function bytecode,
   var-ref and context: JSObject 48 → 44, JSVarRef 40 → 36.
2. **Every long in JSShape after the header sits at an address ≡ 2 (mod 4)
   [M offsets]**: `is_hashed` (1 byte) at +20 pushes `hash` to +22,
   `prop_hash_mask` +26, `prop_size` +30, `prop_count` +34, `proto` +46, and
   the property table starts at +50, so every `JSShapeProperty.atom` compared
   in `find_own_property` is a long straddling two longword-aligned bus
   cycles on a 68020/030. Same for `JSFunctionBytecode.cpool` (+62),
   `JSStackFrame.cur_sp` (+42), both JSValues in `JSMapRecord` (+26, +42).
   vbcc aligns to 2 on m68k and the structs were laid out for natural
   alignment elsewhere. Fix = move the odd-sized members (`is_hashed`, the
   `bool` in JSStackFrame, …) to the end or into existing padding. The cost
   today is one extra bus cycle per misaligned long on 020/030 and a
   split-access penalty on 040/060 **[E]**; Musashi does not model it, so no
   number from this lane.
3. **JSValue is 16 bytes where 8 would do.** The stated reason for
   `JS_NAN_BOXING=0` is vbcc miscompiling the int64 arithmetic of the NaN
   box. **[S]** In `quickjs.h` every piece of that arithmetic only touches
   the high 32 bits: `JS_VALUE_GET_TAG` is `v >> 32`, `JS_MKVAL` is
   `tag << 32 | val`, and the float bias is `± (JS_FLOAT64_TAG_ADDEND << 32)`.
   A third representation — `struct { uint32_t hi; uint32_t lo; }` overlaid
   on the double, with the bias applied to `hi` alone — is NaN boxing with
   no 64-bit integer operation at all. It would halve the size of every
   property slot, array element, stack slot and argument push (4 `move.l`
   → 2), and JSProperty/array memory. This is lane C/A's call; flagged here
   because it dominates every layout number above. Not built or tested.
   A smaller step with the same idea: `int32_t tag` gives a 12-byte JSValue
   (2-byte alignment makes that legal on m68k).
4. `first_weak_ref` costs 4 bytes in every JSString and JSObject for a
   feature almost nothing uses.

### B2. Property lookup as compiled [S][M]

`find_own_property` is declared `static inline`. **[M]** vbcc at `-O1` and
`-O2` does not inline `inline` functions; `-O3` does (9-line reproduction
`inl/t.c`: 3 `jsr` at -O1/-O2, 0 at -O3). So in the shipped library:

- `find_own_property` is a real function (`movem` of 6 registers) that itself
  **calls `prop_hash_end()`**, a function that returns its argument.
- `js_dup` is a real function that copies 16 bytes and calls
  `unsafe_unconst()`, another identity function returning in d0/d1/a0/a1.
- `JS_FreeValue` (1,273 call sites) re-pushes the 16-byte value plus `rt`
  and calls `JS_FreeValueRT`, which only then tests the tag. Releasing a
  plain integer costs two nested calls and about 22 instructions to learn
  there is nothing to do.
- The 6-bit `flags` bit-field test is done three times in a row as
  `moveq #26,d7 / lsl.l d7,d0 / moveq #26,d7 / lsr.l d7,d0 / and.b #48,d0`.

Instruction count for `JS_GetPropertyInternal` on the best case — own
property, first hash probe, plain value — read off the assembly: entry 16 +
`find_own_property` 37 (including the `prop_hash_end` call) + flag test 11 +
byte-loop copy of the value 26 + `js_dup` 25 (including `unsafe_unconst`) +
exit 7 ≈ **122 instructions**, with a 316-byte stack frame. A hand-written
or properly inlined version of the same logic is about 18–20 **[E]**.

Share in a property-heavy loop (`vm/bench_prop.js`: 4 field reads, 1 method
call, 1 field write per iteration; 020fpu) **[M, coarse — sample aliasing]**:
`JS_CallInternal` 68.3%, `js_dup` 9.6%, `JS_FreeValue`+`RT` 6.0%,
`find_own_property`+`prop_hash_end` 5.0%, `js_int32` 2.5%, `set_value` 2.5%,
`unsafe_unconst` 1.4%. The value-helper calls (dup/free/int32/bool/unconst)
total about 20%; the hash-chain walk itself about 5%.

### B3. Inline caches: cost, saving, history

What a monomorphic IC on get_field/put_field/get_global would save here
**[E, bounded by the measurement above]**: the hash probe and, for inherited
methods, the prototype walk. That is the ~5% `find_own_property` share plus
part of the call overhead around it — single digits while the interpreter
and the value helpers cost 90%. After inlining is fixed the lookup's share
rises, and the IC's ceiling with it, to perhaps 10–15% of property-heavy
code.

What it costs: bytecode is shared and immutable, so each site needs a side
slot (8 bytes: shape pointer + slot index) and new opcodes carrying its
index; shapes must be pinned or invalidated (a freed shape's address can be
reused); prototype hits need a second guard or an epoch; the bytecode format
version changes, so every `gen/*.c` blob must be regenerated. On a 68030
(16 data-cache lines) a hit touches the IC slot, the object and the property
slot, against object + shape header + hash slot + shape property + property
slot today — two fewer lines, which is worth something there **[E]**.

History:
- QuickJS-ng carried inline caches and removed them (commit 7de6d46,
  per maintainer Ben Noordhuis in PR #1521): "sometimes a lot slower than no
  inline caches", with the TypeScript-compiler benchmark hit hard.
- QuickJS-ng PR #1521 (May 2026) re-proposed a read-only monomorphic IC:
  1.45× on a property-read micro-loop, but flat on web-tooling-benchmark
  (geomean 1.085 → 1.08 runs/s; prettier +34%, source-map −14%, terser −7%).
  The author closed it unmerged: "the benchmark doesn't show improvement".
- Bellard's QuickJS changelogs for 2025 and 2026 list no inline cache; the
  2026-06-04 release got its gains from "custom malloc for small blocks
  (11%)" and "micro optimizations (30%)".

Verdict: **do not build an IC now.** The same lookups get several times
cheaper from inlining and from not byte-copying JSValues, with no format
change. Revisit only after those, with a profile in hand.

### B4. Atoms, strings, GC, refcount traffic

- Atom lookup **[S]**: `atom_hash[h & mask]` → atom index → `atom_array[i]`
  (pointer) → JSString (compare hash/len, then `memcmp`), chained by
  `hash_next` index. Two dependent loads per chain step; content-hashed.
  Every atom is its own heap block (20-byte header + chars + our 8-byte
  allocator header + exec's rounding).
- Strings: 8-bit where possible, chars inline after the 20-byte header,
  ropes for repeated concatenation. Nothing to change cheaply.
- GC **[M]**: `mark_children` + `JS_MarkValue` + `gc_*` are 10.4% of
  start-up cycles. The default threshold (256 KB, then ×1.5) fires the cycle
  collector repeatedly while the bundles build a 1.4 MB heap that contains
  no garbage cycles. Suppressing it for the duration of the install is worth
  6.0% of start-up (C4 below).
- Refcount traffic: see B2 — the cost is not the increment/decrement, it is
  that each one is a call (or two) moving 16–32 bytes of stack.

## C. Start-up

### C1. How it works [S]

`qjs.c` runs `bridge_InstallExtended` by default (`extended_mode = 1`;
`--no-extensions` turns it off — PERF_IDEAS.md §7, "already opt-in", is out
of date). `QJS_InstallExtended_impl` (`qjsfuncs.c:728`) calls
`js_std_eval_binary` on two blobs linked into the library's code hunk:

| Blob | bytes | atoms in table | source |
|---|---|---|---|
| `qjsc_extended` | 129,747 | 2,665 | `amiga/extended/extended.js`, 278,737 bytes |
| `qjsc_ffi` | 188,502 | 3,045 | 73 files bundled to `gen/ffi-bundle.js`, 492,919 bytes |
| `qjsc_repl` | 25,013 | 585 | loaded only for the REPL |

(Atom counts parsed from the blob headers; approximate.) Each is read with
`JS_ReadObject` — verify checksum over the whole blob, create every atom
(one string allocation each), allocate each function, copy its bytecode,
**byte-swap it** (blobs are little-endian; `bc_byte_swap` walks every opcode
on big-endian hosts), walk it again to turn atom indices into atoms, read
var/closure tables and constants — and then its top-level code is executed.
At exit `JS_FreeContext`/`JS_FreeRuntime` free every block individually.

What the top level does (regex counts over comment-stripped source):
- FFI bundle: 78 classes, ~520 methods, 239 getters/setters, 342 static
  members, 53 `CEnumeration.define` + 8 `.lazy` calls, 93 `Object.freeze`,
  ~1,940 `NAME: number` constant entries, ~40 globals plus the `amiga.*`
  namespaces assigned at the end of `index.js`.
- extended.js: 24 classes, 185 `function`s, 171 arrow functions, 79
  `globalThis.x =` assignments, ~1,180 LVO entries (`Name: -offset`).
- By source volume the FFI bundle is 55% BOOPSI (39 files, 259 KB), 28%
  library wrappers (132 KB), 17% structs (22 files, 80 KB).

Heap blocks created per phase **[M, exec trace deltas, soft library]**:

| Phase | AllocPooled calls | notable |
|---|---|---|
| runtime + context, no extensions | 1,591 | |
| read extended | +3,457 | |
| execute extended | +5,589 | +1,400 JSObjects, +834 shapes |
| read FFI | +3,770 | |
| execute FFI | +11,598 | +2,840 JSObjects, +1,896 shapes, +2,300 two-slot property arrays |

### C2. Where the cycles go [M]

Empty script, Musashi cycles, built by relinking with a `qjsfuncs.c` that
stops after each phase (`var/`):

| Phase | 020fpu (`-O1`) | 020soft (quickjs.c at `-O0`) |
|---|---|---|
| runtime + context + teardown, no extensions | 16.6 M | 19.1 M |
| read extended (and free it) | 68.3 M | 90.0 M |
| execute extended | 76.1 M | 81.6 M |
| read FFI (and free it) | 97.7 M | 126.1 M |
| execute FFI | 143.5 M | 153.0 M |
| **total** | **402.2 M** | **469.8 M** |

- The FFI bundle is **60%** of start-up; reading the two blobs is **41%**
  (about 520 cycles per blob byte); executing them 55%.
- `-O0` → `-O1` on quickjs.c changes start-up by only 14%.
- For scale only **[E]**: if Musashi's count were taken as 68030 clocks,
  402 M is 16 s at 25 MHz. The owner's "tens of seconds" is consistent.

Function profile of the 020fpu run (1.85 M samples), grouped:

| Share | Group |
|---|---|
| 19.4% | bytecode reader: `bc_csum` 4.3, `bc_byte_swap` 3.5, `JS_ReadFunctionBytecode` 2.3, `JS_ReadFunctionTag` 1.9, leb128 readers 2.6, … |
| 17.3% | defining properties, shapes, lookup (`JS_DefineProperty` 2.2, `JS_DefinePropertyValue` 1.7, `find_own_property` 1.4, `add_shape_property` 1.2, …) |
| 10.4% | cycle collector (`mark_children` 7.1) |
| 10.3% | allocator glue on the 68k side (ROM time not included) |
| 9.9% | atoms: create, hash, dup, free |
| 8.8% | value helpers that should be inline (`js_dup`, `unsafe_unconst`, `js_int32`, header helpers) |
| 8.5% | freeing objects/shapes/bytecode |
| 6.9% | `JS_CallInternal` — the interpreter proper |

Start-up is not an interpreter problem: only 7% is spent dispatching
bytecode. It is a loader/allocator/teardown problem.

### C3. Experiments [M] (020fpu, empty script, 402.18 M baseline)

| Change | cycles | Δ |
|---|---|---|
| Blob checksum set to the reader's own escape value `0xFFFFFFFF` (`x/x1`) | 383.96 M | −4.5% |
| + GC threshold raised for the duration of the install (`x/x2`) | 359.74 M | −10.6% |
| `JS_FreeContext`/`JS_FreeRuntime` made no-ops (`x/td`) — measures teardown | 340.58 M | −15.3% |
| `get_u16/get_u32/put_u32` as direct loads (`x/gu`) | 393.14 M | −2.2% |
| size-class allocator, asm fast paths (`alloc/fm3`) | 386.73 M | −3.8% (+ROM share) |
| extended bundle only, i.e. FFI never loaded (`var/f2`) | 160.99 M | **−60.0%** |
| checksum + GC + allocator + asm memmove/memcmp + direct loads (`x/all`) | 335.00 M | **−16.7%**, pool calls 52,009 → 2,317 |

`x/all` on `bench_alloc.js`: 2,813.2 M → 2,029.0 M (**−27.9%**).

### C4. The ideas, evaluated

1. **Load the FFI bundle lazily on first use of one of its globals.**
   −60% of start-up for every script that touches no FFI name **[M]**; no
   gain for GUI scripts. Mechanism: instead of evaluating `qjsc_ffi`, define
   accessor properties on `globalThis` for its ~40 names and on `amiga` for
   `lib`/`boopsi`/…; the first getter evaluates the blob and the bundle's own
   tail replaces the accessors with the real values. Care points: the
   bundle's `if (!(name in globalThis))` gating, `typeof X` triggering the
   load, and the REPL's completion walking globals. Low effort, low risk.
2. **Split per group/class.** For FFI scripts that use no BOOPSI (plain
   Intuition/GadTools windows) a three-way split core+libs / structs / BOOPSI
   would skip ~55% of the bundle ≈ 33% of start-up **[E, proportional to
   source bytes]**. Per-class granularity adds ordering problems (base
   classes, mutual references between Menu/MenuItem) for diminishing
   returns. Medium effort (bundler + lazy stubs per group).
3. **Skip the checksum.** −4.5% **[M]**. The blob is inside the library's
   own code hunk; a checksum guards nothing. Emit `0xFFFFFFFF` at blob
   offset 1–4 from the generator. Trivial.
4. **No cycle GC while installing.** −6.0% **[M]**. Two
   `JS_SetGCThreshold` calls around the install. Trivial.
5. **Do not tear the heap down at exit.** Teardown is 15.3% **[M]** (and
   15,319 `FreePooled` calls on a real machine). Exit handlers, file
   closes and `LibraryBase.closeAll()` must still run; what can go is the
   object-by-object free. Needs the per-runtime arena (A5), because today
   the pool belongs to the library base and is only deleted at expunge —
   skipping frees now would leak until the library is flushed.
6. **Generate big-endian blobs.** `bc_byte_swap` + `JS_SwapRegExpConstants`
   are 4.1% **[M, profile share]**. Needs a host-side post-processing step
   and a flag in the blob; medium effort, format risk.
7. **Keep constant data in the blob instead of copying.** The bytecode
   itself cannot stay shared: the loader rewrites atom operands in place and
   atom numbers are per-runtime. `pc2line` tables and string constants could
   be referenced in place, but strings need a refcounted header in front.
   The copies are cheap (inline long loops); the expensive part is per-item
   decoding and allocation. **[E]** < 3%. Not worth the engine changes.
8. **Avoid per-atom allocation on load.** All atom work is 9.9% of start-up
   **[M]** (5,710 atoms in the two tables, plus dup/free traffic).
   Pre-computed hashes in the blob would remove `hash_string8` (1.8%); one
   arena block for all atom strings needs an "immortal" flag so they are
   never individually freed. **[E]** 3–5%, engine-invasive. Low priority;
   the size-class allocator already makes each atom's allocation cheap.
9. **Snapshot of the initialised heap.** Would replace both reading and
   executing (96% of start-up) with loading and relocating a ~1.4 MB image:
   **[E]** an order of 10 M cycles instead of 385 M, plus the disk read.
   - Reference counts are not the obstacle: each runtime gets a private
     copy taken at a quiescent point, so counts are just data.
   - Absolute pointers are: object→shape/prop, GC list links, atom array,
     hash tables, and pointers *out* of the heap into the library (C function
     pointers in every native function object, class tables, the malloc
     function table, the context/runtime structs themselves).
   - A serializer that knows every struct would be a second, larger
     `JS_WriteObject` (shapes, property arrays, var-refs, modules, atoms,
     runtime tables) and would break on each upstream merge.
   - A type-agnostic route is feasible: build the heap twice in a bump arena
     at two different base addresses with the library loaded at two
     different addresses, and diff the images. A long that differs by the
     arena delta is a heap pointer; by the code/data/bss delta, a library
     pointer; anything else is non-determinism to remove. That yields a
     relocation table without knowing any layout, and can run at build time
     under vamos. One image per library variant (function addresses differ).
   - Remaining traps: pointer-derived hashes (`shape_initial_hash` hashes the
     prototype's address **[S]**, so stored shape hashes go stale — benign,
     only sharing is lost; Map/Set keyed by objects would need a rehash — the
     bundles construct 9 Maps/Sets), anything that captured a time, an OS
     handle or a task pointer during init, and the allocator's own free
     lists (snapshot from a compacted arena with none).
   - Verdict: feasible, weeks of work, high risk. It is the only way to
     make *FFI/GUI* scripts start fast; do it only if lazy loading and
     splitting leave those unacceptable.
10. **Simply not executing code that only defines things nobody uses** is
    what 1 and 2 implement at blob granularity. Finer than that (lazy
    methods) is `JS_PROP_AUTOINIT`-style machinery for JS-defined classes —
    not available without engine work.

## Ranking

| # | Proposal | Gain | Basis | Effort | Risk | CPUs |
|---|---|---|---|---|---|---|
| 1 | Lazy FFI bundle | −60% start-up for non-FFI scripts | M | low | low | all |
| 2 | Make the trivial helpers inline (`js_dup`, `JS_FreeValue` tag test, `find_own_property`, `prop_hash_end`, `get_u32`…): macros, or `-O3`/inline flag for quickjs.c | ~20% of a property loop is helper calls; 8.8% of start-up; get_u32 alone −2.2% start-up | M shares, E total | low–medium (lane A owns the compiler side) | medium (vbcc -O3 untested) | all |
| 3 | Asm `memmove`/`memcmp` per CPU | −19.9% on an Array.shift-heavy loop; ~0 elsewhere | M | low | low | all (020/030 long loop; same on 040/060) |
| 4 | Size-class allocator, per-runtime arena | −7.4% alloc-heavy, −3.8% start-up on the 68k side, plus ROM pool time for 95% of calls; fixes shared-pool hazard; halves header | M + E | medium | medium | all; most on slow CPUs with large heaps |
| 5 | No GC during install + checksum escape | −10.6% start-up | M | trivial | low | all |
| 6 | Fast exit (needs 4) | −15.3% of an empty run | M | low after 4 | medium (exit hooks must still run) | all |
| 7 | Split FFI bundle by group | ~−33% start-up for non-BOOPSI GUI scripts | E | medium | low | all |
| 8 | Struct layout: `uint8_t` GC type field (−4 bytes/object), realign JSShape & co. | memory; bus cycles on 020/030 | M sizes, E speed | low | low | 020/030 most |
| 9 | Big-endian blobs | −4.1% start-up | M share | medium | medium | all |
| 10 | 8-byte JSValue via hi/lo struct (no int64 maths) | halves value traffic | E, source-verified premise | high | high | all — lanes A/C |
| 11 | Heap snapshot (dual-run diff) | −90%+ start-up incl. FFI scripts | E | very high | high | all |

Would **not** pay off:
- **MOVE16**: wrong size range and alignment for this engine's copies.
- **Inline caches now**: ≤ ~5% while helpers and dispatch dominate; twice
  abandoned upstream on real workloads.
- **Hand-tuning memcpy/memset/strlen/strcmp**: already inline long-word
  assembly from vbcc's header.
- **Sharing constant data with the blob / pre-baked atoms** ahead of the
  items above.
- **Expecting `-O1` on the soft build's quickjs.c to fix start-up**: 14%.

## Could not determine

- Real cost of ROM `AllocPooled`/`FreePooled` (vamos runs them in Python).
  Needs a timing run on Amiberry or hardware, or a pool implementation in
  68k code under the emulator.
- Any cache or misalignment effect (Musashi models neither): the JSShape
  realignment and the 68030 D-cache argument for ICs are reasoning only.
- 68040/68060-specific timing of the copy loops; MOVE16 statements come
  from the manuals, not from a run.
- Whether vbcc `-O3` (inlining) compiles quickjs.c correctly — lane A.
- Exact per-function attribution in tight loops (sample aliasing).
- Whether Map/Set object-key hashing is address-based in this engine version
  (assumed for the snapshot analysis; `shape_initial_hash` was verified).
- `qjs -d` prints nothing under vamos, so heap statistics came from the exec
  trace instead of `JS_ComputeMemoryUsage`.

## Sources

- https://github.com/quickjs-ng/quickjs/pull/1521
- https://bellard.org/quickjs/Changelog

## CHECKPOINT

Written on the coordinator's pause request. No background builds or vamos
runs of this lane are alive (checked with `pgrep -f lane-d-runtime`).

### Finished (evidence is in the sections above and in these directories)

- A. libc: sources read; inner loops compiled (`libc/string_68020.s`,
  `libc/mem_68020.s`); finding that memcpy/memset/strlen/strcmp are vbcc
  inline asm and only memmove/memcmp/memchr/strchr/strstr are called
  (jsr counts from `qjs/quickjs_020fpu.s`); asm memmove/memcmp prototype
  `str/mem020.s` measured (−19.9% on `vm/bench_alloc.js`), functional check
  `vm/t_mm.js` identical output.
- A. allocator: exec trace statistics (`alloc/trace_stats.py` over
  `vmr/fpu_base/exec_info.log`); prototypes fm1/fm2/fm3 in `alloc/`
  (libraries `alloc/quickjs_fm{1,2,3}.library`) measured.
- B. sizes/offsets (`qjs/quickjs_sizes.c` → `.s`), enum bit-field waste
  (`qjs/hdr.c`), non-inlining (`inl/t.c`), byte-loop struct pushes
  (`inl/c.c`), get_u32 (`inl/g.c`), property path instruction count
  (`qjs/getprop.s`), `bench_prop.js` profile, IC history (two web sources).
- C. phase split for soft (`var/p1..p4`, libraries in `vm/libs_p*`) and fpu
  (`var/f1..f3.library`); function profile `prof/prof_empty_full.txt`,
  grouped by `prof/group.py`; experiments `x/x1`, `x/x2`, `x/td`, `x/gu`,
  `x/all` all measured (table in C3).
- NOTES.md sections 0, A, B, C, Ranking, Could-not-determine: complete.

### In progress / not done

- **Knowledge-base writes: NOT done.** Zero of the six permitted
  `mcp__fina__remember` calls were made (tool schema is loaded). Intended
  facts, one per call, `cwd=/Volumes/Code/Amiga/nea-quickjs`,
  `tags=perf-68k,reference`, no `partition`:
  1. start-up phase split and profile groups (C2) with the measurement method;
  2. vbcc -O1/-O2 does not inline `static inline`; consequences for
     find_own_property/js_dup/JS_FreeValue/get_u32; 1,309 byte-loop pushes;
  3. allocator facts (one shared unlocked pool, 8-byte header, 26,005 calls,
     size histogram) and prototype results;
  4. vbcc string.h inlines memcpy/memset/strlen/strcmp; memmove/memcmp are
     called byte loops; asm result;
  5. struct sizes, 20-byte JSGCObjectHeader cause, JSShape misalignment;
  6. tooling: relink reproduces shipped binaries byte-for-byte; vamos pool
     calls are host-side; `pcsample.py` profiler; `--no-extensions` flag.
- **Final report to the coordinator: not sent** (ranking table above is its
  content).
- No experiment was interrupted mid-run; every number quoted has a finished
  run behind it.

### Next three steps

1. Make the six `mcp__fina__remember` calls listed above (stop and report if
   a partition-disabled error comes back).
2. Send the final <500-word ranked report (from the Ranking table and the
   "Could not determine" list).
3. If more research is wanted: (a) measure vbcc `-O3`/inline-only flag on
   quickjs.c for start-up and `bench_prop.js` with the existing harness
   (`linkfpu.sh` + `runv.sh`), coordinating with lane A; (b) prototype the
   lazy-FFI accessor stubs in a `qjsfuncs.c` variant and confirm the 161 M
   cycle figure holds with the stubs installed; (c) get one real-ROM timing
   of AllocPooled/FreePooled (Amiberry) to replace the estimate in A5.
