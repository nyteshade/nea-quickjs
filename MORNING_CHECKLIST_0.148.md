# Morning checklist — overnight 0.145 → 0.148

Written 2026-04-21 (early hours). All commits on `main`, **not pushed
yet** per the "push only after Amiga-tested" policy.

## Summary

Five library versions shipped overnight after the 0.144 breakthrough:

| Ver | Fix                                                                                    |
|-----|----------------------------------------------------------------------------------------|
| 145 | Button defaults `relVerify=true` (user reported clicks silent at 0.144)                |
| 146 | **Fixed `IDCMP_IDCMPUPDATE` value** — was `0x40000000`, actual is `0x00800000`. Full IDCMP EventKind catalog. IDCMPUPDATE TagList parser in `Window._translateMessage` populates `event.sourceId` / `event.source` and upgrades `event.kind` to class-specific kinds. |
| 147 | `amiga.makeTags` + `withTags` now accept variadic / flat-array / pair-array inputs     |
| 148 | Phase C: 25 new Reaction wrappers (gadgets + images), full EventKind catalog expanded  |

Then 13 NDK example ports.

## Things to try on Amiga (order)

Copy `LIBS:quickjs.library` from `amiga/libs/` after each test. Do
`avail FLUSH` between copies.

### 1. Sanity: existing regression

```
qjs examples/window_hello.js     (0.127-era path; should still work)
```

### 2. React_hello with working button clicks

This is the headline check for 0.146. The script now prints
`BUTTON_CLICK` lines with id + text and quits on id=2.

```
qjs examples/react_hello.js
```

Click "Say hi" → should print `BUTTON_CLICK — id=1 text="Say hi"`.
Click "Quit" → should break the loop and print `Clean exit.`.

### 3. Phase C demos — one per class

Each is self-contained and should run against 0.148. Expected
behaviour in each file's header comment.

- `qjs examples/buttons_demo.js` — 4-button row + Bevel frame
- `qjs examples/checkbox_demo.js` — toggles print checked/unchecked
- `qjs examples/radiobutton_demo.js` — fruit picker
- `qjs examples/slider_demo.js` — horizontal 0..100
- `qjs examples/scroller_demo.js` — vertical + horizontal
- `qjs examples/integer_demo.js` — clamped 0..999
- `qjs examples/string_demo.js` — name + password fields
- `qjs examples/led_demo.js` — 6-digit LED w/ Reset
- `qjs examples/palette_demo.js` — 8-color picker
- `qjs examples/fuelgauge_demo.js` — progress bar 0..100
- `qjs examples/getcolor_demo.js` — GetColor popup
- `qjs examples/getfile_demo.js` — file requester
- `qjs examples/getfont_demo.js` — font requester
- `qjs examples/getscreenmode_demo.js` — screenmode requester
- `qjs examples/tapedeck_demo.js` — VCR transport
- `qjs examples/datebrowser_demo.js` — calendar

### 4. Try the new tag list shapes

Any context that previously used `amiga.makeTags([[a,b],[c,d]])` now
works with `amiga.makeTags(a,b,c,d)` or `amiga.makeTags([a,b,c,d])`.
The original form still works.

## What's still untested / unverified

- **None of the Phase C wrappers have touched an Amiga yet.** Each
  is a pure-JS class with the correct tag IDs + `_classLibName` per
  NDK headers, but `OpenLibrary` failures or wrong tags would surface
  only on-device.
- Button-click / IDCMPUPDATE routing at 0.146 assumes my TagList
  parser reads `IntuiMessage.iaddress` correctly. First concrete
  validation is `react_hello` clicks.
- `LAYOUT_AddChild`-vs-OM_ADDMEMBER for runtime child attach — only
  construction-time is proven.
- `textVal` / `longVal` attribute reads on `StringGadget` / `Integer`
  — haven't exercised get/set cycle against a real class dispatcher.
- The per-class event kinds (e.g. `CHECKBOX_TOGGLE`) resolve from
  `source._classLibName`, which requires the child to have been
  constructed through one of our JS classes. That's true for any
  class built via these wrappers.

