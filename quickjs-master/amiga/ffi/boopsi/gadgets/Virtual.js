/* quickjs-master/amiga/ffi/boopsi/gadgets/Virtual.js
 *
 * virtual.gadget — Reaction scrollable virtual container. Wraps a
 * child layout that's larger than the visible area and supplies
 * scroller gadgets to pan around. Needs OS3.9+BB1 (V45) or OS3.2.
 *
 * Tag values derived from NDK3.2R4 Include_H/gadgets/virtual.h
 * (audit 10.6.2026, T-reaction-audit-remaining-4):
 *   VIRTUALA_Base = REACTION_Dummy + 0x24500 = 0x85024500
 * The previous table used an invented 0x85062000 base and invented
 * names (NoHorizScroller/TopPixel/...) — none exist in the NDK.
 * TargetX/Y and MapX/Y (+14..+17) are OS4-only and omitted.
 */

import { Layout } from './Layout.js';

const VIRTUALA = Object.freeze({
  /* check-constants: prefix VIRTUALA_ header gadgets/virtual.h */
  Contents:    0x85024500,  /* + 0  (Object *) child layout          */
  Scroller:    0x85024501,  /* + 1  (BOOL) show scrollbars, def TRUE */
  ScrollX:     0x85024502,  /* + 2  (WORD) scroll by N pixels        */
  ScrollY:     0x85024503,  /* + 3  (WORD) scroll by N pixels        */
  VisibleX:    0x85024504,  /* + 4  (UWORD, OM_GET/NOTIFY)           */
  VisibleY:    0x85024505,  /* + 5  (UWORD, OM_GET/NOTIFY)           */
  TopX:        0x85024506,  /* + 6  (UWORD) current top, set/get     */
  TopY:        0x85024507,  /* + 7  (UWORD) current top, set/get     */
  TotalX:      0x85024508,  /* + 8  (UWORD, OM_GET/NOTIFY)           */
  TotalY:      0x85024509,  /* + 9  (UWORD, OM_GET/NOTIFY)           */
  ScrollerX:   0x8502450A,  /* + 10 (Object *) own h-scroller, OM_NEW*/
  ScrollerY:   0x8502450B,  /* + 11 (Object *) own v-scroller, OM_NEW*/
  InputScroll: 0x8502450C,  /* + 12 (BOOL) drag-scroll, def TRUE     */
  NoDispose:   0x8502450D,  /* + 13 (BOOL) don't dispose contents    */
});

/**
 * virtual.gadget — scrollable virtual container.
 *
 * @extends Layout
 */
export class Virtual extends Layout {
  /** @type {string} */
  static _classLibName = 'gadgets/virtual.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...Layout.ATTRS,
    /** Child object (usually a Layout) displayed inside the view. */
    contents:    { tagID: VIRTUALA.Contents,    type: 'ptr' },
    /** Show the built-in scrollbars (default TRUE). */
    scroller:    { tagID: VIRTUALA.Scroller,    type: 'bool' },
    /** Scroll the contents horizontally by N pixels. */
    scrollX:     { tagID: VIRTUALA.ScrollX,     type: 'int32' },
    /** Scroll the contents vertically by N pixels. */
    scrollY:     { tagID: VIRTUALA.ScrollY,     type: 'int32' },
    /** Visible width of the contents (get/notify). */
    visibleX:    { tagID: VIRTUALA.VisibleX,    type: 'uint32' },
    /** Visible height of the contents (get/notify). */
    visibleY:    { tagID: VIRTUALA.VisibleY,    type: 'uint32' },
    /** Current horizontal top offset (set/get/notify). */
    topX:        { tagID: VIRTUALA.TopX,        type: 'uint32' },
    /** Current vertical top offset (set/get/notify). */
    topY:        { tagID: VIRTUALA.TopY,        type: 'uint32' },
    /** Total width of the contents (get/notify). */
    totalX:      { tagID: VIRTUALA.TotalX,      type: 'uint32' },
    /** Total height of the contents (get/notify). */
    totalY:      { tagID: VIRTUALA.TotalY,      type: 'uint32' },
    /** Caller-supplied horizontal scroller object (create-only). */
    scrollerX:   { tagID: VIRTUALA.ScrollerX,   type: 'ptr' },
    /** Caller-supplied vertical scroller object (create-only). */
    scrollerY:   { tagID: VIRTUALA.ScrollerY,   type: 'ptr' },
    /** Drag-past-edge auto-scroll (default TRUE). */
    inputScroll: { tagID: VIRTUALA.InputScroll, type: 'bool' },
    /** Don't auto-dispose the contents with the gadget. */
    noDispose:   { tagID: VIRTUALA.NoDispose,   type: 'bool' },
  };
}
