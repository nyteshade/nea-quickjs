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

### Q1 — Generic FFI primitives (C layer ~200 lines, JS wrapper ~100)

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

```js
const win = gui.createWindow({
    title: 'Settings',
    contents: [
        gui.string({ label: 'Name', id: 'name' }),
        gui.checkbox({ label: 'Enabled', id: 'enabled' }),
        gui.button({ label: 'OK', onClick: () => close(ret) }),
    ],
});
```

Declarative layout + event handlers. Wraps GadTools gadgets. Could
layer on MUI or ClassAct as alternative back-ends (detect which is
installed).

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
