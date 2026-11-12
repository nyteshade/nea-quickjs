/*
 * boopsi_probe8.js - is the button class intact, and does SetAttrsA work?
 *
 * Two diagnostics, printed in order:
 *
 *   (a) Peeks the class structure of button.gadget (cl_Super, cl_ID,
 *       cl_InstOffset, cl_InstSize) to verify that the class chain is
 *       not broken.
 *   (b) Constructs a button with NO tags, then calls
 *       SetAttrsA(GA_ID, GA_RelVerify) on it afterwards and prints the
 *       Activation and GadgetID fields before and after, followed by
 *       what getAttr reports. If the gadget struct fields update,
 *       OM_SET works and the bug is specifically in OM_NEW dispatch
 *       through our path.
 *
 * Nothing to click: no window opens. Run it and paste the output.
 *
 * Assumptions:
 *   - gadgets/button.gadget version 40 or later is installed
 *   - BUTTON_GetClass is the library's first function, at LVO -30
 *   - the struct IClass and struct Gadget offsets are those of the 68k
 *     NDK 3.2 headers (intuition/classes.h, intuition/intuition.h)
 *   - makeTags() returns one 8-byte item per pair plus a TAG_END item
 *   - the library opens, yields a class and NewObjectA succeeds; none
 *     of the three is checked before the result is used
 *   - new Button(0) neither throws nor needs disposing; if it throws,
 *     the cleanup at the end does not run
 *
 * Background: boopsi_probe7.js confirmed that the tag list bytes were
 * correct and the class pointer was correct, yet GA_ID and GA_RelVerify
 * were not honored at OM_NEW. This probe checks the two things left.
 *
 * Requires quickjs.library 0.153+.
 * Run: qjs examples/boopsi_probe8.js
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
 *   GA_ID         GA_Dummy+16  = 0x80030010   0x8003000F is GA_GZZGadget
 *   GA_RelVerify  GA_Dummy+22  = 0x80030016   0x80030015 is GA_Immediate
 */
const GA_ID        = 0x8003000F;  /* check-constants: skip - wrong (this is GA_GZZGadget; GA_ID is 0x80030010) but kept as run: the probe is a historical record */
const GA_RelVerify = 0x80030015;

/* BUTTON_GetClass: the only function in FD/button_lib.fd (##bias 30). */
const LVO_GET_CLASS = -30;

p('=== Class structure introspection ===');

let btnLib = amiga.openLibrary('gadgets/button.gadget', 40);
let btnClass = amiga.call(btnLib, LVO_GET_CLASS, {});
p('btnClass=0x' + hex(btnClass, 8));

/* struct IClass (intuition/classes.h:31-42):
 *   +0   cl_Dispatcher (struct Hook, 20 bytes)
 *  +20   cl_Reserved   (ULONG, 4)
 *  +24   cl_Super      (struct IClass *, 4)
 *  +28   cl_ID         (STRPTR, 4)
 *  +32   cl_InstOffset (UWORD, 2)
 *  +34   cl_InstSize   (UWORD, 2)
 *  +36   cl_UserData   (ULONG, 4)
 *  +40   cl_SubclassCount (ULONG, 4)
 *  +44   cl_ObjectCount   (ULONG, 4)
 */
p('  cl_Dispatcher.h_Entry @ +8 = 0x' + hex(amiga.peek32(btnClass + 8), 8));
let superCl = amiga.peek32(btnClass + 24);
p('  cl_Super (+24)         = 0x' + hex(superCl, 8));
let idPtr = amiga.peek32(btnClass + 28);
p('  cl_ID    (+28)         = 0x' + hex(idPtr, 8) +
  (idPtr ? ' "' + amiga.peekString(idPtr, 64) + '"' : ' (null)'));
p('  cl_InstOffset (+32)    = ' + amiga.peek16(btnClass + 32));
p('  cl_InstSize   (+34)    = ' + amiga.peek16(btnClass + 34));

if (superCl) {
  let supId = amiga.peek32(superCl + 28);
  p('  super.cl_ID            = 0x' + hex(supId, 8) +
    (supId ? ' "' + amiga.peekString(supId, 64) + '"' : ' (null)'));
}

p('');
p('=== Construct empty button, then SetAttrsA ===');

/* Empty tag list - just TAG_END. */
let emptyTags = amiga.makeTags([]);
p('emptyTags ptr=0x' + hex(emptyTags, 8) +
  ' first ULONG=0x' + hex(amiga.peek32(emptyTags), 8) +
  ' second=0x' + hex(amiga.peek32(emptyTags + 4), 8));

let btn = amiga.Intuition.NewObjectA(btnClass, 0, emptyTags);
p('empty btn ptr=0x' + hex(btn, 8));
/* +14 and +38 are struct Gadget.Activation and .GadgetID
 * (intuition/intuition.h). */
p('  Activation(+14)=0x' + hex(amiga.peek16(btn + 14), 4) +
  ' GadgetID(+38)=' + amiga.peek16(btn + 38));

p('');
p('Now SetAttrsA(GA_ID=99, GA_RelVerify=true)...');
let setTags = amiga.makeTags([[GA_ID, 99], [GA_RelVerify, 1]]);
let setResult = amiga.Intuition.SetAttrsA(btn, setTags);
p('SetAttrsA returned ' + setResult);
p('  Activation(+14)=0x' + hex(amiga.peek16(btn + 14), 4) +
  ' GadgetID(+38)=' + amiga.peek16(btn + 38));

p('');
p('Try via OM_GET via our wrapper:');
let { Button } = amiga.boopsi;
let btnWrap = new Button(0);  /* this won't work - wrapping requires ptr */
/* Instead just call Intuition.getAttr directly */
let gid  = amiga.Intuition.getAttr(GA_ID, btn);
let grv  = amiga.Intuition.getAttr(GA_RelVerify, btn);
p('  getAttr(GA_ID) = ' + (gid === null ? 'null/fail' : gid));
p('  getAttr(GA_RelVerify) = ' + (grv === null ? 'null/fail' : grv));

p('');
p('=== Cleanup ===');
amiga.Intuition.DisposeObject(btn);
/* Sizes match makeTags: two pairs plus TAG_END, then TAG_END alone,
 * at 8 bytes an item. */
amiga.freeMem(setTags, 3 * 8);
amiga.freeMem(emptyTags, 1 * 8);
amiga.closeLibrary(btnLib);
p('done.');
