# quickjs.library — QuickJS-ng as an AmigaOS Shared Library

`quickjs.library` exposes the [QuickJS-ng](https://github.com/nickg/quickjs-ng) JavaScript engine (v0.12.1) through the standard AmigaOS shared library mechanism (`OpenLibrary`/`CloseLibrary`). Any Amiga application can embed a full JavaScript interpreter by linking against this library — no need to statically link the 500 KB+ engine into every binary.

## Status

**Work in progress.** The library skeleton is complete (212 functions, FD file, pragmas, protos, test app) but has not yet been compiled and tested on hardware.

## API at a Glance

All library functions use the **`QJS_`** prefix (not the upstream `JS_` prefix) to make the calling convention differences explicit:

```c
#include <proto/quickjs.h>

struct Library *QuickJSBase;

QuickJSBase = OpenLibrary("quickjs.library", 0);
if (QuickJSBase) {
    JSRuntime *rt = QJS_NewRuntime();
    JSContext *ctx = QJS_NewContext(rt);

    JSValue result;
    QJS_Eval(&result, ctx, "2 + 2", 5, "<input>", 0);

    const char *s = QJS_ToCString(ctx, &result);
    printf("Result: %s\n", s);   /* "4" */
    QJS_FreeCString(ctx, s);

    QJS_FreeValue(ctx, &result);
    QJS_FreeContext(ctx);
    QJS_FreeRuntime(rt);
    CloseLibrary(QuickJSBase);
}
```

### Calling Convention Differences from Upstream

JSValue is a 12-byte struct on 68k and cannot be returned in registers through the AmigaOS library jump table. Three rules cover all differences:

1. **JSValue return → output pointer.** Functions that upstream return `JSValue` instead take a `JSValue *result` as their **first** parameter:
   ```c
   /* upstream */  JSValue val = JS_NewString(ctx, "hello");
   /* library  */  JSValue val; QJS_NewString(&val, ctx, "hello");
   ```

2. **JSValueConst parameter → pointer.** Parameters that upstream are `JSValueConst` (pass by value) become `const JSValue *`:
   ```c
   /* upstream */  JS_FreeValue(ctx, val);
   /* library  */  QJS_FreeValue(ctx, &val);
   ```

3. **double parameter → pointer.** The pragma mechanism cannot assign FPU registers, so doubles are passed as `const double *`:
   ```c
   /* upstream */  JSValue n = JS_NewFloat64(ctx, 3.14);
   /* library  */  double d = 3.14; QJS_NewFloat64(&n, ctx, &d);
   ```

All other types (pointers, ints, enums, atoms) are unchanged.

## Function Count: 212

| Category | Count | Examples |
|----------|------:|---------|
| Runtime | 10 | `QJS_NewRuntime`, `QJS_FreeRuntime`, `QJS_RunGC` |
| Context | 7 | `QJS_NewContext`, `QJS_FreeContext`, `QJS_GetRuntime` |
| Intrinsics | 14 | `QJS_AddIntrinsicBaseObjects`, `QJS_AddIntrinsicPromise` |
| Eval | 5 | `QJS_Eval`, `QJS_EvalThis`, `QJS_DetectModule` |
| Value Creation | 15 | `QJS_NewInt32`, `QJS_NewString`, `QJS_NewObject` |
| Value Extraction | 10 | `QJS_ToCString`, `QJS_ToInt32`, `QJS_ToFloat64` |
| Type Checking | 18 | `QJS_IsNumber`, `QJS_IsString`, `QJS_IsException` |
| Value Lifecycle | 4 | `QJS_FreeValue`, `QJS_DupValue` |
| Properties | 16 | `QJS_GetPropertyStr`, `QJS_SetPropertyStr`, `QJS_HasProperty` |
| Object Operations | 8 | `QJS_SetPrototype`, `QJS_FreezeObject` |
| Function Calls | 3 | `QJS_Call`, `QJS_CallConstructor`, `QJS_Invoke` |
| Error Handling | 13 | `QJS_Throw`, `QJS_GetException`, `QJS_ThrowTypeErrorMsg` |
| Atoms | 8 | `QJS_NewAtom`, `QJS_FreeAtom`, `QJS_AtomToString` |
| JSON | 2 | `QJS_ParseJSON`, `QJS_JSONStringify` |
| ArrayBuffer/TypedArray | 8 | `QJS_NewArrayBufferCopy`, `QJS_GetArrayBuffer` |
| Promise | 4 | `QJS_NewPromiseCapability`, `QJS_PromiseState` |
| Module System | 7 | `QJS_NewCModule`, `QJS_LoadModule` |
| C Function Creation | 3 | `QJS_NewCFunction2`, `QJS_NewCFunctionData` |
| Class System | 10 | `QJS_NewClassID`, `QJS_NewClass`, `QJS_SetOpaque` |
| Memory | 6 | `QJS_Malloc`, `QJS_Free`, `QJS_Strdup` |
| Serialization | 2 | `QJS_WriteObject`, `QJS_ReadObject` |
| Job Queue | 2 | `QJS_IsJobPending`, `QJS_ExecutePendingJob` |
| Comparison | 4 | `QJS_IsEqual`, `QJS_IsStrictEqual` |
| std/os Helpers | 8 | `QJS_InitModuleStd`, `QJS_StdLoop`, `QJS_StdDumpError` |
| Misc + Additional | 20 | `QJS_GetVersion`, `QJS_NewProxy`, `QJS_PrintValue` |

Variadic error constructors (`JS_ThrowTypeError(ctx, fmt, ...)`) cannot cross the library boundary. Non-variadic alternatives are provided: `QJS_ThrowTypeErrorMsg(result, ctx, "message")`.

## File Layout

```
library/
├── fd/
│   └── quickjs_lib.fd            FD file (##base _QuickJSBase, ##bias 30)
├── include/
│   ├── clib/
│   │   └── quickjs_protos.h      C prototypes + type definitions
│   ├── pragmas/
│   │   └── quickjs_pragmas.h     #pragma syscall directives (auto-generated)
│   └── proto/
│       └── quickjs.h             Standard AmigaOS proto header
├── libs/
│   └── (quickjs.library)         Built library output (after amiga_build_lib)
├── src/
│   └── quickjs_library.c         212 LIBQJS_* wrapper implementations
├── tests/
│   └── test_quickjs_lib.c        Test app (30+ tests)
└── README.md                     This file
```

## Building

### Prerequisites

- SAS/C 6.58 (via vamos or real Amiga)
- The QuickJS-ng source in `quickjs-master/`
- `bin/amiga-env.sh` sourced in your shell

### Build the Library

```bash
source bin/amiga-env.sh
amiga_build_lib
```

This compiles all QuickJS engine files with `LIBCODE` (shared library code generation), compiles the library wrapper, and links everything into `library/libs/quickjs.library` using `libent.o` startup with `LIBPREFIX LIB`.

The build sequence is:
1. Engine files (`quickjs.c`, `dtoa.c`, `libregexp.c`, etc.) compiled with `LIBCODE MATH=68881 DATA=FARONLY NOSTACKCHECK`
2. Support files (`amiga_compat.c`, `amiga_ssl.c`) compiled with same flags
3. Library wrapper (`quickjs_library.c`) compiled with same flags
4. All linked with `slink` using `libent.o` startup, `LIBPREFIX LIB`, and `LIBFD quickjs_lib.fd`

### Build and Run Tests

```bash
amiga_build_libtest                    # compile + link the test app
amiga_run_libtest test_quickjs_lib     # run under vamos
```

The test app opens `quickjs.library` via `OpenLibrary()`, runs 30+ tests covering eval, value creation, properties, arrays, JSON, atoms, and error handling, then closes the library.

### Deploy on Real Hardware

Copy `library/libs/quickjs.library` to `LIBS:` on your Amiga. Applications using the library will find it there automatically via `OpenLibrary("quickjs.library", 0)`.

### Build Functions Reference

| Function | Description |
|----------|-------------|
| `amiga_build_lib` | Full library build (compile all + link) |
| `amiga_compile_lib FILE` | Compile a `library/src/` file with LIBCODE |
| `amiga_compile_lib_engine FILE` | Compile a `quickjs-master/` file with LIBCODE |
| `amiga_compile_lib_src FILE` | Compile a `src/` file with LIBCODE |
| `amiga_link_lib` | Link all .o files into quickjs.library |
| `amiga_build_libtest` | Build the test application |
| `amiga_compile_libtest FILE` | Compile a `library/tests/` file |
| `amiga_link_libtest OBJ OUT` | Link a test app (pragmas handle dispatch) |
| `amiga_run_libtest TESTBIN` | Run a test under vamos with library in LIBS: |

## Technical Details

### Library Startup

The library uses `libent.o` (shared data model). All openers share the same C data segment. This is safe because QuickJS allocates all runtime state on the heap via `QJS_NewRuntime()` — each opener creates isolated JS environments regardless of the shared data segment.

### Register Convention

Functions use `__asm __saveds` for register-based calling with A4 data segment setup. Parameters are assigned to A0–A3 (pointers) and D0–D7 (integers). The FD file defines the exact register assignment for each function; the pragma file translates these to `#pragma syscall` directives.

### LIBPREFIX

The C implementation uses `LIBQJS_` prefixed names (e.g., `LIBQJS_NewRuntime`). The linker's `LIBPREFIX LIB` option strips the `LIB` prefix, producing external names like `QJS_NewRuntime` that match the FD file and pragmas.

### What Is NOT Exposed

- **Variadic functions** (`JS_ThrowTypeError(ctx, fmt, ...)`) — replaced with `QJS_ThrowTypeErrorMsg(result, ctx, msg)` alternatives
- **`JS_DumpMemoryUsage`** — requires `FILE *` parameter, problematic across library boundary
- **UTF-16 functions** — not useful on classic AmigaOS
- **`JS_NewRuntime2`** — requires complex `JSMallocFunctions` struct, rarely needed

### int64_t Limitation

On SAS/C 6.58, `int64_t` is `long` (32 bits). Functions that upstream use `int64_t` (like `QJS_SetLength`) work correctly but are limited to 32-bit values. This affects BigInt operations and array lengths > 2^31.

## For Library Users

To use `quickjs.library` in your own application:

1. Copy `library/include/` contents to your SAS/C include path (or use `IDIR=`)
2. `#include <proto/quickjs.h>` in your C source
3. Declare `struct Library *QuickJSBase;` as a global
4. Call `OpenLibrary("quickjs.library", 0)` before using any `QJS_*` function
5. Call `CloseLibrary(QuickJSBase)` when done
6. Link with just `amiga.lib` — no QuickJS object files needed (pragmas handle dispatch)

The test application (`library/tests/test_quickjs_lib.c`) is a complete working example.
