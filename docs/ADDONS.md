# Add-ons for quickjs.library

An add-on adds modules to QuickJS on the Amiga without rebuilding the
library. It is one or two files in `LIBS:quickjs/`:

    LIBS:quickjs/<name>.qjsb        modules written in JavaScript, as bytecode
    LIBS:quickjs/<name>.library     modules written in C (designed, not yet built: see below)

Bytecode add-ons work today and are tested (`amiga/tests/test_qjsb.js`
with the add-on in `amiga/tests/addons/hello/`). Native add-ons are
specified in the second half of this document but **the loader for them
is not implemented**; nothing in the library opens a `<name>.library`
yet.

## Importing from an add-on

| A script writes | The library loads |
|---|---|
| `import fs from 'node:fs'` | module `fs` of `LIBS:quickjs/node.qjsb` |
| `import x from 'node:fs/promises'` | module `fs/promises` of `LIBS:quickjs/node.qjsb` |
| `import h from 'qjs:hello'` | module `@main` of `LIBS:quickjs/hello.qjsb` |
| `import * as std from 'qjs:std'` | built in (also `qjs:os`, `qjs:bjson`, `qjs:net`); no file |
| `import a from 'Work:lib/a.js'` | the file, as before |
| `import a from './a.js'` | the file, relative to the importer, as before |

The rules, in the order the loader applies them
(`library/vbcc/qjsb_modules.c`):

1. A specifier without a colon, or ending in `.js`, `.mjs` or `.json`,
   is a file path.
2. `qjs:<name>` that is not built in is the main module of the add-on
   `<name>`. If there is no `<name>.qjsb` the import fails; `qjs:` is
   never taken as a volume.
3. `<scheme>:<rest>`, where `<scheme>` consists of letters, digits, `_`,
   `-` and `.` (at most 30): if `<scheme>.qjsb` exists, the specifier
   belongs to that add-on and `<rest>` must be one of its modules;
   otherwise it is a file path (`Work:lib/a`).

Rule 3 means an add-on's name shadows a volume or assign of the same
name for imports. It also costs one failed `Open` in `LIBS:quickjs/`
for an import that names a volume and does not end in `.js`; write the
extension and there is none. The add-on is asked first because asking
AmigaDOS for `node:fs` would put up "Please insert volume node:".

The directory is `LIBS:quickjs/`, preceded by the one the local shell
variable `QJSB_DIR` names, if set (docs/QJSB-FORMAT.md, "Where the
files are looked for").

Inside an add-on, modules import each other by their full specifiers:
`import { x } from 'hello:util'`. A relative import is resolved against
the importer's name as if that were a path, which is right by accident
from `hello:a` (`./util` becomes `hello:util`) and wrong from the main
module (`qjs:hello` makes it `qjs:util`); do not rely on it.

A module is loaded once per context, whoever imports it, and
`import.meta.url` in it is its specifier.

## Building a bytecode add-on

On the Mac, with the host `qjsc` built
(`cmake -S quickjs-master -B quickjs-master/build && make -C quickjs-master/build qjsc`):

    python3 scripts/qjsb.py compile hello.qjsb --version 1.0 \
        --main main.js util=util.js
    python3 scripts/qjsb.py list hello.qjsb

- `--main FILE.js` is the module `qjs:hello`; `NAME=FILE.js` is the
  module `hello:NAME`. The add-on's name is the output file's name.
- `--version N.N` and `--date D.M.YYYY` (default: today) go into the
  file's version string, `$VER: hello.qjsb 1.0 (14.11.2026)`, which
  `version file LIBS:quickjs/hello.qjsb` and `qjs -v` print.
- `--min-library N` is the oldest `quickjs.library` that may load it,
  as the library's version number (`240` for 0.240). The default is the
  version of the tree the tool runs in.

Copy the result to `LIBS:quickjs/` on the Amiga.

Each module is compiled under the specifier it will be imported by,
because that name is recorded in the bytecode and is how the engine
knows a module it has already loaded. Renaming `hello.qjsb` therefore
does not rename the add-on: the library refuses a module recorded under
another name, and says which.

### What an add-on is tied to

An add-on is tied to the **bytecode format**, not to a library version.
The library refuses it when the engine's bytecode version or its atom
and opcode lists differ from what the add-on was compiled against (the
"engine stamp" of docs/QJSB-FORMAT.md), or when the library is older
than the add-on's `--min-library`. A library update that leaves the
bytecode format alone keeps every add-on working; one that changes it
makes every add-on fail with a message naming the file and both
bytecode stamps, and the add-ons are then compiled again with the new
tree's `qjsc`. (The library's own three files are stricter: they are
for exactly one library version.)

