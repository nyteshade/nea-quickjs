# QuickJS-ng Amiga Port — Changes from Upstream

This document tracks all differences between the Amiga port and the
upstream QuickJS-ng codebase.  Features marked with [upstream candidate]
are generic enough to propose for inclusion in the main project.

## Release History

### 0.16 (25.3.2026)
- Fix `--color` flag (extern linkage fix for SAS/C)
- Add `--color` flag to enable REPL syntax highlighting
- Add `S:QJS-Config.txt` — default CLI flags (one per line)
- Add `S:QJS-Startup.js` — auto-run startup script
- Add `Symbol.for('qjs.inspect')` — custom object display
- Fix `JS_PrintValue` float display (`%.17g` → dtoa path)

### 0.15 (25.3.2026)
- Port `JS_PrintValue` from upstream (~350 lines) — proper object
  inspection in `print()` and REPL (`{ x: 1 }` instead of `[object Object]`)
- Add `std.__printObject` binding
- Update `js_print` to use `JS_PrintValue` for non-string values
- Update `repl.js` `print_eval_result` to use `std.__printObject`
- Add `JSPrintValueOptions` type to `quickjs.h`

### 0.14 (25.3.2026)
- Fix float display in `JS_PrintValue` — SAS/C `scnb.lib` outputs
  `%.17g` literally; switched to `JS_ToCString`/dtoa path

### 0.13 (23.3.2026)
- Fix REPL backspace crash — remove `is_trailing_surrogate` while-loops
  from `forward_char`, `backward_char`, `delete_char_dir` in repl.js
  (caused hard system lock on 68060 hardware)
- Fix REPL display — restore `std.out.flush()` (needed on real hardware)
- Revert `update()` to upstream (batched output was not the fix)

### 0.12 (22.3.2026)
- Complete no-FPU build (`qjs_soft`) — all sources compiled without
  `MATH=68881`, linked with `scmnb.lib`
- Fix module path normalizer (Bug 15) — treat `:` as path separator
  for AmigaOS volume-root files
- Add `$VER:` version string for AmigaDOS `version` command
- Fix `amiga-env.sh` path resolution for zsh
- Fix `vamos_diag.sh` — add `qjs:std` imports, fix stack KiB units
- Add `amiga_build_soft` convenience function
- Add `amiga_test.js` test suite

### Pre-0.12 (sessions 1–7)
- Initial SAS/C 6.58 port of QuickJS-ng 0.12.1
- Fix `int64_t` = 32-bit: custom dtoa, MAX_SAFE_INTEGER cap, u64toa
- Fix `INT32_MIN` unsigned promotion (all integer math produced float64)
- Fix `scmieee.lib` crash with DATA=FARONLY — software math in amiga_compat.c
- Fix `printf %g/%e/%f` broken in `scnb.lib` — FPU digit extraction
- Fix `(5).toString()` — u64toa 32-bit shift undefined behavior
- Add AmigaOS console I/O: ttyGetWinSize, ttySetRaw, CSI translation
- Add poll() via WaitForChar, Ctrl-C via SetSignal
- Add POSIX stubs: gettimeofday, opendir, vsnprintf, etc.
- Add `NO_COLOR=1` default for AmigaOS REPL
- Long identifier renames for SAS/C 31-char IDLEN limit

## New Features

### Symbol.for('qjs.inspect') — Custom Object Display [upstream candidate]

Objects with a `Symbol.for('qjs.inspect')` method get custom display
in `print()` and the REPL eval result output.  Similar to Node.js's
`Symbol.for('nodejs.util.inspect.custom')`.

```js
class Foo {
    [Symbol.for('qjs.inspect')]() {
        return 'Foo<custom>';
    }
}
print(new Foo());  // Foo<custom>
new Foo()          // Foo<custom>  (in REPL)
```

The method is called during `JS_PrintValue`.  If it throws or returns
a non-string, the default object rendering is used.

### S:QJS-Config.txt — Default CLI Flags

A text file at `S:QJS-Config.txt` provides default command-line options.
One option per line.  Lines starting with `#` are comments.  CLI arguments
override config file options.

```
# S:QJS-Config.txt
--std
```

### S:QJS-Startup.js — Auto-run Startup Script

If `S:QJS-Startup.js` exists, it is evaluated before any user code
(REPL or script mode).  Errors are non-fatal.  Use it to set up
globals, register REPL hooks, or configure the environment.

### $VER Version String

The binary contains an AmigaDOS `$VER:` string queryable via the
`version` command:

```
1> version qjs
qjs 0.15 (25.3.2026)
```

## Modified Behavior

### REPL Surrogate Pair Handling — Removed

The `while (is_trailing_surrogate(...))` loops in `forward_char`,
`backward_char`, and `delete_char_dir` (repl.js) are removed.  These
caused hard system locks on real 68060 hardware.  Surrogate pairs do
not appear in AmigaOS console input (ASCII/Latin-1 only).

### REPL Eval Result Display

`print_eval_result` uses `std.__printObject()` (backed by `JS_PrintValue`)
to display eval results, matching the clean upstream QuickJS-ng behavior.
The older `JS_ToCString`-based path is replaced.

### NO_COLOR Default

`std.getenv("NO_COLOR")` returns `"1"` when the environment variable
is not set.  This disables ANSI color codes in the REPL by default,
since AmigaOS consoles have varying VT100 support.  Override with
`setenv NO_COLOR 0` in the AmigaDOS shell.

### Float Formatting

`JS_PrintValue` uses `JS_ToCString` (which routes through our custom
dtoa) for float display instead of `snprintf("%.17g", ...)`, because
SAS/C's `scnb.lib` outputs printf float format strings literally.

