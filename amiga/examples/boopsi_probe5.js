/* boopsi_probe5.js — hypothesis-test: does removing GADGET_UP/GADGET_DOWN/
 * GADGET_HELP/NEW_SIZE from our default IDCMP mask let WM_HANDLEINPUT
 * surface button clicks?
 *
 * Constructs the same UI as react_hello but explicitly overrides idcmp
 * to exactly the value window.class auto-picked in the working C
 * baseline (0x028c0604 — CLOSE | REFRESH | ACTIVE | INACTIVE | RAWKEY |
 * IDCMPUPDATE | CHANGEWINDOW). Drives WM_HANDLEINPUT directly. If this
 * prints "WMHI class=2 data=1/2" on button clicks, our default mask is
 * what's been swallowing events — fix is to drop the default.
 *
 *   qjs examples/boopsi_probe5.js
 *
 * Click each button then close. */

import * as std from 'qjs:std';

const { Window, Layout, Button, WindowPosition } = amiga.boopsi;

function p(s) { print(s); }
function hex(n, w) { return (n >>> 0).toString(16).padStart(w || 1, '0'); }

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
   * GADGET_UP/DOWN/HELP/NEW_SIZE — those are what we suspect block the
   * Reaction IDCMPUPDATE bridge that WM_HANDLEINPUT depends on. */
  idcmp: 0x028c0604,
  layout: layout,
});

win.open();
let iw = win.intuiWindow;
p('Window.IDCMPFlags(actual)=0x' + hex(amiga.peek32(iw.ptr + 82), 8));
p('Click each button (4-5 each), then close. Expect WMHI class=2 data=1/2 on releases.');

const WM_HANDLEINPUT = 0x570001;
let sigm = (win.get('sigMask') >>> 0);
let codeBuf = amiga.allocMem(2);
let waits = 0, drains = 0;
let done = false;

while (!done && waits < 300) {
  amiga.Exec.Wait(sigm);
  waits++;

  let drainedThisWait = 0;
  let result;
  while ((result = win.doMethod(WM_HANDLEINPUT, codeBuf) >>> 0) !== 0) {
    drains++;
    drainedThisWait++;
    let code = amiga.peek16(codeBuf);
    let cls  = (result >>> 16) & 0xFFFF;
    let data = result & 0xFFFF;
    p('  W#' + waits + ' R=0x' + hex(result, 8) +
      ' class=' + cls + ' data=' + data + ' code=' + code);
    if (cls === 1) { done = true; break; }                    /* CLOSE */
    if (cls === 2 && data === 2) { done = true; break; }       /* B2=Quit */
  }

  if (drainedThisWait === 0) {
    p('  W#' + waits + ' woke but WM_HANDLEINPUT returned LASTMSG immediately');
  }
}

p('totals: waits=' + waits + ' drains=' + drains);
amiga.freeMem(codeBuf, 2);
win.dispose();
p('done.');
