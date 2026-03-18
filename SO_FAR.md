# QuickJS → AmigaOS Port — SO_FAR

## Original Goal
Port QuickJS (Fabrice Bellard's lightweight JavaScript engine) to run on
AmigaOS 2.x+ using SAS/C 6.58.  The target binary is `qjs` — a REPL and
standalone JS runner.  Target: 68020+ hardware with or without FPU.

---

## Current State (session 7 — INT32_MIN bug, toString bug, REPL partially working)

```
print(100+110)              → 210                      ✓ (was 210.00000000000001)
print(Math.sqrt(2))         → 1.4142135623730952        ✓
JSON.stringify([1,2,3])     → [1,2,3]                   ✓
print(3.14)                 → 3.1400000000000001        (known, acceptable)
(5).toString()              → "5"                       ✓ (was "0000000000000000005")
qjs -e '...'                → WORKS fully               ✓
REPL starts                 → WORKS (no termInit crash)  ✓
REPL receives keystrokes    → WORKS (poll+WaitForChar)   ✓
REPL forward typing         → WORKS ✓ (INT32_MIN fix)
REPL eval (Enter)           → WORKS ✓
REPL backspace              → CRASHES SYSTEM (hard lock, no guru)
Ctrl-C in REPL              → exits qjs via EINTR        ✓
Amiberry + FPU enabled      → WORKS ✓ (error #8000000B gone when FPU on)
Amiberry without FPU        → CRASHES #8000000B (no-FPU build not yet linked)
Integer addition            → FIXED (was producing float64 due to INT32_MIN bug)
```

**Two binaries needed (session 6 decision):**

| Binary | MATH flag | Math lib | Requires | Status |
|--------|-----------|----------|----------|--------|
| `qjs` (FPU build) | `MATH=68881` | `scm881nb.lib` | 68881/68882 or 68040/68060 FPU | **Done** — 945 KB, Mar 17 18:18 |
| `qjs_soft` (no-FPU) | *(none)* | `scmnb.lib` | 68020+ any | **In progress** — see §no-FPU build below |

The current `qjs` binary (945 KB, Mar 17 18:18:27):
- Compiled WITH `MATH=68881` (uses inline 68881 FPU opcodes)
- Linked with `scm881nb.lib`
- Includes the `NO_COLOR=1` default fix (show_colors=false → optimize REPL path)
- Includes CSI→VT100 translation fix

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

## Build Environment

| Item | Value |
|------|-------|
| Compiler | SAS/C 6.58 |
| Host | macOS, vamos emulator |
| vamos build config | `quickjs-master/amiga/vamos_build.cfg` |
| vamos run config | `~/.vamos/vamos.cfg` (varies by machine) |
| SAS/C installation | `/Users/brie/sasc658/` (mapped as `sc:`) |
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

### Link command (FPU build → `qjs`)
```
slink sc:lib/c.o qjs:qjs.o qjs:quickjs.o qjs:quickjs-libc.o \
      qjs:libregexp.o qjs:libunicode.o qjs:dtoa.o \
      qjs:amiga/amiga_compat.o qjs:gen/repl.o qjs:gen/standalone.o \
      TO qjs:qjs \
      LIB sc:lib/scnb.lib sc:lib/scm881nb.lib sc:lib/amiga.lib NOICONS
```
(`scm881nb.lib` = software+881 math library, no buffering)

### Link command (no-FPU build → `qjs_soft`)
```
slink sc:lib/c.o qjs:qjs.o qjs:quickjs.o qjs:quickjs-libc.o \
      qjs:libregexp.o qjs:libunicode.o qjs:dtoa.o \
      qjs:amiga/amiga_compat.o qjs:gen/repl.o qjs:gen/standalone.o \
      TO qjs:qjs_soft \
      LIB sc:lib/scnb.lib sc:lib/scmnb.lib sc:lib/amiga.lib NOICONS
```
(`scmnb.lib` = pure software-float math, no buffering — confirmed present at `sc:lib/scmnb.lib`)

**IMPORTANT:** All `.o` files fed to the no-FPU link must be compiled *without*
`MATH=68881`.  Object files compiled WITH and WITHOUT `MATH=68881` must not
be mixed in the same link — the 68881 ones emit FPU opcodes that crash on
CPUs without FPU.

### No-FPU build status (as of session 6)

| File | .o compiled without MATH=68881? | Notes |
|------|--------------------------------|-------|
| `qjs.c` | ✓ `qjs.o` (21 KB, Mar 17 21:30) | Done |
| `dtoa.c` | ✓ `dtoa.o` (18 KB, Mar 17 21:31) | Done |
| `quickjs.c` | ✗ `quickjs.o` (711 KB, Mar 16) | **Still needs no-FPU recompile** |
| `quickjs-libc.c` | ✗ `quickjs-libc.o` (62 KB, Mar 17 18:18) | **Still needs no-FPU recompile** |
| `libregexp.c` | ✗ `libregexp.o` (29 KB, Mar 16) | **Still needs no-FPU recompile** |
| `libunicode.c` | ✗ `libunicode.o` (62 KB, Mar 16) | **Still needs no-FPU recompile** |
| `amiga/amiga_compat.c` | ✗ `amiga/amiga_compat.o` (9.7 KB, Mar 16) | **Still needs no-FPU recompile** |
| `gen/repl.c` | ✗ `gen/repl.o` (24 KB, Mar 16) | **Still needs no-FPU recompile** |
| `gen/standalone.c` | ✗ `gen/standalone.o` (2.6 KB, Mar 16) | **Still needs no-FPU recompile** |

To complete the no-FPU build, compile each remaining file, then link to `qjs_soft`.
The object files for the no-FPU build should be kept separate (e.g., in a `obj_soft/`
subdirectory) so FPU and no-FPU builds can coexist.

### vamos invocation patterns
```sh
# Compile a file for FPU build (example: dtoa.c):
rm -rf ~/.vamos/volumes/ram
vamos \
  -c quickjs-master/amiga/vamos_build.cfg \
  -V sc:/Users/bharrison4/sasc \
  -V qjs:/path/to/quickjs-master \
  sc:c/sc qjs:dtoa.c MATH=68881 DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP \
  IDIR=qjs: IDIR=qjs:amiga IDIR=sc:include NOICONS

# Compile a file for no-FPU build (drop MATH=68881):
rm -rf ~/.vamos/volumes/ram
vamos \
  -c quickjs-master/amiga/vamos_build.cfg \
  -V sc:/Users/bharrison4/sasc \
  -V qjs:/path/to/quickjs-master \
  sc:c/sc qjs:dtoa.c DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP \
  IDIR=qjs: IDIR=qjs:amiga IDIR=sc:include NOICONS

# Run qjs in vamos (note -- separator to stop vamos option parsing):
vamos -S -C 68040 -m 65536 -H disable -s 2048 \
  -V qjs:/path/to/quickjs-master \
  -- qjs:qjs -e 'print(1+1)'

# Link FPU build:
vamos \
  -c quickjs-master/amiga/vamos_build.cfg \
  -V sc:/Users/bharrison4/sasc \
  -V qjs:/path/to/quickjs-master \
  sc:c/slink sc:lib/c.o qjs:qjs.o qjs:quickjs.o qjs:quickjs-libc.o \
  qjs:libregexp.o qjs:libunicode.o qjs:dtoa.o \
  qjs:amiga/amiga_compat.o qjs:gen/repl.o qjs:gen/standalone.o \
  TO qjs:qjs \
  LIB sc:lib/scnb.lib sc:lib/scm881nb.lib sc:lib/amiga.lib NOICONS

# Link no-FPU build (after all no-FPU .o files compiled):
# Same but use scmnb.lib instead of scm881nb.lib, and TO qjs:qjs_soft
```

**Notes:**
- Always `rm -rf ~/.vamos/volumes/ram` before vamos invocations.
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

### Bug 12: Backspace crashes/freezes system — NOT YET FIXED (session 7)
After pressing backspace in the REPL, the entire Amiga system hard-locks (no guru).
**Root cause:** NOT Bug 13 (INT32_MIN was fixed, but backspace still crashes).
The crash occurs in the full-redraw path of `update()` in repl.js, which outputs
VT100 escape sequences (`\x1b[ND` for cursor-left, `\x1b[K`/`\x1b[J` for erase).
Forward typing works fine (uses the optimize path, no escape sequences).

**What was tried (all still crash):**
- ESC+[ (`\x1b[`) sequences → crash
- Native AmigaOS CSI (`\x9b`) sequences → garbled (UTF-8 encoding turns 1 byte into 2)
- `\x1b[K` (erase line) instead of `\x1b[J` (erase display) → still crash
- `\r` + re-output + BS-based erase (no escape sequences at all) → still crash
- Debug file logging to `ram:` → locks file, system crashes (ram: I/O might contribute)

**Current state (end of session 7):** The update() function now uses a
`\r` + re-output + backspace approach with NO escape sequences. Still crashes.
This suggests the crash is not from escape sequences but possibly from:
- SAS/C `fwrite()`/`Write()` bug when writing certain byte sequences
- Stack overflow in the JS interpreter during update()
- Memory corruption from the string concatenation in `dupchar()` or `update()`

**Next steps for investigation:**
1. Create a standalone C test program (no JS) that outputs `\r`, backspaces,
   etc. to the console in raw mode — see if it crashes
2. Try using `os.write(1, ...)` (raw fd write) instead of `std.puts` (fwrite)
3. Add a simple `qjs -e` test that outputs the same byte sequence as update()
   without the REPL event loop, to isolate whether the crash is in output
   or in the event loop/poll interaction
4. Try disabling raw mode before the full-redraw output and re-enabling after

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

### REPL backspace — CRASHES SYSTEM (Bug 12, NOT FIXED)
Pressing backspace in the REPL causes a hard system lock (no guru meditation).
This happens even with an escape-sequence-free implementation using only `\r`,
printable characters, space, and `\b` (0x08). See Bug 12 description for
full details and investigation notes.

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

## Next Steps (priority order)

### 1. Diagnose and fix REPL backspace crash (MOST URGENT)
Backspace causes a hard system lock. The crash occurs even with an implementation
that uses NO escape sequences (only `\r`, space, `\b`). Investigation plan:

**Step 1:** Create a standalone `qjs -e` test that simulates what update() does
during backspace — output `\r`, prompt, cmd, spaces, backspaces — without the
REPL event loop. If this crashes, the issue is in the output. If it doesn't,
the issue is in the event loop or the interaction between output and input.

**Step 2:** If the output test passes, create a test that does raw mode +
poll/WaitForChar + output in a loop, to test the interaction.

**Step 3:** If the output test crashes, try `os.write(1, buf, len)` instead
of `std.puts()` (fwrite) to bypass SAS/C stdio.

**Step 4:** Consider stack size. The JS interpreter is deeply nested when
running the REPL (event loop → poll → read handler → handle_byte →
handle_char → handle_key → backward_delete_char → delete_char_dir → update →
dupchar → string concat). If the Amiga stack is too small, deep calls crash.
Try increasing stack size: `stack 65536` in AmigaDOS before running qjs,
or increase `-s` in vamos.

### 2. Complete no-FPU build
Compile the remaining 7 source files without `MATH=68881` and link as `qjs_soft`.
See §No-FPU build status above for the list.  Compile order doesn't matter.

For each file, the pattern is:
```sh
rm -rf ~/.vamos/volumes/ram
vamos -c quickjs-master/amiga/vamos_build.cfg \
  -V sc:/Users/bharrison4/sasc \
  -V qjs:/Volumes/Code/Amiga/nea-js/quickjs-master \
  sc:c/sc qjs:FILENAME.c DATA=FARONLY [CODE=FAR] NOSTACKCHECK NOCHKABORT ABSFP \
  IDIR=qjs: IDIR=qjs:amiga IDIR=sc:include NOICONS
```
`CODE=FAR` is required for `quickjs.c` and `quickjs-libc.c` (large files).

Then link:
```sh
vamos -c quickjs-master/amiga/vamos_build.cfg \
  -V sc:/Users/bharrison4/sasc \
  -V qjs:/Volumes/Code/Amiga/nea-js/quickjs-master \
  sc:c/slink sc:lib/c.o qjs:qjs.o qjs:quickjs.o qjs:quickjs-libc.o \
  qjs:libregexp.o qjs:libunicode.o qjs:dtoa.o \
  qjs:amiga/amiga_compat.o qjs:gen/repl.o qjs:gen/standalone.o \
  TO qjs:qjs_soft \
  LIB sc:lib/scnb.lib sc:lib/scmnb.lib sc:lib/amiga.lib NOICONS
```

### 4. Build script / smakefile
Create `quickjs-master/amiga/build.sh` — a shell script on the macOS host that
drives vamos to compile all files and link both the FPU and no-FPU binaries.
This replaces the manual vamos invocations and makes rebuilding reproducible.

### 5. Shortest-decimal (Grisu/Ryu)
`sasc_dtoa_free` always uses 17 significant digits.  `(3.14).toString()`
→ `"3.1400000000000001"` instead of `"3.14"`.  Technically wrong per the
ES spec (§7.1.12.1 requires shortest round-trip) but doesn't break normal
programs.  Implementing Grisu2 or Ryu in C89 without 64-bit integers is
non-trivial; defer until 64-bit emulation is available.

### 6. Comprehensive JS test suite
Run QuickJS's built-in test suite under vamos, document what passes/fails.

### 7. AmiSSL integration
Enable HTTPS fetch() via AmiSSL (SDK already installed at `sc:sdks/AmiSSL`).
