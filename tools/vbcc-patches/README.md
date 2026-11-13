# vbccm68k: local patches, and the miscompile shipped until 0.232

Everything here is about the compiler that builds `quickjs.library`,
`~/vbcc/bin/vbccm68k`, and its sources in `~/vbcc/src/vbcc`. Written
13.11.2026.

## What happened

| Date | Compiler in `~/vbcc/bin` | Built from |
|---|---|---|
| 3.4.2026 | sha1 `7d913be6` (kept as `vbccm68k.orig-20260610` and `.orig-pre-oobfix`) | a newer vbcc.tar.gz, not kept on disk; its output is identical to that of today's upstream sources (regs.c 1.39) |
| 10.6.2026 | sha1 `475e0818` | `~/vbcc/src/vbcc`, a snapshot downloaded in **August 2025** (regs.c 1.36), plus the June patch |

The June patch fixed two real compiler crashes, but it was applied to the
source tree that happened to be on disk, and that tree is older than the
compiler it replaced. The older sources have a bug in the register
allocator that the newer ones do not. Rebuilding from them brought it
back. It is not caused by the June patch itself: the unpatched August
2025 sources produce the same wrong code, byte for byte, on all 167
compilations of the library and CLI.

How this was established: the current upstream tarball, built here
without changes, produces output byte-identical to `7d913be6` on all 167
compilations; `~/vbcc/src/vbcc` at its git HEAD (identical to
`~/vbcc/src/vbcc.tar.gz`) produces output identical to `475e0818`.

## The bug: a constant reloaded at the exit label

`regs.c`, `insert_regs()`. When the allocator keeps a variable or a
constant in a register over several blocks, it inserts a load at the
start of each block that can be entered without the register holding
it. The function's exit block (nothing but the exit label) must be left
out: nothing uses the register there. In regs.c 1.36 that test was
commented out (`/*!exit_block&&*/`).

So for

    if (!sf) return 0;
    ...
    return g(sf);

the allocator keeps the constant 0 in d0 (it is wanted there by the
`return 0` statements), the call to `g()` ends that, and at the exit
label, reached from both kinds of return, the compiler "restores" the
constant:

        jsr     _g
        addq.w  #4,a7
    l1
        moveq   #0,d0        ; return value of g() destroyed
        rts

`exit-reload.c` is this function; `check-compiler.sh [vbccm68k]` compiles
it and says GOOD or BAD. `library/vbcc/Makefile` and `Makefile.cli` run
that check and refuse to build with a BAD compiler.

Fix (`02-exit-block-reload-and-node-init.patch`): the two lines of
upstream regs.c 1.39. The exit block is recognised as "a block that is
only a LABEL" and gets no entry loads.

## What it damaged in the shipped libraries

Method: every C file of the library and the CLI (167 compilations: 3
CPUs x FPU/soft, each file with the flags the Makefiles give it) was
compiled to assembly with the bad compiler and with the fixed one, and
the two results compared function by function (`audit/`). No pattern
matching: every function whose text differs is listed.

8 functions differ, all in `quickjs.c`, 34 instances over the six
variants (the 68040 variants have only the first). In each, the only
difference is the removed load(s) at the exit label:

| Function | Reloaded at exit | Effect |
|---|---|---|
| `JS_GetScriptOrModuleName` | `moveq #0,d0` | **wrong return value**: always `JS_ATOM_NULL` |
| `is_num_string` | `move.l #48,a5` | none |
| `js_bigint_divrem` | `moveq #1,d2` | none |
| `js_parse_array_literal` | `move.l #2147483647,a3` | none |
| `js_parse_postfix_expr` | `moveq #1,d5` | none |
| `get_exported_names` | `moveq #1,d6` | none |
| `js_parse_directives` | `move.l #-127,a3` | none |
| `JS_AddIntrinsicBaseObjects` | `moveq #3,d5` `moveq #4,d4` `moveq #1,d3` `move.l #8,a5` `move.l #5,a4` | none |

"None" because the register is one the function saves on entry and
restores in the `movem.l (a7)+,...` that follows immediately; each of
the seven was read to confirm the register is in that list. Only a load
into d0, d1, a0, a1 or fp0 could change a result, and there is one.

Which libraries: the FPU variants built after 10.6.2026, and the soft
variants from 0.226 to 0.232. Until 0.225 the soft variants compiled
quickjs.c at -O0, where the bug does not occur (at -O0 the bad and the
fixed compiler give identical output for quickjs.c).

Seen from JavaScript:

- `import(...)` was always rejected: "no function filename for import()".
- `import.meta` threw "import.meta not supported in this context".
- `new os.Worker(...)` takes the calling script's name the same way and
  would fail with "could not determine calling script or module name"
  (not tried).
- LVO `QJS_GetScriptOrModuleName` returned 0 to any embedder.

`amiga/tests/test_compiler_regressions.js` checks the first two (7
checks fail with a library from the bad compiler, pass with the fixed
one) and exercises the other seven functions (pass with both).

The CLI (`qjs`) has no affected function.

## The patches

