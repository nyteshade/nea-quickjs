# Q-tier: Amiga library FFI + GUI bridge

## Motivation

On a desktop-first OS like AmigaOS, the killer feature of a JS engine
is direct access to Intuition and related libraries — GUIs authored in
JS, native filerequesters, menu systems, graphics. Our port currently
has no FFI — users can't reach into Amiga libraries from JS without
forking the C code and adding an LVO.

**Reference**: [NodeAmiga](http://aminet.net/package/dev/lang/NodeAmiga)
ships this kind of bridge. Three layers:

1. `require('amiga')` — generic FFI: `openLibrary`, `call` (LVO + register args), `peek/poke`, `allocMem`, `makeTags`
2. `require('intuition')` — window/graphics bindings
3. `require('gui')` — GadTools widgets (12 types, declarative layout)

## Scope (proposed)

### Q1 — Generic FFI primitives — LANDED at 0.124 (2026-04-19)

**Status:** shipped. Commit `2437488`. See
`docs/superpowers/specs/2026-04-19-q1-amiga-ffi-design.md`.

Install `globalThis.amiga` with:

| API | Signature | Notes |
|---|---|---|
| `amiga.openLibrary(name, version)` | `→ Number (Library*)` | Wraps `exec.OpenLibrary`; returns opaque handle. |
| `amiga.closeLibrary(lib)` | | Wraps `exec.CloseLibrary`. |
| `amiga.call(lib, lvo, regs)` | `→ Number` | `regs` is `{d0, d1, d2, d3, a0, a1, a2, a3}`; calls `jsr -lvo(a6)` with registers set. Returns d0. |
| `amiga.peek8/16/32(addr)` | `→ Number` | Direct memory read. |
| `amiga.poke8/16/32(addr, val)` | | Direct memory write. |
| `amiga.peekString(addr, max?)` | `→ String` | Null-terminated read. |
| `amiga.pokeString(addr, str)` | | Null-terminated write. |
| `amiga.allocMem(size, flags)` | `→ Number` | `exec.AllocMem`. |
| `amiga.freeMem(ptr, size)` | | `exec.FreeMem`. |
| `amiga.makeTags(array)` | `→ Number (TagItem*)` | Builds TagItem array in allocated memory; caller must free. |

Security note: direct memory access from JS is Amiga-standard; we
document that scripts with untrusted origin can crash the system.

### Q2 — Intuition binding (~300 lines JS + ~100 C)

`globalThis.intuition` or `import * as intuition from 'qjs:intuition'`:

```js
const win = intuition.openWindow({
    title: 'Hello qjs',
    left: 50, top: 50, width: 640, height: 480,
    idcmp: intuition.IDCMP_CLOSEWINDOW | intuition.IDCMP_MOUSEBUTTONS,
});
win.onClose = () => std.exit(0);
win.onMouse = (x, y, btn) => { /*...*/ };

win.gfx.setColor(1);
win.gfx.drawText(10, 20, 'Hello!');
win.gfx.drawRect(10, 30, 200, 100);
```

C side needs to dispatch Intuition's IDCMP messages into JS callbacks —
similar pattern to how `os.setTimeout` fires JS functions from the
event loop. Could hook into existing `os_timers` loop or add a
`waitIntuition()` that blocks and calls pending JS handlers.

### Q3 — GadTools / MUI widget toolkit (~600 lines JS)

Aim for the exact NodeAmiga `gui` surface so their ecosystem of
scripts runs on our port. Reference app: `aminet_browser.js` (the
Aminet download browser by Juen), ~968 lines.

**Observed NodeAmiga API** (concrete — from the reference app):

```js
const gui = require('gui');
const gfx = gui.gfx;

// Screen metrics
const scr = gui.screenInfo();   // → { fontWidth, fontHeight, ... }

// Declarative gadget array — numeric IDs, pct or px layout
const gadgets = [
    { kind: 'cycle',    id: 1, left: '1%', top: 4, width: '50%', height: 20,
      items: ['A','B','C'], value: 0 },
    { kind: 'listview', id: 4, left: 4, top: 30, width: 120, height: 300,
      items: [], value: 0, flex: true },
    { kind: 'string',   id: 7, label: 'Find:', left: '12%', top: -50,
      width: '87%', height: 20, value: '' },
    { kind: 'button',   id: 8, label: 'Download',
      left: '1%', top: -25, width: '32%', height: 20 },
    { kind: 'text',     id: 6, left: '1%', top: -80, width: '98%', height: 20,
      value: 'Ready.' },
    // also supported: checkbox, integer, slider, cycle, scroller
];

const win = gui.createWindow({
    title: 'Aminet Browser',
    width: 520, height: 400,
    left: 20, top: 15,
    resizable: true, minWidth: 300, minHeight: 140,
    gadgets: gadgets,
});

// Gadget access by numeric id
gui.set(win, 6, 'New status text');
gui.set(win, 4, ['item a', 'item b']);            // listview items
const query = gui.get(win, 7);                     // string value
gui.setDisabled(win, 8, true);                     // dim a button

// File requester (ASL)
const result = gui.fileRequest({
    title: 'Save File', save: true,
    drawer: 'RAM:', file: 'default.txt',
});
// result === { path: 'RAM:default.txt' } or null (cancelled)

// Event loop
while (true) {
    const evt = gui.waitEvent(win);      // blocking
    // or: const evt = gui.pollEvent(win);  // non-blocking
    if (!evt) break;

    if (evt.type === 'close') break;
    if (evt.type === 'key' && evt.key === '\x1b') break;
    if (evt.type === 'resize') { /* evt.width, evt.height */ }
    if (evt.type === 'gadgetup') {
        // evt.id = which gadget, evt.code = value (index/state)
    }
}

gfx.waitTOF();   // wait for top-of-frame (vsync-ish; use with pollEvent)
gui.closeWindow(win);
```

**Layout conventions observed:**
- `left`/`top`/`width`/`height` accept pixels (number), percentages (`'50%'`),
  or negative numbers (pixels from right/bottom edge).
- `flex: true` on a gadget makes it resize-responsive.
- Multiple windows: open more via `gui.createWindow()`, poll each with
  `gui.pollEvent(win)` in a combined loop.

**Gadget kinds in the wild:** `cycle`, `listview`, `string`, `text`,
`button`, `checkbox`, `integer`, `slider`, `scroller` — and the Aminet
browser's readme window uses a `scroller` with `{visible, total}` for
horizontal scroll state.

Implementing this surface 1:1 maximizes script portability — users can
drop NodeAmiga scripts into our port and they just run.

## Non-goals

- Not a full Node-to-N-API shim.
- Not porting NodeAmiga itself (different engine, different
  constraints).
- Not supporting PPC-specific functions in a portable-syntax way —
  NodeAmiga is 68k-only, we should be too for Q-tier.

## Phasing

Q1 alone has value — users can author their own bindings for any
Amiga library using just `openLibrary + call + peek/poke`. The
`intuition` and `gui` wrappers are nice-to-have layers on top.

Ship sequence: Q1 standalone → real usage → decide on Q2/Q3 scope
based on what users actually want.

## Tracking

- Fina decision: `NodeAmiga-style native FFI + GUI bridge`
- Scope estimate: Q1 ~8 hours focused work; Q2 ~12h; Q3 ~20h.
- Not blocking current work — the Node-compat tier (D/E/G) covers
  server-side JS use cases. Q-tier is what makes this port genuinely
  Amiga-native.
