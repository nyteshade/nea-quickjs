/* quickjs-master/amiga/ffi/boopsi/gadgets/TextEditor.js
 *
 * texteditor.gadget — multi-line text edit / code editor control.
 * One of the most complex Reaction classes.
 *
 * TEXTEDITOR_Dummy = REACTION_Dummy + 0x26000 = 0x85026000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const TEXTEDITOR = Object.freeze({
  Contents:         0x85026001,
  ExportHook:       0x85026002,
  ImportHook:       0x85026003,
  Flow:             0x85026004,
  KeyBindings:      0x85026005,
  Pen:              0x85026006,
  Quiet:            0x85026007,
  ReadOnly:         0x85026008,
  StyleBold:        0x85026009,
  StyleItalic:      0x8502600A,
  StyleUnderline:   0x8502600B,
  FixedFont:        0x8502600C,
  Columns:          0x8502600D,
  DoubleClickHook:  0x8502600E,
  HasChanged:       0x8502600F,
  Separator:        0x85026010,
  CursorPosition:   0x85026011,
  CursorX:          0x85026012,
  CursorY:          0x85026013,
  Prop_First:       0x85026014,
  Prop_Entries:     0x85026015,
  Prop_Visible:     0x85026016,
  Pen_FG:           0x85026017,
  Pen_BG:           0x85026018,
  CheckWordFunction:0x85026019,
  FormatCode:       0x8502601A,
  Slider:           0x8502601B,
  ColorMap:         0x8502601C,
  TypeAndSpell:     0x8502601D,
  InVirtualGroup:   0x8502601E,
  UndoAvailable:    0x8502601F,
  RedoAvailable:    0x85026020,
  AreaMarked:       0x85026021,
  HasChanged_ACK:   0x85026022,
  WrapBorder:       0x85026023,
  StopCursorBlink:  0x85026024,
  SmoothScroll:     0x85026025,
});

/**
 * texteditor.gadget — multi-line text editor.
 *
 * @extends GadgetBase
 */
export class TextEditor extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/texteditor.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    contents:        { tagID: TEXTEDITOR.Contents,        type: 'string-owned' },
    flow:            { tagID: TEXTEDITOR.Flow,            type: 'uint32' },
    pen:             { tagID: TEXTEDITOR.Pen,             type: 'uint32' },
    quiet:           { tagID: TEXTEDITOR.Quiet,           type: 'bool' },
    readOnly:        { tagID: TEXTEDITOR.ReadOnly,        type: 'bool' },
    styleBold:       { tagID: TEXTEDITOR.StyleBold,       type: 'bool' },
    styleItalic:     { tagID: TEXTEDITOR.StyleItalic,     type: 'bool' },
    styleUnderline:  { tagID: TEXTEDITOR.StyleUnderline,  type: 'bool' },
    fixedFont:       { tagID: TEXTEDITOR.FixedFont,       type: 'bool' },
    columns:         { tagID: TEXTEDITOR.Columns,         type: 'int32' },
    hasChanged:      { tagID: TEXTEDITOR.HasChanged,      type: 'bool' },
    cursorPosition:  { tagID: TEXTEDITOR.CursorPosition,  type: 'int32' },
    cursorX:         { tagID: TEXTEDITOR.CursorX,         type: 'int32' },
    cursorY:         { tagID: TEXTEDITOR.CursorY,         type: 'int32' },
    penFG:           { tagID: TEXTEDITOR.Pen_FG,          type: 'uint32' },
    penBG:           { tagID: TEXTEDITOR.Pen_BG,          type: 'uint32' },
    typeAndSpell:    { tagID: TEXTEDITOR.TypeAndSpell,    type: 'bool' },
    undoAvailable:   { tagID: TEXTEDITOR.UndoAvailable,   type: 'bool' },
    redoAvailable:   { tagID: TEXTEDITOR.RedoAvailable,   type: 'bool' },
    areaMarked:      { tagID: TEXTEDITOR.AreaMarked,      type: 'bool' },
    wrapBorder:      { tagID: TEXTEDITOR.WrapBorder,      type: 'uint32' },
    stopCursorBlink: { tagID: TEXTEDITOR.StopCursorBlink, type: 'bool' },
    smoothScroll:    { tagID: TEXTEDITOR.SmoothScroll,    type: 'bool' },
    slider:          { tagID: TEXTEDITOR.Slider,          type: 'ptr' },
  };
}

EventKind.define('TEXT_CHANGE', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/texteditor.gadget',
  wraps: 'ATTR_UPDATE',
});
