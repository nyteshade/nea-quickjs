# WHATS_NEXT.md -- Handoff Document for nea-quickjs

This document is a handoff for a new Claude instance continuing work on
the nea-quickjs project. Read this first, then SO_FAR.md for historical
context, then WORKING_VBCC.md (if it exists) for VBCC pitfalls.

---

## 1. Project Overview

nea-quickjs is the QuickJS-ng JavaScript engine ported to AmigaOS 3.x,
packaged as an Amiga shared library (`quickjs.library`). The CLI binary
(`qjs`) is intentionally a thin shell (~77 KB) that opens the library
via LVO calls. Any Amiga application can open quickjs.library and get a
full JavaScript engine with std/os/bjson modules -- no CLI needed.

The cross-compiler toolchain is VBCC with vasmm68k_mot (assembler) and
vlink (linker), all running on macOS (Apple Silicon M3 Max). Testing
happens on amiberry (Amiga emulator).

---

## 2. Current State (v0.64, April 10 2026)

- **222/222 tests pass** (test_core.js + test_comprehensive.js)
- **6 CPU/FPU variants build**: 020fpu, 020soft, 040fpu, 040soft, 060fpu, 060soft
- **Default library = 020soft** (runs on any 68020+ Amiga without FPU)
- **AmiSSL urlGet works** for both HTTP and HTTPS
- **Toolchain**: VBCC cross-compiler, vasmm68k_mot assembler, vlink linker
- **CLI binary** built separately via Makefile.cli

---

## 3. Directory Layout

```
nea-quickjs/
  Makefile                 Top-level; delegates to library/vbcc/Makefile and Makefile.cli
  SO_FAR.md                Historical project log (read after this file)
  WHATS_NEXT.md            This file

  amiga/                   Output directory -- what ships to the Amiga
    c/qjs                  CLI binary (thin shell, opens quickjs.library)
    c/flushlibs            Utility to flush cached libraries from memory
    libs/quickjs.library   Default library (= 020soft)
    libs/quickjs.020fpu.library
    libs/quickjs.020soft.library
    libs/quickjs.040fpu.library
    libs/quickjs.040soft.library
    libs/quickjs.060fpu.library
    libs/quickjs.060soft.library
    tests/                 Test scripts (test_core.js, test_comprehensive.js, etc.)

  library/vbcc/            VBCC library source -- the main build
    Makefile               Builds all library variants
    Makefile.cli           Builds the CLI binary
    libraryconfig.h        Library base structure, version, function table
    qjsfuncs.c             QJS_* C function implementations
    qjsfuncs_asm.s         Assembly LVO entry points (register -> stack trampolines)
    qjsfuncs_asm_all.s     All LVO entry points combined
    quickjs_bridge.c       Init/cleanup, stubs (CLI side)
    quickjs_libc_lib.c     std/os/bjson module code for library context
    quickjs_lib.sfd        SFD file defining the library's LVO interface
    sharedlib_clib.c       errno, strtol, sscanf, getenv, fd I/O
    sharedlib_int64.s      64-bit integer helpers for FPU builds
    sharedlib_int64_soft.s 64-bit integer helpers for soft-float builds
    sharedlib_int64_conv.c 64-bit conversion helpers in C
    sharedlib_math.c       Math functions for FPU builds (pow, atan2, frexp, etc.)
    sharedlib_math_soft.c  Software float via mathieeedoub*.library
    sharedlib_math_fpu_aux.c  Transcendentals for 040/060 FPU (atan, sin, cos, etc.)
    sharedlib_mem.c        AllocVec-based malloc/free
    sharedlib_posix.c      stat, getcwd, opendir, mkdir, rename, etc.
    sharedlib_stdio.c      fopen, fwrite, etc. via dos.library
    sharedlib_printf.c     snprintf/vsnprintf reimplementation
    sharedlib_string.c     String functions
    sharedlib_strtod.c     strtod reimplementation
    sharedlib_time.c       gettimeofday via DateStamp
    sharedlib_vbcc.c       VBCC runtime support
    bridge_asm.s           Assembly bridges (register argument trampolines)
    bridge_asm_batch1.s    Additional bridge batches
    bridge_asm_batch2.s
    bridge_asm_libc.s      libc bridge trampolines
    bridge_lvo.s           LVO dispatch
    bridge_a6.s            A6 base-register bridge
    bridge_dpvs.s          DPVS bridges
    stubs.c                Stub functions
    diag_init.c            Diagnostic init code
    amiga_ssl_lib.c        AmiSSL integration for library context
    alloca_68k.s           alloca implementation in 68k assembly

  quickjs-master/          QuickJS-ng source with AmigaOS patches
                           (patches mainly in cutils.h and quickjs.c)

  quickjs-clean/           Unmodified QuickJS-ng checkout for diffing

  include/                 POSIX stubs for AmigaOS
    amiga_compat.h         Main compatibility header
    amiga_compat_vbcc.h    VBCC-specific compatibility
    amiga_ssl.h            AmiSSL header
    stdint.h, inttypes.h   Standard integer types
    unistd.h, dirent.h     POSIX stub headers
    termios.h, poll.h      More POSIX stubs
    sys/                   sys/ subdirectory stubs
    inline/                Inline function headers

  src/                     amiga_compat files (CLI only, NOT in library)
    amiga_compat.c         Compatibility layer for CLI
    amiga_compat_vbcc.c    VBCC-specific compat for CLI
    amiga_posix_stubs.c    POSIX stubs for CLI
    amiga_ssl.c            AmiSSL for CLI

  vbcc-librarytemplate/    Christoph Fassbach's VBCC shared library template
                           (library.c, library.h -- the init/open/close/expunge framework)

  sdks/                    SDK files (AmiSSL SDK, etc.)
  bin/                     Utility binaries
  docs/                    Documentation
  resources/               Resource files
  tests/                   Host-side test infrastructure
```

