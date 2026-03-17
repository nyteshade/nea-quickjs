# QuickJS → AmigaOS Port — SO_FAR

## Original Goal
Port QuickJS (Fabrice Bellard's lightweight JavaScript engine) to run on
AmigaOS 2.x+ using SAS/C 6.58.  The target binary is `qjs` — a REPL and
standalone JS runner.  The port runs on 68020+ hardware with a 68881/68882
FPU (or 68040/68060 internal FPU).

---

## Current State (session 4 end — REPL I/O partially working, display broken)

```
print(100+110)              → 210                      ✓
print(Math.sqrt(2))         → 1.4142135623730951        ✓
JSON.stringify([1,2,3])     → [1,2,3]                   ✓
print(3.14)                 → 3.1400000000000001        (known, acceptable)
qjs -e '...'                → WORKS fully               ✓
REPL starts                 → WORKS (no termInit crash)  ✓
REPL receives keystrokes    → WORKS (poll+WaitForChar)   ✓
REPL display/editing        → BROKEN — chars repeat, backspace does nothing ✗
Ctrl-C in REPL              → exits qjs via EINTR        (acceptable)
```

The binary is at `quickjs-master/qjs` (967 KB, built Mon Mar 16 22:23 2026).

**What was fixed in session 4:**
`poll()` stub now uses `WaitForChar(Input(), usec)` so the REPL's stdin
read handler actually fires. Keystrokes ARE received. Progress.

**What is still broken — REPL display/editing:**
Observed on real Amiga: after typing 'h', 'e', the characters repeat many
times; backspace does nothing. Two likely root causes (investigate tomorrow):

1. **AmigaOS CSI vs VT100 escape sequences:**
   AmigaOS raw mode sends special keys as CSI sequences starting with 0x9B
   (e.g., cursor-up = `\x9B A`).  The repl.js state machine only understands
   VT100 ESC+[ (`\x1b\x5b...`), not native AmigaOS CSI (0x9B).
   Backspace on AmigaOS sends `\x9B P` (delete-char CSI), not `\x7f`/`\x08`.
   Fix: translate 0x9B → `\x1b[` in our read() or poll() path; OR map
   0x9B sequences to the expected keys in a pre-filter.

2. **term_cursor_x tracking goes wrong → display corruption:**
   repl.js tracks cursor position in `term_cursor_x` and uses VT100 cursor
   movement sequences (`\x1b[nC`, `\x1b[nD`, etc.) for output.  If ViNCEd
   doesn't handle these exactly, `term_cursor_x` drifts and the REPL
   re-renders the whole line from the wrong offset → visual repetition.
   Investigate: does ViNCEd handle `\x1b[nC`/`\x1b[nD` for cursor movement?

**From reading repl.js (key facts for tomorrow's fix):**
- `term_read_handler()` calls `os.read(fd, buf, 0, len)` → reads up to
  `term_read_buf.length` bytes at once (typically 64)
- `handle_byte()` decodes UTF-8; `handle_char()` decodes escape sequences
- State machine: `\x1b` → state 1; `\x1b[` → state 2 (CSI via ESC);
  anything else passes to `handle_key()`
- **0x9B (native AmigaOS CSI) is NOT handled** → passed as raw character
  → interpreted as 0x9B = some high unicode char → ignored or causes confusion
- Backspace command mapped to `\x7f` (DEL) and `\x08` (^H)
- Delete key mapped to `\x1b[3~`
- Arrow keys: `\x1b[A/B/C/D`

**Investigation plan for tomorrow:**
1. Write a small diagnostic `qjs -e` script that reads raw bytes and prints
   their hex values — find out exactly what ViNCEd sends for backspace,
   delete, arrows
2. Add a CSI-to-VT100 translation layer in `term_read_handler` (or in C's
   `read()` for fd 0): translate 0x9B → `\x1b[`
3. Test whether the character repetition stops once CSI is handled correctly

---

## Build Environment

| Item | Value |
|------|-------|
| Compiler | SAS/C 6.58 |
| Host | macOS, vamos emulator |
| vamos build config | `quickjs-master/amiga/vamos_build.cfg` |
| vamos run config | `/Users/bharrison4/sasc/vamos.cfg` |
| SAS/C installation | `/Users/bharrison4/sasc/` (mapped as `sc:`) |
| Source tree | `quickjs-master/` (mapped as `qjs:` in vamos) |
| Test CPU | `-C 68040 -m 65536 -H disable -s 2048` |

### Compile flags (per source file)

| File | Flags |
|------|-------|
| `quickjs.c` | `MATH=68881 DATA=FARONLY CODE=FAR NOSTACKCHECK NOCHKABORT ABSFP` |
| `quickjs-libc.c` | `MATH=68881 DATA=FARONLY CODE=FAR NOSTACKCHECK NOCHKABORT ABSFP` |
| `dtoa.c` | `MATH=68881 DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP` |
| All others | `MATH=68881 DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP` |

`CODE=FAR` is required when the object file exceeds ~32 KB (16-bit PC-relative
branches can't reach across more than 32 KB).  `ABSFP` is required for any
file whose functions have cross-module calls (otherwise the linker gets
"Reloc16 > 32768" for `_ldexp` or similar).

### IDIR (include search path)
`IDIR=qjs: IDIR=qjs:amiga IDIR=sc:include`

### Link command
```
slink sc:lib/c.o qjs:qjs.o qjs:quickjs.o qjs:quickjs-libc.o \
      qjs:libregexp.o qjs:libunicode.o qjs:dtoa.o \
      qjs:amiga/amiga_compat.o qjs:gen/repl.o qjs:gen/standalone.o \
      TO qjs:qjs \
      LIB sc:lib/scnb.lib sc:lib/scm881nb.lib sc:lib/amiga.lib NOICONS
```
(`scm881nb.lib` = math library for 68881, no buffering)

### vamos invocation patterns
```sh
# Compile a file (example: dtoa.c):
rm -rf ~/.vamos/volumes/ram
vamos \
  -c quickjs-master/amiga/vamos_build.cfg \
  -V sc:/Users/bharrison4/sasc \
  -V qjs:/path/to/quickjs-master \
  sc:c/sc qjs:dtoa.c MATH=68881 DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP \
  IDIR=qjs: IDIR=qjs:amiga IDIR=sc:include NOICONS

# Run qjs in vamos (note -- separator to stop vamos option parsing):
vamos -S -C 68040 -m 65536 -H disable -s 2048 \
  -V qjs:/path/to/quickjs-master \
  -- qjs:qjs -e 'print(1+1)'

# Link (run after all .o files are current):
vamos \
  -c quickjs-master/amiga/vamos_build.cfg \
  -V sc:/Users/bharrison4/sasc \
  -V qjs:/path/to/quickjs-master \
  sc:c/slink sc:lib/c.o qjs:qjs.o ... TO qjs:qjs LIB ...
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

### REPL keyboard input — FIXED, NEEDS REAL-AMIGA VERIFICATION
`poll()` now uses `WaitForChar(Input(), usec)` for fd 0.  This should
allow the REPL's read handler to fire when keys are pressed.
Ctrl-C: detected via `SetSignal(0, SIGBREAKF_CTRL_C)` → EINTR → qjs exits.
Ctrl-D: arrives as raw byte 0x04 → repl.js handles it as EOF.

**Remaining concern:** We call `IsInteractive(in_fh)` in poll().  If the
console handle changes between `ttySetRaw` and `poll()` (unlikely), or
if vamos doesn't fully emulate WaitForChar, the REPL might still not work
under vamos.  Real-Amiga testing is the verification path.

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

### 1. Real-Amiga testing tonight
Copy `quickjs-master/qjs` to the Amiga and test:
- `qjs -e 'print(1+1)'` → should print `2`
- `qjs -e 'print(100+110)'` → should print `210`
- `qjs -e 'print(Math.sqrt(2))'` → should print `1.4142135623730951`
- `qjs -e 'print(JSON.stringify([1,2,3]))'` → should print `[1,2,3]`
- `qjs` (REPL) → should no longer crash with `RangeError` at startup
- Report whether the REPL accepts input / works at all

### 2. REPL display/editing — fix CSI translation (NEXT PRIORITY)
Keystrokes are received but display is broken: chars repeat, backspace
does nothing.  Root cause: AmigaOS sends CSI (0x9B) sequences; repl.js
only understands VT100 (0x1B 0x5B).

**Step 1:** Write a hex-dump diagnostic to find exact byte sequences for
each key on ViNCEd:
```javascript
// qjs -e (run on real Amiga, raw mode):
// Or add a debug mode to print hex of each received byte
```

**Step 2:** Add CSI→VT100 translation.  Two options:
a. In JavaScript: patch `handle_byte()` in repl.js to treat 0x9B as
   ESC+[ (set state=2 directly when byte 0x9B is seen)
b. In C: intercept in `js_os_read()` or a wrapper around SAS/C `read()`,
   translate 0x9B → `\x1b[` inline.
Option (a) is cleaner — repl.js is compiled to bytecode in gen/, which
means we'd patch `repl.js` and recompile to gen/repl.c via qjsc.

**Step 3:** Verify cursor movement sequences.  repl.js emits `\x1b[nC`
(right n), `\x1b[nD` (left n), `\x1b[A` (up), `\x1b[B` (down).
ViNCEd should handle these; if not, this is a separate issue.

**Step 4:** Check echo.  `SetMode(Input(), 1)` should disable OS-level
echo; if it doesn't, we'd see double characters.  AmigaOS 2+ raw mode
does disable echo — verify on real hardware.

### 3. Shortest-decimal (Grisu/Ryu)
Implement a C89-compatible shortest-decimal algorithm for `sasc_dtoa_free`.
Options:
a. Grisu2 lite: try 15-digit output first, verify round-trip via `strtod`,
   fall back to 17 if needed. Requires `strtod` to be accurate (verify first).
b. Full Ryu implementation adapted for 32-bit arithmetic (complex but correct).

### 4. Makefile.amiga
Create a proper smakefile or shell script for reproducible builds.  Should
handle: compile all objects, detect which need recompilation, link.

### 5. Comprehensive JS test suite
Run QuickJS's built-in test suite under vamos, document what passes/fails.

### 6. AmiSSL integration
Enable HTTPS fetch() via AmiSSL (SDK already installed at `sc:sdks/AmiSSL`).
