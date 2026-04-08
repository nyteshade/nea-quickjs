# QuickJS → AmigaOS Port — SO_FAR

## Current State (April 2026, post-library architecture)

**Major architectural milestone: quickjs.library is now the product.**

The CLI binary (`amiga/qjs`) is a thin shell (~77 KB) that opens
`quickjs.library` and calls into it via LVO. Any Amiga application
can do the same and get full JavaScript with std/os/bjson modules.

### Test results: **221/221 pass** on AmigaOS (Amiberry, 020 FPU)
- All core JS, std, os, bjson modules work
- REPL works with .quit and Ctrl-D
- Module imports work (`import * as std from 'qjs:std'`)
- File I/O works through dos.library
- No crashes during normal operation

### Build (modern, simple)

```sh
make           # build library + CLI
make lib       # build library variants
make cli       # build CLI binary
make clean     # clean all
```

### Architecture

| Component | Size | Contents |
|-----------|------|----------|
| `quickjs.library` (FPU) | ~998 KB | engine + std/os/bjson + dos.library shims |
| `quickjs_soft.library` | ~1011 KB | same, soft-float math |
| `qjs` (CLI) | ~77 KB | thin shell, opens library via LVO |

### What lives WHERE

| In library | In CLI |
|-----------|--------|
| QuickJS engine (quickjs.c, dtoa.c, libregexp.c, libunicode.c) | qjs.c (main, arg parsing, S:QJS-Config.txt) |
| quickjs-libc.c (std, os, bjson modules) | bridge_asm*.s (LVO trampolines) |
| sharedlib_posix.c (stat, getcwd, opendir, mkdir, rename, etc.) | quickjs_bridge.c (init/cleanup, stubs) |
| sharedlib_stdio.c (fopen, fwrite via dos.library) | repl.o (precompiled REPL bytecode) |
| sharedlib_clib.c (errno, strtol, sscanf, getenv, fd I/O) | standalone.o (precompiled standalone runner) |
| sharedlib_mem.c (AllocVec malloc/free) | |
| sharedlib_time.c (gettimeofday via DateStamp) | |
| sharedlib_printf.c (snprintf/vsnprintf) | |
| sharedlib_int64.s (64-bit integer helpers) | |
| All 186 QJS_* LVO entry points (assembly) | |

### Known issues / pending work

- **AmiSSL HTTPS**: VBCC integration crashes — opt-in only via
  `-DQJS_ENABLE_AMISSL`. Default builds use popen("curl") fallback
  which fails cleanly. Root cause likely related to inline assembly
  function signatures or AmiSSL task-local state.
- **6 CPU/FPU variants**: Currently builds 020 FPU and 020 soft-float.
  040/060 variants would need Makefile refactoring.
- **os.now precision**: Returns ~7-digit values (microseconds since
  some baseline) instead of microseconds since Unix epoch. Likely
  in 64-bit multiply or VBCC inline behavior. Tests pass since they
  just check delta, not absolute time.
- **setTimeout timing**: Same root cause as os.now — depends on
  js__hrtime_ms which uses gettimeofday.

### Critical architectural rules (don't repeat past mistakes)

1. **The library is the product, CLIs are just clients.** All
   functionality MUST live in the library so any Amiga app can use
   it. Never put JS-facing functionality in the CLI.
2. **No .lib files in the library.** vc.lib, posix.lib, etc. depend
   on C startup code that doesn't run in shared library context.
   Use dos.library/exec.library directly via LVO.
3. **VBCC `__reg("a6")` clobbers the frame pointer.** Any C function
   declared with `__reg("a6")` parameter that uses stack-relative
   addressing (locals, function calls) is broken. Use assembly
   trampolines that read params from registers and call plain C
   helpers without `__reg`.

---

## Getting Started (read this first)

This repo is worked on across multiple machines with different usernames.
**Before running any vamos command or referencing file paths, resolve the
current user from the environment — never hardcode a username.**

```sh
# First action in any session:
echo $USER          # → e.g. bharrison4, brie, whoever
echo $HOME          # → /Users/$USER
echo $SC            # → set by $HOME/sasc658/setup.sh if sourced
```

### SAS/C setup
A copy of SAS/C 6.58 lives in the repo at `sasc658/`. This is the preferred
source so the build works on any machine without extra installation.
`$SC` is exported by `sasc658/setup.sh` and points to the `sasc658/` directory.

Priority for resolving `$SC`:
1. Already set in environment — use it as-is
2. `./sasc658/setup.sh` exists in the repo root — source it  ← **preferred**
3. `$HOME/sasc658/setup.sh` exists — fall back to user's home install

`amiga-env.sh` handles this automatically when sourced. To do it manually:

```sh
[ -z "$SC" ] && source ./sasc658/setup.sh
echo $SC            # → /path/to/repo/sasc658
```

All vamos invocations use `-V sc:$SC` — never a hardcoded path.

### vamos invocation template
```sh
# Compile a source file (substitute $USER / $SC from environment):
rm -rf ~/.vamos/volumes/ram
vamos \
  -c quickjs-master/amiga/vamos_build.cfg \
  -V sc:$SC \
  -V qjs:/path/to/quickjs-master \
  sc:c/sc qjs:FILE.c [MATH=68881] DATA=FARONLY [CODE=FAR] NOSTACKCHECK NOCHKABORT ABSFP \
  IDIR=qjs: IDIR=qjs:amiga IDIR=sc:include NOICONS
```

### Source tree
The repo may be checked out in different locations on different machines.
The `qjs:` vamos volume always maps to the `quickjs-master/` directory
within wherever the repo lives. Use `$(pwd)/quickjs-master` or a
shell variable to avoid hardcoding the checkout path.

### amiga-env.sh — shell helper functions
`amiga-env.sh` in the project root provides wrapper functions so you never
have to type the full vamos command. Source it once per session:

```sh
source ./amiga-env.sh
```

| Function | What it does |
|----------|-------------|
| `amiga_clear` | `rm -rf ~/.vamos/volumes/ram` — run before every vamos call |
| `amiga_compile FILE [FLAGS]` | Compile FILE (relative to `quickjs-master/`) with FPU flags |
| `amiga_compile_soft FILE [FLAGS]` | Same without `MATH=68881` (no-FPU build) |
| `amiga_link` | Link all `.o` files → `quickjs-master/amiga/bin/qjs` (FPU) |
| `amiga_link_soft` | Link all `.o` files → `quickjs-master/amiga/bin/qjs_soft` (no-FPU) |
| `amiga_run [ARGS]` | Run `qjs` via vamos with standard 68040 flags |
| `amiga_run_stack N [ARGS]` | Same but with N KiB of vamos stack (for stack-overflow diagnosis) |
| `amiga_run_soft [ARGS]` | Same but runs `qjs_soft` |
| `amiga_build_fpu` | Full FPU rebuild: compile all sources + link |
| `amiga_build_soft` | Full no-FPU rebuild: compile all sources + link (overwrites .o files) |

Pass `CODE=FAR` as an extra flag for large files (`quickjs.c`, `quickjs-libc.c`):
```sh
amiga_compile quickjs.c CODE=FAR
amiga_run -e 'print(1+1)'
```

**Module imports in `-e` mode:** `std` and `os` are NOT available as globals in
`-e` mode.  Use explicit imports with the `qjs:` prefix:
```sh
amiga_run -e 'import * as std from "qjs:std"; std.puts("hello\n")'
amiga_run -e 'import * as os from "qjs:os"; print(os.platform)'
```

As new tasks arise, **add convenience functions to `amiga-env.sh`** rather than
writing out raw vamos commands. Keep the function table above in sync when you do.

---

