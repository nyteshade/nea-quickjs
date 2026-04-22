/* boopsi_probe7.js — drill into the tag list itself.
 *
 * Probe6 proved GA_ID and GA_RelVerify aren't reaching button.gadget
 * even though GA_Text does. This probe:
 *   (a) calls amiga.makeTags with a hand-built [tag, value] pair list
 *       and peeks the resulting memory to verify the bytes that hit
 *       NewObjectA actually contain what we think;
 *   (b) constructs a button by hand with that tag list (no wrapper)
 *       and dumps its struct Gadget — same fields probe6 checked.
 *
 *   qjs examples/boopsi_probe7.js
 *
 * No need to click anything. Just run and paste output. */

import * as std from 'qjs:std';

function p(s) { print(s); }
function hex(n, w) { return (n >>> 0).toString(16).padStart(w || 1, '0'); }

const GA_ID        = 0x8003000F;
const GA_Text      = 0x80030009;
const GA_RelVerify = 0x80030015;

p('=== Stage A: hand-built tag list, peek raw bytes ===');

let textPtr = amiga.allocMem(8);
amiga.pokeString(textPtr, 'Hi');
p('text at 0x' + hex(textPtr, 8));

let pairs = [
  [GA_ID,        42],
  [GA_RelVerify, 1],
  [GA_Text,      textPtr],
];
let tagPtr = amiga.makeTags(pairs);
p('tag list at 0x' + hex(tagPtr, 8) + ', expecting (3+1)*8 = 32 bytes');

for (let i = 0; i < 4; i++) {
  let tag = amiga.peek32(tagPtr + i*8);
  let val = amiga.peek32(tagPtr + i*8 + 4);
  let label = '?';
  if ((tag >>> 0) === GA_ID)        label = 'GA_ID';
  else if ((tag >>> 0) === GA_Text) label = 'GA_Text';
  else if ((tag >>> 0) === GA_RelVerify) label = 'GA_RelVerify';
  else if ((tag >>> 0) === 0)       label = 'TAG_END';
  p('  +' + (i*8) + ': tag=0x' + hex(tag, 8) +
    ' (' + label + ') value=0x' + hex(val, 8) + ' (' + (val >>> 0) + ')');
}

p('');
p('=== Stage B: hand construct button via raw FFI ===');

let btnLib = amiga.openLibrary('gadgets/button.gadget', 40);
p('button.gadget base = 0x' + hex(btnLib, 8));
let btnClass = amiga.call(btnLib, -30, {});
p('button class ptr = 0x' + hex(btnClass, 8));

let btn = amiga.Intuition.NewObjectA(btnClass, 0, tagPtr);
p('hand-built button ptr = 0x' + hex(btn, 8));

if (btn) {
  p('  +0  NextGadget = 0x' + hex(amiga.peek32(btn + 0), 8));
  p('  +4  LeftEdge   = ' + amiga.peek16(btn + 4));
  p('  +6  TopEdge    = ' + amiga.peek16(btn + 6));
  p('  +8  Width      = ' + amiga.peek16(btn + 8));
  p('  +10 Height     = ' + amiga.peek16(btn + 10));
  p('  +12 Flags      = 0x' + hex(amiga.peek16(btn + 12), 4));
  p('  +14 Activation = 0x' + hex(amiga.peek16(btn + 14), 4));
  p('  +16 GadgetType = 0x' + hex(amiga.peek16(btn + 16), 4));
  p('  +38 GadgetID   = ' + amiga.peek16(btn + 38) + ' (expect 42)');

  /* Also peek 4 bytes BEFORE the gadget — that's where Class*
   * normally lives in OS3.2 BOOPSI convention. */
  p('  -4  Class*     = 0x' + hex(amiga.peek32(btn - 4), 8) +
    ' (vs btnClass=0x' + hex(btnClass, 8) + ')');

  amiga.Intuition.DisposeObject(btn);
}

amiga.freeMem(tagPtr, (pairs.length + 1) * 8);
amiga.freeMem(textPtr, 8);
amiga.closeLibrary(btnLib);
p('done.');
