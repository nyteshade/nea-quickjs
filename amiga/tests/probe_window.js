/*
 * probe_window.js - walk through every call a plain Intuition window
 * example makes, one at a time, saying what comes next.
 *
 * This is a diagnostic, not an example. Each step is announced and
 * flushed to the console BEFORE it runs, so if the machine gurus or
 * freezes, the last line on screen names the call that did it.
 *
 * The steps, in order:
 *
 *   A. read constants, build a tag list, look at what was built
 *   B. open the window, free the tag list
 *   C. read the window's fields (RastPort, message port, screen, font)
 *   D. draw: pen, move, line, rectangle, text
 *   E. make a frameiclass image, draw it, dispose of it
 *   F. wait for the close gadget through window.messages()
 *   G. close the window
 *
 * Assumptions:
 *   - quickjs.library 0.215 or later
 *   - the default public screen is at least 400 x 160
 *
 * Run: qjs tests/probe_window.js
 */

import * as std from 'qjs:std';

/**
 * Announce the next step and push the text out to the console now.
 *
 * @param {string} text
 * @returns {undefined}
 */
function step(text) {
  std.out.puts(text + '\n');
  std.out.flush();
}

/**
 * Format a number as eight hex digits.
 *
 * @param {number} value
 * @returns {string}
 */
function hex(value) {
  return '0x' + (Number(value) >>> 0).toString(16).padStart(8, '0');
}

step('A0 script is running');

step('A1 read Intuition.consts');
const C = Intuition.consts;
step('   WA_Left=' + hex(C.WA_Left) + ' WA_Flags=' + hex(C.WA_Flags) +
     ' WA_IDCMP=' + hex(C.WA_IDCMP));

let windowFlags = C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
                | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE;
let idcmpFlags  = C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW;
step('   flags=' + hex(windowFlags) + ' idcmp=' + hex(idcmpFlags));

let pairs = [
  [C.WA_Left,   60],
  [C.WA_Top,    40],
  [C.WA_Width,  400],
  [C.WA_Height, 160],
  [C.WA_Flags,  windowFlags],
  [C.WA_IDCMP,  idcmpFlags],
];
let tagBytes = (pairs.length + 1) * 8;

step('A2 amiga.makeTags with ' + pairs.length + ' pairs');
let tags = amiga.makeTags(pairs);
step('   tag list at ' + hex(tags));

for (let index = 0; index <= pairs.length; index++) {
  step('   [' + index + '] ' + hex(amiga.peek32(tags + index * 8)) +
       ' = ' + hex(amiga.peek32(tags + index * 8 + 4)));
}

step('B1 Intuition.OpenWindowTagList(null, tags)');
let window = Intuition.OpenWindowTagList(null, tags);
step('   window at ' + hex(window ? window.ptr : 0));

step('B2 free the tag list');
amiga.freeMem(tags, tagBytes);

if (!window) {
  step('The window did not open; stopping.');
  std.exit(1);
}

step('C1 window.width / height');
step('   ' + window.width + ' x ' + window.height);

step('C2 window.rastPort');
let rastPort = window.rastPort;
step('   RastPort at ' + hex(rastPort.ptr));

step('C3 window.userPort');
let userPort = window.userPort;
step('   port at ' + hex(userPort.ptr) + ' sigMask=' + hex(userPort.sigMask));

step('C4 window.screen and its font');
let screen = window.screen;
step('   screen at ' + hex(screen.ptr));
let fontHeight = screen.font.ySize;
step('   font height ' + fontHeight);

step('D1 rastPort.setColor(1)');
rastPort.setColor(1);

step('D2 rastPort.move(20, 40)');
rastPort.move(20, 40);

step('D3 rastPort.draw(380, 40)');
rastPort.draw(380, 40);

step('D4 rastPort.rectFill(20, 50, 120, 70)');
rastPort.rectFill(20, 50, 120, 70);

step('D5 rastPort.text(20, 90, ...)');
rastPort.text(20, 90, 'Close this window to go on.');

step('E1 NewObjectTags(frameiclass)');
let frame = Intuition.NewObjectTags('frameiclass', [
  [C.IA_FrameType, 1],
  [C.IA_Recessed,  0],
  [C.IA_Width,     80],
  [C.IA_Height,    20],
]);
step('   frame at ' + hex(frame ? (frame.ptr || frame) : 0));

if (frame) {
  step('E2 Intuition.DrawImage(frame)');
  Intuition.DrawImage(rastPort, frame, 20, 110);

  step('E3 Intuition.DisposeObject(frame)');
  Intuition.DisposeObject(frame);
}

step('F1 window.messages() - waiting for the close gadget');

for (let message of window.messages()) {
  step('   message class ' + hex(message.classRaw));

  if (message.class === C.IDCMP_CLOSEWINDOW) break;

  if (message.class === C.IDCMP_REFRESHWINDOW) {
    Intuition.BeginRefresh(window);
    Intuition.EndRefresh(window, true);
  }
}

step('G1 window.close()');
window.close();

step('Finished without a crash.');