## Original Goal
Port QuickJS (Fabrice Bellard's lightweight JavaScript engine) to run on
AmigaOS 2.x+ using SAS/C 6.58.  The target binary is `qjs` — a REPL and
standalone JS runner.  Target: 68020+ hardware with or without FPU.

**Upstream QuickJS:** `git@github.com:bellard/quickjs.git`
Use when pulling upstream changes or checking whether a bug exists in unmodified QuickJS.

---

## Current State (session 8–9, version 0.15)

```
print(100+110)              → 210                      ✓
print(Math.sqrt(2))         → 1.4142135623730952        ✓
JSON.stringify([1,2,3])     → [1,2,3]                   ✓
print(3.14)                 → 3.1400000000000001        (known, 17-digit dtoa)
(5).toString()              → "5"                       ✓
print({x:1})                → { x: 1 }                  ✓ (JS_PrintValue)
print([1,2,3])              → [ 1, 2, 3 ]               ✓ (JS_PrintValue)
qjs -e '...'                → WORKS fully               ✓
REPL starts                 → WORKS (no termInit crash)  ✓
REPL receives keystrokes    → WORKS (poll+WaitForChar)   ✓
REPL forward typing         → WORKS ✓ (INT32_MIN fix)
REPL eval (Enter)           → WORKS ✓
REPL backspace              → WORKS ✓ (surrogate loop fix)
REPL left/right arrows      → WORKS ✓
REPL eval (Enter)           → WORKS ✓
REPL object display         → WORKS ✓ (JS_PrintValue ported)
S:QJS-Config.txt            → WORKS ✓ (default CLI flags)
S:QJS-Startup.js            → WORKS ✓ (auto-run on startup)
Symbol.for('qjs.inspect')   → WORKS ✓ (custom object display)
os.exec()                   → WORKS ✓ (SystemTags)
std.urlGet() HTTP           → WORKS ✓ (bsdsocket.library)
std.urlGet() HTTPS          → WORKS ✓ (AmiSSL + SNI)
os.getvar/setvar            → WORKS ✓ (GetVar/SetVar)
setenv/unsetenv             → WORKS ✓ (SetVar/DeleteVar)
realpath()                  → WORKS ✓ (Lock/NameFromLock)
pipe()                      → WORKS ✓ (PIPE: device)
Workers                     → DISABLED (no pthreads on AmigaOS)
Ctrl-C in REPL              → exits qjs via EINTR        ✓
Amiberry + FPU enabled      → WORKS ✓ (error #8000000B gone when FPU on)
Amiberry without FPU        → NEEDS RETEST (qjs_soft now built and linked)
Integer addition            → FIXED (was producing float64 due to INT32_MIN bug)
vamos diagnostics           → 17/17 PASS (O/S/U groups)  ✓
```

**Two binaries needed (session 6 decision):**

| Binary | MATH flag | Math lib | Requires | Status |
|--------|-----------|----------|----------|--------|
| `qjs` (FPU build) | `MATH=68881` | `scm881nb.lib` | 68881/68882 or 68040/68060 FPU | **Done** — 934 KB, Mar 22 → `amiga/bin/qjs` |
| `qjs_soft` (no-FPU) | *(none)* | `scmnb.lib` | 68020+ any | **Done** — 942 KB, Mar 22 → `amiga/bin/qjs_soft` |

The current `qjs` binary (934 KB, Mar 22) — **output to `quickjs-master/amiga/bin/qjs`**:
- Compiled WITH `MATH=68881` (uses inline 68881 FPU opcodes)
- Linked with `scm881nb.lib`
- Includes the `NO_COLOR=1` default fix (show_colors=false → optimize REPL path)
- Includes CSI→VT100 translation fix
- Includes batched REPL output fix (session 8: single Write() per update())

The `qjs_soft` binary (942 KB, Mar 22) — **output to `quickjs-master/amiga/bin/qjs_soft`**:
- Compiled WITHOUT `MATH=68881` (software floating point only)
- Linked with `scmnb.lib` (pure software-float math, no buffering)
- Runs on any 68020+ without FPU
- All math functions provided by `amiga_compat.c` software implementations

**What was fixed in session 5 (CSI translation):**
AmigaOS raw mode sends special keys as CSI sequences starting with 0x9B:
  cursor-up = `0x9B 0x41`, cursor-down = `0x9B 0x42`, etc.
repl.js `handle_char()` only understands VT100 ESC+[ (`0x1B 0x5B`).
Without translation, pressing cursor-up inserts garbage (`\u009b` + 'A')
into the command buffer, causing the "characters repeat many times" symptom.

**Fix:** `amiga_read_stdin()` in `quickjs-libc.c` intercepts `os.read(fd=0, ...)`
and translates every `0x9B` byte to `0x1B 0x5B` before the JS sees it.
This is done at the C level so repl.js bytecode doesn't need regeneration.

**Diagnostic tool:** `quickjs-master/hexdump.js`
Run `qjs hexdump.js` on the Amiga to see the exact hex bytes each key sends.
This confirms what ViNCEd sends for backspace, delete, and arrow keys.
Expected after fix (cursor-up should send `1B 5B 41`, not `9B 41`).

**What MIGHT still be broken after the CSI fix:**
The character repetition might ALSO be caused by something else:
- If backspace sends something other than `0x08` or `0x7f` (which repl.js
  maps to backward_delete_char), backspace still won't work
- If ViNCEd doesn't interpret `\x1b[nD` (cursor-left-n) correctly, cursor
  tracking will be wrong and the REPL will display garbage on re-render
- Unknown: whether SAS/C's `write(1, buf, n)` and `std.puts()` correctly
  deliver all output bytes to ViNCEd without buffering issues

---

## Console Handler: ViNCEd vs ROM CON:

Most modern AmigaOS installations use **ViNCEd** (handler `VNC:vincèd.handler`)
instead of or in addition to the ROM-provided `CON:` handler.  This matters for
the REPL because all terminal I/O goes through whichever handler owns the window.

### Two deployment patterns

| Pattern | What you see | Effect on qjs |
|---------|-------------|---------------|
| ROM CON: only | `assign CON:` → ROM handler | Conservative: handles `\r`, `\x08`, spaces; limited VT100 |
| ViNCEd installed, CON: **not** remounted | CLI windows still use ROM CON:; ViNCEd windows are `VNC:` | Same as above for CLI |
| ViNCEd installed, CON: **remounted to VNC:** | `assign CON: VNC:vincèd.handler` → all programs get ViNCEd | More VT100 sequences available; raw Write() dispatch may differ |

### What to check on the target Amiga

Run `assign CON:` — the output tells you which handler is active.  Also run
`assign` (no args) to see all active assigns; look for `VNC:`.

### How this affects the backspace crash investigation

- ROM CON: and ViNCEd handle multiple sequential `Write(Output(), ...)` calls
  within a raw-mode read callback **differently** — one may be safe, the other
  may not.
- ViNCEd may parse `\r` followed immediately by output as a cursor-home
  + new content, which is different from how ROM CON: processes it.
- If the crash only happens with one handler and not the other, that pins down
  whether the issue is in ViNCEd's CSI dispatch or a ROM CON: limitation.

### Detection approach (future work)
Detect at runtime in `quickjs-libc.c` using `GetConsoleTask()` +
`DeviceName()` (or examine the FileInfoBlock device name for `Input()`) to
identify whether the active handler is ViNCEd's `vincèd.handler` or the ROM
handler. Then adjust: send VT100 erase-to-EOL (`\x1b[K`) when ViNCEd is
confirmed (it supports it reliably); fall back to space-padding + backspaces for
ROM CON:.

For now: the `assign CON:` command in Group V of `amiberry_tests.txt` tells us
which path we're on.

---

## Build Environment

| Item | Value |
|------|-------|
| Compiler | SAS/C 6.58 |
| Host | macOS, vamos emulator |
| vamos build config | `quickjs-master/amiga/vamos_build.cfg` |
| vamos run config | `~/.vamos/vamos.cfg` (varies by machine) |
| SAS/C installation | `sasc658/` in repo root (preferred) or `$HOME/sasc658/` — `$SC` set via `source ./sasc658/setup.sh`; mapped as `sc:` in vamos |
| Source tree | `quickjs-master/` (mapped as `qjs:` in vamos) |
| Test CPU | `-C 68040 -m 65536 -H disable -s 2048` |

### Compile flags (per source file)

**FPU build** (`qjs`):

| File | Flags |
|------|-------|
| `quickjs.c` | `MATH=68881 DATA=FARONLY CODE=FAR NOSTACKCHECK NOCHKABORT ABSFP` |
| `quickjs-libc.c` | `MATH=68881 DATA=FARONLY CODE=FAR NOSTACKCHECK NOCHKABORT ABSFP` |
| `dtoa.c` | `MATH=68881 DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP` |
| All others | `MATH=68881 DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP` |

**No-FPU build** (`qjs_soft`) — drop `MATH=68881`, everything else identical:

| File | Flags |
|------|-------|
| `quickjs.c` | `DATA=FARONLY CODE=FAR NOSTACKCHECK NOCHKABORT ABSFP` |
| `quickjs-libc.c` | `DATA=FARONLY CODE=FAR NOSTACKCHECK NOCHKABORT ABSFP` |
| `dtoa.c` | `DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP` |
| All others | `DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP` |

`CODE=FAR` is required when the object file exceeds ~32 KB (16-bit PC-relative
branches can't reach across more than 32 KB).  `ABSFP` is required for any
file whose functions have cross-module calls (otherwise the linker gets
"Reloc16 > 32768" for `_ldexp` or similar).

### IDIR (include search path)
`IDIR=qjs: IDIR=qjs:amiga IDIR=sc:include`

### Link command (FPU build → `amiga/bin/qjs`)
```
slink sc:lib/c.o qjs:qjs.o qjs:quickjs.o qjs:quickjs-libc.o \
      qjs:libregexp.o qjs:libunicode.o qjs:dtoa.o \
      qjs:amiga/amiga_compat.o qjs:gen/repl.o qjs:gen/standalone.o \
      TO qjs:amiga/bin/qjs \
      LIB sc:lib/scnb.lib sc:lib/scm881nb.lib sc:lib/amiga.lib NOICONS
```
(`scm881nb.lib` = software+881 math library, no buffering)

### Link command (no-FPU build → `amiga/bin/qjs_soft`)
```
slink sc:lib/c.o qjs:qjs.o qjs:quickjs.o qjs:quickjs-libc.o \
      qjs:libregexp.o qjs:libunicode.o qjs:dtoa.o \
      qjs:amiga/amiga_compat.o qjs:gen/repl.o qjs:gen/standalone.o \
      TO qjs:amiga/bin/qjs_soft \
      LIB sc:lib/scnb.lib sc:lib/scmnb.lib sc:lib/amiga.lib NOICONS
```
(`scmnb.lib` = pure software-float math, no buffering — confirmed present at `sc:lib/scmnb.lib`)

**IMPORTANT:** All `.o` files fed to the no-FPU link must be compiled *without*
`MATH=68881`.  Object files compiled WITH and WITHOUT `MATH=68881` must not
be mixed in the same link — the 68881 ones emit FPU opcodes that crash on
CPUs without FPU.

### No-FPU build status (completed session 8)

All 9 source files compiled without `MATH=68881` and linked as `qjs_soft` (942 KB).
Smoke-tested: integer math, floating point (software), JSON, toString all pass.

**Note:** FPU and no-FPU `.o` files share the same directory; a full rebuild of one
overwrites the other.  Use `amiga_build_fpu` to restore FPU `.o` files after a soft build.
The link step is fast; the compile step dominates build time (~1 min per large file).

### vamos invocation patterns
Prefer the helper functions from `amiga-env.sh` (see Getting Started above).
Raw commands are preserved here for reference and for cases where the script
is not sourced.

```sh
# Compile a file for FPU build (example: dtoa.c):
amiga_compile dtoa.c
# or raw:
rm -rf ~/.vamos/volumes/ram
vamos -c quickjs-master/amiga/vamos_build.cfg -V sc:$SC \
  -V qjs:$(pwd)/quickjs-master \
  sc:c/sc qjs:dtoa.c MATH=68881 DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP \
  IDIR=qjs: IDIR=qjs:amiga IDIR=sc:include NOICONS

# Compile a file for no-FPU build (drop MATH=68881):
amiga_compile_soft dtoa.c

# Run qjs in vamos (note -- separator to stop vamos option parsing):
amiga_run -e 'print(1+1)'

# Link FPU build:
amiga_link

# Link no-FPU build:
amiga_link_soft
```

**Notes:**
- Always `amiga_clear` (or `rm -rf ~/.vamos/volumes/ram`) before vamos invocations.
- `OBJDIR=qjs:` is silently rejected by SAS/C 6.58; object files land next
  to the source file (which is fine since source is `qjs:file.c`).
- `-S` skips vamos config files; use with explicit `-H disable` or
  hw-access errors appear with large `-m` values.
- `--` is required before the binary path when passing `-e` or other
  dash-prefixed arguments to qjs, because Python argparse otherwise
  claims them as vamos options.

---

## Files Modified

### `amiga/amiga_compat.h`
Compatibility shims pulled in by `cutils.h` under `#ifdef __SASC`:
- `__builtin_clz/ctz/ll` software implementations
- `JS_NAN_BOXING=0` (force struct-based JSValue, not NaN-boxing)
- `__STDC_NO_ATOMICS__=1` (no stdatomic.h in SAS/C)
- `inline` → `__inline`, `restrict` → empty
- `scalbn(x,n)` → `ldexp((x),(n))`
- `copysign()` inline function
- `NAN` / `INFINITY` definitions
- `gettimeofday()` declaration
- `promise_trace` macro (eliminates variadic macro usage)
- Comment listing long-identifier renames applied to quickjs.c

### `amiga/amiga_compat.c`
Pure-C implementations of:
- `gettimeofday()` via `DateStamp()`
- POSIX stubs: `isatty`, `poll`, `ioctl`, `tcgetattr`, `tcsetattr`,
  `fork/exec`, `dlopen/dlsym`, `getrlimit`, `waitpid`, `sysconf`,
  `access`, `dup`, `dup2`, `pipe`, `symlink`, `readlink`, etc.
- `dirent` / `opendir` / `readdir` / `closedir` via `dos.library`
- `vsnprintf` / `snprintf` (SAS/C 6.58 lacks these)
- All IEEE 754 math functions: `sqrt`, `exp`, `log`, `pow`, `sin`, `cos`,
  `tan`, `atan`, `atan2`, `asin`, `acos`, `sinh`, `cosh`, `tanh`,
  `log2`, `log10`, `log1p`, `expm1`, `cbrt`, `hypot`, `acosh`, `asinh`,
  `atanh`, `floor`, `ceil`, `trunc`, `fmod`, `frexp`, `modf`, `ldexp`,
  `fabs`, `round`, `lrint`, `isnan`, `isinf`, `isfinite`, `signbit`
  — avoids `scmieee.lib` which crashes with `DATA=FARONLY` (see bug §3)

### `amiga/stdint.h` / `amiga/stdbool.h`
C99 types for SAS/C:
- `typedef long int32_t; typedef long long int64_t;` etc.
- **IMPORTANT**: `int64_t` = 32-bit `long` in SAS/C.  All code that
  depends on 64-bit math is wrong on this platform.

### `amiga/termios.h` / `amiga/sys/ioctl.h` / others
Stub POSIX headers so quickjs-libc.c compiles without changes.

### `dtoa.c` — `#ifdef __SASC` block (~line 1030)
Complete replacement of `js_dtoa` / `js_dtoa_max_len` / `js_atod`:

**Why:** SAS/C `int64_t` is 32-bit, so `float64_as_uint64` / all 64-bit
IEEE bit manipulation is silently wrong.  `printf %g/%e/%f` format
specifiers output the format string literally in `scnb.lib`.

**What it does:** Uses direct 68881 FPU arithmetic for digit extraction:

```
sasc_dbl_hi/lo(d)          — extract IEEE 754 high/low 32-bit words
sasc_extract_digits(d, n)  — normalise to [1,10), pull n decimal digits
sasc_round_digits(d, pos)  — standard carry-round at position pos
sasc_append_exp(buf, exp)  — format exponent with no leading zeros
sasc_dtoa_free(d, flags)   — Number.toString(): 17 sig figs, JS rules
sasc_dtoa_fixed(d, n, exp) — toPrecision(n) / toExponential(n)
sasc_dtoa_frac(d, n)       — toFixed(n)
```

**Key fix (session 3):** `sasc_dtoa_free` was extracting 17 digits with
no rounding.  68881 accumulated FPU error gives `210/10/10 = 2.0999…`
instead of `2.1`, producing digits `"20999…"` → `"209.99…"`.  Fix:
extract 18 digits, call `sasc_round_digits` at position 17 (same pattern
already used by `sasc_dtoa_fixed` and `sasc_dtoa_frac`).

**Known limitation:** Always outputs 17 significant digits (not
shortest-decimal / Grisu/Ryu).  `(3.14).toString()` → `"3.1400000000000001"`
instead of `"3.14"`.  Functionally correct; does not affect JS semantics.

### `quickjs.c`

**MAX_SAFE_INTEGER override (~line 13896):**
```c
#ifdef __SASC
#define MAX_SAFE_INTEGER 2147483647L   /* 2^31-1; int64_t is 32-bit */
#else
#define MAX_SAFE_INTEGER (((int64_t)1 << 53) - 1)
#endif
```
Without this, `(1<<53)-1` with 32-bit int64_t = `-1`.
`JS_ToLengthFree` clamps all lengths to `-1` → arrays always have 0
elements → `JSON.stringify([1,2,3])` → `[]`.  Also causes
`new Uint8Array(64)` → `RangeError: invalid array index` (see §termInit).

**Long identifier renames** (SAS/C IDLEN limit = 31 chars):
- `JS_ThrowReferenceErrorUninitialized2` → `JS_ThrowRefErrUninit2`
- `JS_ThrowReferenceErrorUninitialized` → `JS_ThrowRefErrUninit`
- `JS_GENERATOR_STATE_SUSPENDED_YIELD_STAR` → `JS_GEN_STATE_SUSP_YSTAR`
- `JS_ASYNC_GENERATOR_STATE_SUSPENDED_*` → `JS_ASGEN_STATE_SUSP_*`
- `js_async_from_sync_iterator_unwrap_func_create` → `js_afsi_unwrap_func_create`
- `js_async_generator_resolve_function_create` → `js_asgen_resolve_func_create`
- `js_object_getOwnPropertyDescriptors` → `js_obj_getOwnPropDescriptors`

### `qjs.c` — version string (session 8)
AmigaOS `$VER:` string embedded under `#ifdef __SASC`:
```c
static const char amiga_ver[] = "$VER: qjs 0.12.1 (22.3.2026)";
```
Queryable via AmigaDOS `version qjs` command.

### `quickjs-libc.c`

**AmigaOS tty block** (inserted as `#elif defined(__SASC)` before
`#elif !defined(__wasi__)` in the `ttyGetWinSize`/`ttySetRaw` section):
```c
#elif defined(__SASC)
#include <exec/types.h>
#include <dos/dos.h>
#include <proto/dos.h>   /* declares Delay, Write, Read, etc. */
```

`js_os_ttyGetWinSize`: Sends `CSI "0 q"` (Window Status Request) to the
console device; parses `CSI 1;1;<rows>;<cols> r` response.  Guard:
`IsInteractive()` returns FALSE on non-interactive handles (vamos
redirected I/O) → returns `JS_NULL` → repl.js defaults to 80 columns.
Works on real AmigaOS consoles (ViNCEd, NewShell, AmiShell).

`js_os_ttySetRaw`: Calls `SetMode(Input(), 1)` (AmigaOS raw/single-char
mode).  Restores cooked mode on exit via `atexit(amiga_term_exit)`.

**`extern void Delay(...)` cleanup:** Two existing `extern void Delay(...)`
local declarations (lines ~3011, ~3492) were replaced with comments since
`Delay` is now declared at file scope by `<proto/dos.h>`.

**`js_std_getenv` — `NO_COLOR=1` default (session 6):**
When `NO_COLOR` env var is not set, returns `"1"` under `#ifdef __SASC`.
This sets `show_colors=false` in repl.js, activating the "optimize" display
path (outputs only the new suffix on forward typing; no full-line redraw).
Rationale: the full-redraw "else" path with colorize_js may be causing the
character reversal bug; the optimize path is simpler and faster.
Override with `setenv NO_COLOR 0` in AmigaDOS shell to re-enable colors.

```c
#ifdef __SASC
    if (!str && strcmp(name, "NO_COLOR") == 0)
        str = "1";
#endif
```

---

## Key Bugs Found and Fixed

### Bug 1: dtoa.c — uint64_t is 32-bit (THE big one)
`float64_as_uint64(d)` uses `memcpy(&a, &d, sizeof(uint64_t))` → only
copies 4 bytes (hi word, not full 64-bit IEEE pattern).  Then:
- `e = (a >> 52) & 0x7ff` → 0 (shift ≥ 32 = 0 on 32-bit long)
- `sgn = a >> 63` → 0
- All float-to-string produces garbage
**Fix:** Complete `#ifdef __SASC` replacement using FPU digit extraction.

### Bug 2: `scmieee.lib` crashes with DATA=FARONLY
`scmieee.lib` accesses `MathIeeeDoubBasBase` via 16-bit A4-relative
offset.  With DATA=FARONLY, the data segment can exceed ±32 KB from A4 →
reads as NULL → every FP call crashes at 0xFFFFFFD8.
**Fix:** `MATH=68881` + define all math functions in `amiga_compat.c`.

### Bug 3: printf %g/%e/%f broken in scnb.lib
`scnb.lib` (small/no-buffering library) does not include float printf
support.  `printf("%.17g", x)` outputs the literal format string.
**Fix:** All float formatting uses manual FPU digit extraction (no printf).

### Bug 4: MAX_SAFE_INTEGER overflow with 32-bit int64_t
`(((int64_t)1 << 53) - 1)` → `(0 - 1)` → `-1` → all array lengths
clamp to -1 → `JSON.stringify`, `Array.from`, `new Uint8Array(n)` all broken.
**Fix:** `#ifdef __SASC #define MAX_SAFE_INTEGER 2147483647L`

### Bug 5: quickjs.c too large for 16-bit PC-relative branches
"Function too far for PC-relative. Use AbsFunctionPointer option."
`quickjs.c` compiles to 711 KB.  Without `CODE=FAR`, the compiler emits
16-bit BSR which can't reach targets > 32 KB away.  Without `ABSFP`, the
linker can't resolve cross-module function pointer references.
**Fix:** `CODE=FAR ABSFP` on `quickjs.c` and any large file (now also
needed for `quickjs-libc.c` after the tty additions).

### Bug 6: sasc_dtoa_free — no rounding (NEW this session)
Extracting 17 digits without rounding leaves accumulated 68881 FPU error
visible: `210.0` produces `"209.99999999999999"`.
**Fix:** Extract 18 digits, round at position 17.

### Bug 7: termInit crash — `new Uint8Array(64)` → RangeError
Caused by Bug 4 (MAX_SAFE_INTEGER = -1).  `JS_ToLengthFree(64)` clamped
to -1 → RangeError.  **Fixed** by Bug 4 fix.

### Bug 11: REPL characters inserted in reverse order — FIXED (session 7)
Typing "pri" showed "prpirp" on screen; pressing Enter evaluated "irp" (reversed).
**Root cause:** Bug 13 (INT32_MIN defined as positive value). Every integer addition
produced a JS_TAG_FLOAT64 result instead of JS_TAG_INT. When these float values
were passed to `String.prototype.substring()`, `JS_ToInt32SatFree` compared them
against the buggy positive INT32_MIN, clamping all values in [0, 2^31-1] to
INT32_MIN → then clamped to 0 by JS_ToInt32Clamp. So `cmd.substring(0, pos)`
always returned `""` (pos clamped to 0) and `cmd.substring(pos)` returned the
full string — prepending each new character instead of appending.
**Fix:** Bug 13 fix (INT32_MIN definition).

### Bug 12: Backspace / cursor movement crashes system — FIXED (session 8)
After pressing backspace or right-arrow past EOL in the REPL, the entire Amiga system
hard-locks (no guru).  Left arrow also crashes when cursor reaches end of typed text.

**Session 8 fix v2 (after real-Amiga testing):**
- Fix v1 (removed `std.out.flush()`) caused invisible prompt/typing — `fflush(stdout)`
  IS needed on real Amiga even with `scnb.lib`.
- **Fix v2:** `update()` batches all output into a single string → one `std.puts()` call
  → one `Write(Output(), ...)` syscall, followed by `std.out.flush()`.  Previously used
  5+ separate `std.puts()` calls per update.  The single-Write approach should prevent
  the console device from being overwhelmed by rapid sequential writes in raw mode.
- Bytecode regenerated with QuickJS-ng qjsc.
- Both FPU and no-FPU binaries rebuilt.
- **Needs real-Amiga retest** for backspace, left arrow, right arrow at EOL.

**Root cause:** The `while (is_trailing_surrogate(cmd.charAt(...)))` loops in
`forward_char`, `backward_char`, and `delete_char_dir` cause a hard system lock
on real Amiga hardware (68060 AA3000+). The loops never execute their body for
ASCII input, but the mere evaluation of the loop condition triggers the crash.
Both `charCodeAt` and `codePointAt` variants crash — the while loop itself is
the trigger. Narrowed down through 21 incremental test files (T8–T21).
Does NOT reproduce in vamos.

**Fix:** Removed the surrogate while loops. Surrogate pairs won't appear in
AmigaOS console input (ASCII/Latin-1 only). `update()` reverted to upstream.

### Bug 20: Typing `os` or `std` in REPL → Abnormal program termination (session 8)
Typing `os` or `std` at the REPL prompt and pressing Enter causes "Abnormal program
termination". This is a SAS/C runtime abort (not a hard lock like Bug 12).
Likely cause: `util.inspect()` or `print()` on the module object triggers a code path
that calls `abort()` — possibly deep recursion in object inspection, a failed assertion,
or a 32-bit type issue in the formatting code. Needs investigation.

### Bug 14: `(5).toString()` returns "0000000000000000005" — FIXED (session 7)
`Number.prototype.toString()` for integers calls `i64toa_radix` → `u64toa_radix`
→ `u64toa`. In `u64toa`, the fast-path check `n < ((uint64_t)1 << 32)` always
fails because `(uint64_t)1 << 32` is undefined behavior on 32-bit (produces 0).
So ALL values take the large-number path, which splits into 3 groups of 9 digits,
producing 19 zero-padded characters for small values like 5.
**Fix:** `#ifdef __SASC` to always use `u32toa` since uint64_t == uint32_t.

### Bug 13: INT32_MIN defined as positive value — THE ROOT CAUSE (session 7)
`amiga/stdint.h` defined `INT32_MIN` as `(-2147483648L)`. On SAS/C where
`long` is 32-bit, the literal `2147483648L` exceeds `LONG_MAX` (2147483647).
Under C89 rules, this makes it `unsigned long` (0x80000000). Then
`-2147483648L` = `-(unsigned long)0x80000000` = `(unsigned long)0x80000000`
= **positive 2147483648** (unsigned negation wraps).

This caused the OP_add integer overflow check:
```c
if (r < INT32_MIN || r > INT32_MAX)
    sp[-2] = js_float64(r);  /* overflow → float */
else
    sp[-2] = js_int32(r);    /* fits → int */
```
to ALWAYS evaluate as true for values 0..2^31-1, because:
`(long)1 < (unsigned long)2147483648` → unsigned promotion → `1u < 2147483648u` → true.

**Every integer addition in the entire VM produced a float64 instead of int32.**
This cascaded into: substring args clamped to 0 (Bug 11), REPL cursor corruption
(Bug 12), and `print(100+110)` showing `210.00000000000001` instead of `210`.

**Fix:** `#define INT32_MIN (-2147483647L - 1L)` — the standard C idiom that
avoids the 2^31 literal overflow. Also fixed INT64_MIN similarly.

### Bug 10: AmigaOS CSI (0x9B) not translated to VT100 ESC+[ (session 5)
repl.js `handle_char()` only recognises `\x1b` (ESC=0x1B) as escape sequence
start.  AmigaOS raw mode sends 0x9B for all CSI sequences.  Without
translation, cursor keys insert garbage; the whole line gets re-rendered
→ "characters repeat many times" symptom.
**Fix:** `amiga_read_stdin()` in `quickjs-libc.c` (`#ifdef __SASC` block
just before `js_os_read_write`) intercepts `os.read(0, ...)` and replaces
every `0x9B` byte with `0x1B 0x5B`.  A one-byte `amiga_csi_pending` stores
the second byte if the buffer was exactly full.

### Bug 9: poll() never returning POLLIN — REPL input broken
`poll()` stub returned 0 unconditionally.  REPL uses `os.setReadHandler(0, fn)`
which calls `poll([{fd:0, events:POLLIN}], 1, timeout)` — handler never fired.
**Fix:** `poll()` now calls `WaitForChar(Input(), usec_timeout)` for fd 0;
sets `revents = POLLIN` if a character is available; returns 1.
Ctrl-C detected via `SetSignal(0, SIGBREAKF_CTRL_C)` before each WaitForChar.

### Bug 8: ttyGetWinSize returning null on AmigaOS
POSIX `ioctl(TIOCGWINSZ)` stub returned -1 → null → REPL used 80-column
default.  **Fixed** with CSI escape sequence approach in quickjs-libc.c.

---

## What Doesn't Work Yet (Known Issues)

### REPL forward typing + eval — FIXED (Bug 11 + Bug 13 + Bug 14)
Character reversal was caused by Bug 13 (INT32_MIN). REPL number display
was caused by Bug 14 (u64toa 32-bit shift). Both fixed.

### REPL backspace — FIX APPLIED, NEEDS AMIBERRY RETEST (Bug 12)
Hard system lock on backspace, no guru.  Session 8: vamos diagnostics (17/17 pass)
confirmed the crash is NOT in JS/C logic — it only occurs on real Amiberry hardware.
**Fix applied:** `update()` now batches all output into one `std.puts()` call (single
`Write()`) and removed `std.out.flush()`.  Binary rebuilt.  Needs Amiberry retest.

### REPL keyboard input — FIXED
`poll()` now uses `WaitForChar(Input(), usec)` for fd 0.
Ctrl-C: detected via `SetSignal(0, SIGBREAKF_CTRL_C)` → EINTR → qjs exits.
Ctrl-D: arrives as raw byte 0x04 → repl.js handles it as EOF.
**Status: Working (Ctrl-C works when REPL is NOT frozen by backspace bug)**

### Shortest-decimal (Grisu/Ryu)
`sasc_dtoa_free` always uses 17 significant digits.  `(3.14).toString()`
→ `"3.1400000000000001"` instead of `"3.14"`.  Technically wrong per the
ES spec (§7.1.12.1 requires shortest round-trip) but doesn't break normal
programs.  Implementing Grisu2 or Ryu in C89 without 64-bit integers is
non-trivial; defer until 64-bit emulation is available.

### Large integer display (> 10^21)
JS spec says integers up to 10^21 should print without exponential
notation.  Our sasc_dtoa_free uses the standard JS rules for this but
FPU precision limits might cause issues near the boundary.

### AmiSSL / fetch()
`sc:sdks/AmiSSL` is installed (listed in `vamos.cfg` assigns).  QuickJS-libc
has a `fetch()` stub but no HTTPS support.  Planned future work.

---

## Files in quickjs-master/amiga/

```
amiga_compat.h    — auto-included via cutils.h under __SASC
amiga_compat.c    — compiled to amiga_compat.o, linked into qjs
amiga_compat.o    — compiled object (12 KB)
stdint.h          — C99 integer types
stdbool.h         — C99 bool type
inttypes.h        — C99 printf format macros
termios.h         — POSIX terminal stub (struct termios, tcgetattr/tcsetattr)
unistd.h          — POSIX unistd stub
dirent.h          — POSIX directory stub
dlfcn.h           — dlopen/dlsym stubs
grp.h             — POSIX group stubs
poll.h            — poll() stub
sys/ioctl.h       — TIOCGWINSZ + ioctl() stub
sys/resource.h    — getrlimit stubs
sys/wait.h        — waitpid stub
vamos_build.cfg   — vamos config for compilation (32MB RAM, cpu=68020)
vamos_qjs.cfg     — vamos config for running qjs (includes AmiSSL assigns)
```

## Other project files
```
console_dimensions.c  — standalone AmigaOS utility: GetShellSize() using
                         CSI 0q/r.  Source of the ttyGetWinSize implementation.
                         Works on real Amiga; not in vamos.
rkrm-dos.pdf          — AmigaOS ROM Kernel Reference Manual: Libraries (DOS).
                         Reference for console.device, dos.library, event loop.
SO_FAR.md             — This file.
```

---

## Regenerating repl.js bytecode

When `repl.js` is modified, the bytecode in `gen/repl.c` must be regenerated using the
QuickJS-ng qjsc (NOT the bellard QuickJS qjsc — bytecode formats are incompatible).

```sh
# Build the QuickJS-ng qjsc from the repo source (one-time):
cmake -B quickjs-master/build -S quickjs-master -DCMAKE_BUILD_TYPE=Release
cmake --build quickjs-master/build --target qjsc -j 8

# Regenerate bytecode (-ss strips source, -m = module mode):
quickjs-master/build/qjsc -ss -o quickjs-master/gen/repl.c -m quickjs-master/repl.js

# Then recompile and relink for the Amiga:
source ./amiga-env.sh
amiga_compile gen/repl.c && amiga_link
```

The host `/opt/homebrew/bin/qjsc` is bellard's QuickJS (version 2025-09-13); the repo is
QuickJS-ng v0.12.1.  Using the wrong qjsc produces bytecode that crashes at runtime.

---

## qjsc — The QuickJS Compiler

`qjsc` is NOT a native binary compiler in the traditional sense. It compiles JavaScript
source to QuickJS bytecode and embeds that bytecode in a C source file as `uint8_t[]` arrays.
You then compile that C file with a C compiler to get a native executable.

### Output modes
| Flag | Output | Description |
|------|--------|-------------|
| (none) | `.c` file | bytecode as `uint8_t[]` + no `main()` — for linking into a larger app |
| `-e` | `.c` file | bytecode + full `main()` + `#include "quickjs-libc.h"` → compile to standalone binary |
| `-b` | raw `.bc` file | raw bytecode blob (not loadable by `qjs` from command line; for embedding) |

### qjsc workflow for Amiga
1. Run `qjsc -e -o myapp.c myapp.js` on the host Mac (qjsc is a host tool)
2. Copy `myapp.c` into the source tree
3. Compile `myapp.c` with SAS/C on vamos: same flags as other files + link against all QuickJS `.o` files
4. Result: a standalone Amiga binary with JS bytecode baked in — no `.js` file needed at runtime

### Known issues / not yet done
- **SAS/C identifier length limit (31 chars):** `qjsc` generates C names from filenames (e.g.
  `qjsc_my_script_name`). If the JS filename is long, the generated C identifier may exceed
  31 characters and be silently truncated by SAS/C, causing linker errors.
  Fix: use `qjsc -N shortname` to override the generated C identifier.
- **Generated `inttypes.h` include:** the non-`-e` output includes `#include <inttypes.h>`,
  which maps to our `amiga/inttypes.h` stub — should compile correctly.
- **Status: NOT YET TESTED** on Amiga. The build/link workflow needs to be verified.

---

## Amiga File Path Handling

AmigaOS uses `Volume:Directory/File` paths (e.g. `RAM:scripts/main.js`, `Work:tools/qjs`).
POSIX code in quickjs-libc.c and quickjs.c assumes Unix-style paths (`/dir/file`).

### What already works
- `fopen()` / `fclose()` / `fread()` / `fwrite()`: SAS/C's runtime maps these to
  `dos.library Open()/Read()/Write()` — Amiga paths work natively.
- `js_load_file()` (used by module loader and `qjs script.js`): calls `fopen()` → works.
- `std.open()` (`js_std_open`): calls `fopen()` → works with Amiga paths.
- `realpath()` stub: just copies the path unchanged — adequate since AmigaOS has no symlinks.

### Bug 15: Module path normalizer breaks for volume-root files
`js_default_module_normalize_name()` in `quickjs.c` uses:
```c
r = strrchr(base_name, '/');
if (r) len = r - base_name;
else   len = 0;   /* ← BUG: ignores the colon */
```
For `RAM:main.js` (file at volume root, no `/`), `strrchr` returns NULL → len=0 →
base directory = "" → `import './util'` resolves to `util` instead of `RAM:util`.
For `RAM:scripts/main.js`, strrchr finds the `/` correctly → `RAM:scripts/util` ✓

**Fix needed:** In `#ifdef __SASC`, modify (or replace via `JS_SetModuleLoaderFunc2`
normalizer hook) to treat `:` as a path separator when no `/` is found:
```c
r = strrchr(base_name, '/');
if (!r) r = strrchr(base_name, ':');  /* Amiga: colon is volume separator */
```
With this, `RAM:main.js` → len points after `:` → base = `RAM:` → result = `RAM:util` ✓

### Bug 16: `import.meta.url` set to bare Amiga path (no `file://` prefix)
`js_module_set_import_meta()` checks `if (!strchr(module_name, ':'))` to decide whether
to prepend `file://`. Since ALL Amiga paths contain `:` (e.g. `RAM:foo.js`), the check
fires and `import.meta.url` is set to `RAM:foo.js` rather than `file://RAM:foo.js`.
This is inconsistent but functionally harmless unless user code parses the URL.
Could be left as-is or handled by always prepending `amiga://` for `__SASC`.

### Bug 17: `os.open()` / POSIX `open()` with Amiga paths — UNKNOWN
`js_os_open()` calls POSIX `open(filename, flags, mode)`. SAS/C's `open()` may or may
not handle `RAM:foo.txt` — needs testing. If it doesn't, `os.open()` will silently
fail for Amiga paths while `std.open()` (fopen-based) works fine.

### Bug 18: `os.getcwd()` returns AmigaOS-format path
`js_os_getcwd()` calls `getcwd()`. SAS/C's `getcwd()` returns the AmigaOS current
directory as a string like `Work:scripts` (no leading `/`). Code that expects a Unix
path (starts with `/`) and tries to do path manipulation on the result will break.
The value is correct for passing back to AmigaOS functions but may confuse JS code.

### Bug 19: `os.chdir()` — UNKNOWN
`js_os_chdir()` calls `chdir(target)`. SAS/C provides `chdir()` via its POSIX layer,
which calls `dos.library CurrentDir()`. Amiga paths should work but needs testing.

### What to implement
1. Fix Bug 15 (module normalizer) in `quickjs.c` — `#ifdef __SASC` block, ~line 29207.
2. Test `os.open()`, `os.getcwd()`, `os.chdir()` with Amiga paths via `qjs -e`.
3. Implement `os.realpath()` for Amiga: call `dos.library` `GetDeviceName()` or
   `NameFromLock()` after `Lock()` to canonicalize device names (e.g. `RAM:` vs `Ram Disk:`).
   The current stub (copy path) is adequate for basic use but won't canonicalize.

---

## Next Steps (priority order)

### 1. Diagnose and fix REPL backspace crash (MOST URGENT)

All diagnostic tests and the proposed fix are staged.  Run them as a single
batch — no iterative back-and-forth needed.

**Step A — vamos tests (run from Mac, no binary transfer):**
```sh
source ./amiga-env.sh
bash quickjs-master/amiga/tests/vamos_diag.sh
```
Reports pass/fail for output isolation (Group O), stack depth probe (Group S),
full `update()` simulation (Group U), and large-stack repeats (Group L).

**Step B — Amiberry tests (requires binary transfer):**
Follow `quickjs-master/amiga/tests/amiberry_tests.txt`.
Most important test: `stack 65536` then `qjs:amiga/bin/qjs`, press backspace.

**Step C — After test results: apply targeted fix and retest:**
The fix depends on what the E and R groups reveal.  If E-group crashes → fix is in the
output path (likely remove/defer `std.out.flush()` calls or batch all `puts` into one
`Write()`).  If R-group reveals the event-loop as the culprit → fix is in how
`term_read_handler` calls `update()` (e.g. use a single buffered `Write()` instead of
multiple `fwrite` calls).  See the active hypotheses in Bug 12 for details.
After applying a fix: `amiga_compile quickjs-libc.c CODE=FAR` + `amiga_link`, transfer
to Amiberry, run the amiberry_tests.txt groups again.

### 2. ~~Complete no-FPU build~~ — DONE (session 8)
`qjs_soft` (942 KB) built and tested.  All 9 files compiled without `MATH=68881`,
linked with `scmnb.lib`.  Integer math, floating point (software), JSON all pass in vamos.

### 3. ~~Fix Amiga file path handling (Bug 15 — module normalizer)~~ — DONE (session 8)
Fixed in `quickjs.c` `js_default_module_normalize_name()`: when no `/` is found,
falls back to `strrchr(base_name, ':')` and includes the colon in the base path.
`RAM:main.js` → base = `RAM:` → `import './util'` → `RAM:util` ✓
Compiled into FPU binary.  Needs recompile for `qjs_soft` if module imports are needed.

Still to test: other os.* path functions (Bugs 16-19) with simple `qjs -e` scripts.

### 4. ViNCEd detection and conditional terminal sequences
Once the backspace crash is fixed, add runtime console handler detection in
`quickjs-libc.c`:
- Use `GetConsoleTask()` on the `Input()` file handle, then inspect `FindTask()`
  or the `DeviceName()` of the message port to identify the handler.
- If ViNCEd is confirmed: use `\x1b[K` (erase-to-EOL) in `update()` instead of
  the space-padding + `\x08` loop — fewer bytes, more reliable on VT100-capable
  consoles.
- If ROM CON: is detected: keep the conservative space + backspace approach.
- Expose as `os.isViNCEd()` or via an internal flag in the REPL init.
This is low priority until the backspace crash is resolved, but should be tracked.

### 5. Build script / smakefile
Create `quickjs-master/amiga/build.sh` — a shell script on the macOS host that
drives vamos to compile all files and link both the FPU and no-FPU binaries.
This replaces the manual vamos invocations and makes rebuilding reproducible.

### 6. Test qjsc workflow on Amiga
Verify the compile-to-C → SAS/C → Amiga binary pipeline:
1. On host: `qjsc -e -o quickjs-master/amiga/hello.c quickjs-master/examples/hello.js`
   (if `qjsc` not yet built for host, build it with `make qjsc` on macOS)
2. Compile `hello.c` with SAS/C via vamos (same flags as other files)
3. Link against all QuickJS `.o` files, produce `hello` binary
4. Run `vamos ... hello` — should print without needing a `.js` file present
Watch for: identifier length issues (use `-N shortname` if needed).

### 7. Shortest-decimal (Grisu/Ryu)
`sasc_dtoa_free` always uses 17 significant digits.  `(3.14).toString()`
→ `"3.1400000000000001"` instead of `"3.14"`.  Technically wrong per the
ES spec (§7.1.12.1 requires shortest round-trip) but doesn't break normal
programs.  Implementing Grisu2 or Ryu in C89 without 64-bit integers is
non-trivial; defer until 64-bit emulation is available.

### 8. Comprehensive JS test suite
Run QuickJS's built-in test suite under vamos, document what passes/fails.

### 9. AmiSSL integration
Enable HTTPS fetch() via AmiSSL (SDK already installed at `sc:sdks/AmiSSL`).

### 10. Standard library audit and AmigaOS adaptation (PRIORITY)
All `os` and `std` module functions must work on AmigaOS.  Currently many
POSIX stubs return errors.  Needs AmigaOS-native implementations:

**os module — needs work:**
- `os.exec()` → use `dos.library SystemTagList()` or `Execute()`
- `os.pipe()` → use `PIPE:` device
- `os.kill()` → use `Signal()` with AmigaOS break flags
- `os.waitpid()` → process completion tracking
- `os.dup/dup2()` → may need custom AmigaOS implementation
- `os.symlink/readlink()` → not applicable on AmigaOS (no symlinks)
- Workers → currently uses pthreads; needs `CreateNewProc()`

**os module — needs testing:**
- `os.open/read/write/close` on files (verified for stdin only)
- `os.stat/lstat` with Amiga paths
- `os.mkdir/remove/rename` via SAS/C POSIX layer
- `os.chdir/getcwd` with Amiga paths

**std module — needs testing/work:**
- `std.popen()` → needs `PIPE:` or `Execute()`
- `std.tmpfile()` → should use `T:` volume
- `std.open/loadFile/writeFile` with Amiga paths

**bjson module:**
- Needs testing — likely works if no 64-bit issues in serialization

**Test suite:** `quickjs-master/amiga/tests/amiga_test.js` covers basic math,
strings, arrays, JSON, and object display.  Extend to cover all os/std functions.

---

## Symbol.for('qjs.inspect') — Custom object display (session 9)

Objects with a `Symbol.for('qjs.inspect')` method get custom display in
`print()` and the REPL, similar to Node.js's `Symbol.for('nodejs.util.inspect.custom')`.

```js
class Foo {
    [Symbol.for('qjs.inspect')]() {
        return 'Foo<custom>';
    }
}
print(new Foo());  // prints: Foo<custom>
```

The method is called during `JS_PrintValue` (used by `print()` and REPL eval
result display).  If the method throws or returns a non-string, the default
object rendering is used as fallback.  The symbol atom is resolved once per
`JS_PrintValue` call via `JS_Eval("Symbol.for('qjs.inspect')")` and cached
for the duration of the print operation.

This is a candidate for upstreaming to QuickJS-ng.

---

## S:QJS-Config.txt — Default CLI flags (session 9)

Place a text file at `S:QJS-Config.txt` with one CLI option per line.
Lines starting with `#` are comments.  Example:

```
# Always load std, os, bjson as globals
--std
```

Options from the config file are prepended to the command line, so
explicit CLI arguments override them.  The file is optional — if absent,
qjs starts normally.

## S:QJS-Startup.js — Auto-run startup script (session 9)

If `S:QJS-Startup.js` exists, it is evaluated before any user code
(both REPL and script modes).  Use it to set up globals, register
REPL hooks, or configure the environment.  Errors in the startup
script are non-fatal.  The script is loaded with module auto-detection
(use `import` statements if needed).

---

## quickjs.library — Shared Library (sessions 10-12)

### Status

Steps 1-11 PASS on Amiberry (68020 emulation, JIT on/off). Step 12 (JS_Eval) crashes the emulator. Untested on real 68060 hardware with the working build.

Working test build: `amiga/qjs_medium.library` v3.3-3.5 + `amiga/try_medium`.

### Architecture

The test library (`medium_lib_nolibfd.c`) uses:
- **Manual function table** in C (no slink LIBFD) — avoids slink's library-specific hunk processing
- **`libent.o`** from SAS/C for the RomTag/entry point
- **`libversion.c`** compiled with `DATA=NEAR` for `_LibName`/`_LibID` (libent.o needs near-data access to these)
- **`LIBVERSION`/`LIBREVISION`** slink flags for version symbols
- **AllocMem-based allocator** via `JS_NewRuntime2()` — the C runtime heap (`malloc/free`) is not available in library context because `c.o` startup doesn't run
- **DOSBase opened in `myLibInit`** — CRITICAL: without this, AddBaseObjects crashes. Something in the engine code path dispatches through DOSBase.
- **SysBase set from address 4** in `myLibInit`
- **DATA=FARONLY + CODE=FAR** on all compilation units
- **No `__saveds`** on any function — with DATA=FARONLY, `__saveds` can corrupt register parameters (Fiona's diagnosis)
- **No `LIBCODE`** — incompatible with DATA=FARONLY

### Key Findings — SAS/C Shared Library Limitations

1. **32K near data limit**: slink enforces a 32KB limit on near data for ALL shared libraries, not just those using the `SD` flag. QuickJS has ~123KB of static data. Cannot be bypassed with `DATA=FARONLY` (which eliminates near data but introduces other problems), `DATA=FAR`, `DATA=AUTO`, `STRMER` (STRINGMERGE), or `__far` on const arrays.

2. **DATA=FARONLY frees A4 as scratch register**: The compiler can use A4 for temporary values. This means `__saveds` (which sets A4) can have its value clobbered by subsequent code. scnb.lib functions compiled with DATA=NEAR expect A4 to be stable. However, this turned out NOT to be the root cause of the AddBaseObjects crash — DOSBase initialization was.

3. **`__saveds` + `register __d0` conflict on `_LibInit`**: The compiler may assign the D0 parameter to A4, then `__saveds` overwrites A4 with `_LinkerDB`. This corrupts the library base pointer, causing OpenLibrary to crash. Fix: never use `__saveds` on init functions that receive parameters in D0.

4. **`#pragma libcall` on static variables corrupts relocations**: Adding `#pragma libcall private_base func offset regspec` where `private_base` is a static variable causes slink to generate conflicting relocations. The library crashes at OpenLibrary. Fix: never use `#pragma libcall` with private library bases inside library code.

5. **DOSBase must be initialized**: The library must `OpenLibrary("dos.library", 36)` during init and store the result in a global `DOSBase`. Without this, code paths that eventually dispatch through DOSBase crash. The standalone executable doesn't have this issue because `c.o` auto-initializes DOSBase.

6. **STRMER (STRINGMERGE)** moves string literals and simple `static const` scalars to the CODE section, but does NOT move `static const` struct arrays containing pointers (like function pointer tables). These need runtime relocations that can't be PC-relative.

7. **slink ALV (Automatic Link Vectors)**: slink automatically inserts trampolines for 16-bit BSR calls that can't reach their target. vlink does NOT do this, so linking SAS/C .o files (which use 16-bit BSR for scnb.lib internals) with vlink fails with relocation errors. Solution: compile all library code with `CODE=FAR`.

### JS_Eval Crash

JS_Eval crashes the Amiberry emulator (both JIT and interpretive mode). The crash occurs inside JS_Eval itself — even `EvalSimple('42')` which keeps everything inside the library crashes. The exact crash point is unknown — we added debug trace points but quickjs.c is too large for the SAS/C warning limit (Error 166) when `proto/dos.h` is included. Next step: use a separate debug logging file (`qjs_debug.c`) or try VBCC.

### VBCC Alternative

VBCC (Frank Wille's compiler) is available at `$HOME/vbcc/` with:
- `vlink` v0.18 — cross-linker, runs natively on macOS
- `fd2pragma` — generates pragma headers from FD/SFD files
- `vbcc-librarytemplate/` — complete shared library template
- `posixlib/` — POSIX compatibility library

Strategy: compile engine with SAS/C (proven working as standalone), link as shared library with vlink (avoids slink's 32K limit and LIBFD issues). The vbcc library template provides the RomTag, function table, and init/cleanup infrastructure.

### Files

```
library/
├── fd/quickjs_lib.fd              212-function FD file
├── include/
│   ├── clib/quickjs_protos.h      C prototypes with docs
│   ├── pragmas/quickjs_pragmas.h  Auto-generated libcall pragmas
│   └── proto/quickjs.h            Standard AmigaOS proto header
├── src/
│   ├── quickjs_library.c          212 wrapper implementations
│   └── quickjs_libinit.c          Custom library init (no data copy)
├── tests/
│   ├── medium_lib_nolibfd.c       Working 16-function test library (no LIBFD)
│   ├── medium_lib.c               12-function test library (with LIBFD, crashes)
│   ├── try_medium.c               Incremental test app
│   ├── standalone_test.c          Standalone proof (works on real hardware)
│   ├── flushlibs.c                Library cache flushing utility
│   ├── libversion.c               Near-data version symbols for libent.o
│   ├── qjs_debug.c               Debug logging (separate file for proto/dos.h)
│   └── qjs_interface.h            Interface struct definition (Option C)
└── README.md
```

---

## VBCC quickjs.library + CLI Bridge (April 2026)

### Milestone: `EvalSimple("1+1")` returns 2

The quickjs.library shared library is functional. The qjs CLI tool (151KB)
opens quickjs.library at runtime and evaluates JavaScript through LVO calls.

### Architecture

**Library** (quickjs.library, 918KB): Contains the full QuickJS-ng engine.
170 QJS_* wrapper functions exposed via AmigaOS LVO jump table. JSValue
params passed as pointers, results via out-parameter.

**Bridge** (in qjs binary): Translates between quickjs.h C calling convention
(JSValue by value, stack params) and the library's LVO convention (JSValue
by pointer, register params, A6=library base).

**CRITICAL**: VBCC's `__reg("a6")` clobbers the frame pointer before loading
other register params. C bridge functions are fundamentally unreliable.
**Assembly trampolines** are the proven solution — read params from stack via
SP-relative offsets, set registers explicitly, save/restore with `movem.l`.

### Key Files
- `library/vbcc/bridge_asm.s` — Assembly trampolines (working, 10 functions)
- `library/vbcc/bridge_dpvs.s` — DefinePropertyValueStr trampoline
- `library/vbcc/quickjs_bridge.c` — C bridge (~160 functions, BROKEN, need asm conversion)
- `library/vbcc/qjsfuncs.c` — Library-side wrappers
- `library/vbcc/Makefile` — Library build (fpu/soft targets)
- `library/vbcc/Makefile.cli` — CLI tool build

### Next Steps
1. Convert ALL ~160 remaining C bridge functions to assembly trampolines
2. Audit missing functions (JS_DefinePropertyGetSet, JS_DefineProperty, etc.)
3. Build comprehensive test suite to prevent regressions
4. Get `print(1+1)` → `2` working (needs ToCStringLen2 in assembly)
5. Get REPL working
6. Build 6 CPU/FPU library variants (020/040/060 × FPU/soft)
7. Investigate SPFL hang (LVO -900 from external callers)
8. Remove debug prints, clean up
9. Write AmigaOS autodocs for QJS_* functions

### VBCC A6 Clobber — Root Cause
VBCC treats `__reg("a6")` as another register parameter and may set A6=QJSBase
BEFORE loading other params from the stack. Since A6 is the frame pointer:
- `&stack_local` computed after A6 clobber → garbage address
- Static variables: also unreliable (non-deterministic failures)
- Only fix: pure assembly with explicit SP-relative parameter access

### d0/d1 Convention for uint64_t
VBCC m68k returns 64-bit values as d0=HIGH 32 bits, d1=LOW 32 bits.
Assembly trampolines must match this when reading result buffers:
```asm
move.l (sp)+,d0   ; high 32 bits (tag for NAN-boxed JSValue)
move.l (sp)+,d1   ; low 32 bits (pointer/value)
```
