# Toolchain patches

> **13.11.2026: this patch alone is not enough.** The compiler built
> from it on 10.6.2026 (sha1 `475e0818`) was built from a vbcc source
> tree older than the compiler it replaced, and that tree has a register
> allocator bug that made `JS_GetScriptOrModuleName` always return 0
> (every `import()` failed). The "byte-identical to a known-good run"
> validation below cannot have been against the compiler it replaced:
> the two differ in about 80 functions of each library variant. The
> second patch, the fixed compiler, the list of
> affected functions and a script that compares two compilers over the
> whole library are in `tools/vbcc-patches/` (start with its README).

## vbcc-ic-uaf-and-move_freereg.patch

Fixes two vbccm68k (vbcc V0.9i pre, m68k backend) bugs that broke
compiling `quickjs.c` for the soft-float library variants. Diagnosed and
fixed 10.6.2026; see Fina T-vbccm68k-soft-quickjs-segv and
`REVIEW-2026-06-10.md` §1 for the full story.

1. **IC use-after-free** (`supp.c`, `supp.h`, `ic.c`, `main.c`):
   `add_IC()`'s peepholes (branch-to-following-label deletion and the
   `bcc l1;bra l2;l1:` inversion) free linked ICs while the
   `for/while/do_statement` handlers in `statements.c` still hold saved
   IC cursors for their `mic->line`/`mic->file` tagging walks. The walk
   then reads freed memory — a layout-dependent SIGSEGV in
   `for_statement` (~50% of runs on large inputs; the m68k -O0/-O1
   quickjs.c crashes). Fix: `remove_IC()` and the bra-inversion path
   defer the `free()` into a graveyard (`defer_free_IC`), flushed once
   per function (`flush_deferred_ICs` in `do_function`). The unlinked
   node's own next/prev still point into the live list, so stale
   cursors traverse it harmlessly.

2. **move_freereg adjacency assertion** (`machines/m68k/machine.c`):
   `move_freereg()` either moves a FREEREG IC behind the use IC or NOPs
   it in place (when an intervening ALLOCREG merged the live ranges),
   but the `(ax,dy)` addressing-mode fusion caller asserted the moved
   layout unconditionally — deterministic `internal error 0 in line
   ~1744` on e.g. quickjs's `cutils.h`. Fix: return a moved-flag and
   gate the assertion on it.

### Applying on another machine

```
cd ~/vbcc            # the vbcc-macos repo root (src/vbcc inside)
git apply /path/to/nea-quickjs/patches/vbcc-ic-uaf-and-move_freereg.patch
cd src/vbcc
rm -f objects/m68k/*.o
make TARGET=m68k bin/vbccm68k
cp ~/vbcc/bin/vbccm68k ~/vbcc/bin/vbccm68k.orig-$(date +%Y%m%d)   # backup
cp bin/vbccm68k ~/vbcc/bin/vbccm68k
```

Validation used on the original machine: 20 consecutive
`quickjs.c` 020soft compiles + 10× 040soft, all exit 0 with output
byte-identical to a known-good run; full `make -C library/vbcc variants`
3×; an ASan build (`-fsanitize=address` on the Makefile `CC` line) also
passes. Fixed-binary sha1 on the original machine: `475e0818…` (will
differ on other hosts/gcc versions — verify behaviorally instead).

Both bugs exist in stock vbcc V0.9i sources (not introduced by the
macOS port) and are worth reporting upstream to Volker Barthelmann.
