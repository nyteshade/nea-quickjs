/* boopsi_probe6.js — peek the struct Gadget fields of our buttons
 * directly (bypassing OM_GET) to see what Intuition actually sees.
 *
 * struct Gadget layout (intuition/intuition.h):
 *   +0   NextGadget       (struct Gadget *)
 *   +4   LeftEdge         (WORD)
 *   +6   TopEdge          (WORD)
 *   +8   Width            (WORD)
 *  +10   Height           (WORD)
 *  +12   Flags            (UWORD)
 *  +14   Activation       (UWORD)   ← GACT_RELVERIFY = 0x0001 must be SET
 *  +16   GadgetType       (UWORD)
 *  +18   GadgetRender     (APTR)
 *  +22   SelectRender     (APTR)
 *  +26   GadgetText       (struct IntuiText *)
 *  +30   MutualExclude    (LONG)
 *  +34   SpecialInfo      (APTR)
 *  +38   GadgetID         (UWORD)   ← our GA_ID must end up here
 *  +40   UserData         (APTR)
 *
 * If our Buttons end up with Activation=0 and GadgetID=0xFFFF, the
 * tag list isn't taking — and that's why no GADGETUP/IDCMPUPDATE fires.
 *
 * Note: For Reaction BOOPSI gadgets, the BOOPSI object header sits at
 * (objptr - sizeof(_Object)). The struct Gadget IS the start of the
 * object's instance data once you cast through. Our btn.ptr IS already
 * the struct Gadget* per how Reaction gadget classes work. */

import * as std from 'qjs:std';

const { Window, Layout, Button } = amiga.boopsi;

function p(s) { print(s); }
function hex(n, w) { return (n >>> 0).toString(16).padStart(w || 1, '0'); }

let btn1 = new Button({ id: 1, text: 'B1' });
let btn2 = new Button({ id: 7, text: 'B2' });   /* deliberately weird ID */

p('=== BEFORE adoption ===');
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
let g = amiga.peek32(win.intuiWindow.ptr + 62);
let n = 0;
while (g && n < 30) {
  p('  [' + n + '] @0x' + hex(g, 8) +
    ' Activation=0x' + hex(amiga.peek16(g + 14), 4) +
    ' Type=0x' + hex(amiga.peek16(g + 16), 4) +
    ' ID=' + amiga.peek16(g + 38));
  g = amiga.peek32(g + 0);
  n++;
}

p('');
p('Close the window when done viewing.');

const WM_HANDLEINPUT = 0x570001;
let codeBuf = amiga.allocMem(2);
let sigm = (win.get('sigMask') >>> 0);
let done = false;
let waits = 0;

while (!done && waits < 60) {
  amiga.Exec.Wait(sigm);
  waits++;
  let result;
  while ((result = win.doMethod(WM_HANDLEINPUT, codeBuf) >>> 0) !== 0) {
    let cls = (result >>> 16) & 0xFFFF;
    let data = result & 0xFFFF;
    p('WMHI class=' + cls + ' data=' + data);
    if (cls === 1) { done = true; break; }
  }
}

amiga.freeMem(codeBuf, 2);
win.dispose();
p('done.');
