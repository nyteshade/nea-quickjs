# The JavaScript stack

How `quickjs.library` gives a script the stack it needs, what the three
sizes mean, and what a tool that looks at a task's stack will see.

## Why

An AmigaOS stack is a fixed block of memory. It cannot be made longer,
and nothing stops a program running off its end: the memory below is
simply overwritten. The interpreter recurses on the machine stack (one
nested JavaScript call is one nested C call, about 800 bytes), so the
depth a script can reach is set by the size of that block.

Until now `qjs` solved this by giving itself 512 KB at start, script or
no script: about 640 nested calls, and half a megabyte gone on a machine
that may have two. Now it starts on 64 KB and the stack grows when a
script needs it.

## How it grows

Wherever recursion can happen the engine has always compared the stack
pointer with a limit. That compare is still all an ordinary call pays.
When it fails at a place that can grow (see the table), the library

1. takes a further block of memory from the system (`AllocMem`,
   `MEMF_PUBLIC`: exec saves a task's registers on its stack at every
   task switch, so a stack must be memory that is always there);
2. moves to it with exec's `StackSwap()`, runs the nested call there,
   and moves back with a second `StackSwap()` when the call returns;
3. keeps the block for the next time, or gives it back (below).

So the stack is a chain: the task's own stack, then block after block,
each holding a run of nested calls. The older segments stay where they
are while a newer one is in use, so pointers into them (argument
arrays, the caller's variables) remain good.

**Unwinding.** The only way out of a block is the call that entered it
returning. That is enough: the engine reports every error as a return
value and has no `longjmp`; an exception thrown in the deepest block
travels up through each `StackSwap()` pair as an ordinary return.
Ctrl-C is an exception of this kind. `std.exit()` inside the library
sets a flag and throws; nothing in the library or in `qjs` leaves a
script by `exit()` or `longjmp`. The library's worker processes run no
JavaScript.

**One spare block.** When a block is left it is kept, one at most, so
that a loop whose calls cross the end of a segment does not allocate
and free on every turn: it pays two `StackSwap()` calls per crossing
and nothing else. The spare is given back at the next garbage
collection and when the runtime is freed.

## The three sizes

| Size | Default | `qjs` option | Meaning |
| --- | --- | --- | --- |
| floor | 64 KB | `--stack-floor n` | The least stack JavaScript starts on. |
| block ("chunk") | 128 KB | `--stack-chunk n` | The size of each further block. `0`: never grow. |
| cap | 1024 KB | `--stack-size n` | The most stack in all. `0`: no cap. |

`n` is in KB, or with a suffix as for `--memory-limit` (`256k`, `2m`).
Put the options in `S:QJS-Config.txt`, one per line, to have them for
every run. Other programs set them with `QJS_SetStackSizes()` and read
them, with the counters, with `QJS_GetStackInfo()` (see the autodoc);
a script reads them with `os.stackInfo()`.

**Floor.** `qjs` is built with a floor of 64 KB (`QJS_OWN_STACK_SIZE`
in `qjs.c`): if the Shell's stack is smaller, vbcc's start-up code
moves to a block of that size before `main()`, as it did with 512 KB
before. A Shell stack that is already larger is used as it is. A floor
set at run time cannot undo that, since the start-up code has run, but
it can ask for more: when the task's stack is smaller than the floor,
the library leaves it at the first opportunity and runs JavaScript on
a first block of at least the floor's size. The same happens when the
library cannot tell how large the task's stack is (see "Unknown
bounds"). For a program other than `qjs` this is what the floor is: it
need not have a large stack itself to run deep scripts, only enough
for the library calls it makes outside JavaScript (creating a runtime
and a context takes a few KB). A stack within one eighth of the floor
counts as meeting it.

**Block.** Of every block 24 KB are not available to nested calls: a
margin of 16 KB at the bottom that must stay free (for the frames
between two checks, an operating-system call, and exec saving the
registers at a task switch) and a reserve of 8 KB above it (next
section). A 128 KB block therefore holds about 135 plain calls, a
64 KB block about 50. Sizes below 32 KB are raised to 32 KB. A block
larger than the setting is taken when one call needs it. If the system
cannot supply a block of the size wanted, half of it is tried, and so
on down to the least that is useful.

**Cap.** Counted against the cap are the bytes in use on the task's
stack below the point where the runtime was created, plus every block
in use, whole. The last block before the cap is shortened to fit. At
the cap, or when the system has no memory for a block, the script gets
the usual `RangeError: Maximum call stack size exceeded`, which it can
catch; the blocks are left on the way up and the engine works as
before. 1 MB is the figure the engine assumes on other platforms and
allows about 1100 nested plain calls; a runaway recursion takes that
megabyte for a moment before it is stopped. With no cap, recursion
ends when memory does.

Measured per nested call, C stack, under emulation (by counting the
calls that fit a block):

| | 68020, soft float | 68040, FPU |
| --- | --- | --- |
| plain function, method, arrow function | 777 bytes | 801 bytes |
| constructor (`new`) | 902 | 926 |
| getter | 1298 | 1331 |
| `f.apply(...)`, `Reflect.apply` | 2009 | 2088 |
| callback through `Array.prototype.map` | 2958 | 3042 |
| callback through `sort`, `String.prototype.replace` | 4 to 5 KB | |
| one nested expression in source text (parser) | about 1.3 KB | |
| one nested JSON array or object (`JSON.parse`) | about 0.1 KB | |

## What grows and what does not

A check that can grow the stack is a "switch point". The others throw
`RangeError` (the regular expression compiler: `SyntaxError`) when the
segment they are in is used up. Because a switch point has always been
passed shortly before (calling the built-in function that leads to
them is one), they find at least the 8 KB reserve, usually much more:
at the top level of a script on the 64 KB stack `qjs` starts with, a
regular expression may nest 100 groups and an expression may chain 400
prefix operators, but neither 400 groups nor 1500 operators. With the
512 KB stack of earlier versions these particular limits were several
times higher; a larger floor (`--stack-floor 512`) brings that back.

| Recursion | Grows? | Where |
| --- | --- | --- |
| JavaScript function calls of every kind: plain, method, constructor, getter and setter, callbacks from built-ins (`map`, `sort`, `replace`, `toString`, `toJSON`, Proxy traps, ...) | yes | `JS_CallInternal` |
| Native functions, bound functions, `apply`/`call`/`Reflect.apply` | yes | `js_call_c_function`, `js_call_c_function_data`, `js_call_c_closure`, `js_call_bound_function` |
| Generators and async functions being started or resumed | yes | `async_func_resume` |
| Source text: nested expressions (parentheses, array and object literals, arguments, templates, function bodies) | yes | `js_parse_assign_expr2` |
| Source text: nested statements (blocks, `else if` chains, loops) | yes | `js_parse_statement_or_decl` |
| `JSON.parse`: nested arrays and objects; reviver | yes | `json_parse_value`, `internalize_json_property` |
| `JSON.stringify`: nested values | yes | `js_json_to_str` |
| `Array.prototype.flat` and `flatMap` on nested arrays | yes | `JS_FlattenIntoArray` |
| Source text: a chain of prefix operators (`!!!!...x`, `typeof typeof ...`), a chain of `**` | no | `next_token` |
| A regular expression with deeply nested groups, being compiled | no | `lre_check_stack_overflow` |
| A chain of Proxies each wrapping the next (no trap functions) | no | `get_proxy_method`, `js_proxy_isArray` |
| Module graphs: a long chain of imports being linked or evaluated | no | `js_inner_module_linking`, `js_inner_module_evaluation`, `gather_available_ancestors`, `js_async_module_execution_rejected` |
| `bjson` reading or writing deeply nested values | no | `JS_ReadObjectRec`, `JS_WriteObjectRec` |

`amiga/tests/test_stack_chain.js` exercises every "yes" row far beyond
64 KB; `test_stack_limit.js` and `test_engine_host.js` check that every
row ends in an error that can be caught.

## Function frames are not on the C stack

Separately from all this: the arguments, variables and operand stack
of a running function live in an arena of the runtime
(`quickjs-master/amiga/stack/frame-arena.h`), a second stack for data.
On other platforms the engine takes them from the C stack with
`alloca()`; vbcc has none. Until this was written the port's `alloca`
was `AllocVec`, never freed: every call of a JavaScript function took
its frame from the system for good, even beyond the end of the program
(200,000 calls: 6.4 MB). The arena grows in chunks of 8 KB from the
runtime's allocator and is counted by `--memory-limit`, not by the
stack cap.

## What stack-watching tools see

`StackSwap()` exchanges `tc_SPLower` and `tc_SPUpper` of the task
together with the stack pointer, so at any moment the two describe the
segment the stack pointer is in:

- before and after deep recursion, and for `qjs` at the prompt: the
  64 KB block of the start-up code (or the Shell's stack);
- during deep recursion: the newest block, 128 KB less a 20 byte
  header at its top. The segments below are not visible to such a
  tool, and their contents are not "stack in use" to it;
- a tool that measures the high-water mark of the Shell's own stack
  sees what `qjs` used before its start-up code moved away, a few
  hundred bytes.

A tool that samples the stack pointer and compares it with bounds it
read earlier (rather than at the same moment, under `Forbid()`) can
report an overflow that is none, as with any program that uses
`StackSwap()`.

Callbacks that the operating system runs on our task while JavaScript
is running (a hook function called from inside a library call) run on
the block that is current, like any other nested call.

## Unknown bounds

`tc_SPLower`/`tc_SPUpper` are trusted only if the stack pointer lies
between them. A program that moved its stack without `StackSwap()`
leaves them describing the old one. Then the library treats the task's
stack as below the floor and runs JavaScript on its own blocks, whose
bounds it knows. (With growth turned off it falls back to assuming the
cap, 1 MB, below the point where the runtime was created, as before.)

## Turning it off

- `--stack-chunk 0`, or `QJS_SetStackSizes(rt, ~0, 0, ~0)`: the stack
  is the task's and nothing else; `RangeError` at its end. Give `qjs`
  a larger one with the Shell's `Stack` command.
- A `qjs` built with `-DQJS_OWN_STACK_SIZE=0` does not move to a block
  of its own at start and refuses to run on less than 64 KB, asking
  for `Stack 65536`.
- A library built with `-DQJS_NO_CHAINED_STACK` has none of this.

## The files

| File | What |
| --- | --- |
| `quickjs-master/amiga/stack/stack-chain.h` | the limits, when to grow, the cap, the spare block |
| `quickjs-master/amiga/stack/stack-chain-calls.h` | one function per switch point that carries the call over |
| `quickjs-master/amiga/stack/stack-chain-api.h`, `-types.h` | settings, figures, the runtime's state |
| `quickjs-master/amiga/stack/frame-arena.h`, `-types.h` | function frames |
| `library/vbcc/qjs_stack_chunk.c` | the task's bounds, blocks from the system |
| `library/vbcc/qjs_stack_switch.s` | the two `StackSwap()` calls |
| `library/vbcc/qjs_stack_vectors.s` | `QJS_SetStackSizes`, `QJS_GetStackInfo` |
| `library/vbcc/qjs_stack_js.c` | `os.stackInfo()` |
| `amiga/tests/test_stack_chain.js`, `perf/stack-tests.sh` | the tests |

## os.stackInfo()

Returns an object of numbers (bytes where a size): `floor`, `chunk`,
`cap` (the settings); `baseSize` (the task's stack, 0 if unknown) and
`baseForced` (true when it is below the floor and JavaScript runs on
blocks only); `depth` (blocks in use now), `depthMax`; `bytesInUse`,
`bytesCached` (the spare), `bytesMax`; `switches` (calls continued on
another block), `allocations` and `frees` (blocks taken from and given
back to the system), `refusals` (times no block could be had),
`marginUsed` (the deepest the stack went into the 16 KB margin of any
block given back so far: the margin is painted when a block is taken
and inspected when it is returned).

`os.stackInfo(n)` with a number is for the tests: the next `n`
requests to the system for a block are refused, as if memory were
short; `os.stackInfo(0)` ends that.

## Not verified without an Amiga

All of the above was run under the vamos emulator, which implements
`StackSwap()` but keeps the stack bounds inside the emulator instead
of in the task structure. Still to be seen on a real or fully emulated
Amiga: that `tc_SPLower`/`tc_SPUpper` follow the blocks
(`test_stack_chain.js` checks it there and only there), that
Enforcer/MuForce and stack checkers stay quiet during deep recursion,
and that deep recursion works with dos.library calls (file output)
made from the deepest block.
