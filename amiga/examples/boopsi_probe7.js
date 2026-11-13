/*
 * boopsi_probe7.js - do the tag list bytes we build reach button.gadget?
 *
 * Drills into the tag list itself, in two stages:
 *
 *   A. calls amiga.makeTags with a hand-built [tag, value] pair list
 *      and peeks the resulting memory, to verify that the bytes handed
 *      to NewObjectA really contain what we think;
 *   B. constructs a button by hand with that tag list (no wrapper) and
 *      dumps its struct Gadget - the same fields boopsi_probe6.js
 *      checked - plus the class pointer stored just before the object.
 *
 * No need to click anything: no window opens. Just run it and paste
 * the output.
 *
 * Assumptions:
 *   - gadgets/button.gadget version 40 or later is installed
 *   - BUTTON_GetClass is the library's first function, at LVO -30
 *   - makeTags() returns one 8-byte item per pair plus a TAG_END item
 *   - the object pointer NewObjectA returns is the struct Gadget
 *     pointer, with the object's Class pointer 4 bytes before it
 *   - the struct Gadget offsets are those of the 68k NDK 3.2
 *     intuition/intuition.h
 *   - the library opens and yields a class; neither is checked before
 *     NewObjectA is called
 *
 * Background: boopsi_probe6.js proved that GA_ID and GA_RelVerify were
 * not reaching button.gadget even though GA_Text was. This probe takes
 * the wrapper classes out of the picture.
 *
 * Requires quickjs.library 0.153+.
 * Run: qjs examples/boopsi_probe7.js
 */

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

/* The tag values this probe passes, kept exactly as they were typed
 * during the investigation. Do not correct them here: the probe would
 * no longer do what it did. Against intuition/gadgetclass.h in NDK 3.2,
 * where GA_Dummy is 0x80030000:
 *
 *   GA_Text       GA_Dummy+9   = 0x80030009   matches
 *   GA_ID         GA_Dummy+16  = 0x80030010   0x8003000F is GA_GZZGadget
 *   GA_RelVerify  GA_Dummy+22  = 0x80030016   0x80030015 is GA_Immediate
 */
const GA_ID        = 0x8003000F;  /* check-constants: skip - wrong (this is GA_GZZGadget; GA_ID is 0x80030010) but kept as run: the probe is a historical record */
const GA_Text      = 0x80030009;
/* check-constants: skip - wrong (this is GA_Immediate) but kept as run */
const GA_RelVerify = 0x80030015;   /* check-constants: skip */

/* BUTTON_GetClass: the only function in FD/button_lib.fd (##bias 30). */
const LVO_GET_CLASS = -30;

p('=== Stage A: hand-built tag list, peek raw bytes ===');

/* 8 bytes is ample for "Hi" and its NUL. */
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

/* Four items: the three pairs and TAG_END. Each struct TagItem is 8
 * bytes, ti_Tag then ti_Data. */
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
let btnClass = amiga.call(btnLib, LVO_GET_CLASS, {});
p('button class ptr = 0x' + hex(btnClass, 8));

let btn = amiga.Intuition.NewObjectA(btnClass, 0, tagPtr);
p('hand-built button ptr = 0x' + hex(btn, 8));

if (btn) {
  /* Fields of struct Gadget (intuition/intuition.h). */
  p('  +0  NextGadget = 0x' + hex(amiga.peek32(btn + 0), 8));
  p('  +4  LeftEdge   = ' + amiga.peek16(btn + 4));
  p('  +6  TopEdge    = ' + amiga.peek16(btn + 6));
  p('  +8  Width      = ' + amiga.peek16(btn + 8));
  p('  +10 Height     = ' + amiga.peek16(btn + 10));
  p('  +12 Flags      = 0x' + hex(amiga.peek16(btn + 12), 4));
  p('  +14 Activation = 0x' + hex(amiga.peek16(btn + 14), 4));
  p('  +16 GadgetType = 0x' + hex(amiga.peek16(btn + 16), 4));
  p('  +38 GadgetID   = ' + amiga.peek16(btn + 38) + ' (expect 42)');

  /* Also peek 4 bytes BEFORE the gadget - that's where Class*
   * normally lives in OS3.2 BOOPSI convention. */
  p('  -4  Class*     = 0x' + hex(amiga.peek32(btn - 4), 8) +
    ' (vs btnClass=0x' + hex(btnClass, 8) + ')');

  amiga.Intuition.DisposeObject(btn);
}

amiga.freeMem(tagPtr, (pairs.length + 1) * 8);
amiga.freeMem(textPtr, 8);
amiga.closeLibrary(btnLib);
p('done.');
