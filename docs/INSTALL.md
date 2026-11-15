# Installing QuickJS on an Amiga

Three things are copied; all of them come from the `amiga/` directory
of this repository.

| From | To | What |
|---|---|---|
| `amiga/libs/quickjs.<cpu><fpu>.library` (one of six) | `LIBS:quickjs.library` | the engine |
| `amiga/libs/quickjs/` (the whole drawer) | `LIBS:quickjs/` | the bundled JavaScript, as bytecode |
| `amiga/c/qjs` | `C:qjs` (or anywhere on the path) | the command |

    copy amiga/libs/quickjs.020soft.library LIBS:quickjs.library
    makedir LIBS:quickjs
    copy amiga/libs/quickjs/#?.qjsb LIBS:quickjs/
    copy amiga/c/qjs C:qjs

## The library: pick one variant

| File | For |
|---|---|
| `quickjs.020soft.library` | any 68020 or better, no FPU needed (also shipped as `quickjs.library`) |
| `quickjs.020fpu.library` | 68020/68030 with a 68881/68882 |
| `quickjs.040soft.library` | 68040 without FPU (LC/EC) |
| `quickjs.040fpu.library` | 68040 with FPU |
| `quickjs.060soft.library` | 68060 without FPU |
| `quickjs.060fpu.library` | 68060 with FPU |

## The drawer LIBS:quickjs/: the same for every variant

New in 0.240. Until then this JavaScript was inside each library.

| File | Holds | Needed for |
|---|---|---|
| `extended.qjsb` | URL, Buffer, process, path, fs, util, events, fetch wrappers, ... and the `amiga` object | any of those names |
| `amiga.qjsb` | `Exec`, `Dos`, `Intuition`, `Graphics`, `GadTools`, `Asl`, `Diskfont` and the struct classes | windows, screens, files through the OS |
| `reaction.qjsb` | the BOOPSI and Reaction classes (`amiga.boopsi`, `Button`, `Window`, ...) | Reaction GUIs |

The files are not tied to a CPU: one set serves whichever library
variant is installed. They are tied to the library's **version**: copy
them every time the library is updated. Add-ons (`<name>.qjsb`,
docs/ADDONS.md) go in the same drawer.

What happens without them: `qjs` starts and plain JavaScript runs
(`qjs -e "print(6*7)"` needs no file). The first use of a name from a
missing file stops the script with a message that names the file, for
example

    Error: 'url' needs LIBS:quickjs/extended.qjsb, which is missing:
    copy the 'quickjs' drawer that comes with quickjs.library into LIBS:

and a file left over from another release is refused with both version
numbers in the message.

## Checking what is installed

    qjs -v

prints the command's version, the loaded library's, and one line per
`.qjsb` file found, flagging any the library will refuse:

    qjs 0.240 (14.11.2026), QuickJS-ng 0.12.1
    quickjs.020soft.library 0.240 (14.11.2026)
    LIBS:quickjs/amiga.qjsb: amiga.qjsb 0.240 (14.11.2026)
    LIBS:quickjs/reaction.qjsb: reaction.qjsb 0.240 (14.11.2026)
    LIBS:quickjs/extended.qjsb: extended.qjsb 0.240 (14.11.2026)

The same strings are what the AmigaDOS command prints:

    version file LIBS:quickjs.library
    version file LIBS:quickjs/extended.qjsb

All of them should show one version and date. After replacing the
library, reboot or run `avail flush` so that the old one leaves memory.

## Developers: another directory

`set QJSB_DIR Work:dev/quickjs` in a shell makes programs started from
that shell look in `Work:dev/quickjs` for a `.qjsb` file before
`LIBS:quickjs`. It is a local variable on purpose; see
docs/QJSB-FORMAT.md.
