/*
 * boopsi_probe6.js - what does Intuition see in our buttons' struct Gadget?
 *
 * Reads the struct Gadget fields of two buttons straight out of memory,
 * bypassing OM_GET: once before the buttons are given to a layout and a
 * window, and once after the window is open, together with the layout
 * itself. Then it walks the window's gadget chain and prints the
 * Activation, GadgetType and GadgetID of every entry.
 *
 * Nothing to click. Read the output, then close the window; the probe
 * also gives up by itself after 60 wake-ups.
 *
 * What to look for: Activation must have GACT_RELVERIFY (0x0001) set,
 * and GadgetID must be 1 for the first button and 7 for the second. If
 * the buttons end up with Activation=0 and GadgetID=0xFFFF, the tag
 * list is not taking, and that is why no GADGETUP / IDCMPUPDATE fires.
 *
 * Assumptions:
 *   - button.gadget, layout.gadget and window.class are installed
 *   - the window opens on the default public screen, which has room
 *     for a 200 x 80 window
 *   - a wrapper's .ptr is already the struct Gadget pointer. For
 *     Reaction BOOPSI gadgets the object header sits just before the
 *     object pointer, at (objptr - sizeof(_Object)), and struct Gadget
 *     is the start of the instance data
 *   - the struct Gadget and struct Window offsets are those of the 68k
 *     NDK 3.2 intuition/intuition.h
 *   - the gadget chain is shorter than 30 entries; the walk stops there
 *
 * Background: part of the buttons-silent investigation, after
 * boopsi_probe5.js. Earlier probes read attributes back through OM_GET;
 * this one looks at the memory Intuition itself reads.
 *
 * Requires quickjs.library 0.153+.
 * Run: qjs examples/boopsi_probe6.js
 */

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

let btn1 = new Button({ id: 1, text: 'B1' });
let btn2 = new Button({ id: 7, text: 'B2' });   /* deliberately weird ID */

p('=== BEFORE adoption ===');

/* struct Gadget layout (intuition/intuition.h):
 *   +0   NextGadget       (struct Gadget *)
 *   +4   LeftEdge         (WORD)
 *   +6   TopEdge          (WORD)
 *   +8   Width            (WORD)
 *  +10   Height           (WORD)
 *  +12   Flags            (UWORD)
 *  +14   Activation       (UWORD)   <- GACT_RELVERIFY = 0x0001 must be SET
 *  +16   GadgetType       (UWORD)
 *  +18   GadgetRender     (APTR)
 *  +22   SelectRender     (APTR)
 *  +26   GadgetText       (struct IntuiText *)
 *  +30   MutualExclude    (LONG)
 *  +34   SpecialInfo      (APTR)
 *  +38   GadgetID         (UWORD)   <- our GA_ID must end up here
 *  +40   UserData         (APTR)
 */

/**
 * Print the struct Gadget fields that matter for event delivery.
 * @param {string} label  what to call this gadget in the output
 * @param {number} ptr    address of the struct Gadget; must not be 0
 * @returns {void}
 */
function dumpGadget(label, ptr) {
  p(label + ' ptr=0x' + hex(ptr, 8));
  p('  +0  NextGadget = 0x' + hex(amiga.peek32(ptr + 0), 8));
  p('  +4  LeftEdge   = ' + amiga.peek16(ptr + 4));
  p('  +6  TopEdge    = ' + amiga.peek16(ptr + 6));
  p('  +8  Width      = ' + amiga.peek16(ptr + 8));
  p('  +10 Height     = ' + amiga.peek16(ptr + 10));
  p('  +12 Flags      = 0x' + hex(amiga.peek16(ptr + 12), 4));
  p('  +14 Activation = 0x' + hex(amiga.peek16(ptr + 14), 4) +
    '  (GACT_RELVERIFY=0x0001 expected if GA_RelVerify took)');
  p('  +16 GadgetType = 0x' + hex(amiga.peek16(ptr + 16), 4));
  p('  +38 GadgetID   = 0x' + hex(amiga.peek16(ptr + 38), 4) +
    ' (' + amiga.peek16(ptr + 38) + ')  (expect 1 / 7 if GA_ID took)');
}

dumpGadget('btn1 (id=1)', btn1.ptr);
dumpGadget('btn2 (id=7)', btn2.ptr);

p('');
p('=== Construct layout + window (adoption) ===');
let layout = new Layout({ orientation: 'vertical', children: [btn1, btn2] });
let win = new Window({
  title: 'Probe6',
  innerWidth: 200, innerHeight: 80,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  layout: layout,
});
win.open();

p('');
p('=== AFTER adoption + open ===');
dumpGadget('btn1', btn1.ptr);
dumpGadget('btn2', btn2.ptr);
dumpGadget('layout', layout.ptr);

p('');
p('=== window.intuiWindow.FirstGadget chain ===');
/* +62 is struct Window.FirstGadget (intuition/intuition.h). */
let gadget = amiga.peek32(win.intuiWindow.ptr + 62);
let gadgetCount = 0;
/* Stop after 30 gadgets in case the chain is corrupt and never ends. */
while (gadget && gadgetCount < 30) {
  p('  [' + gadgetCount + '] @0x' + hex(gadget, 8) +
    ' Activation=0x' + hex(amiga.peek16(gadget + 14), 4) +
    ' Type=0x' + hex(amiga.peek16(gadget + 16), 4) +
    ' ID=' + amiga.peek16(gadget + 38));
  gadget = amiga.peek32(gadget + 0);
  gadgetCount++;
}

p('');
p('Close the window when done viewing.');

/* Method ID, from classes/window.h. */
const WM_HANDLEINPUT = 0x570001;
/* WM_HANDLEINPUT writes a UWORD code through this pointer: 2 bytes. */
let codeBuf = amiga.allocMem(2);
let sigm = (win.get('sigMask') >>> 0);
let done = false;
let waits = 0;

/* Give up after 60 wake-ups so a window that never reports a close
 * cannot hang the Shell for good. */
while (!done && waits < 60) {
  amiga.Exec.Wait(sigm);
  waits++;
  let result;
  /* 0 is WMHI_LASTMSG: no more messages. */
  while ((result = win.doMethod(WM_HANDLEINPUT, codeBuf) >>> 0) !== 0) {
    /* Upper word: event class. Lower word: its data. Class 1 is
     * WMHI_CLOSEWINDOW (classes/window.h). */
    let cls = (result >>> 16) & 0xFFFF;
    let data = result & 0xFFFF;
    p('WMHI class=' + cls + ' data=' + data);
    if (cls === 1) { done = true; break; }
  }
}

amiga.freeMem(codeBuf, 2);
win.dispose();
p('done.');
