# QuickJS → AmigaOS Port — Project Overview

## Goal
Port QuickJS (Fabrice Bellard's lightweight JavaScript engine) to run on
AmigaOS using SAS/C 6.58.  Binary target: `qjs` (REPL + standalone JS runner).

## Build Environment
- Compiler: SAS/C 6.58 (C89/C90, 32-bit m68k)
- Emulator for testing: vamos with `-C 68040 -m 65536` (64 MB RAM, FPU)
- Key compile flags: `MATH=68881 DATA=FARONLY NOSTACKCHECK NOCHKABORT`
- Key link libs: `sc:lib/scnb.lib sc:lib/scm881nb.lib sc:lib/amiga.lib`
- Source tree: `quickjs-master/`  Build output: `qjs:` (vamos RAM volume)

## Critical SAS/C Constraints Discovered

### 1. `long long` is 32-bit in SAS/C
`typedef long long int64_t` → SAS/C treats as `long` (32-bit).
- `sizeof(int64_t) == 4`, `sizeof(uint64_t) == 4`
- Shifts ≥ 32 bits produce 0 (hardware behaviour, not UB trap)
- **Impact**: ALL 64-bit arithmetic in dtoa.c is silently wrong

### 2. MATH=IEEE + DATA=FARONLY = crash
`scmieee.lib` reads `MathIeeeDoubBasBase` via A4-relative 16-bit offset.
With large data segments (DATA=FARONLY) the variable is beyond ±32 KB from
A4 → reads as 0 → A6=0 → every FP call crashes.
**Fix**: Use `MATH=68881` so all doubles use FPU instructions, no library.

### 3. `__builtin_clz` / `__builtin_clzll`
SAS/C doesn't have GCC builtins.  **Already fixed** in
`amiga/amiga_compat.h` with software implementations.

### 4. JSValue struct layout (JS_NAN_BOXING=0)
typedef struct { JSValueUnion u; int64_t tag; } JSValue;
With 32-bit int64_t: `sizeof(JSValue) == 12` (8-byte union + 4-byte tag).
Works correctly for JS_TAG_INT path (i32toa).

### 5. dtoa.c uint64_t breakage (THE BIG BUG)
`float64_as_uint64(d)` uses `memcpy(&a, &d, sizeof(uint64_t))` → only
copies 4 bytes (hi word).  Then:
- `e = (a >> 52) & 0x7ff` → 0 always (shift by 52 on 32-bit = 0)
- `sgn = a >> 63` → 0 always
- `m = a & ((1<<52)-1)` → a itself (mask = 0xFFFFFFFF)
All float-to-string conversions produce wrong output or hang.

### 6. JSDTOATempMem / JSATODTempMem too small
`uint64_t mem[37]` → with 32-bit uint64_t = 148 bytes instead of 296.
Resolved by the __SASC replacement implementations which don't use tmp_mem.

### 7. vamos RAM volume cleanup
Multiple sequential vamos invocations need ≥2s between them or the RAM
volume conflicts.  Always `rm -rf ~/.vamos/volumes/ram && sleep 2` first.

## Files Modified / Created

| File | Change |
|------|--------|
| `amiga/amiga_compat.h` | `__builtin_clz/ll/ctz/ll` software impls; `JS_NAN_BOXING=0`;
`inline`→`__inline`; `JS_MKVAL`/`JS_MKPTR` as functions; `isnan()` for `JS_VALUE_IS_NAN` |
| `amiga/amiga_compat.c` | Pure-C IEEE 754 math: sqrt, sin, cos, tan, exp, log, pow, etc. —
avoids scmieee transcendentals |
| `amiga/stdint.h` | `typedef long long int64_t` etc. (known broken for >32-bit, but this is
SAS/C's limit) |
| `dtoa.c` | **IN PROGRESS**: Adding `#ifdef __SASC` early-return paths for `js_dtoa_max_len`,
`js_dtoa` (sprintf-based), `js_atod` (strtod-based) |
| `quickjs.h` | `JS_MKVAL`/`JS_MKPTR` as `static inline` functions for C89; `JS_VALUE_IS_NAN`
uses `isnan()` |

## Current Status (end of session)
- `qjs` binary builds and links (955 KB, MATH=68881)
- Integer arithmetic / comparison: believed working
- `print(42)` → "42" ✓ (JS_TAG_INT → i32toa path)
- `Math.sqrt(2)` → WRONG (JS_TAG_FLOAT64 → broken js_dtoa)
- **Fix in progress**: `#ifdef __SASC` sprintf/strtod replacements in dtoa.c

## Next Steps
1. Finish and test dtoa.c `__SASC` wrappers (session was mid-edit)
2. Recompile dtoa.c and relink qjs
3. Test: `qjs -e 'print(Math.sqrt(2))'` → should give `1.4142135623730951`
4. Test basic JS: comparisons, loops, string ops, Math functions
5. Address `termInit` crash on real Amiga (ViNCEd shell):
   - Error: `RangeError: invalid array index at Uint8Array (native) at termInit`
   - Fix: query console window size via CSI escape sequence (code provided by user)
   - See `GetShellSize()` implementation the user provided (AmigaDOS CSI `0 q` / `r` sequence)
6. Create `Makefile.amiga` for reproducible builds
7. Integrate AmiSSL for HTTPS/TLS support
8. Run QuickJS test suite

## Known Remaining Issues
- `%.17g` may not give the *shortest* decimal (JS spec requires shortest
  round-trip).  Functionally correct but may fail strict JS number tests.
  Can improve with a proper 64-bit integer emulation later.
- Large integers ≥ 10^17 may format in exponential notation instead of
  full decimal (JS spec uses full decimal up to 10^21).
- `js_atod` strtod replacement: non-decimal floats (e.g. `0x1.8p+1`) not
  supported — not a real concern since JS source doesn't use them.
- SAS/C stack: use `-s 2048` (2 MB) to avoid overflow with 68881 FPU
  register save frames.

## Build Command Reference
```sh
# Compile a single file (run inside vamos):
sc quickjs.c MATH=68881 DATA=FARONLY NOSTACKCHECK NOCHKABORT \
   IDIR=qjs: IDIR=sc:include OBJDIR=qjs: NOICONS

# Link:
slink sc:lib/c.o qjs:qjs.o qjs:quickjs.o qjs:quickjs-libc.o \
      qjs:libregexp.o qjs:libunicode.o qjs:dtoa.o \
      qjs:amiga/amiga_compat.o qjs:gen/repl.o qjs:gen/standalone.o \
      TO qjs:qjs \
      LIB sc:lib/scnb.lib sc:lib/scm881nb.lib sc:lib/amiga.lib NOICONS

# Run a test:
vamos -C 68040 -m 65536 -s 2048 qjs:qjs -e 'print(Math.sqrt(2))'
