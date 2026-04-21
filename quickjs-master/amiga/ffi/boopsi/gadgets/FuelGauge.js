/* quickjs-master/amiga/ffi/boopsi/gadgets/FuelGauge.js
 *
 * fuelgauge.gadget — Reaction progress bar / fuel gauge.
 *
 * FUELGAUGE_Dummy = REACTION_Dummy + 0x12000 = 0x85012000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const FUELGAUGE = Object.freeze({
  Min:            0x85012001,
  Max:            0x85012002,
  Level:          0x85012003,
  Percent:        0x85012004,
  Justification:  0x85012005,
  Ticks:          0x85012006,
  ShortTicks:     0x85012007,
  TickSize:       0x85012008,
  VariableWidth:  0x85012009,
  Orientation:    0x8501200A,
  LowColor:       0x8501200B,
  HighColor:      0x8501200C,
  ColorOffset:    0x8501200D,
});

export const FuelGaugeOrient = Object.freeze({
  HORIZONTAL: 0x1, VERTICAL: 0x2,
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
    percent:        { tagID: FUELGAUGE.Percent,        type: 'bool' },
    justification:  { tagID: FUELGAUGE.Justification,  type: 'uint32' },
    ticks:          { tagID: FUELGAUGE.Ticks,          type: 'int32' },
    shortTicks:     { tagID: FUELGAUGE.ShortTicks,     type: 'int32' },
    tickSize:       { tagID: FUELGAUGE.TickSize,       type: 'int32' },
    variableWidth:  { tagID: FUELGAUGE.VariableWidth,  type: 'bool' },
    orientation:    { tagID: FUELGAUGE.Orientation,    type: 'uint32' },
    lowColor:       { tagID: FUELGAUGE.LowColor,       type: 'uint32' },
    highColor:      { tagID: FUELGAUGE.HighColor,      type: 'uint32' },
    colorOffset:    { tagID: FUELGAUGE.ColorOffset,    type: 'int32' },
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
