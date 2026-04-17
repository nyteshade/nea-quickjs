# VBCC optimizer miscompile: libregexp.c

## Summary

VBCC 0.9i pre (with vbcc m68k code-generator V1.15) miscompiles three
large functions in `quickjs-master/libregexp.c` when invoked at `-O1`
or higher. The miscompiled functions hang at runtime on any regex
input — including trivial patterns like `/\+/g`. At `-O0` the same
code runs correctly.

## Reproduction

```bash
cd library/vbcc
$VBCC/bin/vc +aos68k -c -cpu=68020 -O1 \
    ../../quickjs-master/libregexp.c -o /tmp/libregexp.o
```

Output:

```
warning 175 in function "lre_compile": this code is weird
warning 175 in function "lre_exec_backtrack": this code is weird
```

At `-O2` or `-O3` the same warning also appears for
`re_parse_char_class`. At `-O0` the warnings vanish and the
resulting `.o` works correctly at runtime.

"Warning 175: this code is weird" is VBCC's generic signal that
its optimizer's data-flow analysis cannot reason about a
construct. In this case the emitted m68k code appears to
mis-handle the large switch-based dispatch loops and goto-heavy
control flow in libregexp's regex engine.

## Impact

Any JavaScript regex usage triggers this — compile and exec both
touch the miscompiled functions. Before the workaround, user JS
like `"abc".match(/a/)` or `"+b".replace(/\+/g, "-")` hung the
whole interpreter.

## Workaround

`library/vbcc/Makefile` compiles only `libregexp.c` at `-O0`; the
rest of the library stays at `-O1`. Size cost per variant is
~50KB; no measurable perf impact for regex-heavy workloads
(correct is better than fast).

## Upstream

Worth reporting to VBCC maintainer (Volker Barthelmann) with a
minimized test case. `libregexp.c` is stable upstream — the bug
is almost certainly in VBCC's m68k code generator, not
QuickJS-ng.

Minimized reproduction effort deferred. The per-file `-O0`
workaround works indefinitely.

## Related

- Fina decision: `Build libregexp.c at -O0 on Amiga...`
- Commit: `e4483fb` (0.089 — fix landed)
- Five prior versions of whack-a-mole regex patches (0.082-0.087)
  were all treating symptoms of this single root cause.
