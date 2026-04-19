/*
 * frameidemo.js — JS port of Examples1/intuition/frameidemo.c from NDK 3.1.
 *
 * Original: ESCOM AG, 1992-1996. Shows the four frame types provided by
 * frameiclass (the BOOPSI imageclass) in both normal and recessed states —
 * 8 frames in a 4×2 grid.
 *
 * This port exercises:
 *   - Older-style OpenWindow(&NewWindow) (not tag-list)
 *   - NewObjectA with BOOPSI imageclass "frameiclass"
 *   - DrawImage into the window's RastPort
 *   - BeginRefresh/EndRefresh for IDCMP_REFRESHWINDOW handling
 *   - Window struct field reads (RPort @ +50, WScreen @ +46, UserPort @ +86)
 *   - Screen->Font (@ +40) -> TextAttr->ta_YSize (@ +4) chain
 *
 * Run on the Amiga:  qjs examples/frameidemo.js
 * Requires:          quickjs.library 0.126+
 */

import * as std from 'qjs:std';

if (typeof amiga !== 'object') {
    print('amiga FFI not available — need quickjs.library 0.126+');
    std.exit(1);
}

/* ========================================================
 * Small helpers scoped to this example.
 * ========================================================
 *
 * cstr(s) — allocate a NUL-terminated copy of `s` in public memory
 * and return the pointer. Caller MUST freeMem(ptr, size) when done.
 * Returns { ptr, size } for bookkeeping.
 */
function cstr(s) {
    const bytes = s.length + 1;            /* ASCII + NUL */
    const ptr = amiga.allocMem(bytes);
    if (!ptr) throw new Error('cstr: allocMem failed');
    amiga.pokeString(ptr, s);
    return { ptr, size: bytes };
}
function freeCstr(cs) { if (cs && cs.ptr) amiga.freeMem(cs.ptr, cs.size); }

/* IA_ tag IDs from intuition/imageclass.h: IA_Dummy = TAG_USER + 0x20000 = 0x80020000 */
const IA = {
    Dummy:     0x80020000,
    Width:     0x80020003,
    Height:    0x80020004,
    Recessed:  0x80020015,
    FrameType: 0x8002001B,
};

const WBENCHSCREEN = 0x0001;

const I = amiga.intuition;
const SysBase = amiga.peek32(4);

/* ========================================================
 * Library opens
 * ======================================================== */
const gfx = amiga.openLibrary('graphics.library', 39);
if (!gfx) { print('graphics.library 39+ not available'); std.exit(1); }

const intuition = amiga.openLibrary('intuition.library', 39);
if (!intuition) {
    print('intuition.library 39+ not available');
    amiga.closeLibrary(gfx);
    std.exit(1);
}

/* ========================================================
 * Build the NewWindow struct in memory.
 *
 * struct NewWindow {         offset  size
 *     WORD LeftEdge;             0    2
 *     WORD TopEdge;              2    2
 *     WORD Width;                4    2
 *     WORD Height;               6    2
 *     UBYTE DetailPen;           8    1
 *     UBYTE BlockPen;            9    1
 *     ULONG IDCMPFlags;         10    4   (2-byte aligned)
 *     ULONG Flags;              14    4
 *     struct Gadget *FirstGadget;18   4
 *     struct Image *CheckMark;  22    4
 *     UBYTE *Title;             26    4
 *     struct Screen *Screen;    30    4
 *     struct BitMap *BitMap;    34    4
 *     WORD MinWidth;            38    2
 *     WORD MinHeight;           40    2
 *     UWORD MaxWidth;           42    2
 *     UWORD MaxHeight;          44    2
 *     UWORD Type;               46    2
 * };                             total 48
 * ======================================================== */
const NW_BYTES = 48;
const title = cstr('FrameIClass Demo');

const nw = amiga.allocMem(NW_BYTES);
if (!nw) {
    print('allocMem(NewWindow) failed');
    freeCstr(title); amiga.closeLibrary(intuition); amiga.closeLibrary(gfx);
    std.exit(1);
}

/* poke fields */
amiga.poke16(nw +  0, 0);      /* LeftEdge */
amiga.poke16(nw +  2, 0);      /* TopEdge */
amiga.poke16(nw +  4, 600);    /* Width */
amiga.poke16(nw +  6, 200);    /* Height */
amiga.poke8 (nw +  8, 0xFF);   /* DetailPen (-1) */
amiga.poke8 (nw +  9, 0xFF);   /* BlockPen (-1) */
amiga.poke32(nw + 10, I.IDCMP_CLOSEWINDOW | I.IDCMP_REFRESHWINDOW);
amiga.poke32(nw + 14, I.WFLG_DRAGBAR | I.WFLG_SIZEGADGET |
                      I.WFLG_DEPTHGADGET | I.WFLG_CLOSEGADGET |
                      I.WFLG_ACTIVATE /* WFLG_SMART_REFRESH is default */);