- `../../patches/vbcc-ic-uaf-and-move_freereg.patch` (10.6.2026, see
  `patches/README.md`): (1) `add_IC()`'s peepholes and `remove_IC()`
  freed intermediate-code nodes that the for/while/do statement
  handlers still pointed at; the frees are deferred to a list that is
  emptied after each function. (2) `move_freereg()` in the m68k backend
  may leave a FREEREG where it is, and its caller's assertion did not
  allow for that. Both are still needed. The use-after-free is still in
  current upstream (an AddressSanitizer build of the unchanged January
  2026 sources reports it on quickjs.c); upstream has removed the
  assertion.
- `02-exit-block-reload-and-node-init.patch` (13.11.2026), on top of the
  above:
  - `regs.c`: the exit-label fix described here.
  - `parse_expr.c`: `new_node()` clears the whole node. Found while
    proving the fix: an AddressSanitizer build of the compiler generated
    different code for `JS_CallInternal`. `type_expression2()` decides
    whether `*&x` may be replaced by `x` by testing `val.vumax` of the
    ADDRESS node, a field nothing ever sets, so the answer depended on
    what `malloc()` returned. Both outcomes are correct code, and with
    the system allocator the field has so far always been zero, so this
    patch changes no output today (checked on all 167 compilations); it
    removes the dependence. Present in current upstream too.
- `all-local-changes.patch`: both of the above as one diff against the
  git HEAD of `~/vbcc` (the unmodified August 2025 sources). This is
  exactly what `git -C ~/vbcc diff HEAD` shows for the source files.
- `alt-for-current-upstream.patch`: the same fixes for the *current*
  upstream sources (apply with `patch -p1` above the `vbcc/` directory
  of a fresh vbcc.tar.gz): the deferred frees and the node clearing.
  The regs.c fix and the removed assertion are already upstream.

## The fixed compilers

Neither is installed in `~/vbcc/bin`; that is the owner's decision.

- `~/vbcc-fixed/bin/vbccm68k`: the August 2025 sources with all local
  changes (sources beside it in `~/vbcc-fixed/src`). Differs from
  `475e0818` in exactly the 8 functions above and nothing else. **This
  is the one to build with**: everything else in the library stays the
  code that has been tested since June.
- `~/vbcc-fixed/bin-upstream/vbccm68k`: current upstream with
  `alt-for-current-upstream.patch`. Output byte-identical to the April
  compiler `7d913be6`. Against the one above it differs in 467 more
  function instances, which were taken apart into three upstream
  changes: a register-cost change for indirect calls (regs.c, 412
  instances, the function pointer goes to a scratch register instead of
  a saved one), a cost change for return statements (regs.c, 37), and
  reaching-definitions changes (rd.c, 18: `js_amiga_call`,
  `resolve_labels`, `js_printf_internal`; all three read, same meaning
  both ways). 370 of the 412 are pure register renamings (checked
  mechanically); the others were sampled, not all read.

To use one without installing it, put its directory first on PATH (`vc`
runs the first `vbccm68k` it finds):

    PATH=$HOME/vbcc-fixed/bin:$HOME/vbcc/bin:$PATH make -C library/vbcc variants

To install it:

    cp ~/vbcc/bin/vbccm68k ~/vbcc/bin/vbccm68k.bad-20260610
    cp ~/vbcc-fixed/bin/vbccm68k ~/vbcc/bin/vbccm68k

To rebuild it from `~/vbcc/src/vbcc` (the source edits are already
there, uncommitted):

    cd ~/vbcc/src/vbcc && rm -f objects/m68k/*.o
    touch objects/m68k/dt.h objects/m68k/dt.c    # or make runs dtgen, which asks questions
    make TARGET=m68k bin/vbccm68k < /dev/null

## What the fixed compiler was tested with

- `exit-reload.c`: correct.
- All 167 compilations exit 0; output identical to the bad compiler
  except the 8 functions.
- The June crashes: quickjs.c for 020soft at -O1 ten times, 040soft,
  060soft and 020fpu once, at -O0 three times, libregexp.c at -O0 and
  -O1: all exit 0, repeated runs byte-identical.
- An AddressSanitizer build of the same sources: all 167 compilations
  and the list above, no report, output identical to the normal build.
  (An ASan build of the unpatched sources does report the
  use-after-free on quickjs.c, so the test can see it.)
- With macOS malloc filling new and freed blocks with garbage
  (`MallocPreScribble=1 MallocScribble=1`): all 167 outputs unchanged.
  Before the `new_node()` change `JS_CallInternal` differed.
- The six libraries built with it: `test_compiler_regressions.js` 46/46
  on each under vamos; the 18 console tests print the same as with the
  shipped 020soft library.

## Checking a compiler in future

    tools/vbcc-patches/check-compiler.sh ~/vbcc/bin/vbccm68k
    tools/vbcc-patches/audit/compare-compilers.sh <old vbccm68k> <new vbccm68k>

The second compiles everything with both and lists every function that
differs; run it whenever the compiler is rebuilt. Static functions are
listed by label; a compiler built with `audit/name-static-functions.patch`
(it writes a comment in front of each) gives their names.
