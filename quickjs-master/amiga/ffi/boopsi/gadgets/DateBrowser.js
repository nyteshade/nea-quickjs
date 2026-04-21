/* quickjs-master/amiga/ffi/boopsi/gadgets/DateBrowser.js
 *
 * datebrowser.gadget — Reaction calendar / date picker. Extends
 * gadgetclass.
 *
 * DATEBROWSER_Dummy = REACTION_Dummy + 0x61000 = 0x85061000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const DATEBROWSER = Object.freeze({
  Year:          0x85061001,
  Month:         0x85061002,
  Day:           0x85061003,
  WeekDay:       0x85061004,
  FirstWeekDay:  0x85061005,
  Locale:        0x85061006,
  WeekNumbers:   0x85061007,
  HighlightToday:0x85061008,
  ShowDays:      0x85061009,
  TopLabel:      0x8506100A,
  TopLabelPlace: 0x8506100B,
  HeaderGadget:  0x8506100C,
  ReadOnly:      0x8506100D,
});

/**
 * datebrowser.gadget — calendar picker.
 *
 * @extends GadgetBase
 */
export class DateBrowser extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/datebrowser.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    year:           { tagID: DATEBROWSER.Year,          type: 'int32' },
    month:          { tagID: DATEBROWSER.Month,         type: 'int32' },
    day:            { tagID: DATEBROWSER.Day,           type: 'int32' },
    weekDay:        { tagID: DATEBROWSER.WeekDay,       type: 'int32' },
    firstWeekDay:   { tagID: DATEBROWSER.FirstWeekDay,  type: 'int32' },
    locale:         { tagID: DATEBROWSER.Locale,        type: 'ptr' },
    weekNumbers:    { tagID: DATEBROWSER.WeekNumbers,   type: 'bool' },
    highlightToday: { tagID: DATEBROWSER.HighlightToday,type: 'bool' },
    showDays:       { tagID: DATEBROWSER.ShowDays,      type: 'bool' },
    topLabel:       { tagID: DATEBROWSER.TopLabel,      type: 'string-owned' },
    topLabelPlace:  { tagID: DATEBROWSER.TopLabelPlace, type: 'uint32' },
    headerGadget:   { tagID: DATEBROWSER.HeaderGadget,  type: 'bool' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('DATE_CHANGE', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/datebrowser.gadget',
  wraps: 'ATTR_UPDATE',
});
