/*
 * boopsi_probe3.js - what does each layer hold while the buttons stay silent?
 *
 * Builds the same Button / Layout / Window stack as react_hello.js and
 * prints what each layer really contains, in four stages:
 *
 *   1. the GA_* attributes of each button, read back with OM_GET
 *   2. the IDCMP mask and signal mask of the window once it is open
 *   3. the gadget chain hanging off struct Window
 *   4. one line for every value WM_HANDLEINPUT returns
 *
 * When stage 4 starts, click each button a few times AND close the
 * window, then paste the full output back. Closing the window ends the
 * probe; it also gives up by itself after 300 wake-ups.
 *
 * Assumptions:
 *   - button.gadget, layout.gadget and window.class are installed
 *   - the window opens on the default public screen, which has room
 *     for a 200 x 80 window
 *   - the struct Window and struct Gadget offsets are those of the 68k
 *     NDK 3.2 intuition/intuition.h
 *   - the gadget chain is shorter than 30 entries; the walk stops there
 *   - if open() throws, the probe exits without disposing anything
 *
 * Background: carries on from boopsi_probe.js and boopsi_probe2.js,
 * which chased earlier Gurus. This is the first probe of the
 * buttons-silent investigation: react_hello.js opened, but clicking
 * its buttons delivered no events.
 *
 * Requires quickjs.library 0.153+.
 * Run: qjs examples/boopsi_probe3.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button } = amiga.boopsi;

/**
 * Print one line. The probe's shorthand for print().
 * @param {string} s  the line to print
 * @returns {void}
 */
function p(s) { print(s); }

/**
 * Format a number as hex digits, without a 0x prefix.
 * @param {number} n    value; treated as an unsigned 32-bit integer
 * @param {number} [w]  minimum number of digits, zero-padded (default 1)
 * @returns {string} lower-case hex digits
 */
function hex(n, w) { return (n >>> 0).toString(16).padStart(w || 1, '0'); }

p('=== STAGE 1: construction (OM_GET round-trip) ===');

let btn1 = new Button({ id: 1, text: 'B1' });
p('btn1.ptr=0x' + hex(btn1.ptr, 8) +
  ' GA_ID=' + btn1.get('id') +
  ' GA_RelVerify=' + btn1.get('relVerify') +
  ' GA_Text="' + btn1.get('text') + '"');

let btn2 = new Button({ id: 2, text: 'B2' });
p('btn2.ptr=0x' + hex(btn2.ptr, 8) +
  ' GA_ID=' + btn2.get('id') +
  ' GA_RelVerify=' + btn2.get('relVerify') +
  ' GA_Text="' + btn2.get('text') + '"');

let layout = new Layout({ orientation: 'vertical', children: [btn1, btn2] });
p('layout.ptr=0x' + hex(layout.ptr, 8));

let win = new Window({
  title: 'Probe',
  innerWidth: 200, innerHeight: 80,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  layout: layout,
});
p('win.ptr=0x' + hex(win.ptr, 8) +
  ' WA_IDCMP(requested)=0x' + hex(win.get('idcmp') || 0, 8));

p('');
p('=== STAGE 2: open ===');
try {
  win.open();
} catch (error) {
  p('open() threw: ' + error.message);
  std.exit(1);
}

let iw = win.intuiWindow;
let userPort = iw.userPort;
p('intuiWindow.ptr=0x' + hex(iw.ptr, 8));
p('userPort.ptr=0x' + hex(userPort.ptr, 8) +
  ' userPort.sigMask=0x' + hex(userPort.sigMask, 8));
/* +82 is struct Window.IDCMPFlags (intuition/intuition.h). */
p('struct Window.IDCMPFlags(actual)=0x' + hex(amiga.peek32(iw.ptr + 82), 8));

let sigm = (win.get('sigMask') || 0) >>> 0;
p('WINDOW_SigMask(via OM_GET)=0x' + hex(sigm, 8));

p('');
p('=== STAGE 3: gadget chain in struct Window ===');
/* +62 is struct Window.FirstGadget. The offsets inside the loop are
 * fields of struct Gadget. Both are from intuition/intuition.h. */
let gadget = amiga.peek32(iw.ptr + 62);
p('Window.FirstGadget=0x' + hex(gadget, 8));
let gadgetCount = 0;
/* Stop after 30 gadgets in case the chain is corrupt and never ends. */
while (gadget && gadgetCount < 30) {
  let next   = amiga.peek32(gadget + 0);     /* NextGadget */
  let leftE  = amiga.peek16(gadget + 4);     /* LeftEdge   */
  let topE   = amiga.peek16(gadget + 6);     /* TopEdge    */
  let width  = amiga.peek16(gadget + 8);     /* Width      */
  let height = amiga.peek16(gadget + 10);    /* Height     */
  let flags  = amiga.peek16(gadget + 12);    /* Flags      */
  let act    = amiga.peek16(gadget + 14);    /* Activation */
  let gtype  = amiga.peek16(gadget + 16);    /* GadgetType */
  let gid    = amiga.peek16(gadget + 38);    /* GadgetID   */
  p('  [' + gadgetCount + '] @0x' + hex(gadget, 8) +
    ' ID=' + gid + ' type=0x' + hex(gtype, 4) +
    ' flags=0x' + hex(flags, 4) + ' act=0x' + hex(act, 4) +
    ' rect=' + leftE + ',' + topE + ' ' + width + 'x' + height);
  gadget = next; gadgetCount++;
}
p('walked ' + gadgetCount +
  ' gadget(s) (0 = layout never installed children into Window)');

p('');
p('=== STAGE 4: WM_HANDLEINPUT loop ===');
p('Click each button a couple of times, then close the window.');
p('Each WM_HANDLEINPUT call that returns non-zero will print one line.');

/* WM_HANDLEINPUT writes a UWORD code through this pointer: 2 bytes. */
let codeBuf = amiga.allocMem(2);
/* Method ID and its return codes, from classes/window.h. */
const WM_HANDLEINPUT = 0x570001;
const WMHI_LASTMSG   = 0;                   /* no more messages */
const WMHI_IGNORE    = 0xFFFFFFFF >>> 0;    /* ~0L: nothing to report */

let waits = 0;
let drains = 0;
let done = false;

/* Give up after 300 wake-ups so a window that never reports a close
 * cannot hang the Shell for good. */
while (!done && waits < 300) {
  amiga.Exec.Wait(sigm);
  waits++;

  let drainedThisWait = 0;
  let result;
  while ((result = win.doMethod(WM_HANDLEINPUT, codeBuf) >>> 0)
         !== WMHI_LASTMSG) {
    drains++;
    drainedThisWait++;
    let code = amiga.peek16(codeBuf);
    /* The result's upper word is the event class, the lower word its
     * data: WMHI_CLASSMASK and WMHI_GADGETMASK in classes/window.h. */
    let cls  = (result >>> 16) & 0xFFFF;
    let data = result & 0xFFFF;
    p('  W#' + waits + ' R=0x' + hex(result, 8) +
      ' class=' + cls + ' data=' + data + ' code=' + code +
      (result === WMHI_IGNORE ? ' (WMHI_IGNORE)' : ''));
    if (cls === 1) { done = true; break; }   /* WMHI_CLOSEWINDOW */
  }

  if (drainedThisWait === 0) {
    p('  W#' + waits +
      ' woke but WM_HANDLEINPUT returned LASTMSG immediately');
  }
}

p('');
p('totals: waits=' + waits + ' drains=' + drains);
amiga.freeMem(codeBuf, 2);
win.dispose();
p('done.');
