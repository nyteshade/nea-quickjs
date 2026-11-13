/* quickjs-master/amiga/ffi/boopsi/gadgets/SketchBoard.js
 *
 * sketchboard.gadget — Reaction free-draw canvas.
 *
 * Tag values derived from NDK3.2R4 Include_H/gadgets/sketchboard.h
 * (audit 10.6.2026, T-reaction-audit-remaining-4):
 *   SKETCHBOARD_Dummy = REACTION_Dummy + 0x24600 = 0x85024600
 *   real tags are SGA_* at +0 .. +33.
 * The previous table (MinWidth/RenderHook/PenFG/...) was entirely
 * invented — none of those names or numbers exist in the NDK.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind, IDCMP } from '../EventKind.js';

const SGA = Object.freeze({
  /* check-constants: prefix SGA_ header gadgets/sketchboard.h */
  BitMap:              0x85024600,  /* + 0  (struct BitMap *)        */
  MouseX:              0x85024601,  /* + 1  (LONG, OM_GET/NOTIFY)    */
  MouseY:              0x85024602,  /* + 2  (LONG, OM_GET/NOTIFY)    */
  Width:               0x85024603,  /* + 3  (LONG)                   */
  Height:              0x85024604,  /* + 4  (LONG)                   */
  APen:                0x85024605,  /* + 5  (ULONG pen number)       */
  Tool:                0x85024606,  /* + 6  (ULONG, SGTOOL_*)        */
  UndoAvailable:       0x85024607,  /* + 7  (BOOL, OM_GET/NOTIFY)    */
  RedoAvailable:       0x85024608,  /* + 8  (BOOL, OM_GET/NOTIFY)    */
  ShowGrid:            0x85024609,  /* + 9  (BOOL)                   */
  Scale:               0x8502460A,  /* + 10 (ULONG zoom factor)      */
  AfPt:                0x8502460B,  /* + 11 (UWORD * area fill pat)  */
  AfPtSize:            0x8502460C,  /* + 12 (ULONG)                  */
  HPropTotal:          0x8502460D,  /* + 13 (ULONG, scroller wiring) */
  HPropTop:            0x8502460E,  /* + 14 (ULONG)                  */
  HPropVisible:        0x8502460F,  /* + 15 (ULONG)                  */
  VPropTotal:          0x85024610,  /* + 16 (ULONG)                  */
  VPropTop:            0x85024611,  /* + 17 (ULONG)                  */
  VPropVisible:        0x85024612,  /* + 18 (ULONG)                  */
  HotSpot:             0x85024613,  /* + 19 (ULONG)                  */
  Changed:             0x85024614,  /* + 20 (BOOL, OM_GET/NOTIFY)    */
  RastPort:            0x85024615,  /* + 21 (struct RastPort *)      */
  SketchBoardRect:     0x85024616,  /* + 22 (struct Rectangle *)     */
  SubWidth:            0x85024617,  /* + 23 (LONG)                   */
  SubHeight:           0x85024618,  /* + 24 (LONG)                   */
  DoubleScaleX:        0x85024619,  /* + 25 (BOOL)                   */
  DoubleScaleY:        0x8502461A,  /* + 26 (BOOL)                   */
  TopLayerBitmap:      0x8502461B,  /* + 27 (struct BitMap *)        */
  TopLayerWidth:       0x8502461C,  /* + 28 (LONG)                   */
  WithBevel:           0x8502461D,  /* + 29 (BOOL)                   */
  ScrollWheelResponse: 0x8502461E,  /* + 30 (ULONG)                  */
  MaxUndoSteps:        0x8502461F,  /* + 31 (ULONG)                  */
  UpdatedBitMap:       0x85024620,  /* + 32 (struct BitMap *)        */
  MaxScale:            0x85024621,  /* + 33 (ULONG)                  */
});

/**
 * Drawing tool values for SGA_Tool (NDK SGTOOL_* constants).
 *
 * @readonly
 * @enum {number}
 */
export const SketchTool = Object.freeze({
  /* check-constants: prefix SGTOOL_ header gadgets/sketchboard.h */
  FREEHAND_DOTS:  0,  /* default */
  FREEHAND:       1,
  ELLIPSE:        2,
  ELLIPSE_FILLED: 3,
});

/**
 * sketchboard.gadget — free-draw canvas over a BitMap.
 *
 * @extends GadgetBase
 */
export class SketchBoard extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/sketchboard.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    bitMap:        { tagID: SGA.BitMap,        type: 'ptr' },
    mouseX:        { tagID: SGA.MouseX,        type: 'int32' },
    mouseY:        { tagID: SGA.MouseY,        type: 'int32' },
    bmWidth:       { tagID: SGA.Width,         type: 'int32' },
    bmHeight:      { tagID: SGA.Height,        type: 'int32' },
    aPen:          { tagID: SGA.APen,          type: 'uint32' },
    tool:          { tagID: SGA.Tool,          type: 'uint32' },
    undoAvailable: { tagID: SGA.UndoAvailable, type: 'bool' },
    redoAvailable: { tagID: SGA.RedoAvailable, type: 'bool' },
    showGrid:      { tagID: SGA.ShowGrid,      type: 'bool' },
    scale:         { tagID: SGA.Scale,         type: 'uint32' },
    changed:       { tagID: SGA.Changed,       type: 'bool' },
    rastPort:      { tagID: SGA.RastPort,      type: 'ptr' },
    withBevel:     { tagID: SGA.WithBevel,     type: 'bool' },
    maxUndoSteps:  { tagID: SGA.MaxUndoSteps,  type: 'uint32' },
    maxScale:      { tagID: SGA.MaxScale,      type: 'uint32' },
  };
}

EventKind.define('SKETCH_UPDATE', {
  idcmp: IDCMP.IDCMPUPDATE,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: true },
  from:  'gadgets/sketchboard.gadget',
  wraps: 'ATTR_UPDATE',
});
