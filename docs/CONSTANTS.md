# Constants and structure offsets

AmigaOS is driven by numbers: tags, flags, method IDs, library offsets,
and the positions of fields inside structures. A wrong one does not
raise an error. The OS does something else, or the script reads memory
that belongs to somebody else.

So in this project **nobody types such a number**. Each one is either
written into the JavaScript by a script that read it from the NDK
headers, or checked against the headers (or the C compiler) by a script
that fails when it differs.

This page is in two parts: using the constants from a script, and
maintaining them.


## Part 1: using them from JavaScript

### Where the names live

| You want | Look in | Example |
|---|---|---|
| Window tags, flags, IDCMP classes | `Intuition.consts` | `C.WA_InnerWidth`, `C.WFLG_DRAGBAR`, `C.IDCMP_CLOSEWINDOW` |
| Screen tags, pens, overscan | `Intuition.consts` | `C.SA_Depth`, `C.TEXTPEN`, `C.OSCAN_TEXT` |
| Menu flags, mouse buttons | `Intuition.consts` | `C.CHECKIT`, `C.MENUNULL`, `C.SELECTDOWN` |
| Image and gadget attributes | `Intuition.consts` | `C.IA_FrameType`, `C.SYSIA_Which`, `C.GA_ID` |
| Memory flags, signals, node types | `Exec.consts` | `Exec.consts.MEMF_CLEAR`, `SIGBREAKF_CTRL_C` |
| File modes, locks, error codes | `Dos.consts` | `Dos.consts.MODE_OLDFILE`, `SHARED_LOCK`, `ERROR_OBJECT_NOT_FOUND` |
| Draw modes, font styles | `Graphics.consts` | `Graphics.consts.JAM1`, `FSF_BOLD` |
| GadTools kinds and tags | `GadTools.consts` | `GadTools.consts.BUTTON_KIND`, `GTCB_Checked` |
| ASL requester tags | `Asl.consts` | `Asl.consts.ASLFR_TitleText` |
| timer.device units and commands | `TimerRequest.consts` | `T.UNIT_VBLANK`, `T.TR_ADDREQUEST` |

The names are the header's own, unchanged, so anything written about
AmigaOS programming in C applies directly.

At the REPL, list a family:

```js
[...Intuition.consts.cases()].filter(name => name.startsWith('WA_'))
```

### Using a constant

A constant is an object, not a bare number, but it turns into its
number wherever a number is expected:

```js
const C = Intuition.consts;

let window = Intuition.OpenWindowTags([
  [C.WA_InnerWidth, 300],                             // as a tag
  [C.WA_Flags, C.WFLG_DRAGBAR | C.WFLG_CLOSEGADGET],  // joined with |
  [C.WA_IDCMP, C.IDCMP_CLOSEWINDOW],
]);

request.command = TimerRequest.consts.TR_ADDREQUEST;  // into a field
```

Several can be pulled out at once:

```js
const { CHECKIT, ITEMTEXT, MENUTOGGLE } = Intuition.consts;
item.flags = CHECKIT | ITEMTEXT | MENUTOGGLE;
```

### Three things to know

**1. A misspelt name is an error, straight away.**

```js
C.WA_Tittle
// TypeError: IntuitionConsts has no constant WA_Tittle
//            - did you mean WA_Title?
```

This is deliberate. It used to give `undefined`, which in a tag list was
written as 0, and 0 ends the list: every tag after the mistake was
silently ignored.

To ask whether a constant exists (say, to check the library is new
enough), use `in`, which does not throw:

```js
if (!('WA_InnerWidth' in Intuition.consts)) {
  print('Need quickjs.library 0.217 or later');
}
```

**2. With `===`, compare against another constant, or use `Number()`.**

A constant is only equal to itself. `message.class` gives you a
constant, so this works:

```js
if (message.class === C.IDCMP_CLOSEWINDOW) ...
```

but a raw number read from a field is a number, so convert the
constant:

```js
const SELECTDOWN = Number(C.SELECTDOWN);
if (message.code === SELECTDOWN) ...
```

**3. In arithmetic and with `==` it is its number; as text it is its
name.**

```js
C.WA_Left + 1          // 0x80000065
message.code == C.SELECTDOWN   // true when they match (==, not ===)
String(C.WA_Left)      // 'WA_Left'
`tag ${C.WA_Left}`     // 'tag WA_Left'
'tag ' + C.WA_Left     // 'tag 2147483748': + means arithmetic first
```

### Finding a constant from its value

```js
C.fromPrefix('IDCMP_', 0x200)   // the IDCMP_CLOSEWINDOW constant
```

A value alone is not enough: 0x200 is `IDCMP_CLOSEWINDOW`, but it is
also `WFLG_REPORTMOUSE`. Say which family you mean.

