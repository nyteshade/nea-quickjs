/* quickjs-master/amiga/ffi/boopsi/gadgets/FuelGauge.js
 *
 * fuelgauge.gadget — Reaction progress bar / fuel gauge.
 *
 * FUELGAUGE_Dummy = REACTION_Dummy + 0x12000 = 0x85012000.
 *
 * Tags re-derived 2026-04-24 from gadgets/fuelgauge.h (NDK 3.2R4). The
 * previous table had Orientation/Percent/Justification at the wrong slots
 * and invented attrs (VariableWidth, LowColor, HighColor, ColorOffset)
 * that don't exist in the OS3.2 header. progress_demo rendered vertical
 * because `percent: true` was writing tag +4 = real Orientation, and
 * FuelGaugeOrient values were 0x1/0x2 instead of header's 0/1.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const FUELGAUGE = Object.freeze({
  Min:            0x85012001,   /* +1 (LONG)  minimum */
  Max:            0x85012002,   /* +2 (LONG)  maximum */
  Level:          0x85012003,   /* +3 (LONG)  current */
  Orientation:    0x85012004,   /* +4 (WORD)  FGORIENT_HORIZ/VERT */
  Percent:        0x85012005,   /* +5 (BOOL)  show numeric percent */
  Ticks:          0x85012006,   /* +6 (WORD)  number of major ticks */
  ShortTicks:     0x85012007,   /* +7 (WORD)  intermediate ticks */
  TickSize:       0x85012008,   /* +8 (WORD)  major tick height */
  TickPen:        0x85012009,   /* +9 (WORD)  tick mark pen */
  PercentPen:     0x8501200A,   /* +0xA (WORD) inner percent text pen */
  FillPen:        0x8501200B,   /* +0xB (WORD) fuelbar pen */
  EmptyPen:       0x8501200C,   /* +0xC (WORD) background/empty pen */
  VarArgs:        0x8501200D,   /* +0xD GA_Text varargs string */
  Justification:  0x8501200E,   /* +0xE FGJ_LEFT/CENTER */
});

/** FuelGauge orientation values per gadgets/fuelgauge.h FGORIENT_*. */
export const FuelGaugeOrient = Object.freeze({
  HORIZONTAL: 0,   /* FGORIENT_HORIZ */
  VERTICAL:   1,   /* FGORIENT_VERT */
});

/** FuelGauge text justification per FGJ_*. */
export const FuelGaugeJustify = Object.freeze({
  LEFT:   0,
  CENTER: 1,
  CENTRE: 1,
});

/**
 * fuelgauge.gadget — progress bar.
 *
 * @extends GadgetBase
 */
export class FuelGauge extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/fuelgauge.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    min:            { tagID: FUELGAUGE.Min,            type: 'int32' },
    max:            { tagID: FUELGAUGE.Max,            type: 'int32' },
    level:          { tagID: FUELGAUGE.Level,          type: 'int32' },
    orientation:    { tagID: FUELGAUGE.Orientation,    type: 'uint32' },
    percent:        { tagID: FUELGAUGE.Percent,        type: 'bool' },
    ticks:          { tagID: FUELGAUGE.Ticks,          type: 'int32' },
    shortTicks:     { tagID: FUELGAUGE.ShortTicks,     type: 'int32' },
    tickSize:       { tagID: FUELGAUGE.TickSize,       type: 'int32' },
    tickPen:        { tagID: FUELGAUGE.TickPen,        type: 'int32' },
    percentPen:     { tagID: FUELGAUGE.PercentPen,     type: 'int32' },
    fillPen:        { tagID: FUELGAUGE.FillPen,        type: 'int32' },
    emptyPen:       { tagID: FUELGAUGE.EmptyPen,       type: 'int32' },
    justification:  { tagID: FUELGAUGE.Justification,  type: 'uint32' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (typeof clean.orientation === 'string') {
      clean.orientation = clean.orientation.toLowerCase() === 'vertical'
        ? FuelGaugeOrient.VERTICAL : FuelGaugeOrient.HORIZONTAL;
    }
    super(clean);
  }
}
