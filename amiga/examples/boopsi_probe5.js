/*
 * boopsi_probe5.js - does a narrower IDCMP mask let button clicks through?
 *
 * Builds the same window as react_hello.js, but asks for exactly the
 * IDCMP mask that window.class picked by itself in the working C
 * baseline, then calls WM_HANDLEINPUT directly and prints one line for
 * every value it returns.
 *
 * Click each button (4-5 each), then close the window. Expect
 * "class=2 data=1" or "class=2 data=2" on each release. The second
 * button, or the close gadget, ends the probe; it also gives up by
 * itself after 300 wake-ups.
 *
 * Assumptions:
 *   - button.gadget, layout.gadget and window.class are installed
 *   - the window opens on the default public screen, which has room
 *     for a 260 x 100 window
 *   - 0x028c0604 is what window.class chose in the C baseline; that was
 *     read off a run of the baseline, not taken from documentation
 *   - struct Window.IDCMPFlags is at offset 82 (68k NDK 3.2
 *     intuition/intuition.h)
 *
 * Background: a hypothesis test in the buttons-silent investigation,
 * after boopsi_probe4.js. The wrapper's default mask,
 * IDCMP_REACTION_DEFAULT (0x06ac0666), also asks for GADGET_UP,
 * GADGET_DOWN, GADGET_HELP and NEW_SIZE; the suspicion was that those
 * block the Reaction IDCMPUPDATE bridge that WM_HANDLEINPUT depends on.
 * If this probe prints "class=2 data=1/2" on button clicks, the default
 * mask is what has been swallowing events, and the fix is to drop it.
 *
 * Requires quickjs.library 0.153+.
 * Run: qjs examples/boopsi_probe5.js
 */

const { Window, Layout, Button, WindowPosition } = amiga.boopsi;

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

/* The IDCMP mask window.class chose for the C baseline: CLOSEWINDOW |
 * REFRESHWINDOW | ACTIVEWINDOW | INACTIVEWINDOW | RAWKEY | IDCMPUPDATE
 * | CHANGEWINDOW, by the IDCMP_* values of intuition/intuition.h. */
const IDCMP_C_BASELINE = 0x028c0604;

let btn1 = new Button({ id: 1, text: 'Say hi' });
let btn2 = new Button({ id: 2, text: 'Quit' });
let layout = new Layout({ orientation: 'vertical', children: [btn1, btn2] });

let win = new Window({
  title:        'Probe5',
  innerWidth:   260,
  innerHeight:  100,
  position:     WindowPosition.CENTERSCREEN,
  closeGadget:  true,
  dragBar:      true,
  depthGadget:  true,
  activate:     true,
  /* Override our wrapper's IDCMP_REACTION_DEFAULT (0x06ac0666) with the
   * exact mask window.class chose for the C baseline (0x028c0604). NO
   * GADGET_UP/DOWN/HELP/NEW_SIZE - those are what we suspect block the
   * Reaction IDCMPUPDATE bridge that WM_HANDLEINPUT depends on. */
  idcmp: IDCMP_C_BASELINE,
  layout: layout,
});

win.open();
let iw = win.intuiWindow;
/* +82 is struct Window.IDCMPFlags (intuition/intuition.h). */
p('Window.IDCMPFlags(actual)=0x' + hex(amiga.peek32(iw.ptr + 82), 8));
p('Click each button (4-5 each), then close. ' +
  'Expect WMHI class=2 data=1/2 on releases.');

/* Method ID, from classes/window.h. */
const WM_HANDLEINPUT = 0x570001;
let sigm = (win.get('sigMask') >>> 0);
/* WM_HANDLEINPUT writes a UWORD code through this pointer: 2 bytes. */
let codeBuf = amiga.allocMem(2);
let waits = 0, drains = 0;
let done = false;

/* Give up after 300 wake-ups so a window that never reports a close
 * cannot hang the Shell for good. */
while (!done && waits < 300) {
  amiga.Exec.Wait(sigm);
  waits++;

  let drainedThisWait = 0;
  let result;
  /* 0 is WMHI_LASTMSG: no more messages. */
  while ((result = win.doMethod(WM_HANDLEINPUT, codeBuf) >>> 0) !== 0) {
    drains++;
    drainedThisWait++;
    let code = amiga.peek16(codeBuf);
    /* The result's upper word is the event class, the lower word its
     * data: WMHI_CLASSMASK and WMHI_GADGETMASK in classes/window.h.
     * Class 1 is WMHI_CLOSEWINDOW, class 2 is WMHI_GADGETUP. */
    let cls  = (result >>> 16) & 0xFFFF;
    let data = result & 0xFFFF;
    p('  W#' + waits + ' R=0x' + hex(result, 8) +
      ' class=' + cls + ' data=' + data + ' code=' + code);
    if (cls === 1) { done = true; break; }                    /* CLOSE */
    if (cls === 2 && data === 2) { done = true; break; }       /* B2=Quit */
  }

  if (drainedThisWait === 0) {
    p('  W#' + waits +
      ' woke but WM_HANDLEINPUT returned LASTMSG immediately');
  }
}

p('totals: waits=' + waits + ' drains=' + drains);
amiga.freeMem(codeBuf, 2);
win.dispose();
p('done.');
