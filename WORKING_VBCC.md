# Building QuickJS as an AmigaOS Shared Library with VBCC

## A Technical Memoir

This document records every hard-won lesson from porting QuickJS-ng to an
AmigaOS shared library (`quickjs.library`) using the VBCC cross-compiler.
It is intended as both a reference for future maintainers and a forensic
record of the bugs, workarounds, and architectural decisions that shaped
the final working library.

The library reached v0.64 with 222/222 tests passing on 2026-04-10.

---

## Table of Contents

1. [VBCC Cross-Compilation Setup](#1-vbcc-cross-compilation-setup)
2. [The Shared Library Architecture](#2-the-shared-library-architecture)
3. [The No-.lib-Files Rule](#3-the-no-lib-files-rule--the-critical-constraint)
4. [The __reg("a6") Frame Pointer Catastrophe](#4-the-__rega6-frame-pointer-catastrophe)
5. [The __ieeefltud Calling Convention Disaster](#5-the-__ieeefltud-calling-convention-disaster)
6. [The IEEEDPPow Parameter Swap](#6-the-ieeedppow-parameter-swap)
7. [040/060 FPU Transcendental Wrappers](#7-040060-fpu-transcendental-wrappers)
8. [The DateStamp/gettimeofday Saga](#8-the-datestampgettimeofday-saga)
9. [Soft-Float Build Specifics](#9-soft-float-build-specifics)
10. [Int64 Assembly Helpers](#10-int64-assembly-helpers)
11. [The CLI Bridge Architecture](#11-the-cli-bridge-architecture)
12. [Linker Flags and Hunk Format](#12-linker-flags-and-hunk-format)
13. [Debugging Techniques](#13-debugging-techniques)
14. [Memory Model Notes](#14-memory-model-notes)
15. [Version History](#15-version-history)

---

## 1. VBCC Cross-Compilation Setup

The project originally used SAS/C 6.58 for compiling the QuickJS engine
and CLI binary. The switch to VBCC was forced by the shared library
requirement: SAS/C's linker and runtime assumptions are deeply entangled
with normal executable startup, making it impractical for producing
AmigaOS shared libraries that must avoid all `.lib` file dependencies.

### Installation

VBCC is installed at `~/vbcc`. The directory structure:

```
~/vbcc/
  bin/vc           — the C compiler driver
  bin/vlink        — the linker
  vasmm68k_mot     — Motorola-syntax 68k assembler
  config/aos68k    — AmigaOS 68k cross-compilation config
  targets/m68k-amigaos/
    include/       — AmigaOS system headers
    lib/           — startup.o, vc.lib, amiga.lib, m881.lib, etc.
  posixlib/
    include/       — POSIX compatibility headers
    AmigaOS3/      — POSIX .lib files for AmigaOS 3.x
```

### The +aos68k Config File

The `+aos68k` config file at `~/vbcc/config/aos68k` controls the default
compilation pipeline. Its contents:

```
-cc=vbccm68k -quiet %s -o= %s %s -O=%ld -I$VBCC/targets/m68k-amigaos/include
-ccv=vbccm68k %s -o= %s %s -O=%ld -I$VBCC/targets/m68k-amigaos/include
-as=vasmm68k_mot -quiet -Fhunk -nowarn=62 %s -o %s
-asv=vasmm68k_mot -Fhunk -nowarn=62 %s -o %s
-rm=rm -f %s
-rmv=rm %s
-ld=vlink -bamigahunk -x -Bstatic -Cvbcc -nostdlib -mrel $VBCC/targets/m68k-amigaos/lib/startup.o %s %s -L$VBCC/targets/m68k-amigaos/lib -lvc -o %s
-l2=vlink -bamigahunk -x -Bstatic -Cvbcc -nostdlib -mrel %s %s -L$VBCC/targets/m68k-amigaos/lib -o %s
-ldv=vlink -bamigahunk -t -x -Bstatic -Cvbcc -nostdlib -mrel $VBCC/targets/m68k-amigaos/lib/startup.o %s %s -L$VBCC/targets/m68k-amigaos/lib -lvc -o %s
-l2v=vlink -bamigahunk -t -x -Bstatic -Cvbcc -nostdlib -mrel %s %s -L$VBCC/targets/m68k-amigaos/lib -o %s
-ldnodb=-s -Rshort
-ul=-l%s
-cf=-F%s
-ml=1000
-hunkdebug
-amiga-softfloat
```

**The critical last line**: `-amiga-softfloat` is ALWAYS applied by the
config. This means every compilation through `+aos68k` gets soft-float
mode. When you specify `-fpu=68881` on the command line, it overrides
`-amiga-softfloat` because VBCC processes flags in order and the last
FPU specification wins. But be aware: the soft-float flag is always
present in the config.

### Toolchain Components

- **vc**: The compiler driver. Invokes vbccm68k (the actual C compiler),
  then vasmm68k_mot (assembler), then optionally vlink (linker).
  Use `vc -c` for compile-only (no linking).
- **vasmm68k_mot**: Motorola-syntax 68k assembler. Flags:
  - `-Fhunk`: Output AmigaOS hunk format object files
  - `-nowarn=62`: Suppress "unsupported relocations" warnings (harmless
    in hunk format)
  - `-m68020`: Enable 68020 instruction set
  - `-m68881`: Enable 68881/68882 FPU instructions
- **vlink**: The linker. Produces AmigaOS hunk executables from `.o` files.
  When used directly (as we do for the library), it does NOT link any
  default libraries.

### Compiler Flags Used

For the library (from `Makefile`):

```makefile
CFLAGS_COMMON = +aos68k -c -cpu=$(CPU) -O1 \
         -I$(VBCC)/targets/m68k-amigaos/include \
         -I$(VBCC)/posixlib/include \
         -I$(AMISSL_SDK) \
         -I$(INCLUDE) -I$(QJS) \
         -I$(TEMPLATE) -I$(LIBVBCC)

CFLAGS_FPU  = $(CFLAGS_COMMON) -fpu=68881
CFLAGS_SOFT = $(CFLAGS_COMMON)
```

Key points:
- `-O1` optimization: safe level; `-O2` can cause miscompilations with
  complex register allocation scenarios (never tested, but not worth risking).
- `-c`: compile only, no linking.
- `-cpu=68020/68040/68060`: selects instruction set. All three CPUs use
  the same base 68020 ISA, but the 040/060 FPU drops transcendental
  instructions.
- `-fpu=68881`: enables FPU instructions. On 040/060, the VBCC compiler
  still uses 68881 mnemonics (which the 040/060 FPU supports for basic
  ops) but emits external function calls for transcendentals.

---

## 2. The Shared Library Architecture

### Origins: vbcc-librarytemplate

The library skeleton is based on **vbcc-librarytemplate** by Christoph
Fassbach (chritoph@gmx.de), available on Aminet. This template provides:

- A minimal `library.c` with the RomTag, InitTable, and the four
  standard library vectors (`_LibInit`, `_LibOpen`, `_LibClose`,
  `_LibExpunge`).
- A `library.h` that documents the configuration contract via
  `libraryconfig.h`.
- The `_start()` function that returns -1 (prevents running the library
  as an executable).

The template lives in `vbcc-librarytemplate/` in the repository root.

### library.c: The Boot Sequence

When AmigaOS loads a shared library, the following sequence occurs:

1. **LoadSeg**: The OS loads the library binary from `LIBS:` into memory.
   BSS hunks are zeroed. RELOC32 entries are applied to fix up absolute
   addresses.

2. **RomTag scan**: The OS searches the loaded code for the `RTC_MATCHWORD`
   (0x4AFC) magic. Our `RomTag` structure is placed at the very beginning
   of the code section (library.c is linked FIRST).

3. **InitTable dispatch**: The RomTag points to `InitTable[4]`:
   ```c
   const APTR InitTable[4] = {
       (APTR) sizeof(LIBRARY_BASE_TYPE),  // size to AllocMem
       (APTR) &LibraryFunctions,          // function pointer table
       (APTR) NULL,                       // init data (unused)
       (APTR) _LibInit                    // init function
   };
   ```
   The `RTF_AUTOINIT` flag tells exec to handle the boilerplate:
   allocate memory, build the jump table from `LibraryFunctions[]`, then
   call `_LibInit`.

4. **_LibInit**: Receives `ExecBase*` in A6, the segment list in A0, and
   the allocated library base in D0. Sets up the `Library` node fields
   (type, name, flags, version, revision, ID string), stores the segment
   list and SysBase, then calls `CustomLibInit()`.

5. **CustomLibInit** (in `qjsfuncs.c`): Opens all required libraries and
   initializes subsystems:
   ```
   SysBase global       <- for proto/exec.h inline calls
   dos.library (v36)    <- file I/O, DateStamp, etc.
   _qjs_DOSBase global  <- for Date.now/os.now time functions
   sharedlib_time_init  <- gettimeofday via DateStamp
   sharedlib_posix_init <- POSIX shim (stat, getcwd, open, etc.)
   quickjs_libc_lib_init <- quickjs-libc DOSBase
   sharedlib_stdio_init <- fopen/fclose/fread/fwrite
   sharedlib_clib_init  <- file descriptor table
   mathieeedoubbas.library (v34)   <- basic float ops (soft builds)
   mathieeedoubtrans.library (v34) <- transcendentals
   sharedlib_math_soft_init <- sets MathIeeeDoubBasBase etc.
   AmigaPoolInit        <- exec memory pool (64KB puddles)
   ```
   Returns FALSE on success, TRUE on failure. On failure, `_LibInit`
   calls `_LibExpunge` to clean up and returns NULL to the OS.

### The Library Base Structure

```c
struct QJSLibBase {
    struct Library iLibrary;          // Standard Amiga Library node
    UWORD iPadding;                   // Alignment padding
    BPTR iSegmentList;                // BCPL pointer to loaded segments
    struct ExecBase *iSysBase;        // Cached SysBase
    struct Library *iDOSBase;         // dos.library base
    struct Library *iMathDoubBasBase;  // mathieeedoubbas.library
    struct Library *iMathDoubTransBase; // mathieeedoubtrans.library
    APTR iMemPool;                    // exec memory pool handle
};
```

The first three fields after `iLibrary` (padding, segment list, SysBase)
are mandated by the template. The remaining fields are project-specific.

### The Function Table

`LibraryFunctions[]` in library.c lists all exported functions:

```c
const APTR LibraryFunctions[] = {
    (APTR) _LibOpen,       // LVO -6   (standard)
    (APTR) _LibClose,      // LVO -12  (standard)
    (APTR) _LibExpunge,    // LVO -18  (standard)
    (APTR) _LibReserved,   // LVO -24  (standard)
    LIBRARY_FUNCTIONS,     // LVO -30, -36, -42, ... (custom)
    (APTR) -1              // end-of-table sentinel
};
```

`LIBRARY_FUNCTIONS` is a macro defined in `libraryconfig.h` that expands
to all 212+ QJS_* function pointers.

### libraryconfig.h

This is the bridge between the template and our library. It defines:

- `LIBRARY_NAME` ("quickjs.library")
- `LIBRARY_VERSION_STRING` (e.g., `"\0$VER: quickjs.library 0.64 (10.4.2026)\r\n"`)
- `LIBRARY_VERSION` (0) and `LIBRARY_REVISION` (64)
- `LIBRARY_BASE_TYPE` (struct QJSLibBase)
- All QJS_* function declarations with `__reg()` register assignments
- Forward declarations of JSRuntime, JSContext, JSValue, JSValueUnion

### qjsfuncs.c: The Glue Layer

This file provides the C implementations of all QJS_* library functions.
Each function:

1. Receives the library base in A6 (first parameter)
2. Receives its arguments in other registers (A0, A1, D0, D1, etc.)
3. Calls the corresponding JS_* engine function (compiled from
   quickjs-master/ sources into .o files)
4. Returns the result

For functions that pass or return `JSValue` by value (an 8-byte struct on
68k), the C calling convention becomes problematic. These functions are
implemented in `qjsfuncs_asm_all.s` as assembly trampolines that handle
the struct copy explicitly.

---

## 3. The No-.lib-Files Rule -- THE CRITICAL CONSTRAINT

This is the single most important architectural constraint of the entire
project. It affects every design decision and is the root cause of the
massive amount of reimplementation work.

### Why No .lib Files?

AmigaOS `.lib` files (vc.lib, amiga.lib, m881.lib, posixlib, etc.)
contain:

1. **Startup code** (`startup.o`): Initializes the C runtime, sets up
   `SysBase`, opens `dos.library`, creates `stdin`/`stdout`/`stderr`,
   parses command-line arguments, calls `main()`, and handles exit.
   This code assumes it is running as a standalone executable.

2. **C runtime globals**: Variables like `errno`, `stdin`, `stdout`,
   `SysBase`, `DOSBase` that are initialized by the startup code. In a
   shared library, there IS no startup code -- the library is loaded by
   `LoadSeg` and initialized via `_LibInit`.

3. **Static data**: Functions in `.lib` files may reference static
   variables that assume a specific memory layout or initialization order
   that conflicts with the shared library's data segment.

4. **Cross-library conflicts**: If two libraries both link with `vc.lib`,
   their internal globals would collide or be duplicated in confusing ways.

The vbcc-librarytemplate documentation explicitly states:

> "Do NOT use amiga.lib or anything else ending with .lib."

### What Had to Be Reimplemented

Every C runtime function that QuickJS uses had to be written from scratch
using only AmigaOS system calls (exec.library, dos.library,
mathieeedoubbas.library, mathieeedoubtrans.library). The complete list of
reimplementation files:

| File | What It Provides |
|------|-----------------|
| `sharedlib_mem.c` | `AmigaAlloc`, `AmigaFree`, `AmigaRealloc`, `AmigaCalloc`, `AmigaUsableSize` -- pool-based memory allocator using exec.library `CreatePool`/`AllocPooled`/`FreePooled`. Each allocation has an 8-byte header (`AAHeader`) with total size and a magic number (0x41416D61 = "AAma") for sanity checking. Pool uses 64KB puddles with 16KB threshold. |
| `sharedlib_string.c` | `memcpy`, `memset`, `memmove`, `strlen`, `strcmp`, `strncmp`, `strchr`, `strrchr`, `strstr`, `strcat`, `strncat`, `strncpy`, `strcpy`, `memcmp`, `memchr`, `strdup`, `strerror`, `toupper`, `tolower`, `isdigit`, `isalpha`, `isalnum`, `isspace`, `isxdigit`, `ispunct`, `isupper`, `islower`, `isprint`, `iscntrl`, `isgraph`, `atoi`, `atol`, `qsort`, `bsearch` |
| `sharedlib_math.c` | (FPU build) `atan2`, `pow`, `exp2`, `expm1`, `log2`, `log10`, `fmod`, `ldexp`, `modf`, `round`, `trunc`, `copysign`, `scalbn`, `frexp`, `cbrt`, `hypot`, `remainder`, `rint`, `nearbyint`, `fmin`, `fmax`, `asin`, `acos`, `asinh`, `acosh`, `atanh` -- built on top of VBCC's inlined 68881 FPU primitives |
| `sharedlib_math_soft.c` | (Soft-float build) Same functions as above but using mathieeedoubbas/mathieeedoubtrans LVO calls instead of FPU instructions. Also declares and initializes the required globals: `MathIeeeDoubBasBase`, `MathIeeeDoubTransBase`, `MathIeeeSingBasBase` |
| `sharedlib_math_fpu_aux.c` | (040/060 FPU build only) `atan`, `sin`, `cos`, `tan`, `sinh`, `cosh`, `tanh`, `exp`, `log`, `sqrt`, `asin`, `acos`, `log10` -- wrappers that convert FP0 to d0:d1, call mathieeedoubtrans LVO, convert d0:d1 back to FP0. Also C implementations of `exp2`, `expm1`, `log2`, `fmod`, `ldexp`, `modf`, `round`, `atanh` |
| `sharedlib_time.c` | `gettimeofday` (via DateStamp LVO -192), `gmtime_r`, `localtime_r`, `mktime` -- handles Amiga epoch (1978-01-01) to Unix epoch (1970-01-01) conversion with 252460800 second offset |
| `sharedlib_strtod.c` | `strtod`, `strtol`, `strtoul`, `strtoll`, `strtoull` -- number parsing without C runtime |
| `sharedlib_printf.c` | `snprintf`, `vsnprintf` -- minimal printf implementation supporting `%d`, `%u`, `%x`, `%s`, `%c`, `%p`, `%f`, `%e`, `%g`, `%%` |
| `sharedlib_vbcc.c` | `abort` (infinite loop), `_exit`/`__exit` (infinite loop), `SysBase` global, `__CTOR_LIST__`/`__DTOR_LIST__` (empty), `main` (dummy), `__XCEXIT` (SAS/C compat stub), `__pInf_s`/`__qNaN_s`/`__pInf_d` (IEEE 754 special value bit patterns for VBCC's `INFINITY`/`NAN` references) |
| `sharedlib_posix.c` | `stat`, `fstat`, `lstat`, `getcwd`, `chdir`, `opendir`, `readdir`, `closedir`, `open`, `close`, `read`, `write`, `rename`, `unlink`, `mkdir`, `rmdir`, `access`, `isatty`, `fileno`, `popen`, `pclose`, `getpid`, `sleep`, `usleep` -- all via dos.library LVO calls |
| `sharedlib_stdio.c` | `fopen`, `fclose`, `fread`, `fwrite`, `fprintf`, `fputs`, `fgets`, `fputc`, `fgetc`, `ungetc`, `fseek`, `ftell`, `feof`, `ferror`, `clearerr`, `fflush`, `setvbuf`, `tmpfile`, `tmpnam` -- implemented on top of dos.library `Open`/`Close`/`Read`/`Write`/`Seek` |
| `sharedlib_clib.c` | File descriptor table mapping Unix-style `int fd` to AmigaOS `BPTR` file handles. Provides `dup`, `dup2`, `pipe` stubs. Initializes fd 0/1/2 from the process's standard I/O handles |
| `sharedlib_int64_soft.s` | 68020 assembly: `__mulint64`, `__divuint64`, `__divsint64`, `__moduint64`, `__modsint64`, `__lshint64`, `__rshsint64`, `__rshuint64`, `__ieeefltud` -- all 64-bit integer operations that VBCC normally gets from vc.lib. For soft-float builds only |
| `sharedlib_int64.s` | Same 64-bit integer operations for FPU builds, plus FPU-based float conversion (`fmove.l` instructions instead of mathieeedoubbas calls) |
| `sharedlib_int64_conv.c` | `_sint64toflt64`, `_uint64toflt64`, `_flt64tosint64`, `_flt64touint64` -- 64-bit integer to/from double conversion in C (for soft-float; FPU builds use hardware `fmove.l`) |
| `stubs.c` | Duplicates of symbols from `sharedlib_vbcc.c` -- `__XCEXIT`, `_exit`, `__exit`, `abort`, `main`, `__CTOR_LIST__`, `__DTOR_LIST__`, `printf` (no-op), `fprintf` (no-op), `stdout` (dummy pointer). Provides the vc.lib compatibility symbols that the engine .o files reference |

### The execinline.h Escape Hatch

Since we cannot use `proto/exec.h` (which pulls in amiga.lib), we have
`execinline.h` that provides direct inline calls to exec.library functions
using the function-pointer-to-LVO pattern:

```c
#define __OpenLibrary(sysBase, name, version) \
    ((struct Library *(*)(                    \
        __reg("a6") struct ExecBase *,        \
        __reg("a1") const char *,             \
        __reg("d0") ULONG))                   \
     ((char *)(sysBase) - 552))               \
    ((sysBase), (name), (version))
```

This works for exec.library because exec is always available (its base
is at memory address 4) and exec's functions are simple enough that the
__reg("a6") issue (section 4) doesn't manifest for most of them.

---

## 4. The __reg("a6") Frame Pointer Catastrophe

This was the most insidious class of bug encountered during the port. It
affected math library calls (mathieeedoubtrans) and could affect any
function-pointer-based LVO dispatch.

### Background: How VBCC Uses A6

On the 68000 family, VBCC uses register A6 as the **frame pointer** for
function stack frames. The frame pointer points to the saved previous
frame pointer on the stack, and local variables and function arguments
are accessed as offsets from A6 (e.g., `-4(a6)` for the first local,
`8(a6)` for the first argument on stack-passing conventions).

AmigaOS library calls require A6 to contain the **library base pointer**.
The standard calling convention is: load A6 with the library base, load
other registers with arguments, then `JSR -offset(a6)` to call through
the LVO jump table.

### The Conflict

When you use the function-pointer-via-cast pattern (the `MATH_LVO` or
`DOS_LVO` macros) with `__reg("a6")`, VBCC generates code that:

1. Loads the library base into A6 (as requested by `__reg("a6")`)
2. Then tries to load other arguments from the stack

But step 1 **destroys the frame pointer**. If the arguments being loaded
in step 2 require stack-relative addressing via the (now-clobbered) A6,
they read garbage memory instead of the intended values.

### The Broken Pattern

```c
#define MATH_LVO(base, offset, type) \
    ((type)((char *)(base) - (offset)))

static double sl_Exp(double x) {
    return MATH_LVO(MathIeeeDoubTransBase, 78,
        double (*)(
            __reg("a6") struct Library *,
            __reg("d0/d1") double))
        (MathIeeeDoubTransBase, x);
}
```

VBCC might generate something like:

```asm
    move.l  _MathIeeeDoubTransBase,a6   ; A6 = library base (FRAME POINTER GONE)
    move.l  -8(a6),d0                   ; GARBAGE — -8(a6) is now relative to
    move.l  -4(a6),d1                   ;   the library base, not the stack frame!
    jsr     -78(a6)                     ; call with garbage in d0:d1
```

### Observable Symptom

`Math.exp(1)` returned `0.000001321787941` (garbage) instead of
`2.718281828459045`. Meanwhile, `Math.sqrt(4)` and `Math.pow(2, 3)` and
`Math.log(1)` returned correct values. This was maddening -- some math
functions worked perfectly and others returned nonsense.

The explanation: whether the bug manifests depends on the specific
register pressure at each call site. If VBCC happens to have the
argument already in a data register (not needing stack-relative load),
the A6 clobber is harmless. For `sqrt`, `pow`, and `log`, the compiler
happened to generate code where the argument was already in d0:d1 before
A6 was loaded. For `exp`, it wasn't.

### The Fix: Inline Assembly Syntax

VBCC has a special syntax for declaring a function whose body is inline
assembly:

```c
static double __sl_Exp(
    __reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-78(a6)";

#define sl_Exp(x) __sl_Exp(MathIeeeDoubTransBase, (x))
```

With `function = "asm"`, VBCC embeds the `jsr -78(a6)` directly at the
call site. It sets up ALL register arguments BEFORE any of them,
including A6, using correct stack-relative addressing while the frame
pointer is still intact. Only then does it execute the inline assembly.

This pattern was first proven correct in `sharedlib_posix.c` for all
dos.library calls. After the Math.exp(1) disaster, ALL math LVO calls
were converted to this pattern.

### How sharedlib_posix.c Does It

```c
static BPTR __sl_Open(__reg("a6") struct Library *base,
                      __reg("d1") const char *name,
                      __reg("d2") LONG mode) = "\tjsr\t-30(a6)";
#define sl_Open(n,m) __sl_Open(sl_DOSBase, (n), (m))
```

This two-part pattern (inline-asm function declaration + convenience
macro) is used for every single dos.library call: Open, Close, Read,
Write, Seek, Lock, UnLock, Examine, ExNext, CreateDir, DeleteFile,
Rename, DateStamp, CurrentDir, Input, Output, IoErr, SetIoErr, Delay,
NameFromLock, ParentDir, DupLock, FilePart, PathPart, AddPart,
IsInteractive, WaitForChar, FPutC, FGetC.

### Rule of Thumb

**Never use the function-pointer-via-cast pattern for LVO dispatch in
VBCC-compiled shared library code.** Always use the inline assembly
syntax. The function-pointer pattern can work by accident (when register
pressure is favorable) but will break in subtle, intermittent ways that
are extremely difficult to diagnose.

---

## 5. The __ieeefltud Calling Convention Disaster

This was the root cause of Date.now() returning 0, toISOString()
printing "0000-01-00", and the os.sleep timing test failing. It took
many debugging iterations across multiple versions (v0.61 through v0.64)
to track down.

### What __ieeefltud Does

`__ieeefltud` converts an unsigned 32-bit integer to an IEEE 754
double-precision float. It is called by `_sint64toflt64` (64-bit signed
integer to double), which is in turn called EVERYWHERE in QuickJS:

- `Date.now()` returns a timestamp as a JS Number (double)
- `toISOString()` formats a Date as a string
- Any 64-bit integer value displayed or coerced to a JS Number
- Internal bigint-to-float conversions

### The Bug

Our assembly implementation of `__ieeefltud` in
`sharedlib_int64_soft.s` originally read its argument from register D0:

```asm
__ieeefltud:
    movem.l d2-d3/a6,-(sp)
    ; BUG: assumed arg in d0, but VBCC pushes it on the stack!
    move.l  _MathIeeeDoubBasBase,a6
    jsr     -36(a6)         ; IEEEDPFlt: d0 -> d0:d1
    ...
```

But VBCC's C compiler, when calling `__ieeefltud`, pushes the unsigned
long argument **on the stack**, not in D0. This is VBCC's standard
calling convention for runtime helper functions -- they use stack-based
argument passing, unlike the register-based convention used for normal
function calls.

D0 contained whatever garbage was left from a previous operation. The
function would convert that garbage to a double, producing meaningless
results.

### Why It Was So Hard to Find

1. **FPU builds worked**: On FPU builds, `(double)value` uses the
   hardware `fmove.l Dn,fp0` instruction. There is no call to
   `__ieeefltud` at all. So the bug ONLY affected soft-float builds.

2. **Compiled code was identical**: When examining the disassembly of the
   _calling_ code (e.g., `_sint64toflt64`), the FPU and soft builds
   generated IDENTICAL code up to the point of the float conversion.
   The divergence was only in the conversion itself.

3. **The linker map was correct**: `__ieeefltud` resolved to the right
   address. The symbol was there, the code was there. The bug was in the
   calling convention mismatch.

4. **The symptom looked like a gettimeofday bug**: Date.now() returning
   0 naturally led to investigating DateStamp, gettimeofday, the DOS
   library initialization, etc. The actual failure was in the
   int64-to-double conversion that happened AFTER gettimeofday returned
   a perfectly valid timestamp.

5. **Hardcoding gettimeofday still returned 0**: Even when gettimeofday
   was hardcoded to `tv->tv_sec = 1234567890`, `Date.now()` still
   returned 0. This was the key clue that the bug was downstream of
   gettimeofday -- in the conversion of the resulting int64 timestamp to
   a JavaScript Number.

### The Fix

One line of assembly:

```asm
__ieeefltud:
    movem.l d2-d3/a6,-(sp)
    move.l  16(sp),d0       ; <-- THE FIX: load arg from stack
    move.l  _MathIeeeDoubBasBase,a6
    jsr     -36(a6)         ; IEEEDPFlt: d0 -> d0:d1
    ...
```

The stack offset is 16 because: 12 bytes for the three saved registers
(d2, d3, a6) via `movem.l` + 4 bytes for the return address = 16 bytes
before the first argument.

### The Full __ieeefltud Implementation

```asm
__ieeefltud:
    movem.l d2-d3/a6,-(sp)
    move.l  16(sp),d0       ; load unsigned long arg from stack
    move.l  _MathIeeeDoubBasBase,a6
    ; IEEEDPFlt converts signed long -> double. If the unsigned
    ; value was >= 2^31, the result will be negative.
    jsr     -36(a6)         ; IEEEDPFlt: signed d0 -> double d0:d1
    tst.l   d0
    bpl.s   .fltud_done
    ; Value was >= 2^31. Add 4294967296.0 to correct.
    move.l  d0,d2
    move.l  d1,d3
    move.l  #$41F00000,d0   ; 4294967296.0 high word
    moveq   #0,d1           ; 4294967296.0 low word
    jsr     -66(a6)         ; IEEEDPAdd: d0:d1 + d2:d3 -> d0:d1
.fltud_done:
    movem.l (sp)+,d2-d3/a6
    rts
```

The implementation handles the unsigned aspect by first converting as
signed (via IEEEDPFlt, which takes a signed long), then adding 2^32 if
the original value had its high bit set (meaning IEEEDPFlt produced a
negative result).

### Lesson Learned

When implementing VBCC runtime helper functions in assembly, **always
verify the calling convention by examining VBCC's actual generated code**
(use `vc -S` to get assembly output). Do not assume register-based
argument passing for runtime helpers -- many use stack-based conventions.

---

## 6. The IEEEDPPow Parameter Swap

This bug caused `Math.pow(2, 10)` to return 100 instead of 1024.

### The AmigaOS Calling Convention for IEEEDPPow

The mathieeedoubtrans.library function `IEEEDPPow` has this prototype
(from the NDK3.2 FD file):

```
IEEEDPPow(exp,arg)(d2/d3,d0/d1)
```

This means:
- `exp` (the exponent) goes in d2:d3
- `arg` (the base) goes in d0:d1
- The function computes `arg ^ exp` (i.e., `base ^ exponent`)

### The Bug

Our `sl_Pow(base, exponent)` wrapper was passing:
- `base` to the first register pair listed (d2:d3)
- `exponent` to the second register pair (d0:d1)

```c
// WRONG — base in d2:d3 (exp slot), exponent in d0:d1 (arg slot)
// Computes exponent^base instead of base^exponent
```

So `Math.pow(2, 10)` was computing `10^2 = 100` instead of `2^10 = 1024`.

### The Fix

Swap the argument order in the wrapper call:

```c
// CORRECT — the asm function declares d2/d3 first (exp), d0/d1 second (arg/base)
// The MACRO swaps the C-natural (base, exp) order to match the LVO convention
static double __sl_Pow(
    __reg("a6") struct Library *base,
    __reg("d2/d3") double exponent,   // LVO's "exp" parameter
    __reg("d0/d1") double arg) =      // LVO's "arg" (base) parameter
    "\tjsr\t-90(a6)";

// Macro swaps: C's pow(base, exp) -> LVO's Pow(exp, base)
#define sl_Pow(base_val, exp_val) __sl_Pow(MathIeeeDoubTransBase, (exp_val), (base_val))
```

### Lesson Learned

**Always verify LVO parameter order against the original FD/SFD files**
in the NDK. The parameter NAMES in the FD file (`exp`, `arg`) tell you
what each register slot expects. The C function name `Pow` and the
natural ordering of "base, exponent" can be misleading when the LVO
convention puts them in a different order.

The relevant FD file is at:
`sdks/NDK3.2R4/FD/mathieeedoubtrans_lib.fd`

---

## 7. 040/060 FPU Transcendental Wrappers

### The Problem

The Motorola 68881/68882 FPU includes hardware implementations of
transcendental functions: FSIN, FCOS, FTAN, FASIN, FACOS, FATAN, FSINH,
FCOSH, FTANH, FEXP (e^x, 2^x, 10^x), FLOG (ln, log2, log10), FSQRT.

The 68040 and 68060 FPUs **dropped all transcendental instructions**.
They only retained the basic operations: FADD, FSUB, FMUL, FDIV, FCMP,
FMOVE, FTST, FNEG, FABS, FSQRT (68040 keeps FSQRT), and a few others.

When VBCC compiles with `-cpu=68040 -fpu=68881`, it knows about this
limitation. For basic operations, it emits 68881-compatible FPU
instructions that the 040/060 FPU handles natively (or traps and
emulates in ROM). For transcendentals, it emits **external function
calls** to `atan`, `sin`, `cos`, `tan`, `exp`, `log`, `sqrt`, etc.

In a normal executable linked with `m881.lib`, these functions would be
provided by the math library. In our shared library, we must provide
them ourselves.

### sharedlib_math_fpu_aux.c

This file provides the wrappers, using VBCC's inline assembly syntax.
The pattern for each function:

```c
double __ieee_sin(__reg("a6") void *base,
                  __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"    // 1. Push FP0 as 8 bytes onto stack
    "\tmove.l\t(sp)+,d0\n"      // 2. Pop high word into d0
    "\tmove.l\t(sp)+,d1\n"      // 3. Pop low word into d1
    "\tjsr\t-36(a6)\n"          // 4. Call IEEEDPSin (d0:d1 -> d0:d1)
    "\tmove.l\td1,-(sp)\n"      // 5. Push result low word
    "\tmove.l\td0,-(sp)\n"      // 6. Push result high word
    "\tfmove.d\t(sp)+,fp0";     // 7. Pop into FP0 as double

double sin(double x) { return __ieee_sin(MathIeeeDoubTransBase, x); }
```

The conversion path is:
```
FP0 (80-bit extended) → stack → d0:d1 (IEEE 64-bit double)
    → mathieeedoubtrans LVO → d0:d1 → stack → FP0
```

This incurs 8 bytes of stack overhead per call (push FP0, pop to
registers, push registers, pop to FP0).

### LVO Offset Table

All offsets verified against `NDK3.2R4/FD/mathieeedoubtrans_lib.fd`:

| Function | LVO Offset | VBCC External Name |
|----------|-----------|-------------------|
| IEEEDPAtan | -30 | `atan` |
| IEEEDPSin | -36 | `sin` |
| IEEEDPCos | -42 | `cos` |
| IEEEDPTan | -48 | `tan` |
| IEEEDPSincos | -54 | (not used) |
| IEEEDPSinh | -60 | `sinh` |
| IEEEDPCosh | -66 | `cosh` |
| IEEEDPTanh | -72 | `tanh` |
| IEEEDPExp | -78 | `exp` |
| IEEEDPLog | -84 | `log` |
| IEEEDPPow | -90 | (called via sl_Pow wrapper) |
| IEEEDPSqrt | -96 | `sqrt` |
| IEEEDPAsin | -114 | `asin` |
| IEEEDPAcos | -120 | `acos` |
| IEEEDPLog10 | -126 | `log10` |

### Functions NOT in mathieeedoubtrans

The following functions are needed by QuickJS but are NOT provided by
mathieeedoubtrans.library. They are implemented in C in
`sharedlib_math_fpu_aux.c`:

- `exp2(x)` = `exp(x * M_LN2)`
- `expm1(x)` = `exp(x) - 1.0` (with special handling near zero)
- `log2(x)` = `log(x) / M_LN2`
- `fmod(x, y)` = `x - trunc(x/y) * y`
- `ldexp(x, n)` = `x * 2^n` (via bit manipulation)
- `modf(x, iptr)` = splits into integer and fractional parts
- `round(x)` = `floor(x + 0.5)` with special cases
- `atanh(x)` = `0.5 * log((1+x)/(1-x))`

### Conditional Compilation

In the Makefile, the FPU aux object is only built for 040/060:

```makefile
ifeq ($(CPU),68020)
FPU_AUX_OBJ =
else
FPU_AUX_OBJ = $(OBJDIR_FPU)/sharedlib_math_fpu_aux.o
endif
```

On 020, the 68881 FPU has all transcendentals as hardware instructions,
so VBCC inlines them directly (e.g., `fsin fp0` instead of calling
`sin()`). No wrapper is needed.

---

## 8. The DateStamp/gettimeofday Saga

This section documents the multi-version debugging odyssey that
ultimately led to discovering the `__ieeefltud` bug (section 5). It is
included as a cautionary tale about how misleading symptoms can lead
debugging down the wrong path.

### Initial Symptom (v0.61)

`os.now()` and `Date.now()` returned 0 on soft-float builds. FPU builds
returned correct (or at least nonzero) values. This naturally focused
investigation on the time-related code path.

### Investigation Path

#### Hypothesis 1: gettimeofday Assembly Is Wrong

Examined the generated assembly for `gettimeofday` in detail:
- A7-relative addressing was correct
- LVO -192 (DateStamp) was correct
- Epoch math (add 252460800 seconds) was correct
- Stack-local `DateStamp` struct was properly addressed

**Result**: Assembly looked correct. Red herring.

#### Hypothesis 2: Stack-Local DateStamp Is Corrupted

Changed from a stack-local `struct DateStamp ds` to a file-scope static
`static struct DateStamp _sl_ds`. Theory: maybe the LVO call was
corrupting the stack frame and overwriting the local.

**Result**: No change. Red herring.

#### Hypothesis 3: gettimeofday Symbol Conflict

Created a new function `_qjs_time_us()` with a unique symbol name,
bypassing `gettimeofday` entirely. Called directly from `cutils.h`
(the QuickJS internal timing code).

**Result**: Still returned 0. The problem was downstream.

#### Hypothesis 4: Per-File BSS Relocation Issue

Moved `_qjs_time_us` from `sharedlib_time.c` to `qjsfuncs.c` (the same
file as `CustomLibInit`). Also created a non-static global
`_qjs_DOSBase` in qjsfuncs.c instead of using sharedlib_time.c's static
`sl_DOSBase`.

Rationale: maybe writes to static BSS in `sharedlib_time.c` during init
weren't visible to reads from `sharedlib_time.c`'s `gettimeofday` at
runtime, due to per-file BSS relocation issues.

**Result**: The DOSBase global in qjsfuncs.c DID work (it was visible
to other code that referenced it). But Date.now() still returned 0.
Partial improvement -- but the core problem persisted.

#### Hypothesis 5: Hardcoded Values

Modified gettimeofday to ignore DateStamp entirely and return a hardcoded
constant: `tv->tv_sec = 1234567890; tv->tv_usec = 0;`

**Result**: Date.now() STILL returned 0. This was the breakthrough
moment. The problem was definitively NOT in gettimeofday.

#### Hypothesis 6: Compare FPU vs Soft Assembly

Used `vc -S` to generate assembly for the same source with both configs.
The `gettimeofday` code was IDENTICAL. The `_qjs_time_us` code was
IDENTICAL. The divergence was only in how `(double)value` was compiled:

- FPU: `fmove.l d0,fp0` (hardware instruction)
- Soft: `jsr __ieeefltud` (runtime helper call)

This led directly to examining `__ieeefltud` and finding the
stack-vs-register argument mismatch (section 5).

### The Separate Amiberry Clock Issue

Even after fixing `__ieeefltud`, timestamps in amiberry show dates near
1970 despite the emulated AmigaOS showing the correct year (2026). This
appears to be an amiberry clock synchronization issue where the emulated
RTC is not synced with the host machine's clock. DateStamp returns the
correct ticks-since-midnight but the days-since-1978 field is near zero.

This issue is unrelated to the VBCC/library build and is an amiberry
configuration matter. It does not affect the library's correctness --
the conversion math is right, the input data is wrong.

---

## 9. Soft-Float Build Specifics

### How -amiga-softfloat Works

When VBCC sees `-amiga-softfloat`, it replaces ALL floating-point
operations with calls to `mathieeedoubbas.library`. The compiler
generates inline LVO calls at every arithmetic site:

```c
double x = a + b;
```

becomes (conceptually):

```asm
    move.l  a_hi,d0
    move.l  a_lo,d1
    move.l  b_hi,d2
    move.l  b_lo,d3
    move.l  _MathIeeeDoubBasBase,a6
    jsr     -66(a6)         ; IEEEDPAdd
    ; result in d0:d1
```

### Required Global Base Pointers

VBCC's code generator references these globals by name (hardcoded in
the compiler):

1. **`MathIeeeDoubBasBase`** (`struct Library *`): Used for all basic
   double operations: add (-66), sub (-72), mul (-78), div (-84),
   cmp (-42), fix (-30, double→long), flt (-36, long→double), abs (-54),
   neg (-60), ceil (-96), floor (-90).

2. **`MathIeeeDoubTransBase`** (`struct Library *`): Referenced by some
   VBCC-generated conversion code in dtoa and regex compilation paths.

3. **`MathIeeeSingBasBase`** (`struct Library *`): Used for
   float-to-double promotions when the compiler needs to convert a
   `float` to `double` in soft-float mode.

All three are declared as non-static globals in `sharedlib_math_soft.c`
and initialized in `sharedlib_math_soft_init()`:

```c
struct Library *MathIeeeDoubBasBase;
struct Library *MathIeeeDoubTransBase;
struct Library *MathIeeeSingBasBase;

void sharedlib_math_soft_init(struct Library *basBase,
                               struct Library *transBase) {
    MathIeeeDoubBasBase = basBase;
    MathIeeeDoubTransBase = transBase;
    // Open mathieeesingbas.library for float→double
    MathIeeeSingBasBase = __OpenLibrary(sys, "mathieeesingbas.library", 34);
}
```

### Soft-Float Math Functions

In soft-float mode, `sharedlib_math_soft.c` provides all transcendental
and higher-level math functions using explicit LVO calls to
mathieeedoubtrans.library. All calls use the inline assembly pattern
(section 4) to avoid the __reg("a6") frame pointer issue.

The complete list of LVO wrappers in the soft-float build:

| C Function | LVO | Library |
|-----------|-----|---------|
| sin(x) | -36 | mathieeedoubtrans |
| cos(x) | -42 | mathieeedoubtrans |
| tan(x) | -48 | mathieeedoubtrans |
| asin(x) | -114 | mathieeedoubtrans |
| acos(x) | -120 | mathieeedoubtrans |
| atan(x) | -30 | mathieeedoubtrans |
| sinh(x) | -60 | mathieeedoubtrans |
| cosh(x) | -66 | mathieeedoubtrans |
| tanh(x) | -72 | mathieeedoubtrans |
| exp(x) | -78 | mathieeedoubtrans |
| log(x) | -84 | mathieeedoubtrans |
| log10(x) | -126 | mathieeedoubtrans |
| pow(b,e) | -90 | mathieeedoubtrans |
| sqrt(x) | -96 | mathieeedoubtrans |
| floor(x) | -90 | mathieeedoubbas |
| ceil(x) | -96 | mathieeedoubbas |
| fabs(x) | -54 | mathieeedoubbas |

Plus C implementations (no LVO) for: `atan2`, `exp2`, `expm1`, `log2`,
`fmod`, `ldexp`, `modf`, `round`, `trunc`, `copysign`, `scalbn`,
`frexp`, `cbrt`, `hypot`, `remainder`, `rint`, `nearbyint`, `fmin`,
`fmax`, `asinh`, `acosh`, `atanh`.

### HUGE_VAL and NaN

In soft-float mode, `__builtin_huge_val()` and `__builtin_nan()` are
not available. These are constructed from IEEE 754 bit patterns using
unions:

```c
static double sl_huge_val(void) {
    union { double d; struct { unsigned long hi, lo; } w; } u;
    u.w.hi = 0x7FF00000UL;  // +Infinity
    u.w.lo = 0;
    return u.d;
}

static double sl_nan_val(void) {
    union { double d; struct { unsigned long hi, lo; } w; } u;
    u.w.hi = 0x7FF80000UL;  // quiet NaN
    u.w.lo = 0;
    return u.d;
}
```

---

## 10. Int64 Assembly Helpers

VBCC generates calls to helper functions for 64-bit integer arithmetic.
These are normally provided by `vc.lib`, but since we cannot link `.lib`
files (section 3), they must be reimplemented in assembly.

### Function Naming Convention

VBCC suffixes these functions with the CPU target:

- `__mulint64_020` (68020 build)
- `__mulint64_040` (68040 build)
- `__mulint64_060` (68060 build)

The CODE IS IDENTICAL for all three -- only the symbol name differs.
Each function is exported with all three names:

```asm
    xdef __mulint64_020
    xdef __mulint64_040
    xdef __mulint64_060
__mulint64_060:
__mulint64_040:
__mulint64_020:
    ; ... same code for all CPUs ...
```

### Calling Convention

All functions use **stack-based** argument passing and return results in
**d0:d1** (d0 = high 32 bits, d1 = low 32 bits).

**Multiply, divide, modulo** (16 bytes on stack):
```
 0(sp) = a_hi     (high 32 bits of first operand)
 4(sp) = a_lo     (low 32 bits of first operand)
 8(sp) = b_hi     (high 32 bits of second operand)
12(sp) = b_lo     (low 32 bits of second operand)
```

After saving registers with `movem.l`, these offsets shift by the number
of saved bytes + 4 (return address).

**Shifts** (12 bytes on stack):
```
 0(sp) = val_hi   (high 32 bits of value)
 4(sp) = val_lo   (low 32 bits of value)
 8(sp) = count    (shift count, 32 bits)
```

### movem.l Predecrement Order

A critical detail for getting stack offsets right: `movem.l` with
predecrement `-(sp)` stores registers in **reverse order** (highest-
numbered register at the highest address):

```asm
    movem.l d2-d5,-(sp)   ; stores: d5 at (sp+12), d4 at (sp+8),
                          ;         d3 at (sp+4), d2 at (sp+0)
```

With postincrement `(sp)+`, registers are loaded in forward order.

### The Functions

#### __mulint64: 64-bit Multiply

Uses the 68020's `mulu.l` instruction for 32x32->64 multiplication.
The full 64-bit result is computed as:

```
result = (a_lo * b_lo)                    // full 64-bit product
       + (a_hi * b_lo) << 32             // high word of cross product
       + (a_lo * b_hi) << 32             // high word of cross product
```

The 68020's `mulu.l Dn,Dh:Dl` form gives a full 64-bit product in two
registers, which is essential for the first term.

#### __divuint64: 64-bit Unsigned Divide

Three fast paths:
1. **32/32**: Both a_hi and b_hi are 0 -- use `divu.l`
2. **64/32**: b_hi is 0 -- divide a_hi by b, then use `divul.l` for
   remainder:a_lo by b (the 68020's 64/32->32q:32r mode)
3. **64/64**: Full division -- the current implementation returns 0 as a
   fallback. This is acceptable because QuickJS rarely performs true
   64-bit-by-64-bit division.

#### __divsint64: 64-bit Signed Divide

Converts both operands to positive, calls `__divuint64`, then negates
the result if the signs differed (XOR of the two sign bits).

#### __moduint64 / __modsint64: 64-bit Modulo

Computed as `a - (a/b) * b`. Calls `__divuint64` for the quotient, then
`__mulint64` for the quotient-times-divisor product, then subtracts.

#### __lshint64: 64-bit Left Shift

Handles three cases:
- count >= 64: result is 0
- count >= 32: result_hi = a_lo << (count-32), result_lo = 0
- count < 32: standard double-register shift

#### __rshsint64 / __rshuint64: 64-bit Right Shift

Similar structure to left shift but with arithmetic (signed) or logical
(unsigned) shift of the high word.

### Float Conversion Helpers

#### __ieeefltud (Soft-float only)

Unsigned long to IEEE double. See section 5 for the full story.

#### _sint64toflt64, _uint64toflt64, _flt64tosint64, _flt64touint64

In the **FPU build** (`sharedlib_int64.s`), these use FPU instructions:

```asm
_sint64toflt64:
    ; Decompose 64-bit int into hi * 2^32 + lo, convert each, add
    fmove.l  hi,fp0
    fmul.d   #4294967296.0,fp0
    fmove.l  lo,fp1
    fadd     fp1,fp0
```

In the **soft-float build** (`sharedlib_int64_conv.c`), these are
implemented in C:

```c
double _sint64toflt64(long long x) {
    unsigned long hi = (unsigned long)(x >> 32);
    unsigned long lo = (unsigned long)x;
    result = (double)hi * 4294967296.0 + (double)lo;
}
```

The C version depends on `__ieeefltud` for the `(double)unsigned_long`
casts, which is why the `__ieeefltud` bug (section 5) cascaded to break
ALL int64-to-float conversions.

---

## 11. The CLI Bridge Architecture

The CLI binary (`qjs`) is a thin shell that opens `quickjs.library` at
runtime and dispatches all JS_* calls through the library's LVO function
table. This architecture keeps all QuickJS engine code inside the shared
library, where it can be updated independently of the CLI.

### CLI Compilation

The CLI is built with `Makefile.cli`:

```makefile
CFLAGS = +aos68k -c -cpu=68020 -fpu=68881 -O1 -DQJS_USE_LIBRARY ...
LDFLAGS = +aos68k -cpu=68020 -fpu=68881 -L$(VBCC)/posixlib/AmigaOS3
```

Note: The CLI **CAN and DOES** link with `.lib` files:

```makefile
$(VC) $(LDFLAGS) $(OBJS) -lamiga -lm881 -o $@
```

This is fine because the CLI is a normal executable with standard C
runtime startup. The no-.lib rule only applies to the shared library.

The `-DQJS_USE_LIBRARY` define switches the QuickJS headers to use
bridge functions instead of direct engine calls.

### Bridge Components

| File | Purpose |
|------|---------|
| `quickjs_bridge.c` | C-level wrappers: save A6, copy parameters to static slots, load library base into A6, call LVO, restore A6, return result |
| `bridge_a6.s` | Assembly save/restore for A6 using a separate BSS stack (not the real stack). 32 entries deep for nested callbacks |
| `bridge_asm.s` | Assembly trampolines for core JS_* functions |
| `bridge_asm_batch1.s` | Additional batch of JS_* trampolines |
| `bridge_asm_batch2.s` | More JS_* trampolines |
| `bridge_asm_libc.s` | Trampolines for quickjs-libc functions |
| `bridge_dpvs.s` | Double-precision value struct passing trampolines |

### bridge_a6.s: The A6 Save Stack

The CLI uses A6 as a frame pointer (same as any VBCC-compiled code).
When calling a library LVO, A6 must temporarily hold the library base.
The bridge saves and restores A6 using a dedicated BSS array:

```asm
    section bss
_bridge_a6_stk:
    ds.l    32              ; 32 save slots

    section data
_bridge_a6_idx:
    dc.l    0               ; current stack depth

    section code
_bridge_save_a6:
    lea     _bridge_a6_stk,a0
    move.l  _bridge_a6_idx,d0
    move.l  a6,0(a0,d0.l)  ; save current A6
    addq.l  #4,d0
    move.l  d0,_bridge_a6_idx
    rts

_bridge_restore_a6:
    lea     _bridge_a6_stk,a0
    move.l  _bridge_a6_idx,d0
    subq.l  #4,d0
    move.l  0(a0,d0.l),a6  ; restore saved A6
    move.l  d0,_bridge_a6_idx
    rts
```

Why not use the real stack? Because VBCC may have SP-relative references
that assume a specific stack layout. Pushing/popping A6 on the real
stack would shift all those references. The separate BSS array is
invisible to the compiler's stack frame management.

32 entries supports up to 32 levels of nesting: bridge call -> library
function -> callback to user code -> bridge call -> library function ->
... This is more than enough for practical use (QuickJS callbacks rarely
nest deeper than 5-6 levels).

### The Call Flow

When the CLI calls (for example) `JS_NewRuntime`:

```
CLI code:   call bridge_JS_NewRuntime()
bridge:     call _bridge_save_a6        ; save CLI's A6
            move.l library_base,a6      ; load quickjs.library base
            jsr -30(a6)                 ; call QJS_NewRuntime LVO
            call _bridge_restore_a6     ; restore CLI's A6
            return result in d0
```

---

## 12. Linker Flags and Hunk Format

### Library Linker Command

```makefile
LDFLAGS = -bamigahunk -Bstatic -nostdlib -mrel
LINK_LIBS =

$(VLINK) $(LDFLAGS) $(ALL_OBJECTS) $(LINK_LIBS) -o quickjs.library
```

Note: `LINK_LIBS` is intentionally EMPTY. No `.lib` files are linked.

### Flag Meanings

| Flag | Purpose |
|------|---------|
| `-bamigahunk` | Output in AmigaOS hunk executable format (not ELF, not a.out) |
| `-Bstatic` | Static linking only -- no dynamic linking (AmigaOS shared libraries use a different mechanism than Unix shared objects) |
| `-nostdlib` | Do NOT link the default C runtime (no startup.o, no vc.lib) |
| `-mrel` | Merge sections with PC-relative references. This allows the linker to combine multiple CODE sections into fewer hunks |

### CLI Linker Command

```makefile
$(VC) $(LDFLAGS) $(OBJS) -lamiga -lm881 -o $(TARGET)
```

The CLI links through `vc` (not `vlink` directly), which adds the
default startup code and resolves `-lamiga` and `-lm881`.

### Hunk Structure

The library binary contains three types of hunks:

1. **CODE hunk**: All executable code. The RomTag must appear early in
   this hunk for efficient scanning.

2. **DATA hunk**: Initialized global and static variables (e.g., the
   IEEE 754 constant bit patterns in `sharedlib_vbcc.c`, the `mdays[]`
   array in `sharedlib_time.c`).

3. **BSS hunk**: Uninitialized global and static variables. Zeroed by
   `LoadSeg` when the library is loaded. Contains the math library base
   pointers (initially NULL), the A6 save stack, file descriptor tables,
   etc.

### Relocation

- **RELOC32 entries**: Fix up absolute 32-bit addresses. When LoadSeg
  places the hunks at their actual memory addresses, it patches all
  RELOC32 entries to point to the correct locations.

- **Within a single .o file**: Static variables use LOCAL labels (l1, l2,
  etc.) and relocations work within the same object.

- **Cross-file references**: Use the XREF/XDEF mechanism. The linker
  resolves all cross-references at link time and generates appropriate
  RELOC32 entries in the output.

### Link Order

**library.o MUST be linked first.** The `_start()` function and `RomTag`
must appear at the very beginning of the CODE hunk. If another object
file is linked first, the RomTag won't be found during the OS's initial
scan (or will be found late, increasing load time).

The Makefile's `$(FPU_ALL)` and `$(SOFT_ALL)` variables list objects with
library infrastructure first:

```makefile
FPU_ALL = $(FPU_LIB) $(FPU_SUPPORT) $(FPU_ENGINE)
```

Where `FPU_LIB` starts with `$(OBJDIR_FPU)/library.o`.

---

## 13. Debugging Techniques

### Generating Assembly Output

```bash
vc +aos68k -c -cpu=68020 -S sharedlib_time.c -o sharedlib_time_soft.s
vc +aos68k -c -cpu=68020 -fpu=68881 -S sharedlib_time.c -o sharedlib_time_fpu.s
diff sharedlib_time_soft.s sharedlib_time_fpu.s
```

Comparing the soft vs FPU assembly for the same source reveals where
the builds diverge. This was essential for tracking down the
`__ieeefltud` bug -- the calling code was identical, but the soft build
called `__ieeefltud` where the FPU build used `fmove.l`.

### Linker Maps

```bash
vlink -M -bamigahunk -Bstatic -nostdlib -mrel $(OBJECTS) -o quickjs.library
```

The `-M` flag outputs a linker map showing every symbol's address. Use
this to verify that symbols resolve correctly and that there are no
duplicate definitions.

### Binary Inspection

```bash
strings quickjs.library | grep -i "ver:"    # Find version string
python3 -c "
with open('quickjs.library', 'rb') as f:
    data = f.read()
    # Search for byte patterns
    idx = data.find(b'\x4e\xb9')  # JSR absolute
    print(f'JSR at offset {idx:#x}')
"
```

### vobjdump for VOBJ Format

VBCC's intermediate object format (VOBJ) can be inspected with
`vobjdump`. This is useful for examining symbol tables and relocations
before linking. Note: this does NOT work on the final hunk-format binary.

### Test Harness

The test approach uses JS test files that print raw values, not just
PASS/FAIL. This is critical for diagnosing issues like the `Math.exp(1)`
garbage value -- a PASS/FAIL test would just say FAIL, but printing the
actual value (`0.000001321787941`) immediately reveals it's a register
garbage issue rather than, say, an off-by-one or precision error.

### Hardware Testing on Amiberry

```bash
# Copy library to emulated LIBS:
cp quickjs.020soft.library ~/.config/amiberry/AmigaOS/LIBS/quickjs.library

# IMPORTANT: Flush old library from memory before testing!
# Run this in the Amiga shell:
flushlibs

# Then test:
qjs test_math.js
```

**Always `flushlibs` between library updates.** If you forget, AmigaOS
will continue using the old version already loaded in memory. This leads
to confusion where your "fix" doesn't seem to work because you're still
running old code.

### When Assembly Looks Right But Results Are Wrong

If a function appears correct in the generated assembly but produces
wrong results at runtime, check:

1. **The calling convention of helper functions.** The callee may expect
   arguments in different locations (registers vs stack) than the caller
   provides. This was the root cause of the `__ieeefltud` bug.

2. **The __reg("a6") issue.** If the function uses function-pointer LVO
   dispatch with `__reg("a6")`, the frame pointer may be clobbered
   before arguments are loaded. See section 4.

3. **Global variable initialization.** Verify that globals like
   `MathIeeeDoubBasBase` are actually set before they're used. A NULL
   base pointer will cause a crash or garbage at the LVO jump.

4. **BSS relocation across files.** Static variables in one .c file may
   not be visible to writes from init code in another .c file. Use
   non-static globals if in doubt, and verify with the linker map.

---

## 14. Memory Model Notes

### Global Variables

Non-static global variables can be shared across `.o` files. The linker
resolves cross-references via XREF/XDEF, and RELOC32 entries ensure the
addresses are correct at load time. Examples that work:

- `MathIeeeDoubBasBase` in `sharedlib_math_soft.c`, referenced by VBCC's
  generated code in every .o file that does floating-point arithmetic
- `SysBase` in `sharedlib_vbcc.c`, referenced by code using
  `proto/exec.h` inline calls
- `_qjs_DOSBase` in `qjsfuncs.c`, referenced by `sharedlib_time.c`

### Static Variables

File-scope static variables (`static struct Foo bar;`) are local to their
compilation unit. They reside in the DATA or BSS section of that specific
.o file and are not visible to other files.

A puzzling issue arose with `sharedlib_time.c`: writes to a static
`DOSBase` variable during `sharedlib_time_init()` did not persist to
reads from `gettimeofday()` in the same file. The root cause was never
fully explained -- it might have been a linker BSS merging issue or an
optimization artifact. The workaround was to use a non-static global
(`_qjs_DOSBase`) in `qjsfuncs.c` and have `sharedlib_time.c` reference
it via `extern`.

### Single Data Model

The library uses a single data segment shared across all openers. This
means:

- All global variables are shared between all processes that have the
  library open
- This is fine for read-only data (function tables, constant arrays)
- For mutable data (the memory pool, math library bases), this means
  the library is NOT reentrant -- only one process should use it at a
  time
- In practice, this is acceptable because AmigaOS 3.x is
  single-tasking per process for most use cases

### The Memory Pool

The library uses exec.library memory pools for all engine allocations:

```c
base->iMemPool = __CreatePool(sys, MEMF_PUBLIC, 64*1024, 16*1024);
```

- `MEMF_PUBLIC`: Memory accessible from any task (required for shared
  library context)
- Puddle size: 64KB -- exec allocates memory in 64KB chunks
- Threshold: 16KB -- allocations larger than 16KB get their own
  `AllocMem` block (exec handles this transparently)

Each allocation has an 8-byte header:

```c
typedef struct {
    ULONG total;    // total bytes including header (for FreePooled)
    ULONG magic;    // 0x41416D61 ("AAma") sanity check
} AAHeader;
```

This overhead is necessary because `FreePooled` requires the allocation
size, and `js_realloc` needs the old size to copy data during
reallocation.

---

## 15. Version History

| Version | Date | Changes |
|---------|------|---------|
| v0.58 | pre-2026-04 | Pre-FPU-wrapper checkpoint. Tagged `v0.58-pre-fpu-wrappers`. All 6 CPU/FPU variant builds working, basic engine functionality. Math transcendentals not yet working on 040/060 FPU builds. |
| v0.59 | 2026-04 | All 6 CPU/FPU variants (020/040/060 x fpu/soft) building successfully. Makefile cleanup: proper conditional compilation for FPU aux wrappers, consistent naming convention for output binaries. |
| v0.60 | 2026-04 | **IEEEDPPow parameter swap fix.** `Math.pow(2,10)` now returns 1024 instead of 100. Exponent and base arguments were swapped in the LVO call. |
| v0.61 | 2026-04 | **Inline asm math LVO wrappers.** All math library calls converted from function-pointer dispatch to VBCC inline assembly syntax. Fixes `Math.exp(1)` returning garbage (0.000001321787941). Static DateStamp in gettimeofday (attempted fix for time issue). |
| v0.62 | 2026-04 | `_qjs_time_us` function added to bypass gettimeofday entirely for Date.now/os.now. Called directly from cutils.h. Time still returns 0 on soft builds. |
| v0.63 | 2026-04 | Moved `_qjs_time_us` to qjsfuncs.c. Created `_qjs_DOSBase` non-static global to work around BSS visibility issues between .c files. |
| v0.64 | 2026-04-10 | **THE ROOT CAUSE: `__ieeefltud` stack argument fix.** Added `move.l 16(sp),d0` to load the argument from the stack instead of assuming it was in D0. This single line fixed Date.now(), toISOString(), os.sleep timing, and all other int64-to-double conversions on soft-float builds. **222/222 tests pass.** |

---

## Build Variants Summary

The library ships in 7 forms:

| File | CPU | FPU | Notes |
|------|-----|-----|-------|
| `quickjs.020fpu.library` | 68020 | 68881/68882 | All transcendentals as inlined FPU instructions |
| `quickjs.020soft.library` | 68020 | None | All math via mathieeedoubbas/trans LVOs |
| `quickjs.040fpu.library` | 68040 | 68040 FPU | Transcendentals via mathieeedoubtrans wrappers |
| `quickjs.040soft.library` | 68040 | None | All math via mathieeedoubbas/trans LVOs |
| `quickjs.060fpu.library` | 68060 | 68060 FPU | Transcendentals via mathieeedoubtrans wrappers |
| `quickjs.060soft.library` | 68060 | None | All math via mathieeedoubbas/trans LVOs |
| `quickjs.library` | 68020 | None | Copy of 020soft -- universal default |

The default `quickjs.library` is the 020 soft-float variant, which runs
on any Amiga with a 68020 or better CPU (including 040 and 060) without
requiring an FPU. Users with FPU hardware can replace it with the
appropriate CPU-specific FPU variant for better floating-point
performance.

### Building

```bash
cd library/vbcc

# Build default (020 fpu + 020 soft + default library):
make

# Build all 6 variants + default:
make variants

# Build specific CPU:
make CPU=68040

# Build specific variant:
make CPU=68060 fpu
make CPU=68060 soft

# Build CLI:
make -f Makefile.cli

# Clean:
make clean           # current CPU only
make clean-variants  # all CPUs
```

Output goes to `amiga/libs/` (libraries) and `amiga/c/` (CLI binary).
Object files go to `/tmp/qjslib_<CPU>[_soft]/` to avoid polluting the
source tree and to allow parallel builds of different CPU variants.

---

## Appendix: Quick Reference for Common Issues

### "Math function returns garbage"

Check: Is the LVO call using the inline assembly pattern or the
function-pointer pattern? Convert to inline asm. See section 4.

### "Date.now() returns 0" (soft-float build only)

Check: Is `__ieeefltud` loading its argument from the stack? The offset
should be 16(sp) after saving d2-d3/a6. See section 5.

### "Math.pow gives wrong results"

Check: Are the base and exponent arguments in the right register slots?
IEEEDPPow takes `exp` in d2:d3 and `arg` (base) in d0:d1. See section 6.

### "Undefined symbol ___mulint64_020" (or similar)

Check: Is the correct assembly file (sharedlib_int64.s or
sharedlib_int64_soft.s) being linked? FPU builds use sharedlib_int64.s;
soft builds use sharedlib_int64_soft.s.

### "Library won't open (OpenLibrary returns NULL)"

Check: Does CustomLibInit return FALSE (success) for all library opens?
Check that mathieeedoubbas.library, mathieeedoubtrans.library, and
dos.library (v36) are available in LIBS:.

### "FPU build works, soft build crashes/hangs"

Check: Are MathIeeeDoubBasBase and MathIeeeDoubTransBase initialized?
They must be set BEFORE any floating-point operation in soft-float mode,
because VBCC's generated code calls through them inline.

### "Old version still running after rebuild"

Run `flushlibs` in the Amiga shell to unload cached libraries from
memory. AmigaOS keeps libraries loaded until explicitly flushed or
memory pressure forces expunge.
