/*
 * drawing_demo.js — exercise graphics.library primitives from JS.
 *
 * Opens a 400×240 window and draws a grid of shapes into its RastPort:
 *   - horizontal line (Move / Draw)
 *   - filled rectangle (RectFill)
 *   - open rectangle outline (4 Draw calls)
 *   - cross-hatch (repeated Move + Draw)
 *   - labeled text (Move + Text)
 *
 * Each block uses a different pen color (SetAPen 1..3). Waits for
 * close-gadget or mouse click; repaints on IDCMP_REFRESHWINDOW.
 *
 * Run:        qjs examples/drawing_demo.js
 * Requires:   quickjs.library 0.126+
 */

import * as std from 'qjs:std';

if (typeof amiga !== 'object') {
    print('amiga FFI not available — need quickjs.library 0.126+');
    std.exit(1);
}

const SysBase = amiga.peek32(4);
const I = amiga.intuition;
const G = amiga.graphics;

const intuition = amiga.openLibrary('intuition.library', 39);
if (!intuition) { print('intuition.library 39+ unavailable'); std.exit(1); }
const gfx = amiga.openLibrary('graphics.library', 39);
if (!gfx) {
    print('graphics.library 39+ unavailable');
    amiga.closeLibrary(intuition); std.exit(1);
}

/* Open window via tag-list (cleaner than NewWindow for Q1 examples). */
const wflg  = I.WFLG_DRAGBAR | I.WFLG_DEPTHGADGET | I.WFLG_CLOSEGADGET | I.WFLG_ACTIVATE;
const idcmp = I.IDCMP_CLOSEWINDOW | I.IDCMP_MOUSEBUTTONS | I.IDCMP_REFRESHWINDOW;

const tags = amiga.makeTags([
    [I.WA_Left,   80],
    [I.WA_Top,    40],
    [I.WA_Width,  400],
    [I.WA_Height, 240],
    [I.WA_Flags,  wflg],
    [I.WA_IDCMP,  idcmp],
]);
const tagsBytes = 7 * 8;

const win = amiga.call(intuition, I.lvo.OpenWindowTagList, { a1: tags });
if (!win) {
    print('OpenWindowTagList failed');
    amiga.freeMem(tags, tagsBytes);
    amiga.closeLibrary(gfx); amiga.closeLibrary(intuition);
    std.exit(1);
}
print('Window open at 0x' + win.toString(16).toUpperCase() + '.');

const rport    = amiga.peek32(win + 50);   /* Window.RPort */
const userPort = amiga.peek32(win + 86);   /* Window.UserPort */
const sigBit   = amiga.peek8 (userPort + 15);
const sigMask  = 1 << sigBit;

/* ========================================================
 * The actual drawing routine — repainted on refresh.
 *
 * graphics.library calling conventions (from the NDK 3.2 autodocs):
 *   SetAPen(rp, pen)     — a1 = rp, d0 = pen
 *   Move(rp, x, y)       — a1 = rp, d0 = x, d1 = y
 *   Draw(rp, x, y)       — a1 = rp, d0 = x, d1 = y (line from cursor to x,y)
 *   RectFill(rp, x1,y1,x2,y2) — a1 = rp, d0..d3 = coords
 *   Text(rp, str, len)   — a1 = rp, a0 = str, d0 = len
 *
 * All coordinates are window-relative here (we didn't use GIMMEZEROZERO,
 * so they're in raw window coords — the title bar occupies y=0..15 or so).
 * Simple demo: just stay well inside the usable area.
 * ======================================================== */
function setAPen(pen) {
    amiga.call(gfx, G.lvo.SetAPen, { a1: rport, d0: pen });
}
function move(x, y) {
    amiga.call(gfx, G.lvo.Move,    { a1: rport, d0: x, d1: y });
}
function draw(x, y) {
    amiga.call(gfx, G.lvo.Draw,    { a1: rport, d0: x, d1: y });
}
function rectFill(x1, y1, x2, y2) {
    amiga.call(gfx, G.lvo.RectFill, {
        a1: rport, d0: x1, d1: y1, d2: x2, d3: y2,
    });
}
function drawText(x, y, s) {
    const cs = amiga.allocMem(s.length + 1);
    if (!cs) return;
    try {
        amiga.pokeString(cs, s);
        move(x, y);
        amiga.call(gfx, G.lvo.Text, { a1: rport, a0: cs, d0: s.length });
    } finally {
        amiga.freeMem(cs, s.length + 1);
    }
}

function repaint() {
    /* Title bar consumes ~16px at top; we start at y=30 to keep clear. */

    /* --- Block 1: horizontal line in pen 1 --- */
    setAPen(1);
    drawText(10, 40, 'Line:');
    move(80, 40);
    draw(360, 40);

    /* --- Block 2: filled rectangle in pen 2 --- */
    setAPen(2);
    drawText(10, 80, 'Rect:');
    rectFill(80, 65, 200, 95);

    /* --- Block 3: open rectangle outline in pen 3 --- */
    setAPen(3);
    drawText(10, 130, 'Outline:');
    /* Four lines — Move to start, then Draw through corners back to start. */
    move(80, 115);
    draw(360, 115);
    draw(360, 145);
    draw(80, 145);
    draw(80, 115);

    /* --- Block 4: cross-hatch using repeated lines --- */
    setAPen(1);
    drawText(10, 180, 'Hatch:');
    for (let i = 0; i < 10; i++) {
        const x = 80 + i * 20;
        move(x, 165);
        draw(x + 30, 195);
    }

    /* --- Block 5: label at bottom --- */
    setAPen(2);
    drawText(10, 220, 'Click or close to exit.');
}

repaint();

/* ========================================================
 * Event loop
 * ======================================================== */
let terminated = false;
while (!terminated) {
    amiga.call(SysBase, amiga.exec.lvo.Wait, { d0: sigMask });

    let msg;
    while ((msg = amiga.call(SysBase, amiga.exec.lvo.GetMsg,
                             { a0: userPort })) !== 0) {
        const cls = amiga.peek32(msg + 20);
        amiga.call(SysBase, amiga.exec.lvo.ReplyMsg, { a1: msg });

        if (cls === I.IDCMP_CLOSEWINDOW || cls === I.IDCMP_MOUSEBUTTONS) {
            terminated = true;
        } else if (cls === I.IDCMP_REFRESHWINDOW) {
            amiga.call(intuition, I.lvo.BeginRefresh, { a0: win });
            repaint();
            amiga.call(intuition, I.lvo.EndRefresh, { a0: win, d0: 1 });
        }
    }
}

amiga.call(intuition, I.lvo.CloseWindow, { a0: win });
amiga.freeMem(tags, tagsBytes);
amiga.closeLibrary(gfx);
amiga.closeLibrary(intuition);
print('Clean exit.');
