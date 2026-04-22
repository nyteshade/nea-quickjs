/* boopsi_probe4.js — second-pass diagnostic. Probe3 showed WM_HANDLEINPUT
 * silently consumed something (W#2 woke but returned LASTMSG immediately).
 * This probe bypasses WM_HANDLEINPUT entirely and drains the UserPort with
 * raw Exec.GetMsg, printing every IntuiMessage's class/code/iAddress and —
 * for any IDCMPUPDATE — walking the iAddress TagList.
 *
 * Layout is constructed WITH the 0.151+0.152 wiring restored in JS
 * (relVerifyNotify=true, icaTarget=ICTARGET_IDCMP) so we test the
 * IDCMPUPDATE-via-OM_NOTIFY path that the doc says is the canonical
 * Reaction event channel.
 *
 *   qjs examples/boopsi_probe4.js
 *
 * Click each button several times then close the window. Paste output. */

import * as std from 'qjs:std';

const { Window, Layout, Button } = amiga.boopsi;

function p(s) { print(s); }
function hex(n, w) { return (n >>> 0).toString(16).padStart(w || 1, '0'); }

const ICTARGET_IDCMP = 0xFFFFFFFF;
const IDCMP_GADGET_DOWN  = 0x00000020;
const IDCMP_GADGET_UP    = 0x00000040;
const IDCMP_IDCMPUPDATE  = 0x00800000;

function idcmpName(c) {
  switch (c >>> 0) {
    case 0x00000004: return 'REFRESH_WINDOW';
    case 0x00000020: return 'GADGET_DOWN';
    case 0x00000040: return 'GADGET_UP';
    case 0x00000200: return 'CLOSE_WINDOW';
    case 0x00000400: return 'RAW_KEY';
    case 0x00040000: return 'ACTIVE_WINDOW';
    case 0x00080000: return 'INACTIVE_WINDOW';
    case 0x00200000: return 'VANILLA_KEY';
    case 0x00800000: return 'IDCMPUPDATE';
    case 0x02000000: return 'CHANGE_WINDOW';
    case 0x04000000: return 'GADGET_HELP';
    default:         return '?';
  }
}

function tagName(t) {
  switch (t >>> 0) {
    case 0x8003000F: return 'GA_ID';
    case 0x80030015: return 'GA_RelVerify';
    case 0x80040001: return 'ICA_TARGET';
    case 0x80040002: return 'ICA_MAP';
    case 0x85007017: return 'LAYOUT_RelVerify';
    case 0x85007018: return 'LAYOUT_RelCode';
    case 0x85007019: return 'LAYOUT_RelAddress';
    case 0x85007021: return 'LAYOUT_TabVerify';
    case 0:          return 'TAG_END';
    case 1:          return 'TAG_IGNORE';
    case 2:          return 'TAG_MORE';
    case 3:          return 'TAG_SKIP';
    default:         return '?';
  }
}

function walkTagList(addr, label) {
  if (!addr) { p('    ' + label + ': iAddress=0, no tag list'); return; }
  let i = 0;
  let p2 = addr;
  while (i < 64) {
    let tag  = amiga.peek32(p2)     >>> 0;
    let data = amiga.peek32(p2 + 4) >>> 0;
    p('    [' + i + '] tag=0x' + hex(tag, 8) +
      ' (' + tagName(tag) + ') data=0x' + hex(data, 8) + ' (' + data + ')');
    if (tag === 0)        break;        /* TAG_END */
    if (tag === 2) { p2 = data - 8; }   /* TAG_MORE — continue from data */
    else if (tag === 3) { p2 += data * 8; }  /* TAG_SKIP */
    else { p2 += 8; }
    i++;
  }
}

p('=== Construction (with LAYOUT_RelVerify + ICA_TARGET=ICTARGET_IDCMP wiring) ===');

let btn1 = new Button({ id: 1, text: 'B1' });
let btn2 = new Button({ id: 2, text: 'B2' });

let layout = new Layout({
  orientation:     'vertical',
  relVerifyNotify: true,                /* LAYOUT_RelVerify=TRUE  */
  icaTarget:       ICTARGET_IDCMP,      /* OM_NOTIFY → IDCMP port */
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
p('userPort.sigMask=0x' + hex(sigm, 8) +
  ' Window.IDCMPFlags=0x' + hex(amiga.peek32(iw.ptr + 82), 8));

p('');
p('=== Raw GetMsg loop ===');
p('Click each button SEVERAL times (4-5 each), then close the window.');

let waits = 0;
let msgs  = 0;
let done = false;

while (!done && waits < 300) {
  amiga.Exec.Wait(sigm);
  waits++;

  let raw;
  let drainedThisWait = 0;
  while ((raw = amiga.Exec.GetMsg(port) >>> 0) !== 0) {
    drainedThisWait++;
    msgs++;
    let cls   = amiga.peek32(raw + 20) >>> 0;
    let code  = amiga.peek16(raw + 24);
    let qual  = amiga.peek16(raw + 26);
    let iaddr = amiga.peek32(raw + 28) >>> 0;
    let mx    = amiga.peek16(raw + 32);
    let my    = amiga.peek16(raw + 34);

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
        let gid    = amiga.peek16(iaddr + 38);
        let gtype  = amiga.peek16(iaddr + 16);
        let gflags = amiga.peek16(iaddr + 12);
        p('    Gadget @0x' + hex(iaddr, 8) +
          ' ID=' + gid + ' type=0x' + hex(gtype, 4) +
          ' flags=0x' + hex(gflags, 4) +
          ' isLayoutPtr=' + (iaddr === layout.ptr));
      }
    }

    amiga.Exec.ReplyMsg(raw);

    if (cls === 0x00000200) { done = true; break; }   /* CLOSE_WINDOW */
  }

  if (drainedThisWait === 0) {
    p('  [W' + waits + '] woke but GetMsg returned 0 (signal without msg?)');
  }
}

p('');
p('totals: waits=' + waits + ' messages=' + msgs);
win.dispose();
p('done.');