## Known limitations for morning thought

1. **RadioButton label arrays** require you to build a NULL-terminated
   STRPTR array by hand (`allocMem` / `pokeString` / `poke32`). A
   helper like `amiga.stringArrayToPtr(['a','b','c'])` would be nice.
   Similarly for Chooser's `struct List` of CNA nodes.
2. **ListBrowser** still needs a `ColumnInfo` + node builder helper to
   be usable. Today you'd have to poke LBCIA_* structs manually.
3. **TextEditor** is feature-rich (undo/redo/styles/cursor) — the
   current wrapper only exposes ATTRS; methods like scroll / select
   would be nice to wrap.
4. **IDCMP_IDCMPUPDATE** carries a TagList that currently only pulls
   GA_ID and ICA_TARGET; extra tags go into `event.attrs[tagID]`. A
   per-class translator would be cleaner — e.g., for a CheckBox, we
   could decode the checked boolean out of the GA_Selected tag.
5. No **REACTION.md** link from README yet. Docs file exists at
   `docs/REACTION.md` and is comprehensive.

## Pet peeves addressed

- `makeTags` variadic/flat form ✓ (0.147)
- Pattern propagated to all Reaction gadgets ✓ (0.148, every
  interactive gadget defaults `relVerify=true`)
- "Bring over all the NDK examples" → 13 of ~25 ported as-of 0.148.
  Remaining: Connect.c (ICA target connections), Chooser1/2.c
  (requires struct List + CNA nodes), ClickTab.c (TNA nodes),
  ListBrowser1/2.c (LBCIA + LBNA), Sketchboard.c, PrintReq.c,
  Requester.c (classes/requester), Palettes.c / Bevels.c / Glyph.c
  (variations). Recommend writing node-builder helpers first.

## Font-aware sizing (pet peeve note)

You asked the examples to "respect the sizes of the actual fonts being
employed." The canonical Reaction approach (used in most NDK examples)
is to **not hard-code pixel dimensions**. Every example I ported
relies on:

- `LAYOUT_AddChild` doing its own min-size negotiation from the
  child's preferred size.
- Layout's `innerSpacing` + `orientation` handling flow.
- `Label` / `Button` / etc. deriving min width/height from their
  text + the screen's default font via `DrawInfo`.

A few examples DO set `innerWidth` / `innerHeight` on the Window
(e.g. `react_hello`, `slider_demo`) — those are *outer canvas*
preferences that Reaction will grow if content is larger. Remove them
entirely to get pure shrink-to-fit.

For demos that want a fixed minimum, pass `minWidth` / `minHeight`
(inherited from GADGET_ATTRS) rather than hardcoding `width` /
`height`.

## Git state

Branch: `main`, **no pushes**.

```
3d0c660 examples(amiga): Reaction demos — 13 NDK example ports
f42f26c feat(boopsi): 0.148 — Phase C: 25 Reaction wrappers
741f342 feat(ffi):    0.147 — makeTags accepts flat + variadic shapes
a7f732d feat(boopsi): 0.146 — full IDCMP catalog + IDCMPUPDATE parsing
f494670 fix(boopsi):  0.145 — Button defaults relVerify=true
3bb4fca fix(ffi):     0.144 — BOOPSI doMethod Hook offset (Guru fix)
35ebe48 fix(boopsi):  0.143 — NewObjectA argument order in BOOPSIBase
56f8596 fix(boopsi):  0.142 — Reaction class-library path prefixes
f2ed30f fix(lib):     0.141 — silent-module-eval + WM_OPEN/WM_CLOSE IDs
7e02332 fix(boopsi):  0.140 — 3 bugs in Phase B after user tested
```

Plus two diagnostic-probe scripts (`boopsi_probe.js`,
`boopsi_probe2.js`) in `amiga/examples/` that localized the Hook bug.

Run `git log --oneline -20` to see the full overnight arc.