---

## 4. Known Issues / Next Steps

### Bugs to Fix

- ~~FPU build int64 conversion TODOs~~ -- Fixed. All four functions in
  sharedlib_int64.s now handle the full 64-bit range using hi*2^32+lo
  decomposition with FPU instructions.

### Resolved / Not Bugs

- **DateStamp returns near-1970 timestamps in amiberry** -- Amiberry IS
  synced with the host clock, so this may be a real bug. The conversion
  math in sharedlib_time.c looks correct (epoch offset, tick math). The
  __ieeefltud bug (fixed in v0.64) was masking this on soft-float builds.
  Needs re-testing on current v0.64 to see if it still reproduces.

- ~~Leading zeros in `print(Date.now())` output~~ -- Fixed in commit
  f1aacd0 (sprintf %d formatting fix in sharedlib_printf.c).

- ~~AmiSSL HTTPS crashes~~ -- Fixed in v0.64. Both HTTP and HTTPS
  urlGet work via AmiSSL.

- **setTimeout granularity is 20ms** -- This is inherent to AmigaOS.
  DateStamp ticks are always 50Hz (TICKS_PER_SECOND=50 in dos/dos.h),
  regardless of PAL/NTSC video standard. Not a bug, just a platform
  limitation. test_timing.js exists as a diagnostic.

### New: fetch() API (v0.65)

Async `fetch()` implemented as a global function. Uses AmigaOS
`CreateNewProc()` to spawn a dedicated worker process for each
request. Worker does blocking HTTP/HTTPS in parallel; main task
polls completion via 20ms timer + MsgPort. Returns Promises that
integrate naturally with async/await.

**Architecture:**
1. Main task: `fetch(url)` creates FetchContext + MsgPort, spawns
   worker via `CreateNewProc()`, returns Promise immediately
2. Worker process (32KB stack, own task): DNS, connect, TLS
   handshake, send, recv — all blocking, all in its own process
3. Worker posts completion message to main's reply port + exits
4. Main task's 20ms timer calls `fetch_step()` → `GetMsg()`
   (non-blocking); when message arrives, resolves Promise

**Why processes, not setReadHandler:** bsdsocket.library's fd
namespace can return fd 0 for the first socket, colliding with
stdin in the QuickJS event loop's handler table. Spawning a
separate process gives each fetch its own task/fd context.

```javascript
// Basic usage (requires -m flag for async/await):
const response = await fetch("https://httpbin.org/get");
const data = await response.json();
print(data.origin);
```

**Supported:** GET, POST, PUT, DELETE with custom headers and body.
**Response class:** status, statusText, ok, url, headers properties;
  text(), json(), arrayBuffer() methods (all return Promises).
**Headers class:** get(name), has(name), forEach(callback).

