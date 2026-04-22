/* boopsi_probe3.js — diagnostic for the buttons-silent investigation
 * (carries on from boopsi_probe1/probe2 which targeted earlier Guru
 * issues). Builds the same Button/Layout/Window stack that
 * react_hello.js does, then prints what each layer actually contains:
 * round-tripped GA_* attrs via OM_GET, the IDCMP mask Intuition gave
 * the open window, the gadget chain hanging off struct Window, and
 * finally what WM_HANDLEINPUT returns each time you click anything.
 *
 * Run on the Amiga at library 0.153:
 *   qjs examples/boopsi_probe3.js
 *
 * Then click each button a few times AND close the window. Paste the
 * full output back. */

import * as std from 'qjs:std';

const { Window, Layout, Button } = amiga.boopsi;

function p(s) { print(s); }
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
} catch (e) {
  p('open() threw: ' + e.message);
  std.exit(1);
}

let iw = win.intuiWindow;
let userPort = iw.userPort;
p('intuiWindow.ptr=0x' + hex(iw.ptr, 8));
p('userPort.ptr=0x' + hex(userPort.ptr, 8) +
  ' userPort.sigMask=0x' + hex(userPort.sigMask, 8));
p('struct Window.IDCMPFlags(actual)=0x' + hex(amiga.peek32(iw.ptr + 82), 8));

let sigm = (win.get('sigMask') || 0) >>> 0;
p('WINDOW_SigMask(via OM_GET)=0x' + hex(sigm, 8));

p('');
p('=== STAGE 3: gadget chain in struct Window ===');
let g = amiga.peek32(iw.ptr + 62);
p('Window.FirstGadget=0x' + hex(g, 8));
let n = 0;
while (g && n < 30) {
  let next   = amiga.peek32(g + 0);
  let leftE  = amiga.peek16(g + 4);
  let topE   = amiga.peek16(g + 6);
  let width  = amiga.peek16(g + 8);
  let height = amiga.peek16(g + 10);
  let flags  = amiga.peek16(g + 12);
  let act    = amiga.peek16(g + 14);
  let gtype  = amiga.peek16(g + 16);
  let gid    = amiga.peek16(g + 38);
  p('  [' + n + '] @0x' + hex(g, 8) +
    ' ID=' + gid + ' type=0x' + hex(gtype, 4) +
    ' flags=0x' + hex(flags, 4) + ' act=0x' + hex(act, 4) +
    ' rect=' + leftE + ',' + topE + ' ' + width + 'x' + height);
  g = next; n++;
}
p('walked ' + n + ' gadget(s) (0 = layout never installed children into Window)');

p('');
p('=== STAGE 4: WM_HANDLEINPUT loop ===');
p('Click each button a couple of times, then close the window.');
p('Each WM_HANDLEINPUT call that returns non-zero will print one line.');

let codeBuf = amiga.allocMem(2);
const WM_HANDLEINPUT = 0x570001;
const WMHI_LASTMSG   = 0;
const WMHI_IGNORE    = 0xFFFFFFFF >>> 0;

let waits = 0;
let drains = 0;
let done = false;

while (!done && waits < 300) {
  amiga.Exec.Wait(sigm);
  waits++;

  let drainedThisWait = 0;
  let result;
  while ((result = win.doMethod(WM_HANDLEINPUT, codeBuf) >>> 0) !== WMHI_LASTMSG) {
    drains++;
    drainedThisWait++;
    let code = amiga.peek16(codeBuf);
    let cls  = (result >>> 16) & 0xFFFF;
    let data = result & 0xFFFF;
    p('  W#' + waits + ' R=0x' + hex(result, 8) +
      ' class=' + cls + ' data=' + data + ' code=' + code +
      (result === WMHI_IGNORE ? ' (WMHI_IGNORE)' : ''));
    if (cls === 1) { done = true; break; }   /* WMHI_CLOSEWINDOW */
  }

  if (drainedThisWait === 0) {
    p('  W#' + waits + ' woke but WM_HANDLEINPUT returned LASTMSG immediately');
  }
}

p('');
p('totals: waits=' + waits + ' drains=' + drains);
amiga.freeMem(codeBuf, 2);
win.dispose();
p('done.');
