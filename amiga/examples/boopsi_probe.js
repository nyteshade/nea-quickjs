/*
 * boopsi_probe.js - which step of making a label.image by hand crashes?
 *
 * Opens label.image, asks it for its class, reads the class structure,
 * builds a one-tag list and calls NewObjectA, announcing each step on
 * the Shell before taking it. There is no window and nothing to click.
 * If the machine stops with a Guru, the last "=== step N" line printed
 * names the step that crashed. A clean run ends with
 * "=== ALL STEPS PASSED ===".
 *
 * Assumptions:
 *   - images/label.image version 40 or later is installed
 *   - LABEL_GetClass is the library's first function, at LVO -30
 *   - the struct Library and struct IClass offsets are those of the
 *     68k NDK 3.2 headers (exec/libraries.h, intuition/classes.h)
 *   - makeTags() returns two tag items, 16 bytes, for one pair
 *   - a step that prints FAIL exits at once and frees nothing
 *
 * Background: written to find where Guru 80000003 happened while a
 * Label was being constructed. It uses no wrapper classes, only raw
 * library calls, so a crash here is not the wrapper's doing.
 *
 * Requires quickjs.library 0.153+.
 * Run: qjs examples/boopsi_probe.js
 */

import * as std from 'qjs:std';

/**
 * Format a number as eight hex digits with a 0x prefix.
 * @param {number} n  value; treated as an unsigned 32-bit integer
 * @returns {string} for example "0x00c0ffee"
 */
function hex(n) { return '0x' + ((n >>> 0).toString(16).padStart(8, '0')); }

/* LABEL_GetClass: the only function in FD/label_lib.fd (##bias 30). */
const LVO_GET_CLASS = -30;

print('=== step 1: open images/label.image (v40+) ===');
let base = amiga.openLibrary('images/label.image', 40);
print('    base = ' + hex(base));
if (!base) { print('FAIL: open returned 0'); std.exit(1); }

/* Offsets into struct Library, from exec/libraries.h and exec/nodes.h. */
print('=== step 2: read library node fields ===');
print('    lib_Version  = ' + amiga.peek16(base + 20));
print('    lib_Revision = ' + amiga.peek16(base + 22));
let nodeName = amiga.peek32(base + 10);
print('    lib_Node.ln_Name ptr = ' + hex(nodeName));
print('    lib_Node.ln_Name str = ' +
      (nodeName ? amiga.peekString(nodeName, 64) : '(null)'));

print('=== step 3: call LABEL_GetClass at LVO -30 ===');
let cls = amiga.call(base, LVO_GET_CLASS, {});
print('    classPtr = ' + hex(cls));
if (!cls) { print('FAIL: LABEL_GetClass returned 0'); std.exit(1); }

/* Offsets into struct IClass, from intuition/classes.h. The first 20
 * bytes are the dispatcher's struct Hook (utility/hooks.h). */
print('=== step 4: read IClass fields (read-only per classes.h) ===');
print('    +0  h_MinNode.mln_Succ = ' + hex(amiga.peek32(cls + 0)));
print('    +4  h_MinNode.mln_Pred = ' + hex(amiga.peek32(cls + 4)));
print('    +8  h_Entry             = ' + hex(amiga.peek32(cls + 8)));
print('    +12 h_SubEntry          = ' + hex(amiga.peek32(cls + 12)));
print('    +16 h_Data              = ' + hex(amiga.peek32(cls + 16)));
print('    +20 cl_Reserved         = ' + hex(amiga.peek32(cls + 20)));
print('    +24 cl_Super            = ' + hex(amiga.peek32(cls + 24)));
print('    +28 cl_ID               = ' + hex(amiga.peek32(cls + 28)));
let clID = amiga.peek32(cls + 28);
if (clID) {
  print('         cl_ID str = ' + amiga.peekString(clID, 64));
}
print('    +32 cl_InstOffset (word)= ' + amiga.peek16(cls + 32));
print('    +34 cl_InstSize   (word)= ' + amiga.peek16(cls + 34));

print('=== step 5: build minimal tag list [LABEL_Text, ptr, TAG_END] ===');
/* LABEL_Text = LABEL_Dummy + 1, from images/label.h. */
let LABEL_Text = 0x85006001;
/* Bytes allocated for the label's text; "probe" plus its NUL fits. */
let strBytes = 16;
let strPtr = amiga.allocMem(strBytes);
amiga.pokeString(strPtr, 'probe');
print('    strPtr = ' + hex(strPtr) + '  aligned? ' + ((strPtr & 3) === 0));
let tags = amiga.makeTags([[LABEL_Text, strPtr]]);
print('    tagList = ' + hex(tags) + '  aligned? ' + ((tags & 3) === 0));
print('    tag[0].ti_Tag  = ' + hex(amiga.peek32(tags + 0)));
print('    tag[0].ti_Data = ' + hex(amiga.peek32(tags + 4)));
print('    tag[1].ti_Tag  = ' + hex(amiga.peek32(tags + 8)) + ' (expect 0)');

print('=== step 6: Intuition.NewObjectA(class, NULL, tags) ===');
print('    about to call... if the next line does not print, ' +
      'crash is in NewObjectA');
let obj = amiga.Intuition.NewObjectA(cls, 0, tags);
print('    obj (raw) = ' + hex(obj));
if (!obj) { print('FAIL: NewObjectA returned 0'); std.exit(1); }

print('=== step 7: clean up ===');
amiga.Intuition.DisposeObject(obj);
/* 16 bytes: the LABEL_Text item plus the TAG_END item, 8 bytes each. */
amiga.freeMem(tags, 16);
amiga.freeMem(strPtr, strBytes);
amiga.closeLibrary(base);

print('=== ALL STEPS PASSED ===');