**v1 Limitations:**
- DNS lookup blocks (gethostbyname is synchronous)
- One fetch at a time (second concurrent fetch rejects)
- No automatic redirect following (3xx returned as-is)
- No streaming (body fully buffered)
- HTTP/1.0 (no chunked transfer)

**Files:** sharedlib_fetch.c (state machine), sharedlib_posix.c
(poll extension with WaitSelect), quickjs-libc.c (JS classes + binding).
**Test:** amiga/tests/test_fetch.js

**Needs testing on amiberry with TCP/IP stack.**

### Pending Feature Work

- **Autodocs** (project_autodoc.md) -- Write C89 AmigaOS autodoc comments
  for all QJS_* library functions. This is standard Amiga practice for
  shared libraries.

- **qjs.inspect API** (project_qjs_inspect_api.md) -- Pass a
  context/helper object to the qjs.inspect callback. Future enhancement.

- **`.foo` dot-symbol syntax** (project_dot_symbol_syntax.md) -- Planned
  syntax extension where `.foo` means `Symbol.for('foo')`, inspired by
  Ruby. Future enhancement.

- **Optimization** -- Profile hot paths, reduce library size, improve
  startup time.

- **fetch() v2 improvements** -- Automatic redirect following, multiple
  concurrent fetches, headers object from JS object (not just string),
  streaming body, HTTP/1.1 with chunked transfer encoding.

---

## 5. Build System

### Quick Reference

```sh
make              # Build all 6 variants + CLI (= make ship)
make ship         # Same as make
make variants     # Build all 6 library variants (020/040/060 x fpu/soft) + default
make cli          # Build just the qjs CLI binary
make lib          # Build 020 FPU + 020 soft
make 020          # Build 68020 FPU + soft variants
make 040          # Build 68040 FPU + soft variants
make 060          # Build 68060 FPU + soft variants
make clean        # Remove all build artifacts
```

### Toolchain Locations

- VBCC: `~/vbcc` (set via `$VBCC` env var)
- `vc` (C compiler): `$VBCC/bin/vc`
- `vasmm68k_mot` (assembler): `$VBCC/vasmm68k_mot`
- `vlink` (linker): `$VBCC/bin/vlink`

### Object File Output

Object files go to `/tmp/qjslib_<CPU>[_soft]/` to keep the source tree
clean and allow parallel builds of different variants. For example:
- `/tmp/qjslib_020/` -- 020 FPU objects
- `/tmp/qjslib_020_soft/` -- 020 soft-float objects
- `/tmp/qjslib_040/` -- 040 FPU objects

### How a Library Variant is Built

1. All `.c` files compile to `.o` with VBCC (`vc +aos68k -cpu=<CPU> ...`)
2. Assembly files assemble with `vasmm68k_mot`
3. Everything links with `vlink` using the library template's linker script
4. FPU builds add `-fpu=68881`; soft-float builds rely on VBCC's `-amiga-softfloat` from the +aos68k config
5. 040/060 FPU builds include `sharedlib_math_fpu_aux.c` for transcendentals
6. The default `quickjs.library` is a copy of `quickjs.020soft.library`

---

## 6. Testing

### Environment

- **Emulator**: amiberry on macOS (Apple Silicon M3 Max)
- Library files are mounted directly from the build directory (no copy step)
- **You MUST run `flushlibs` between library updates** -- AmigaOS caches
  resident libraries in memory. Without flushing, the old version stays loaded.

### Test Files

All in `amiga/tests/`:

| File | Description |
|------|-------------|
| `test_core.js` | 43 basic tests (arithmetic, strings, objects, functions) |
| `test_comprehensive.js` | 222 tests covering: arithmetic, strings, arrays, objects, functions, classes, iterators, promises, maps, typed arrays, regex, math, symbols, errors, dates, proxy/reflect, weakref, std module, file I/O, os module, os timing, bjson |
| `test_timing.js` | Diagnostic for gettimeofday/setTimeout (prints raw values) |
| `test_inspect.js` | Tests for qjs.inspect custom display |
| `test_all.js` | Runs all test suites |

### Running Tests

On amiberry, with quickjs.library installed to LIBS::

```
qjs test_core.js
qjs test_comprehensive.js
```