All floats display with 17 significant digits (e.g. `3.1400000000000001`).
Shortest-decimal (Grisu/Ryu) is not yet implemented.

## AmigaOS-Specific Implementations

### Console I/O (quickjs-libc.c)

- **ttyGetWinSize**: Sends `CSI 0 q` (Window Status Request) to the
  console and parses the `CSI 1;1;<rows>;<cols> r` response.
- **ttySetRaw**: Uses `SetMode(Input(), 1)` for raw mode.  Restores
  cooked mode on exit via `atexit()`.
- **CSI Translation**: `amiga_read_stdin()` translates AmigaOS CSI
  (0x9B) input sequences to VT100 ESC+[ (0x1B 0x5B) so repl.js's
  key handler works without modification.
- **poll()**: Uses `WaitForChar(Input(), timeout)` for stdin polling.
  Ctrl-C detection via `SetSignal(0, SIGBREAKF_CTRL_C)`.

### Math Functions (amiga_compat.c)

All IEEE 754 math functions implemented in software to avoid
`scmieee.lib` (which crashes with `DATA=FARONLY`):
sqrt, exp, log, pow, sin, cos, tan, atan, atan2, asin, acos,
sinh, cosh, tanh, log2, log10, log1p, expm1, cbrt, hypot, acosh,
asinh, atanh, floor, ceil, trunc, fmod, frexp, modf, ldexp, fabs,
round, lrint, isnan, isinf, isfinite, signbit.

### Float-to-String (dtoa.c)

Complete `#ifdef __SASC` replacement of `js_dtoa` / `js_atod` using
direct 68881 FPU arithmetic for digit extraction.  SAS/C's `int64_t`
is 32-bit, so the upstream `float64_as_uint64` IEEE bit manipulation
is silently wrong.

### POSIX Stubs (amiga_compat.c)

Stub implementations for POSIX APIs not available on AmigaOS:
- `gettimeofday()` via `DateStamp()`
- `isatty()`, `tcgetattr()`, `tcsetattr()`
- `opendir/readdir/closedir` via dos.library
- `vsnprintf/snprintf` (SAS/C 6.58 lacks these)
- `fork/exec`, `dlopen/dlsym`, `pipe`, `dup/dup2` — return errors

### Integer Type Workarounds

- `int64_t` = 32-bit `long` in SAS/C.  All code depending on 64-bit
  math is adjusted.
- `INT32_MIN` defined as `(-2147483647L - 1L)` to avoid unsigned
  promotion of the 2^31 literal.
- `MAX_SAFE_INTEGER` capped at `2147483647L` (2^31-1).
- `u64toa` always uses `u32toa` path since `uint64_t == uint32_t`.

### Identifier Length (quickjs.c)

SAS/C limits identifiers to 31 characters.  Long internal names are
renamed with `#define` in `amiga_compat.h`.

### Module Path Normalizer (quickjs.c)

Treats `:` as a path separator for AmigaOS volume-root files:
`RAM:main.js` importing `'./util'` resolves to `RAM:util` (not `util`).

## Process Model — AmigaOS vs POSIX

AmigaOS does not have the POSIX fork/exec process model.  The
following table maps POSIX concepts to AmigaOS equivalents:

| POSIX | AmigaOS | Status |
|-------|---------|--------|
| `fork()` | Not available; use `CreateNewProc()` | Stub (returns -1) |
| `exec()` | `SystemTagList()` or `Execute()` | Stub (returns -1) |
| `waitpid()` | Process completion signals | Stub (returns -1) |
| `pipe()` | `PIPE:` device | Stub (returns -1) |
| `kill(pid, sig)` | `Signal(task, flags)` | Stub (returns -1) |
| `dup()/dup2()` | No direct equivalent | Stub (returns -1) |
| `symlink/readlink` | Not applicable (no symlinks) | Stub (returns -1) |
| pthreads | AmigaOS tasks via `CreateNewProc()` | Not yet implemented |

**Current state:** All process-related os module functions return errors.
These need AmigaOS-native implementations using dos.library and
exec.library.  Workers (os.Worker) use pthreads internally and need
to be adapted to use AmigaOS processes/tasks.

### AmigaOS Process Concepts

- **Tasks** (`exec.library`): lightweight execution units with their
  own stack and signal mask.  No memory protection between tasks.
- **Processes** (`dos.library`): tasks with a DOS context (current
  directory, file handles, environment variables).  Created with
  `CreateNewProc()`.
- **Signals**: 32-bit mask per task.  `Signal(task, mask)` sets bits;
  `Wait(mask)` blocks until any set.  Standard signals: CTRL_C (break),
  CTRL_D, CTRL_E, CTRL_F.
- **Message Ports**: typed IPC.  Tasks send/receive messages through
  ports.  Used for device I/O, inter-process communication.
- **Pipes**: available via the `PIPE:` handler (if installed) or
  custom shared-memory message ports.

### Implementation Plan for os.exec()

```c
/* AmigaOS equivalent of os.exec(args) */
#include <dos/dostags.h>
#include <proto/dos.h>

/* Build command string from args array */
/* Use SystemTagList() for synchronous execution: */
LONG rc = SystemTagList(cmd_string,
    SYS_Input,  Input(),
    SYS_Output, Output(),
    TAG_DONE);
/* rc = return code from the launched program */
```

### Implementation Plan for Workers

Workers would use `CreateNewProc()` to spawn a new DOS process.
Communication between the main process and workers would use
AmigaOS message ports instead of pthreads mutexes/conditions.
Each worker would have its own JSRuntime (as in the POSIX version)
and exchange serialized messages via `PutMsg()`/`GetMsg()`.
