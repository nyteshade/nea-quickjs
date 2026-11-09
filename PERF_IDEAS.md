# Performance ideas for slower Amigas

A survey of where the time actually goes, written 2026-11-09 against
library 0.206. Everything here is read out of the source; **almost none
of it is measured**. That distinction is marked throughout, because the
whole point of this document is to stop the next session guessing the
way the last one did.

Read the "Measure first" section before acting on anything below it.

---

## Measure first

There is no benchmark in this tree. `amiga/tests/probe_performance.js`
only probes whether `performance.*` exists — it does not time anything.

Without a fixed workload, none of the changes below can be evaluated.
A change that "feels faster" on an emulator is not evidence, and this
project has already lost months to changes that looked correct and
weren't.

A useful benchmark would be a single script, runnable on Amiberry at
each CPU setting, timing with `os.now()` (which returns real Unix-epoch
microseconds since 0.183):

- integer and float arithmetic in a tight loop
- string building and concatenation
- object allocation and property churn (exercises the allocator and GC)
- array sort and iteration
- regex matching (exercises the `-O0` file)
- a function-call-heavy loop (exercises dispatch)

Report each separately. A single aggregate number hides which subsystem
moved, and the items below target different subsystems.

---

## 1. The interpreter uses a switch, not computed goto

**Expected payoff: large. Risk: unknown feasibility.**

`quickjs-master/quickjs.c:61`:

```c
#if defined(EMSCRIPTEN) || defined(_MSC_VER) || defined(__SASC) || defined(__VBCC__)
#define DIRECT_DISPATCH  0
#else
#define DIRECT_DISPATCH  1
#endif
```

With `DIRECT_DISPATCH 0` the dispatch macros at `quickjs.c:17425-17440`
compile to:

```c
#define SWITCH(pc)      switch (opcode = *pc++)
#define CASE(op)        case op
#define BREAK           break
```

instead of the computed-goto form:

```c
#define SWITCH(pc)      __extension__ ({ goto *dispatch_table[opcode = *pc++]; });
#define CASE(op)        case_ ## op
#define BREAK           SWITCH(pc)
```

Upstream QuickJS uses computed goto on every platform that supports it
because it removes a bounds check and a return-to-loop per bytecode, and
lets the compiler keep the opcode in a register.

`JS_CallInternal` is **2,838 lines** of dispatch. Every bytecode the
interpreter executes pays this cost.

The `__VBCC__` guard is inherited from the SAS/C path and may never have
been tested against VBCC 0.9i. **The first thing to try is simply
defining `DIRECT_DISPATCH 1` for VBCC and seeing whether it compiles.**
VBCC supports label-as-value in some configurations; whether it supports
this exact construct is unknown.

If it does not compile, the fallback is to reorder the `switch` so the
hot opcodes (`OP_get_loc`, `OP_put_loc`, `OP_add`, `OP_call`, the
integer fast paths) are contiguous, which helps branch prediction on
68040/68060 even without computed goto.

---

## 2. All memory is MEMF_PUBLIC

**Expected payoff: large on accelerated machines. Risk: medium — needs
a Worker audit.**

`library/vbcc/sharedlib_mem.c:53`:

```c
base->iMemPool = __CreatePool(base->iSysBase,
    MEMF_PUBLIC, POOL_PUDDLE, POOL_THRESH);
```

and `sharedlib_mem.c:197`:

```c
return __AllocVec(get_sysbase(), (ULONG)size, MEMF_PUBLIC);
```

`MEMF_PUBLIC` marks memory as visible to other tasks. On AmigaOS that
can force allocations out of fast RAM. QuickJS allocates constantly —
every object, string, array, closure, and property goes through this
allocator.

`MEMF_FAST` would keep the heap in fast RAM. On a machine with no fast
RAM it costs nothing; on an accelerated Amiga it could be significant.

**The catch:** the Worker primitive hands memory between tasks. If any
allocation crosses a task boundary, `MEMF_PUBLIC` may be required for
that allocation specifically. The pool is shared, so this needs an audit
of `sharedlib_worker.c` before changing the flag globally. A safe
intermediate step is a second pool for worker-crossing allocations.

Pool tuning is also here and also unmeasured:

```c
#define POOL_PUDDLE  (64 * 1024)
#define POOL_THRESH  (16 * 1024)
```

A 64 KB puddle on a 2 MB machine is a large chunk to take at once.

---

## 3. GC threshold is a hardcoded 256 KB

**Expected payoff: moderate. Risk: low.**

`quickjs-master/quickjs.c:1977`:

```c
rt->malloc_gc_threshold = 256 * 1024;
```

On a 2 MB machine that means GC runs often. On a 4 MB+ machine it is
leaving performance unused. `JS_SetGCThreshold` is already exposed as an
LVO (`quickjs.c:2120`), so this can be tuned at runtime rather than
recompiled.

Scaling the threshold to available memory at library init would be a
small, safe change with a measurable effect on allocation-heavy scripts.

---

## 4. The interrupt poll runs every 10,000 bytecodes

**Expected payoff: small but free. Risk: low.**

`quickjs-master/quickjs.c:488`:

```c
#define JS_INTERRUPT_COUNTER_INIT 10000
```

`__js_poll_interrupts` (`quickjs.c:8205`) fires every 10,000 bytecodes.
Since 0.206 that calls `qjs_signal_poll`, which does:

- `SetSignal` — one LVO
- `sl_Input()` — one LVO
- `WaitForChar(in, 0)` — one LVO
- and on a pending byte, `read` and possibly `write`

