/* quickjs-master/amiga/ffi/boopsi/gadgets/ClickTab.js
 *
 * clicktab.gadget — Reaction tab control. Extends gadgetclass. Tabs
 * are supplied via CLICKTAB_Labels (struct List of nodes with TNA_*
 * attributes per tab).
 *
 * CLICKTAB_Dummy = REACTION_Dummy + 0x27000 = 0x85027000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const CLICKTAB = Object.freeze({
  Labels:         0x85027001,
  Current:        0x85027002,
  PageGroup:      0x85027003,
  CaptureHeight:  0x85027004,
  TruncateLabels: 0x85027005,
  CurrentNode:    0x85027006,
  TabsBar:        0x85027007,
  AutoFit:        0x85027008,
});

/** Tab-node attributes (TNA_Dummy = TAG_USER+0x010000). */
export const TNA = Object.freeze({
  Text:      0x80010001,
  Number:    0x80010002,
  UserData:  0x80010003,
  Image:     0x80010004,
  Disabled:  0x80010005,
  TextPen:   0x80010006,
  HintInfo:  0x80010007,
  Flagged:   0x80010008,
  Spacing:   0x80010009,
  CloseGadget:0x8001000A,
});

/**
 * clicktab.gadget — tab switcher.
 *
 * @extends GadgetBase
 */
export class ClickTab extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/clicktab.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    labels:         { tagID: CLICKTAB.Labels,         type: 'ptr' },
    current:        { tagID: CLICKTAB.Current,        type: 'int32' },
    pageGroup:      { tagID: CLICKTAB.PageGroup,      type: 'ptr' },
    captureHeight:  { tagID: CLICKTAB.CaptureHeight,  type: 'bool' },
    truncateLabels: { tagID: CLICKTAB.TruncateLabels, type: 'bool' },
    currentNode:    { tagID: CLICKTAB.CurrentNode,    type: 'ptr' },
    tabsBar:        { tagID: CLICKTAB.TabsBar,        type: 'bool' },
    autoFit:        { tagID: CLICKTAB.AutoFit,        type: 'bool' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('CLICKTAB_CHANGE', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/clicktab.gadget',
  wraps: 'ATTR_UPDATE',
});
