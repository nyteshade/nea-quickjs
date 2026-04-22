/* boopsi_probe8.js — class structure + SetAttrsA test.
 *
 * Probe7 confirmed: tag list bytes correct, class pointer correct,
 * yet GA_ID and GA_RelVerify aren't honored at OM_NEW.
 *
 * Two more diagnostics:
 *   (a) Peek the class structure (cl_Super, cl_ID, cl_InstOffset, cl_InstSize)
 *       to verify the class chain isn't broken.
 *   (b) Construct a button with NO tags, then SetAttrsA(GA_ID, GA_RelVerify)
 *       afterwards. If the gadget struct fields update, OM_SET works and
 *       the bug is specifically in OM_NEW dispatch through our path.
 *
 *   qjs examples/boopsi_probe8.js
 */

import * as std from 'qjs:std';

function p(s) { print(s); }
function hex(n, w) { return (n >>> 0).toString(16).padStart(w || 1, '0'); }

const GA_ID        = 0x8003000F;
const GA_RelVerify = 0x80030015;
const GA_Text      = 0x80030009;

p('=== Class structure introspection ===');

let btnLib = amiga.openLibrary('gadgets/button.gadget', 40);
let btnClass = amiga.call(btnLib, -30, {});
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

/* Empty tag list — just TAG_END. */
let emptyTags = amiga.makeTags([]);
p('emptyTags ptr=0x' + hex(emptyTags, 8) +
  ' first ULONG=0x' + hex(amiga.peek32(emptyTags), 8) +
  ' second=0x' + hex(amiga.peek32(emptyTags + 4), 8));

let btn = amiga.Intuition.NewObjectA(btnClass, 0, emptyTags);
p('empty btn ptr=0x' + hex(btn, 8));
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
let btnWrap = new Button(0);  /* this won't work — wrapping requires ptr */
/* Instead just call Intuition.getAttr directly */
let gid  = amiga.Intuition.getAttr(GA_ID, btn);
let grv  = amiga.Intuition.getAttr(GA_RelVerify, btn);
p('  getAttr(GA_ID) = ' + (gid === null ? 'null/fail' : gid));
p('  getAttr(GA_RelVerify) = ' + (grv === null ? 'null/fail' : grv));

p('');
p('=== Cleanup ===');
amiga.Intuition.DisposeObject(btn);
amiga.freeMem(setTags, 3 * 8);
amiga.freeMem(emptyTags, 1 * 8);
amiga.closeLibrary(btnLib);
p('done.');