Output files use naming conventions:
- `.amiberry.output.txt` -- output from amiberry runs
- `.aa3000.output.txt` -- output from AA3000 runs

---

## 7. Critical Architecture Notes

**Read and internalize these before making any changes.**

### The Library IS the Product

ALL functionality lives inside `quickjs.library`. The CLI (`qjs`) is a
thin shell that:
1. Opens quickjs.library
2. Parses command-line arguments
3. Calls QJS_* functions via LVO
4. Closes the library

Never put JS-facing functionality in the CLI. Any Amiga program should
be able to use quickjs.library directly.

### No .lib Files in the Library

The library CANNOT link against vc.lib, posix.lib, or any other VBCC
runtime library. Those depend on C startup code that does not run in
shared library context. Instead, all POSIX/libc functions are
reimplemented in the `sharedlib_*.c` files using AmigaOS native calls
(dos.library, exec.library, mathieeedoub*.library).

### Register A6 and VBCC

VBCC uses A6 as the frame pointer. AmigaOS shared libraries pass the
library base in A6. These conflict. Solution: all LVO entry points are
assembly trampolines (`qjsfuncs_asm*.s`) that:
1. Save A6 (library base) to a known location
2. Push register arguments onto the stack
3. Call plain C functions with normal stack-based calling convention
4. Restore A6 on return

Never declare C functions with `__reg("a6")` parameters if they use
local variables or call other functions -- the frame pointer will be
clobbered.

### LIBCODE + __saveds

Library functions that access global data need `__saveds` to set up the
data segment base (A4). The LIBCODE macro in the template handles the
LVO dispatch. See feedback_libcode_saveds.md in memory for details.

### Soft-Float vs FPU Math

- **Soft-float builds**: All floating point goes through
  `mathieeedoubbas.library` (add, sub, mul, div, cmp, etc.) and
  `mathieeedoubtrans.library` (sin, cos, atan, exp, log, etc.)
- **020 FPU builds**: Basic math uses inline 68881 FPU instructions.
  Transcendentals also use 68881 instructions (fsin, fcos, etc.)
- **040/060 FPU builds**: Basic math uses FPU. Transcendentals go through
  `mathieeedoubtrans.library` because the 68040/68060 FPU does not
  implement those as hardware instructions.

### Int64 Helpers

VBCC's 64-bit integer runtime (`__mulint64`, `__divint64`, `__modint64`,
shifts, comparisons, conversions) is normally in vc.lib. Since we cannot
link vc.lib, these are reimplemented in:
- `sharedlib_int64.s` -- FPU builds
- `sharedlib_int64_soft.s` -- soft-float builds
- `sharedlib_int64_conv.c` -- some conversions in C

### QuickJS-ng Source Patches

The QuickJS-ng source in `quickjs-master/` has AmigaOS-specific patches.
The unmodified source is in `quickjs-clean/` for diffing. Main patches
are in `cutils.h` and `quickjs.c`. When upgrading QuickJS-ng, diff
against quickjs-clean to understand what was changed.

### Memory Notes

The `.claude/` directory and the files referenced in MEMORY.md contain
accumulated knowledge from prior sessions. Key files:
- `feedback_library_architecture.md` -- ALL functionality in library
- `feedback_no_libs_in_library.md` -- No .lib files in library
- `feedback_vbcc_a6_lvo.md` -- VBCC A6 frame pointer conflict
- `feedback_libcode_saveds.md` -- LIBCODE + __saveds rules
- `feedback_version_bump.md` -- Always bump version + date in $VER
- `feedback_vamos_units.md` -- vamos -s/-m flags are KiB not bytes
- `feedback_qjsc_bytecode.md` -- Use repo's qjsc, not system qjsc
- `project_settimeout_bug.md` -- setTimeout timing is incorrect

---

## 8. Version Bumping

When rebuilding the library, always bump the minor version AND the date
in the `$VER` string (in `libraryconfig.h`). This is tracked in
feedback_version_bump.md.

---

## 9. Useful Commands

```sh
# Diff AmigaOS patches against clean QuickJS-ng
diff -r quickjs-clean/ quickjs-master/ | less

# Check library size
ls -la amiga/libs/quickjs.library

# See what functions the library exports
grep -c 'QJS_' library/vbcc/quickjs_lib.sfd

# Build just one variant for quick iteration
cd library/vbcc && make CPU=68020 soft
```
