/* quickjs-master/amiga/ffi/boopsi/GadgetBase.js
 *
 * Base class for every BOOPSI object derived from gadgetclass.
 * Layers the GA_* attribute set (shared by every .gadget) on top of
 * BOOPSIBase's machinery. Concrete gadget classes (Button, CheckBox,
 * Layout, ...) extend GadgetBase and merge their own attribute
 * entries into `ATTRS`.
 *
 * GA_* tag values (intuition/gadgetclass.h, TAG_USER + 0x30000 =
 * 0x80030000 base):
 */

import { BOOPSIBase } from './BOOPSIBase.js';

/**
 * Tag IDs from intuition/gadgetclass.h. Frozen so subclasses can't
 * mutate the shared set by accident.
 */
export const GA = Object.freeze({
  Left:        0x80030001,
  RelRight:    0x80030002,
  Top:         0x80030003,
  RelBottom:   0x80030004,
  Width:       0x80030005,
  RelWidth:    0x80030006,
  Height:      0x80030007,
  RelHeight:   0x80030008,
  Text:        0x80030009,
  Image:       0x8003000A,
  Border:      0x8003000B,
  SelectRender:0x8003000C,
  Highlight:   0x8003000D,
  Disabled:    0x8003000E,
  ID:          0x8003000F,
  UserData:    0x80030010,
  SpecialInfo: 0x80030011,
  Selected:    0x80030012,
  EndGadget:   0x80030013,
  Immediate:   0x80030014,
  RelVerify:   0x80030015,
  FollowMouse: 0x80030016,
  RightBorder: 0x80030017,
  LeftBorder:  0x80030018,
  TopBorder:   0x80030019,
  BottomBorder:0x8003001A,
  ToggleSelect:0x8003001B,
  SysGadget:   0x8003001C,
  SysGType:    0x8003001D,
  Previous:    0x8003001E,
  Next:        0x8003001F,
  DrawInfo:    0x80030020,
  IntuiText:   0x80030021,
  LabelImage:  0x80030022,
  TabCycle:    0x80030023,
  GadgetHelp:  0x80030024,
  Bounds:      0x80030025,
  RelSpecial:  0x80030026,
  TextAttr:    0x80030027,
  ReadOnly:    0x80030028,
  UserInput:   0x80030029,
  HintInfo:    0x8003002A,
});

/**
 * Attributes every gadgetclass subclass inherits. Concrete classes
 * extend this with their own entries in their own ATTRS object;
 * BOOPSIBase's tag-list builder looks up names in whichever table
 * the subclass provides, so concrete classes effectively re-export
 * the combined set via the static GADGET_ATTRS spread.
 */
export const GADGET_ATTRS = Object.freeze({
  left:        { tagID: GA.Left,     type: 'int32'  },
  top:         { tagID: GA.Top,      type: 'int32'  },
  width:       { tagID: GA.Width,    type: 'int32'  },
  height:      { tagID: GA.Height,   type: 'int32'  },
  relRight:    { tagID: GA.RelRight,  type: 'int32' },
  relBottom:   { tagID: GA.RelBottom, type: 'int32' },
  relWidth:    { tagID: GA.RelWidth,  type: 'int32' },
  relHeight:   { tagID: GA.RelHeight, type: 'int32' },
  id:          { tagID: GA.ID,        type: 'uint32' },
  disabled:    { tagID: GA.Disabled,  type: 'bool'   },
  selected:    { tagID: GA.Selected,  type: 'bool'   },
  userData:    { tagID: GA.UserData,  type: 'uint32' },
  text:        { tagID: GA.Text,      type: 'string-owned' },
  gadgetHelp:  { tagID: GA.GadgetHelp, type: 'bool'  },
  tabCycle:    { tagID: GA.TabCycle,  type: 'bool'   },
  readOnly:    { tagID: GA.ReadOnly,  type: 'bool'   },
  /* GA_RelVerify enables release-verify events. Without it a gadget
   * renders but never reports clicks via IDCMP_GADGETUP /
   * IDCMP_IDCMPUPDATE. Button defaults this to true in its own ctor
   * to match the NDK PushButton macro. */
  relVerify:   { tagID: GA.RelVerify, type: 'bool'   },
  immediate:   { tagID: GA.Immediate, type: 'bool'   },
});

/**
 * Base class for all BOOPSI gadgets.
 *
 * @extends BOOPSIBase
 */
export class GadgetBase extends BOOPSIBase {
  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = { ...GADGET_ATTRS };

  /**
   * Convenient property proxy: gadget.id / gadget.disabled / etc.
   * Concrete classes inherit these through the ATTRS table; we
   * define a handful here that apply to every gadget.
   */
  get id()        { return this.get('id'); }
  set id(v)       { this.set({ id: v }); }

  get disabled()  { return this.get('disabled'); }
  set disabled(v) { this.set({ disabled: v }); }

  get selected()  { return this.get('selected'); }
  set selected(v) { this.set({ selected: v }); }

  get text()      { return this.get('text'); }
  set text(v)     { this.set({ text: v }); }
}