Three LVOs per 10,000 bytecodes is tolerable but not free, and it is on
the hot path of every script.

Two cheap improvements:

- **Cache the `Input()` handle** instead of calling it on every poll.
- **Check for a registered SIGINT handler before calling `sl_Input()`** —
  the current code calls `sl_Input()` inside the handler check, but the
  ordering can be tightened.

This is a regression introduced by the 0.206 Ctrl-C fix, so it is worth
addressing on principle even if the measured cost is small.

---

## 5. JSValue is 16 bytes

**Expected payoff: large. Risk: very high — do not attempt casually.**

`JS_NAN_BOXING=0` (forced at `library/vbcc/Makefile:53`) makes `JSValue`
a 16-byte struct:

```c
typedef struct JSValue {
    JSValueUnion u;
    int64_t tag;
} JSValue;
```

instead of an 8-byte `uint64_t`. Every value on the stack, every
argument, every array slot is double size. On a 32-bit CPU with a small
cache this is a real cost, and it shows in the binary: 1.84 MB soft
versus 1.55 MB FPU.

It was forced because VBCC miscompiled the NaN-box construction
(`libraryconfig.h:18`). **But the June 2026 compiler fix may have
changed that.** Nobody has retested `JS_NAN_BOXING=1` since vbccm68k was
patched.

If it now compiles correctly, half-size values and a smaller binary are
available. But this touches the ABI across 102 hand-written asm wrappers
in `qjsfuncs_asm_all.s`, and the 0.198/0.199 arc that converted them to
the 16-byte ABI cost a great deal of time. Treat this as a research
project, not a task.

---

## 6. Two files are still compiled at -O0

**Expected payoff: large. Risk: low — already verified to compile.**

This is compiler flags, but it belongs here because it is the largest
single lever currently sitting unflipped.

`library/vbcc/Makefile:98-99` and `:106`:

```c
CFLAGS_FPU_REGEXP  = $(subst -O1,-O0,$(CFLAGS_FPU))
CFLAGS_SOFT_REGEXP = $(subst -O1,-O0,$(CFLAGS_SOFT))
CFLAGS_SOFT_QUICKJS = $(subst -O1,-O0,$(CFLAGS_SOFT))
```

Both workarounds exist for VBCC optimiser bugs that the June 2026
compiler fix removed. The June session verified:

- `quickjs.c` soft now compiles at `-O1` deterministically (3/3)
- `libregexp.c` at `-O1` emits zero "code is weird" warnings, for the
  first time since 0.078

`quickjs.o` is **1.24 MB of the 1.84 MB library** — two-thirds of the
code, and the interpreter itself. It is running unoptimised on every
soft-float build, which is exactly the build slow machines use.

Tracked as `T-vbcc-quickjs-soft-o0-revisit` and `T-libregexp-o0-revisit`,
both still `planned`. Neither flag has been flipped because both need an
Amiga soak test first — the original failures were real on hardware.

---

## 7. Startup cost is already opt-in

**No action needed — recorded so nobody "optimises" it back.**

`extended.js` (767 KB of bytecode) and `ffi.js` (910 KB) are evaluated
**only** under `-x/--extended` (`quickjs-master/qjs.c:996`). A plain
`qjs script.js` does not pay for them.

However, `bridge_InstallChildProcessGlobal`, `bridge_InstallCryptoGlobal`
and `bridge_InstallAmigaFFIGlobal` run **unconditionally** at
`qjs.c:385-387`. These are C-side global installs and are probably
cheap, but they are on every invocation and have never been timed.

---

## 8. Strings are already 8-bit where possible

**No action needed.**

`is_wide_char` is 0 for Latin-1 and 1 for UTF-16
(`quickjs.c:630`, `:1851`), so ASCII strings do not pay double. This is
already the right design.

---

## 9. The FFI path is per-call, not per-bytecode

**Not worth optimising.**

`js_amiga_call` goes through a single asm trampoline for every LVO
(`library/vbcc/amiga_ffi.c:133`). That is fine for GUI code, where calls
are rare, and irrelevant for compute loops. Only worth revisiting if
someone writes FFI-heavy scripts.

---

## Suggested order

Ranked by payoff against risk, assuming a benchmark exists:

1. **`MEMF_FAST` for the pool** — one line, potentially large win,
   needs a Worker audit first.
2. **GC threshold scaled to available RAM** — small, safe, LVO already
   exists.
3. **Trim the interrupt poll** — small, free, fixes a 0.206 regression.
4. **Test `DIRECT_DISPATCH 1` on VBCC** — largest interpreter win if it
   compiles; unknown whether it does.
5. **Flip the two `-O0` files** — large, low risk, already verified to
   compile, needs a hardware soak.
6. **Reorder the switch** — fallback if computed goto is impossible.
7. **`JS_NAN_BOXING=1`** — research project, not a task.

## What to avoid

- **`-O2` / `-O3`.** VBCC accepts them, but this codebase has a
  documented history of the optimiser miscompiling at `-O1`. Going
  higher before `-O1` is soaked is inviting the same class of bug that
  cost months.
- **Optimising without a benchmark.** Every item above is a hypothesis
  read from source. Several are probably wrong about their own
  importance.

## A note on method

The Ctrl-C work in 0.206 took four builds because three of them were
guesses. The one that worked was the one that produced a measurement.
The same discipline applies here: build the benchmark, then change one
thing at a time, and keep the numbers.