`python3 scripts/qjsb.py verify hello.qjsb` tells whether a file fits
the tree it is run in.

## A Node-style module set

The scheme rule is what will carry a Node, Bun or Deno compatible set:
one file `LIBS:quickjs/node.qjsb` whose modules are named `fs`, `path`,
`fs/promises`, ..., built with

    python3 scripts/qjsb.py compile node.qjsb --version 0.1 \
        fs=fs.js path=path.js fs/promises=fs_promises.js

and imported as `node:fs`. Native help, if it needs any, would come
from `node.library` as described next.

## Native add-ons (design; not implemented)

This section defines the interface so that add-ons can be written
against it once the loader exists. It has not been built or run; treat
every detail as a proposal until an example add-on has passed under
vamos and on an Amiga.

### Finding and opening

`import x from 'native:<name>'` asks for the native add-on `<name>`.
(A bytecode add-on that has a native half imports it this way from its
own modules; scripts normally import the bytecode module.) The library
calls

    OpenLibrary("quickjs/<name>.library", 0)

which exec resolves against `LIBS:` (and the program's directory), and
then the add-on's first vector.

### The one vector the library calls

    LVO -30   QJSAddonInit
        A0  JSContext *ctx
        A1  const char *module_name      the specifier, "native:<name>"
        A2  struct Library *QuickJSBase  the library that is calling
        D0  ULONG abi                    QJS_ADDON_ABI of the caller (1)
        returns D0  JSModuleDef *        or NULL with an exception thrown

`QJSAddonInit` creates a C module with `QJS_NewCModule`, declares its
exports with `QJS_AddModuleExport`, and returns it; its module
initialiser sets them with `QJS_SetModuleExport`. It returns NULL,
after throwing through `QJS_Throw...`, if `abi` is one it does not
know. It is called once per context that imports the module, so its
per-context state belongs in the module, not in globals.

### Reaching the engine

The add-on does not link the engine. It calls the `QJS_` vectors of the
`QuickJSBase` it was handed (`library/vbcc/quickjs_lib.sfd`), and keeps
that pointer for its callbacks. It must use the base it was given and
not open `quickjs.library` itself: six variants answer to that name,
and the one in memory is the one whose values it will be passed.

The engine calls the add-on's functions (`JSCFunction`: `JSValue
f(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst
*argv)`) directly, as C functions in vbcc's calling convention, with
A6 undefined. `JSValue` is the 16-byte structure the library is built
with (`-DJS_NAN_BOXING=0`), returned in D0/D1/A0/A1; the add-on must be
compiled with the same definition.

### One build for all six variants

The aim is that a single 68020 build of an add-on works with the FPU
and the soft-float libraries on 68020, 68040 and 68060. That holds if
the add-on **never does floating-point arithmetic and never passes or
returns a `double` by value**:

- compile for 68020 without `-fpu`;
- move numbers in and out of `JSValue`s only through the vectors that
  take a pointer (`QJS_ToFloat64(ctx, &result, &value)`,
  `QJS_ToInt32`, and the `QJS_New...` constructors), never by reading
  the `float64` member and computing with it;
- do arithmetic on integers, or leave it to JavaScript.

A `double` held in memory has the same eight bytes in every variant, so
copying one is safe; only arithmetic and by-value passing differ
between FPU and soft-float code.

### Staying loaded

The functions an add-on exports live as long as the runtime that
imported them, so the library must not close the add-on while such a
runtime exists. The simplest correct rule, and the one proposed: the
library never closes an add-on it has opened; it stays in memory until
the machine is reset. A later refinement can count openers per runtime.

### What is still to be done

- the loader: the `native:` rule in `qjsb_modules.c`, `OpenLibrary`,
  the call to LVO -30 (the existing register trampoline in
  `amiga_ffi_call.s` can make it);
- an include file with the inline stubs for the `QJS_` vectors an
  add-on needs, generated from `quickjs_lib.sfd`;
- an example `hello.library` built with vbcc from
  `vbcc-librarytemplate/`, run under vamos and then on an Amiga for
  all six variants.
