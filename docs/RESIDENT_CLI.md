# Open issue: Resident C:QJS Add Pure

## Summary

The CLI binary (`amiga/c/qjs`) is not re-entrant. Making it
`Resident Pure` in AmigaDOS (for a zero-load-time invocation from
any shell) would cause state corruption if two shells ran qjs
concurrently.

## Why

Three globals in the CLI:

1. `QJSBase` (in `quickjs_bridge.c`) — pointer to the opened
   `quickjs.library` base.
2. `MathIeeeDoubBasBase` (in `cli_math_globals.c`) — softfloat
   math lib base.
3. `MathIeeeDoubTransBase` (same file) — softfloat transcendentals.

All bridge asm trampolines (`library/vbcc/bridge_asm*.s`) read
`_QJSBase` directly from its global memory location:

```asm
move.l  _QJSBase,a6
move.l  a6,a5
suba.l  #1080,a5
jsr     (a5)
```

Under Resident+Pure, the code + data segment is shared across
tasks. Each task's `OpenLibrary` would write into the same
`QJSBase` slot, clobbering other tasks' library references.

## Fix (deferred)

Per-task storage is the correct answer. Options:

### Option A: `tc_UserData` hijack (fast but fragile)
Store a CLIContext pointer in `FindTask(NULL)->tc_UserData` at
startup. All asm trampolines read `tc_UserData` instead of
`_QJSBase`. Fast — one indirection.

**Problem:** bsdsocket.library also uses `tc_UserData` per task.
In fetch workers we already zero it on entry to avoid collision
(see `sharedlib_worker.c`). In the CLI main task, nothing
currently opens bsdsocket (fetch workers do), so the slot is
free — but it's a brittle assumption. Future code that opens
bsdsocket in main task would break.

### Option B: Task-pointer hash table (safe, slightly slower)
Small static array of `{struct Task *, CLIContext *}` pairs. All
trampolines look up the current task via `FindTask(NULL)`, then
linear-scan the array. For 1-3 concurrent residents this is fine;
overhead is a few instructions per LVO call.

### Option C: Per-process `pr_LocalVars` (standard Amiga way)
Use dos.library's `FindVar` / `SetVar` to store a stringified
pointer. Standard but string lookup overhead makes it slow for
hot-path asm.

### Option D: Rework the asm trampolines to take base as parameter
Change signature of every bridge function to accept `QJSBase` as
an arg. Caller (C code in the CLI) holds it in a local variable.
Biggest refactor but cleanest model — matches how the library
itself is structured.

## Recommendation

Option B (task-pointer hash) is the best balance for v1. Keep
asm trampolines small (~3 instructions added per trampoline).
Maintains current LVO signatures. Worth ~2 hours of focused work
when someone actually asks for Resident Pure.

## Non-urgent

Users who want a "fast-to-load" qjs can just keep `qjs` in RAM:
via `Copy C:qjs RAM:C/`. Loads in <1 second. Resident Pure is
faster (no load at all) but the correctness risk before the
refactor isn't worth it.

## Related

- Fina tag: `next-up,re-entrant-cli`
- Tracking: `project_dot_symbol_syntax.md` memory references this
