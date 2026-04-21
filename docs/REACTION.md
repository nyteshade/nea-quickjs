# Reaction / BOOPSI OO Layer

*Last updated: library 0.148 (21.4.2026).*

This document describes the JavaScript API exposed by
`amiga.boopsi.*` — a thin OO veneer over AmigaOS 3.x Reaction
(BOOPSI) that hides the tag-list/DoMethod ceremony without
abstracting the underlying model away.

## Contents

1. [Why an OO layer](#why-an-oo-layer)
2. [Class hierarchy](#class-hierarchy)
3. [Lifecycle](#lifecycle)
4. [Attribute system (ATTRS)](#attribute-system-attrs)
5. [Event model (EventKind)](#event-model-eventkind)
6. [Tag list shapes](#tag-list-shapes)
7. [Catalog of wrapped classes](#catalog-of-wrapped-classes)
8. [IDCMP constants](#idcmp-constants)
9. [Internals — how dispatch works](#internals--how-dispatch-works)
10. [Known gotchas](#known-gotchas)

---

## Why an OO layer

Raw BOOPSI requires:
- Opening `images/label.image`, `gadgets/button.gadget`,
  `gadgets/layout.gadget`, `classes/window.class` one-at-a-time with
  `OpenLibrary`.
- Calling each library's `XXX_GetClass` at LVO -30 to get a `Class*`.
- Building tag lists with interleaved `GA_/WA_/BUTTON_/LABEL_/...`
  integer constants plus data ULONGs.
- `Intuition.NewObjectA(class, NULL, tagList)` to instantiate.
- Dispatching methods via `IDoMethod(obj, msg)` (a macro that reads
  `obj-4`'s class pointer, pulls `cl_Dispatcher.h_Entry`, JSRs).
- Walking `IntuiMessage`s off the window's `UserPort` and translating
  `IDCMP_IDCMPUPDATE` payloads into per-gadget events.

The OO layer wraps all of this with declarative JS classes:

```js
import { Window, Layout, Button, Label, EventKind, IDCMP } from amiga.boopsi;

let win = new Window({
  title: 'Hello', innerWidth: 260, innerHeight: 100,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [
      new Label({ text: 'Hello from Reaction!' }),
      new Button({ id: 1, text: 'Say hi' }),
      new Button({ id: 2, text: 'Quit' }),
    ],
  }),
});

win.on('CLOSE_WINDOW', () => print('bye'));

win.open();
for (let evt of win.events()) {
  if (evt.kind === EventKind.CLOSE_WINDOW) break;
  if (evt.kind === EventKind.BUTTON_CLICK) {
    print('click id=' + evt.sourceId + ' text="' + evt.source.text + '"');
    if (evt.sourceId === 2) break;
  }
}
win.dispose();
```

No `OpenLibrary`. No `TAG_END`. No `IDoMethod`. No struct pokes.

---

## Class hierarchy

```
BOOPSIBase
├── GadgetBase                          (common GA_* attrs)
│   ├── Button     gadgets/button.gadget
│   ├── CheckBox
│   ├── RadioButton
│   ├── Slider
│   ├── Scroller
│   ├── Integer
│   ├── StringGadget
│   ├── Chooser
│   ├── ClickTab
│   ├── ListBrowser
│   ├── Palette
│   ├── Space
│   ├── FuelGauge
│   ├── SpeedBar
│   ├── GetFile / GetFont / GetScreenMode / GetColor
│   ├── DateBrowser
│   ├── TextEditor
│   ├── SketchBoard
│   ├── TapeDeck
│   ├── ColorWheel
│   ├── GradientSlider
│   └── Layout     gadgets/layout.gadget
│       ├── Page
│       └── Virtual
├── ImageBase                           (common IA_* attrs)
│   ├── Label      images/label.image
│   ├── Led        images/led.image
│   ├── Bevel      images/bevel.image
│   ├── Glyph      images/glyph.image
│   └── Bitmap     images/bitmap.image
└── ReactionWindow (aliased Window) classes/window.class
```

Each concrete class sets three static fields:

| Field | Purpose |
|---|---|
| `_classLibName` | Path-prefixed OpenLibrary name, e.g. `'gadgets/button.gadget'` |
| `_classLibLvo`  | LVO of `XXX_GetClass` — `-30` for every Reaction class |
| `ATTRS`          | Map from JS property names to `{ tagID, type, readOnly? }` |

---

## Lifecycle

```
new Button({text: 'OK', id: 1})
  │
  ├─ Button.ensureClass()          ← lazy, once per process
  │    OpenLibrary('gadgets/button.gadget', 40)
  │    amiga.call(base, -30, {})   → BUTTON_GetClass → Class*
  │    caches on Button._classPtr + Button._libBase
  │
  ├─ _buildTagList({text, id})    ← ATTRS lookup + codec
  │    [[GA_Text, <alloc'd strptr>],
  │     [GA_ID,   1]]              (plus any _extraPairs)
  │    amiga.makeTags → TagItem* memory
  │
  ├─ Intuition.NewObjectA(Class*, NULL, tagList)
  │    → raw BOOPSI pointer        (ptr stored on this)
  │
  └─ (children added depth-first via OM_ADDMEMBER or LAYOUT_AddChild)
```

`win.open()` calls `doMethod(WM_OPEN)` → returns the real `struct
Window*`, wrapped in the `amiga.intuition.Window` struct class so the
event loop can read `UserPort`.

`win.dispose()` calls `WM_CLOSE` then `Intuition.DisposeObject` on the
BOOPSI root; Reaction cascades destruction down the child tree.
Allocated `string-owned` buffers are freed at the same time.

---

## Attribute system (ATTRS)

Each concrete class has an `ATTRS` object mapping JS attribute names
to descriptor objects:

```js
static ATTRS = {
  ...GADGET_ATTRS,
  min:         { tagID: SLIDER.Min,   type: 'int32' },
  max:         { tagID: SLIDER.Max,   type: 'int32' },
  level:       { tagID: SLIDER.Level, type: 'int32' },
  orientation: { tagID: SLIDER.Orientation, type: 'uint32' },
  // ...
};
```

The Codec `type` picks encode/decode. Available types:

| Type            | JS → ULONG (encode)                | ULONG → JS (decode) |
|-----------------|-----------------------------------|--------------------|
| `bool`          | `v ? 1 : 0`                        | `v !== 0`           |
| `int32`         | `v \| 0`                           | `v \| 0`            |
| `uint32`        | `v >>> 0`                          | `v >>> 0`           |
| `string`        | `typeof v === 'number' ? v : 0`    | `peekString(v)`    |
| `string-owned`  | allocMem + pokeString (auto-free)  | `peekString(v)`    |
| `ptr`           | `v.ptr \| v`                       | raw number          |
| `enum`          | `Number(v)`                        | raw number          |

`readOnly: true` disallows the attribute in `new`/`set` but allows
reads via `get`.

Access:

```js
slider.get('level');         // OM_GET via Intuition.getAttr
slider.set({ level: 72 });   // OM_SET via Intuition.SetAttrsA
```

---

## Event model (EventKind)

EventKind is a `CEnumeration` that catalogs every IDCMP class plus
Reaction-specific attribute broadcasts. Each case carries:

```js
{
  idcmp: 0x00800000,             // raw IDCMP class bit
  rich:  { hasId, hasCode, hasCoords, hasSource, hasPressed },
  from:  'gadgets/button.gadget',// class that originated the kind
  wraps: 'ATTR_UPDATE',           // semantic parent (optional)
}
```

The `Window.events()` iterator:

1. Reads an `IntuiMessage` off the Reaction-allocated UserPort.
2. Matches `msg.class` against every `EventKind` whose
   `value.idcmp` matches AND whose `from === 'intuition'` —
   the raw IDCMP case.
3. If `msg.class === 0x00800000` (IDCMPUPDATE), walks the
   TagList at `msg.iaddress`:
   - Extracts `GA_ID` → `event.sourceId`.
   - Looks up `event.source` from the JS-side child registry.
   - Records any other tags into `event.attrs[tagID]`.
   - If a class-specific EventKind has `from` matching
     `source._classLibName`, upgrades `event.kind` to that kind
     (e.g. `ATTR_UPDATE` → `BUTTON_CLICK`).
4. Fires registered `.on(kind, fn)` handlers.
5. Yields the rich event.

Registered EventKinds at 0.148:

### Core IDCMP kinds (from=intuition)

`SIZE_VERIFY`, `NEW_SIZE`, `REFRESH_WINDOW`, `MOUSE_BUTTONS`,
`MOUSE_MOVE`, `GADGET_DOWN`, `GADGET_UP`, `REQ_SET`, `MENU_PICK`,
`CLOSE_WINDOW`, `RAW_KEY`, `REQ_VERIFY`, `REQ_CLEAR`, `MENU_VERIFY`,
`NEW_PREFS`, `DISK_INSERTED`, `DISK_REMOVED`, `WBENCH_MESSAGE`,
`ACTIVE_WINDOW`, `INACTIVE_WINDOW`, `DELTA_MOVE`, `VANILLA_KEY`,
`INTUITICKS`, `ATTR_UPDATE`, `MENU_HELP`, `CHANGE_WINDOW`,
`GADGET_HELP`, `EXTENDED_MOUSE`.

### Class-specific kinds (from=<libname>)

| Class            | Kind                  |
|------------------|-----------------------|
| Button           | `BUTTON_CLICK`        |
| CheckBox         | `CHECKBOX_TOGGLE`     |
| RadioButton      | `RADIO_SELECT`        |
| Slider           | `SLIDER_CHANGE`       |
| Scroller         | `SCROLLER_CHANGE`     |
| Integer          | `INTEGER_CHANGED`     |
| StringGadget     | `STRING_CHANGED`      |
| Chooser          | `CHOOSER_SELECT`      |
| ClickTab         | `CLICKTAB_CHANGE`     |
| ListBrowser      | `LIST_SELECT`         |
| Palette          | `PALETTE_CHANGE`      |
| SpeedBar         | `SPEEDBAR_CLICK`      |
| GetFile          | `FILE_SELECTED`       |
| GetFont          | `FONT_SELECTED`       |
| GetScreenMode    | `SCREENMODE_SELECTED` |
| GetColor         | `COLOR_SELECTED`      |
| DateBrowser      | `DATE_CHANGE`         |
| TextEditor       | `TEXT_CHANGE`         |
| SketchBoard      | `SKETCH_UPDATE`       |
| TapeDeck         | `TAPEDECK_CLICK`      |
| ColorWheel       | `COLORWHEEL_CHANGE`   |
| GradientSlider   | `GRADIENT_CHANGE`     |

---

## Tag list shapes

Three forms, all accepted by `amiga.makeTags()` /
`amiga.withTags(..., fn)`:

```js
// 1. Pair-array (original):
amiga.makeTags([[WA_Title, 'foo'], [WA_Width, 200]]);

// 2. Flat array (adjacent tag/data). Optional trailing TAG_END=0.
amiga.makeTags([WA_Title, 'foo', WA_Width, 200]);

// 3. Variadic — hand-written code's favorite:
amiga.makeTags(WA_Title, 'foo', WA_Width, 200);
```

Detection: first arg not an array → variadic. First arg is array and
its element[0] is also an array → pair-array mode. Otherwise flat-
array. An odd number of items throws TypeError.

`withTags` takes all shapes plus a trailing callback:

```js
amiga.withTags(WA_Title, 'foo', WA_Width, 200, (tagPtr) => {
  // use tagPtr here, auto-freed on return
});
```

---

## Catalog of wrapped classes

Flat namespace (preferred for scripts):

```
amiga.boopsi.Window
amiga.boopsi.Layout / Page / Virtual
amiga.boopsi.Button / CheckBox / RadioButton / Slider / Scroller /
            Integer / StringGadget / Chooser / ClickTab / ListBrowser /
            Palette / Space / FuelGauge / SpeedBar / GetFile /
            GetFont / GetScreenMode / GetColor / DateBrowser /
            TextEditor / SketchBoard / TapeDeck / ColorWheel /
            GradientSlider
amiga.boopsi.Label / Led / Bevel / Glyph / Bitmap
```

Origin-namespaced (useful for tooling):

```
amiga.boopsi.classes.Window
amiga.boopsi.gadgets.<Name>
amiga.boopsi.images.<Name>
```

Value enums:

```
amiga.boopsi.WindowPosition    // CENTERSCREEN, CENTERWINDOW, ...
amiga.boopsi.LayoutOrient      // HORIZONTAL, VERTICAL
amiga.boopsi.LabelJustify      // LEFT, CENTER, RIGHT
amiga.boopsi.BevelStyle        // NONE, XEN, RIDGE, GROOVE, BUTTON, ...
amiga.boopsi.GlyphKind         // UPARROW, ..., CLOSE, DEPTH, ZOOM, ...
amiga.boopsi.SliderOrient      // HORIZONTAL, VERTICAL
amiga.boopsi.ScrollerOrient
amiga.boopsi.FuelGaugeOrient
amiga.boopsi.ChooserJustify
amiga.boopsi.StringHookType    // CUSTOM, PASSWORD, IPADDRESS, ...
amiga.boopsi.TapeDeckMode      // STOP, PLAY, FFWD, REW, RECORD, ...
```

Node-attribute namespaces for struct-List child nodes:

```
amiga.boopsi.CNA   // Chooser nodes:  Text, Image, SelImage, UserData, ...
amiga.boopsi.TNA   // ClickTab tabs:  Text, Number, UserData, Image, ...
amiga.boopsi.SBNA  // SpeedBar items: Ordinal, Image, Label, HintInfo, ...
```

---

## IDCMP constants

```
amiga.boopsi.IDCMP.{
  SIZE_VERIFY,     NEW_SIZE,         REFRESH_WINDOW,
  MOUSE_BUTTONS,   MOUSE_MOVE,       DELTA_MOVE,
  GADGET_DOWN,     GADGET_UP,        GADGET_HELP,
  REQ_SET,         REQ_VERIFY,       REQ_CLEAR,
  MENU_PICK,       MENU_VERIFY,      MENU_HELP,
  CLOSE_WINDOW,    ACTIVE_WINDOW,    INACTIVE_WINDOW,
  CHANGE_WINDOW,   RAW_KEY,          VANILLA_KEY,
  INTUITICKS,      IDCMPUPDATE,
  NEW_PREFS,       DISK_INSERTED,    DISK_REMOVED,
  WBENCH_MESSAGE,  EXTENDED_MOUSE,
}

amiga.boopsi.IDCMP_REACTION_DEFAULT
  = CLOSE_WINDOW | REFRESH_WINDOW | NEW_SIZE |
    ACTIVE_WINDOW | INACTIVE_WINDOW |
    GADGET_UP | GADGET_DOWN |
    IDCMPUPDATE |
    VANILLA_KEY | RAW_KEY |
    CHANGE_WINDOW | GADGET_HELP
```

Always include `IDCMPUPDATE` (0x00800000) in your mask to receive
Reaction attribute-change broadcasts, including button clicks.

---

## Internals — how dispatch works

`BOOPSIBase.doMethod(methodID, ...args)` (used internally by
`win.open()` for WM_OPEN, by `layout.addChild()` for OM_ADDMEMBER,
etc):

1. Allocates a message struct: 4 bytes per word × (1 + args.length).
2. First ULONG = methodID.
3. Remaining ULONGs = args in order.
4. Calls `amiga.doMethod(obj.ptr, msg.ptr)` which is a native primitive
   in `quickjs.library`:

   ```c
   Class *cl = *(Class **)(obj - 4);       // object header
   struct Hook *hook = cl;                 // cl_Dispatcher at +0
   ULONG h_entry = *(ULONG*)((char*)cl+8); // Hook.h_Entry at +8
   // jsr h_entry with A0=hook, A2=obj, A1=msg (Hook convention)
   ```

The asm trampoline is `amiga_boopsi_call.s`; it saves callee regs,
loads A0/A1/A2, JSRs, restores.

Windows use `WM_OPEN=0x570002` / `WM_CLOSE=0x570003` from NDK
`classes/window.h:307-308`. BOOPSI method IDs are plain integers —
they are NOT offsets of `WINDOW_Dummy`.

---

## Known gotchas

1. **IDCMPUPDATE bit is 0x00800000, not 0x40000000.** Easy to
   misremember because `0x40000000` looks like a Reaction-reserved
   upper bit. The real value lives at `intuition.h:887`.
2. **Class library names need subdirectory prefixes.** On OS3.2 the
   Reaction classes live in `LIBS:images/` and `LIBS:gadgets/`, so
   `OpenLibrary('label.image', 40)` FAILS — you need
   `'images/label.image'`. Only `window.class` lives at `LIBS:` root.
   All wrappers use the correct names out of the box.
3. **`NewObjectA(class, classID, tagList)` — class is FIRST.** If
   you're hand-rolling BOOPSI calls, don't swap the first two args.
   Passing `(0, classPtr, ...)` makes Intuition interpret the Class*
   as a null-terminated class-name string, reading garbage.
4. **Buttons need `GA_RelVerify=TRUE`** to fire events. `Button`,
   `CheckBox`, `RadioButton`, `Slider`, `Scroller`, `Integer`,
   `StringGadget`, `Chooser`, `ClickTab`, `ListBrowser`, `Palette`,
   `SpeedBar`, `GetFile/Font/ScreenMode/Color`, `DateBrowser`,
   `TapeDeck`, `ColorWheel`, `GradientSlider` all default
   `relVerify=true` in their constructor. Pass `relVerify: false`
   for a display-only widget.
5. **`LAYOUT_AddChild` at NewObject time, not after.** Reaction's
   layout.gadget wants children declared as repeated tags in the
   construction tag list. Our `Layout({children:[...]})` handles
   this via `_extraPairs`. The runtime `layout.addChild(child)`
   fallback is OM_ADDMEMBER-based and less reliable.
6. **Window event loop is unending** — blocks on `Exec.Wait` for the
   UserPort signal, yields every queued IntuiMessage, auto-replies
   in `finally`. Break out explicitly or close the window externally.
7. **`_id` on BOOPSIBase** is the JS-side mirror of `GA_ID` used for
   the child-lookup registry. Set via `init.id`; don't mutate after
   construction.
