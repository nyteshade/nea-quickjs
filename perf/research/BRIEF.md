# Shared brief: making the JS engine faster on 68k Amigas

## The project
`/Volumes/Code/Amiga/nea-quickjs`: QuickJS-ng ported to AmigaOS 3.x as a shared
library (`quickjs.library`, built with vbcc on this Mac) plus a thin CLI `qjs`.
Engine source: `quickjs-master/` (quickjs.c, libregexp.c, dtoa.c, ...).
Amiga glue: `library/vbcc/` (Makefile, sharedlib_*.c/.s = our own libc, int64
helpers, soft-float glue, allocator). Built variants in `amiga/libs/`:
020fpu, 020soft, 040fpu, 040soft, 060fpu, 060soft.

## The question
The owner asks: how do we get REAL speed on slow processors (68020/030 at
14-50 MHz, 68040, 68060), assuming enough RAM, WITHOUT relying only on compiler
optimisation, by targeting and exploiting the individual 68k CPUs?
This round is RESEARCH. Nothing ships. We want ranked, evidence-backed
proposals, and to know which popular ideas would NOT pay off.

## Facts already established (verify if your lane depends on them)
- Compiler is vbcc (`~/vbcc/bin/vc +aos68k`, vasm, vlink). No m68k gcc installed.
- Everything builds at `-O1`. `libregexp.c` is built at `-O0`, and for the SOFT
  variants `quickjs.c` itself is built at `-O0` (old compiler crash workaround).
  The local vbcc was patched in June 2026 so `-O1` reportedly compiles now, but
  the flags were never flipped and it is untested on an Amiga.
- `-DJS_NAN_BOXING=0`: JSValue is a 16-byte struct (8-byte union + int64 tag),
  chosen because vbcc miscompiled the int64 NaN-box maths. Returned in
  d0/d1/a0/a1, passed as 16 stack bytes.
- `DIRECT_DISPATCH 0` for vbcc: the interpreter loop is a `switch`.
- The three CPU variants differ only by `-cpu=680x0`. There is no CPU-specific
  hand-written code in the hot paths.
- Soft-float variants call mathieeedoubbas.library through library vectors.
- Start-up of `qjs` under the vamos emulator takes about 2 s, most of it loading
  precompiled bytecode for the bundled JS (`quickjs-master/gen/*.c`).

## Rules (hard)
- Do NOT modify anything inside `/Volumes/Code/Amiga/nea-quickjs`. No edits, no
  `make` there (it overwrites shipped binaries), no git commands that change
  state, never `git stash`. Read freely. For experiments, copy what you need
  into your own directory under
  `/private/tmp/claude-501/-Volumes-Code-Amiga-nea-quickjs/16cb392e-cdad-4185-838c-ecaa322c3b16/scratchpad/perf/<your-lane>/`
  and build there (e.g. `vc +aos68k -cpu=68020 -O1 -S file.c -o out.s`, flags as
  in `library/vbcc/Makefile`).
- Privacy: web searches and fetches must use generic technical terms only.
  Never put the project name, the owner's name, or file paths in a request.
- Shell quirks: use `/usr/bin/grep`; every command prints a harmless `unalias`
  error; give vamos and make `< /dev/null`; vbcc sometimes segfaults, retry.
- Running qjs under vamos: read
  `/Users/brie/.claude/projects/-Volumes-Code-Amiga-nea-quickjs/memory/reference_vamos_qjs_recipe.md`.
  An existing working set-up is in `.../scratchpad/vm/`; COPY it to your lane
  directory rather than using it in place (other agents run concurrently).
  vamos has no graphics/intuition; console JS only. vamos is not cycle-accurate:
  say what you actually measured (wall time, instruction count, code size).
- Separate MEASURED from ESTIMATED in everything you report. A number with no
  measurement behind it must be labelled an estimate, with its basis.

## Output
1. Write your full notes to `.../scratchpad/perf/<your-lane>/NOTES.md`
   (other lanes will read it in round 2).
2. Store only facts you MEASURED or verified in the source in the project
   knowledge base: load the tool with ToolSearch
   `select:mcp__fina__remember`, then call it with
   `cwd: "/Volumes/Code/Amiga/nea-quickjs"`, `tags: "perf-68k,reference"`,
   one self-contained fact per call (at most 6 calls). Never pass a
   `partition` argument. If a call reports a disabled partition, stop
   writing and say so in your report; do not retry elsewhere.
3. Final message to me (under 500 words): your ranked proposals, each with
   expected gain, whether measured or estimated, effort, risk, and which CPUs
   it helps; then what you could not determine. Raw findings, no preamble.
