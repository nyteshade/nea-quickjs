/*
 * boopsi_probe4.js - which raw IDCMP messages does a button click send?
 *
 * Opens a window with two buttons and, instead of asking window.class
 * what happened, takes every IntuiMessage off the window's port itself
 * with Exec.GetMsg. For each one it prints the class, code, qualifier,
 * IAddress and mouse position. For an IDCMPUPDATE it also walks the tag
 * list at IAddress; for a GADGET_UP or GADGET_DOWN it prints a few
 * fields of the gadget at IAddress.
 *
 * Click each button several times (4-5 each), then close the window
 * and paste the output back. Closing the window ends the probe; it
 * also gives up by itself after 300 wake-ups.
 *
 * Assumptions:
 *   - button.gadget, layout.gadget and window.class are installed
 *   - the window opens on the default public screen, which has room
 *     for a 200 x 80 window
 *   - Layout accepts relVerifyNotify and icaTarget; it sets neither by
 *     default
 *   - replying to the messages ourselves, so that window.class never
 *     sees them, does no harm for the length of the probe
 *   - the struct IntuiMessage, struct Window and struct Gadget offsets
 *     are those of the 68k NDK 3.2 intuition/intuition.h
 *   - a tag list is at most 64 items long; the walk stops there
 *
 * Background: second pass of the buttons-silent investigation.
 * boopsi_probe3.js showed WM_HANDLEINPUT silently consuming something
 * (W#2 woke but returned LASTMSG immediately), so this probe bypasses
 * WM_HANDLEINPUT entirely. The Layout is built WITH the 0.151 + 0.152
 * wiring restored in JS (relVerifyNotify=true, icaTarget=
 * ICTARGET_IDCMP) to test the IDCMPUPDATE-via-OM_NOTIFY path that the
 * documentation calls the canonical Reaction event channel.
 *
 * Requires quickjs.library 0.153+.
 * Run: qjs examples/boopsi_probe4.js
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

/* ~0L, from intuition/icclass.h: send notifications to the IDCMP port. */
const ICTARGET_IDCMP = 0xFFFFFFFF;
/* IDCMP classes, from intuition/intuition.h. */
const IDCMP_GADGET_DOWN = 0x00000020; /* check-constants: is IDCMP_GADGETDOWN */
const IDCMP_GADGET_UP   = 0x00000040; /* check-constants: is IDCMP_GADGETUP */
const IDCMP_IDCMPUPDATE  = 0x00800000;
const IDCMP_CLOSEWINDOW  = 0x00000200;

/**
 * Name an IDCMP class. The values are the IDCMP_* flags of
 * intuition/intuition.h.
 * @param {number} idcmpClass  IntuiMessage.Class, one IDCMP_* bit
 * @returns {string} the flag's name without "IDCMP_", or '?' if the
 *     value is not one of those listed
 */
function idcmpName(idcmpClass) {
  switch (idcmpClass >>> 0) {
    case 0x00000004:   /* check-constants: is IDCMP_REFRESHWINDOW */
      return 'REFRESH_WINDOW';
    case 0x00000020:   /* check-constants: is IDCMP_GADGETDOWN */
      return 'GADGET_DOWN';
    case 0x00000040:   /* check-constants: is IDCMP_GADGETUP */
      return 'GADGET_UP';
    case 0x00000200:   /* check-constants: is IDCMP_CLOSEWINDOW */
      return 'CLOSE_WINDOW';
    case 0x00000400:   /* check-constants: is IDCMP_RAWKEY */
      return 'RAW_KEY';
    case 0x00040000:   /* check-constants: is IDCMP_ACTIVEWINDOW */
      return 'ACTIVE_WINDOW';
    case 0x00080000:   /* check-constants: is IDCMP_INACTIVEWINDOW */
      return 'INACTIVE_WINDOW';
    case 0x00200000:   /* check-constants: is IDCMP_VANILLAKEY */
      return 'VANILLA_KEY';
    case 0x00800000:   /* check-constants: is IDCMP_IDCMPUPDATE */
      return 'IDCMPUPDATE';
    case 0x02000000:   /* check-constants: is IDCMP_CHANGEWINDOW */
      return 'CHANGE_WINDOW';
    case 0x04000000:   /* check-constants: is IDCMP_GADGETHELP */
      return 'GADGET_HELP';
    default:         return '?';
  }
}

/**
 * Name a tag found in an IDCMPUPDATE tag list.
 *
 * The values are kept exactly as they were typed during the
 * investigation, so that the output still reads as it did then. Three
 * of them do not match the NDK 3.2 headers:
 *
 *   0x8003000F  is GA_GZZGadget; GA_ID is 0x80030010
 *   0x80030015  is GA_Immediate; GA_RelVerify is 0x80030016
 *   0x85007019  is LAYOUT_Parent; LAYOUT_RelAddress is 0x85007027
 *
 * (intuition/gadgetclass.h and gadgets/layout.h.) The other names agree
 * with intuition/icclass.h, gadgets/layout.h and utility/tagitem.h.
 *
 * @param {number} tag  a ti_Tag value
 * @returns {string} the name this probe gives the tag, or '?'
 */
