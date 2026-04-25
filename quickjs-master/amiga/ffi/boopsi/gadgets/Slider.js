/* quickjs-master/amiga/ffi/boopsi/gadgets/Slider.js
 *
 * slider.gadget — Reaction horizontal/vertical value slider.
 * Extends gadgetclass. SLIDER_Level is the current value in
 * [SLIDER_Min, SLIDER_Max].
 *
 * SLIDER_Dummy = REACTION_Dummy + 0x28000 = 0x85028000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

/** @internal SLIDER_* tag IDs (gadgets/slider.h). */
const SLIDER = Object.freeze({
  Min:           0x85028001,
  Max:           0x85028002,
  Level:         0x85028003,
  Orientation:   0x85028004,
  DispHook:      0x85028005,  /* formatting hook */
  Ticks:         0x85028006,
  ShortTicks:    0x85028007,
  TickSize:      0x85028008,
  KnobImage:     0x85028009,
  BodyFill:      0x8502800A,
  BodyImage:     0x8502800B,
  Gradient:      0x8502800C,
  PenArray:      0x8502800D,
  Invert:        0x8502800E,
  KnobDelta:     0x8502800F,
  LevelFormat:   0x85028010,
  LevelPlace:    0x85028011,
  LevelJustify:  0x85028012,
  LevelDomain:   0x85028013,
  LevelSpace:    0x85028014,
  LevelHook:     0x85028015,
  LevelMaxLen:   0x85028016,
  NotifyDisable: 0x85028017,
  InitDispHook:  0x85028018,
});

/** SLIDER_Orientation values (FREEHORIZ / FREEVERT from propgclass). */
export const SliderOrient = Object.freeze({
  HORIZONTAL: 0x1,
  VERTICAL:   0x2,
});

/** SLIDER_LevelJustify (SLJ_*). */
export const SliderJustify = Object.freeze({
  LEFT:   0,
  CENTER: 1,
  RIGHT:  2,
});

/**
 * slider.gadget — value slider.
 *
 * @extends GadgetBase
 */
export class Slider extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/slider.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    min:         { tagID: SLIDER.Min,         type: 'int32' },
    max:         { tagID: SLIDER.Max,         type: 'int32' },
    level:       { tagID: SLIDER.Level,       type: 'int32' },
    orientation: { tagID: SLIDER.Orientation, type: 'uint32' },
    ticks:       { tagID: SLIDER.Ticks,       type: 'int32' },
    shortTicks:  { tagID: SLIDER.ShortTicks,  type: 'int32' },
    tickSize:    { tagID: SLIDER.TickSize,    type: 'int32' },
    knobImage:   { tagID: SLIDER.KnobImage,   type: 'ptr' },
    gradient:    { tagID: SLIDER.Gradient,    type: 'bool' },
    invert:      { tagID: SLIDER.Invert,      type: 'bool' },
    knobDelta:   { tagID: SLIDER.KnobDelta,   type: 'int32' },
    levelFormat: { tagID: SLIDER.LevelFormat, type: 'string-owned' },
    levelPlace:  { tagID: SLIDER.LevelPlace,  type: 'uint32' },
    levelJustify:{ tagID: SLIDER.LevelJustify,type: 'uint32' },
    levelDomain: { tagID: SLIDER.LevelDomain, type: 'string-owned' },
    levelSpace:  { tagID: SLIDER.LevelSpace,  type: 'int32' },
    levelMaxLen: { tagID: SLIDER.LevelMaxLen, type: 'int32' },
    notifyDisable:{tagID: SLIDER.NotifyDisable,type: 'bool' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (typeof clean.orientation === 'string') {
      clean.orientation = clean.orientation.toLowerCase() === 'vertical'
        ? SliderOrient.VERTICAL : SliderOrient.HORIZONTAL;
    }
    if (clean.relVerify === undefined) clean.relVerify = true;
    if (clean.tabCycle  === undefined) clean.tabCycle  = true;
    super(clean);
  }
}

EventKind.define('SLIDER_CHANGE', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/slider.gadget',
  wraps: 'ATTR_UPDATE',
});
