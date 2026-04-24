/* quickjs-master/amiga/ffi/boopsi/gadgets/DateBrowser.js
 *
 * datebrowser.gadget — month-view calendar / date-picker.
 *
 * DATEBROWSER_Dummy = REACTION_Dummy + 0x61000 = 0x85061000.
 *
 * Tags re-derived from gadgets/datebrowser.h (NDK 3.2R4). Previous
 * table had Year/Month/Day shifted — DATEBROWSER_Day is actually
 * DATEBROWSER_Dummy itself (+0), Month is +1, Year is +2, with
 * SelectedDays / WeekDay / FirstWDay / NumDays / ShowTitle /
 * MultiSelect filling the rest. Locale / WeekNumbers / HighlightToday
 * / TopLabel / HeaderGadget from the old table don't exist in this
 * header.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

/** @internal DATEBROWSER_* tag IDs (gadgets/datebrowser.h). */
const DATEBROWSER = Object.freeze({
  Day:          0x85061000,   /* +0 (Dummy itself; 1..31) */
  Month:        0x85061001,   /* +1 (1..12) */
  Year:         0x85061002,   /* +2 (full year, e.g. 2026) */
  SelectedDays: 0x85061003,   /* +3 (ptr to UBYTE bitmap) */
  WeekDay:      0x85061004,   /* +4 */
  FirstWDay:    0x85061005,   /* +5 — first day of week (0=Mon..6=Sun) */
  NumDays:      0x85061006,   /* +6 — span for multi-select */
  ShowTitle:    0x85061007,   /* +7 — bool */
  MultiSelect:  0x85061008,   /* +8 — bool */
});

/**
 * datebrowser.gadget — Reaction month-view calendar.
 *
 * @extends GadgetBase
 */
export class DateBrowser extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/datebrowser.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    day:          { tagID: DATEBROWSER.Day,          type: 'uint32' },
    month:        { tagID: DATEBROWSER.Month,        type: 'uint32' },
    year:         { tagID: DATEBROWSER.Year,         type: 'uint32' },
    selectedDays: { tagID: DATEBROWSER.SelectedDays, type: 'ptr' },
    weekDay:      { tagID: DATEBROWSER.WeekDay,      type: 'uint32' },
    firstWeekDay: { tagID: DATEBROWSER.FirstWDay,    type: 'uint32' },
    numDays:      { tagID: DATEBROWSER.NumDays,      type: 'uint32' },
    showTitle:    { tagID: DATEBROWSER.ShowTitle,    type: 'bool' },
    multiSelect:  { tagID: DATEBROWSER.MultiSelect,  type: 'bool' },
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