function tagName(tag) {
  switch (tag >>> 0) {
    case 0x8003000F:   /* check-constants: skip - as typed; see above */
      return 'GA_ID';
    case 0x80030015:   /* check-constants: skip - as typed; see above */
      return 'GA_RelVerify';
    case 0x80040001:   /* check-constants: is ICA_TARGET */
      return 'ICA_TARGET';
    case 0x80040002:   /* check-constants: is ICA_MAP */
      return 'ICA_MAP';
    case 0x85007017:   /* check-constants: is LAYOUT_RelVerify */
      return 'LAYOUT_RelVerify';
    case 0x85007018:   /* check-constants: is LAYOUT_RelCode */
      return 'LAYOUT_RelCode';
    case 0x85007019:   /* check-constants: skip - as typed; see above */
      return 'LAYOUT_RelAddress';
    case 0x85007021:   /* check-constants: is LAYOUT_TabVerify */
      return 'LAYOUT_TabVerify';
    case 0:          return 'TAG_END';
    case 1:          return 'TAG_IGNORE';
    case 2:          return 'TAG_MORE';
    case 3:          return 'TAG_SKIP';
    default:         return '?';
  }
}

/**
 * Print every item of a tag list, one line each, until TAG_END or 64
 * items, whichever comes first.
 * @param {number} addr   address of the first struct TagItem, or 0
 * @param {string} label  what to call the list if addr is 0
 * @returns {void}
 */
function walkTagList(addr, label) {
  if (!addr) { p('    ' + label + ': iAddress=0, no tag list'); return; }
  let i = 0;
  let cursor = addr;
  /* Each struct TagItem is 8 bytes: ti_Tag then ti_Data. */
  while (i < 64) {
    let tag  = amiga.peek32(cursor)     >>> 0;
    let data = amiga.peek32(cursor + 4) >>> 0;
    p('    [' + i + '] tag=0x' + hex(tag, 8) +
      ' (' + tagName(tag) + ') data=0x' + hex(data, 8) + ' (' + data + ')');
    if (tag === 0)        break;        /* TAG_END */
    /* TAG_MORE - continue from data */
    if (tag === 2) { cursor = data - 8; }
    else if (tag === 3) { cursor += data * 8; }  /* TAG_SKIP */
    else { cursor += 8; }
    i++;
  }
}

p('=== Construction (with LAYOUT_RelVerify + ICA_TARGET=ICTARGET_IDCMP ' +
  'wiring) ===');

let btn1 = new Button({ id: 1, text: 'B1' });
let btn2 = new Button({ id: 2, text: 'B2' });

let layout = new Layout({
  orientation:     'vertical',
  relVerifyNotify: true,                /* LAYOUT_RelVerify=TRUE  */
  icaTarget:       ICTARGET_IDCMP,      /* OM_NOTIFY -> IDCMP port */
  children:        [btn1, btn2],
});
p('layout.ptr=0x' + hex(layout.ptr, 8));

let win = new Window({
  title:        'Probe4',
  innerWidth:   200,
  innerHeight:  80,
  closeGadget:  true,
  dragBar:      true,
  depthGadget:  true,
  activate:     true,
  layout:       layout,
});

win.open();
let iw = win.intuiWindow;
let port = iw.userPort;
let sigm = (port.sigMask >>> 0);
/* +82 is struct Window.IDCMPFlags (intuition/intuition.h). */
p('userPort.sigMask=0x' + hex(sigm, 8) +
  ' Window.IDCMPFlags=0x' + hex(amiga.peek32(iw.ptr + 82), 8));

p('');
p('=== Raw GetMsg loop ===');
p('Click each button SEVERAL times (4-5 each), then close the window.');

let waits = 0;
let msgs  = 0;
let done = false;

/* Give up after 300 wake-ups so a window that never reports a close
 * cannot hang the Shell for good. */
while (!done && waits < 300) {
  amiga.Exec.Wait(sigm);
  waits++;

  let raw;
  let drainedThisWait = 0;
  while ((raw = amiga.Exec.GetMsg(port) >>> 0) !== 0) {
    drainedThisWait++;
    msgs++;
    /* Fields of struct IntuiMessage (intuition/intuition.h). They
     * follow the 20-byte struct Message at its head. */
    let cls   = amiga.peek32(raw + 20) >>> 0;    /* Class     */
    let code  = amiga.peek16(raw + 24);          /* Code      */
    let qual  = amiga.peek16(raw + 26);          /* Qualifier */
    let iaddr = amiga.peek32(raw + 28) >>> 0;    /* IAddress  */
    let mx    = amiga.peek16(raw + 32);          /* MouseX    */
    let my    = amiga.peek16(raw + 34);          /* MouseY    */

    p('  [W' + waits + ' M' + msgs + '] class=0x' + hex(cls, 8) +
      ' (' + idcmpName(cls) + ')' +
      ' code=0x' + hex(code, 4) +
      ' qual=0x' + hex(qual, 4) +
      ' iAddr=0x' + hex(iaddr, 8) +
      ' mouse=' + mx + ',' + my);

    if (cls === IDCMP_IDCMPUPDATE) {
      walkTagList(iaddr, 'IDCMPUPDATE TagList');
    }
    else if (cls === IDCMP_GADGET_UP || cls === IDCMP_GADGET_DOWN) {
      /* IAddress is a struct Gadget*. Peek some fields. */
      if (iaddr) {
        let gid    = amiga.peek16(iaddr + 38);    /* GadgetID   */
        let gtype  = amiga.peek16(iaddr + 16);    /* GadgetType */
        let gflags = amiga.peek16(iaddr + 12);    /* Flags      */
        p('    Gadget @0x' + hex(iaddr, 8) +
          ' ID=' + gid + ' type=0x' + hex(gtype, 4) +
          ' flags=0x' + hex(gflags, 4) +
          ' isLayoutPtr=' + (iaddr === layout.ptr));
      }
    }

    amiga.Exec.ReplyMsg(raw);

    if (cls === IDCMP_CLOSEWINDOW) { done = true; break; }
  }

  if (drainedThisWait === 0) {
    p('  [W' + waits + '] woke but GetMsg returned 0 (signal without msg?)');
  }
}

p('');
p('totals: waits=' + waits + ' messages=' + msgs);
win.dispose();
p('done.');