### Menu numbers

The header's macros are functions on `Intuition`:

```js
let menu = Intuition.MENUNUM(code);    // which menu
let item = Intuition.ITEMNUM(code);    // which item
let sub  = Intuition.SUBNUM(code);     // which sub-item
if (code === Number(C.MENUNULL)) ...   // nothing was picked
```

### Structures

A structure wrapper gives fields by name, so a script never needs an
offset:

```js
let font = new TextAttr(pointer);
print(font.name + ' / ' + font.ySize);
```

If a field you need has no getter, add one to the wrapper (see Part 2)
rather than calling `amiga.peek16(pointer + 4)` in the script.

### In a tag list, a bad tag is refused

`amiga.makeTags`, and everything built on it (`OpenWindowTags`,
`NewObjectTags`, ...), throws if a tag is `undefined`, `null` or not a
number, naming its position.


## Part 2: maintaining them

Three scripts, all in `scripts/`. Run the two checks before every
build; both exit non-zero when something is wrong.

```sh
python3 scripts/check_constants.py     # values against the headers
python3 scripts/check_structs.py       # offsets against the compiler
python3 scripts/gen_consts.py --check  # are the generated tables current?
```

### `gen_consts.py` writes the `consts` tables

The library's `X.consts` tables are generated. A manifest at the top of
the script says which names each table holds, as families:

```python
('Window attributes: tags for OpenWindowTags', 'intuition/intuition.h',
 ['re:WA_\\w+']),
```

The script looks every name up in `sdks/NDK3.2R4/Include_H` and writes
the table between two marker comments, with the header's own expression
beside each value:

```js
WA_InnerWidth:    0x80000076,   /* WA_Dummy + 0x13 */
```

To offer a new constant, add its name or its family's pattern to the
manifest and run `python3 scripts/gen_consts.py`. Do not edit between
the markers.

The tables are passed to `CEnumeration.lazy()`, which creates a
constant the first time it is used. That is why a table can hold
hundreds of names: with the old tables, 190 constants took about a third
of the library's start-up time.

### `check_constants.py` checks every other number

Tables that are not generated yet (the Reaction class attribute tables
such as `SLIDER`, `LAYOUT`, `WINDOW`), the raw tables in `extended.js`,
the library-offset tables, and constants in the examples are compared
with the headers and the pragma files.

It ties a table to the headers by its names. A full header name
(`WA_Left`) is compared directly. A short key (`Min` in a table of
slider attributes) is tied to prefix + key, where the prefix is the one
that makes the most keys of the table agree with the headers
(`SLIDER_`). A table can state its prefix instead:

```js
const OM = Object.freeze({
  /* check-constants: prefix OM_ header intuition/classusr.h */
  NEW: 0x101,
```

and one line can be tied to a header name its key does not resemble:

```js
VERTICAL_BAR: 6,   /* check-constants: is BVS_SBAR_HORIZ */
```

`--fix FILE` rewrites each wrong value in a file to the header's.
`--unverified` lists the numbers it could not tie to anything; look
through those when adding a table, because a table whose names match
nothing in the headers is invisible to the check.

### `check_structs.py` checks structure offsets

Each wrapper in `quickjs-master/amiga/ffi/structs` names its C struct
and lists the offsets it uses:

```js
/* check-structs: struct Window */
static OFFSET = Object.freeze({
  Width:     8,
  ReplyPort: 14,   /* io_Message.mn_ReplyPort */
});
```

and every access goes through the table:
`this.read16(Window.OFFSET.Width)`.

The script reads the field names from the header and asks vbcc for each
field's offset and size, so nothing in it knows the Amiga's alignment
rules. It checks each entry, that every `readN`/`writeN` uses the
table, that N matches the field's size, and `static SIZE` against
`sizeof`.

To see a layout:

```sh
python3 scripts/check_structs.py --layout Window
```

To add a field to a wrapper: find it in the layout, add the line to
`OFFSET`, add the getter, run the check.

### What these found

Running them for the first time, on 2026-11-12, corrected about sixty
values that had been typed by hand, among them:

- the BOOPSI method IDs (`OM_NEW` ... were 1 to 12 instead of 0x101 to
  0x10A, so `Layout.addChild` sent method 7)
- the window position values, where only `CENTERSCREEN` was right
- 14 of the 25 screen-mode requester tags, and the file requester tags
  from `FilterFunc` on (the header counts in decimal; they had been
  typed as hex)
- `MEMF_REVERSE` and `MEMF_TOTAL`, swapped
- three window tags that carried other tags' values
- `Gadget.gadgetID`, which read the field next to it
- `MsgPort.SIZE`, two bytes short

None of these failed loudly. That is the reason for the rule.