amiga.poke32(nw + 18, 0);      /* FirstGadget */
amiga.poke32(nw + 22, 0);      /* CheckMark */
amiga.poke32(nw + 26, title.ptr);
amiga.poke32(nw + 30, 0);      /* Screen */
amiga.poke32(nw + 34, 0);      /* BitMap */
amiga.poke16(nw + 38, 100);    /* MinWidth */
amiga.poke16(nw + 40, 50);     /* MinHeight */
amiga.poke16(nw + 42, 640);    /* MaxWidth */
amiga.poke16(nw + 44, 200);    /* MaxHeight */
amiga.poke16(nw + 46, WBENCHSCREEN);

/* ========================================================
 * OpenWindow(&nw) — a0 = NewWindow*
 * ======================================================== */
const win = amiga.call(intuition, I.lvo.OpenWindow, { a0: nw });
if (!win) {
    print('OpenWindow failed');
    amiga.freeMem(nw, NW_BYTES);
    freeCstr(title);
    amiga.closeLibrary(intuition); amiga.closeLibrary(gfx);
    std.exit(1);
}
print('Window open at 0x' + win.toString(16).toUpperCase() + '.');

/* Window field reads — offsets in intuition/intuition.h. */
const rport      = amiga.peek32(win + 50);   /* Window.RPort */
const wscreen    = amiga.peek32(win + 46);   /* Window.WScreen */
const fontAttr   = amiga.peek32(wscreen + 40);  /* Screen.Font */
const fontYSize  = amiga.peek16(fontAttr + 4);  /* TextAttr.ta_YSize */
const userPort   = amiga.peek32(win + 86);   /* Window.UserPort */
const sigBit     = amiga.peek8 (userPort + 15); /* MsgPort.mp_SigBit */
const sigMask    = 1 << sigBit;

/* ========================================================
 * Draw the 8 frames.
 * ======================================================== */
const classId = cstr('frameiclass');
const framesAllocated = [];
try {
    for (let recessed = 0; recessed <= 1; recessed++) {
        for (let frametype = 0; frametype <= 3; frametype++) {
            const tagsCs = amiga.makeTags([
                [IA.FrameType, frametype],
                [IA.Recessed,  recessed],
                [IA.Width,     80],
                [IA.Height,    20],
            ]);
            const tagsSize = 5 * 8;
            /* NewObjectA(NULL, "frameiclass", tagList) — a0/a1/a2 */
            const frame = amiga.call(intuition, I.lvo.NewObjectA, {
                a0: 0, a1: classId.ptr, a2: tagsCs,
            });
            amiga.freeMem(tagsCs, tagsSize);  /* NewObject copies what it needs */

            if (!frame) {
                print('NewObject(frameiclass) failed at recessed='+recessed+
                      ' frametype='+frametype);
                continue;
            }
            framesAllocated.push(frame);

            const x = 20 + frametype * 100;
            const y = fontYSize + 12 + recessed * 30;
            /* DrawImage(RastPort, Image, left, top) — a0/a1/d0/d1 */
            amiga.call(intuition, I.lvo.DrawImage, {
                a0: rport, a1: frame, d0: x, d1: y,
            });
        }
    }

    /* ========================================================
     * Event loop
     * ======================================================== */
    let terminated = false;
    while (!terminated) {
        amiga.call(SysBase, amiga.exec.lvo.Wait, { d0: sigMask });

        let msg;
        while ((msg = amiga.call(SysBase, amiga.exec.lvo.GetMsg,
                                 { a0: userPort })) !== 0) {
            const cls = amiga.peek32(msg + 20);   /* IntuiMessage.Class */
            amiga.call(SysBase, amiga.exec.lvo.ReplyMsg, { a1: msg });

            if (cls === I.IDCMP_CLOSEWINDOW) {
                terminated = true;
            } else if (cls === I.IDCMP_REFRESHWINDOW) {
                amiga.call(intuition, I.lvo.BeginRefresh, { a0: win });
                /* Re-draw all frames — they were lost when the window got
                 * damaged. DrawImage doesn't persist across refresh. */
                let idx = 0;
                for (let r = 0; r <= 1; r++) {
                    for (let t = 0; t <= 3; t++) {
                        if (framesAllocated[idx]) {
                            amiga.call(intuition, I.lvo.DrawImage, {
                                a0: rport, a1: framesAllocated[idx],
                                d0: 20 + t * 100,
                                d1: fontYSize + 12 + r * 30,
                            });
                        }
                        idx++;
                    }
                }
                amiga.call(intuition, I.lvo.EndRefresh, { a0: win, d0: 1 });
            }
        }
    }
} finally {
    /* ========================================================
     * Cleanup in reverse order
     * ======================================================== */
    for (const f of framesAllocated) {
        amiga.call(intuition, I.lvo.DisposeObject, { a0: f });
    }
    amiga.call(intuition, I.lvo.CloseWindow, { a0: win });
    amiga.freeMem(nw, NW_BYTES);
    freeCstr(title);
    freeCstr(classId);
    amiga.closeLibrary(intuition);
    amiga.closeLibrary(gfx);
}
print('Clean exit.');
