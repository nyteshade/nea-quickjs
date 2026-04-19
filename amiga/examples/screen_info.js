/*
 * screen_info.js — dump geometry, color depth, and default font of the
 * current public (Workbench) screen.
 *
 * Uses LockPubScreen / UnlockPubScreen — the safe way to inspect a public
 * screen without opening a window on it. No event loop, no cleanup drama:
 * lock, peek fields, unlock, print, exit.
 *
 * Run:        qjs examples/screen_info.js
 * Requires:   quickjs.library 0.126+
 */

import * as std from 'qjs:std';

if (typeof amiga !== 'object') {
    print('amiga FFI not available — need quickjs.library 0.126+');
    std.exit(1);
}

const intuition = amiga.openLibrary('intuition.library', 0);
if (!intuition) { print('intuition.library unavailable'); std.exit(1); }

try {
    /* LockPubScreen(name)
     *   - name=NULL → default public screen (typically "Workbench")
     *   - a0 = STRPTR name
     *   - returns: struct Screen * in d0, or NULL on failure. */
    const screen = amiga.call(intuition, amiga.intuition.lvo.LockPubScreen, { a0: 0 });

    if (!screen) {
        print('LockPubScreen(NULL) failed — is Workbench running?');
        std.exit(1);
    }

    /* struct Screen field offsets (intuition/screens.h, 2-byte aligned):
     *   +0   NextScreen       (ptr, 4)
     *   +4   FirstWindow      (ptr, 4)
     *   +8   LeftEdge         (WORD, 2)
     *   +10  TopEdge          (WORD, 2)
     *   +12  Width            (WORD, 2)
     *   +14  Height           (WORD, 2)
     *   +16  MouseY, +18 MouseX  (WORD each)
     *   +20  Flags            (UWORD, 2)
     *   +22  Title            (STRPTR, 4)
     *   +26  DefaultTitle     (STRPTR, 4)
     *   +30  BarHeight (BYTE), +31 BarVBorder, +32 BarHBorder,
     *        +33 MenuVBorder, +34 MenuHBorder,
     *        +35 WBorTop, +36 WBorLeft, +37 WBorRight, +38 WBorBottom
     *   +40  Font             (struct TextAttr *, 4 — 2-byte aligned pad at 39)
     *
     * struct TextAttr:
     *   +0  ta_Name   (STRPTR, 4)
     *   +4  ta_YSize  (UWORD, 2)
     *   +6  ta_Style  (UBYTE, 1)
     *   +7  ta_Flags  (UBYTE, 1)
     */
    const leftEdge  = amiga.peek16(screen + 8);
    const topEdge   = amiga.peek16(screen + 10);
    const width     = amiga.peek16(screen + 12);
    const height    = amiga.peek16(screen + 14);
    const flags     = amiga.peek16(screen + 20);
    const title     = amiga.peek32(screen + 22);
    const titleStr  = title ? amiga.peekString(title, 64) : '<null>';
    const barHeight = amiga.peek8 (screen + 30);
    const wBorTop   = amiga.peek8 (screen + 35);
    const wBorLeft  = amiga.peek8 (screen + 36);
    const wBorRight = amiga.peek8 (screen + 37);
    const wBorBot   = amiga.peek8 (screen + 38);
    const fontAttr  = amiga.peek32(screen + 40);
    const fontName  = fontAttr ? amiga.peekString(amiga.peek32(fontAttr), 64) : '<null>';
    const fontYSize = fontAttr ? amiga.peek16(fontAttr + 4) : 0;
    const fontStyle = fontAttr ? amiga.peek8 (fontAttr + 6) : 0;
    const fontFlags = fontAttr ? amiga.peek8 (fontAttr + 7) : 0;

    print('Public screen:');
    print('  Title:      "' + titleStr + '"');
    print('  Geometry:   ' + width + 'x' + height + ' at (' + leftEdge + ',' + topEdge + ')');
    print('  Flags:      0x' + flags.toString(16));
    print('  TitleBar:   ' + (barHeight + 1) + 'px');
    print('  Borders:    top=' + wBorTop + ' left=' + wBorLeft +
          ' right=' + wBorRight + ' bottom=' + wBorBot + ' px');
    print('  Font:       "' + fontName + '" ' + fontYSize + 'pt' +
          ' (style 0x' + fontStyle.toString(16) +
          ', flags 0x' + fontFlags.toString(16) + ')');

    amiga.call(intuition, amiga.intuition.lvo.UnlockPubScreen, { a0: 0, a1: screen });
} finally {
    amiga.closeLibrary(intuition);
}
