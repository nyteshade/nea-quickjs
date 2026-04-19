/*
 * window_hello.js — minimal Intuition window using raw Q1 FFI.
 *
 * Opens a 320x120 window with dragbar, depth gadget, close gadget, and
 * WFLG_ACTIVATE. Waits for a close-gadget click or any mouse button, then
 * closes everything cleanly.
 *
 * Demonstrates:
 *   - amiga.openLibrary / closeLibrary
 *   - amiga.makeTags / freeMem for Intuition WA_* tag lists
 *   - amiga.call for OpenWindowTagList / CloseWindow
 *   - exec WaitPort / GetMsg / ReplyMsg for the IDCMP event loop
 *   - peek32 to read struct fields (Window->UserPort @ +86, IntuiMessage->Class @ +20)
 *
 * Run on the Amiga with:   qjs examples/window_hello.js
 *
 * Library version: requires quickjs.library 0.125 or later.
 */

import * as std from 'qjs:std';

if (typeof amiga !== 'object' || typeof amiga.openLibrary !== 'function') {
    print('amiga FFI not available — need quickjs.library 0.125+');
    std.exit(1);
}

/* SysBase is always at absolute address 4 — canonical AmigaOS convention. */
const SysBase = amiga.peek32(4);
if (!SysBase) {
    print('SysBase missing — system not Amiga?');
    std.exit(1);
}

const intuition = amiga.openLibrary('intuition.library', 0);
if (!intuition) {
    print('Could not open intuition.library');
    std.exit(1);
}

const I = amiga.intuition;
const wflg  = I.WFLG_DRAGBAR | I.WFLG_DEPTHGADGET | I.WFLG_CLOSEGADGET | I.WFLG_ACTIVATE;
const idcmp = I.IDCMP_CLOSEWINDOW | I.IDCMP_MOUSEBUTTONS;

/* Build a TagItem array for OpenWindowTagList. 6 pairs + 1 terminator
 * = 7 TagItems = 7 * 8 = 56 bytes. Intuition copies what it needs during
 * OpenWindowTagList, so we're free to freeMem() after the call. */
const tags = amiga.makeTags([
    [I.WA_Left,   60],
    [I.WA_Top,    40],
    [I.WA_Width,  320],
    [I.WA_Height, 120],
    [I.WA_Flags,  wflg],
    [I.WA_IDCMP,  idcmp],
]);
if (!tags) {
    print('makeTags failed');
    amiga.closeLibrary(intuition);
    std.exit(1);
}
const tagsBytes = 7 * 8;

/* OpenWindowTagList(newWindow=NULL, tagList) — tagList goes in A1. */
const win = amiga.call(intuition, I.lvo.OpenWindowTagList, { a1: tags });
if (!win) {
    print('OpenWindowTagList failed');
    amiga.freeMem(tags, tagsBytes);
    amiga.closeLibrary(intuition);
    std.exit(1);
}

print('Window open at 0x' + win.toString(16).toUpperCase() +
      '. Click inside or hit the close gadget to exit.');

/* Struct Window field offsets (canonical, Amiga NDK 3.2, 2-byte aligned):
 *   +86  UserPort (struct MsgPort*)
 * Struct IntuiMessage field offsets:
 *   +20  Class (ULONG) — the IDCMP_* flag for this message
 *   +24  Code (UWORD)  — event-specific
 *   +32  MouseX, +34 MouseY (WORD) */
const userPort = amiga.peek32(win + 86);

let running = true;
while (running) {
    /* Block until at least one message is on the port. */
    amiga.call(SysBase, amiga.exec.lvo.WaitPort, { a0: userPort });

    /* Drain all pending messages — GetMsg returns 0 when empty. */
    let msg;
    while ((msg = amiga.call(SysBase, amiga.exec.lvo.GetMsg, { a0: userPort })) !== 0) {
        const cls = amiga.peek32(msg + 20);

        /* ReplyMsg immediately so Intuition can recycle the message slot. */
        amiga.call(SysBase, amiga.exec.lvo.ReplyMsg, { a1: msg });

        if (cls === I.IDCMP_CLOSEWINDOW) {
            print('Got CLOSEWINDOW — exiting.');
            running = false;
            break;
        }
        if (cls === I.IDCMP_MOUSEBUTTONS) {
            const code = amiga.peek16(msg + 24);  /* MENUDOWN/SELECTDOWN etc. */
            print('Got MOUSEBUTTONS (code=0x' + code.toString(16) + ') — exiting.');
            running = false;
            break;
        }
    }
}

/* Cleanup in reverse order. */
amiga.call(intuition, I.lvo.CloseWindow, { a0: win });
amiga.freeMem(tags, tagsBytes);
amiga.closeLibrary(intuition);
print('Clean exit.');
