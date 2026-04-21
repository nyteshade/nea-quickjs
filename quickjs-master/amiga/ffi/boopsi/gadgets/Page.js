/* quickjs-master/amiga/ffi/boopsi/gadgets/Page.js
 *
 * page.gadget — Reaction multi-page container (stackable panels).
 * Typically paired with a ClickTab for tabbed navigation.
 *
 * PAGE_Dummy = LAYOUT_Dummy + 0x200 = REACTION_Dummy + 0x7200 =
 * 0x85007200.
 */

import { Layout } from './Layout.js';

const PAGE = Object.freeze({
  Add:     0x85007201,
  Current: 0x85007202,
});

/**
 * page.gadget — multi-page container.
 *
 * Extends Layout (which is itself a gadget) with page-switching.
 *
 * @extends Layout
 */
export class Page extends Layout {
  /** @type {string} */
  static _classLibName = 'gadgets/page.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...Layout.ATTRS,
    add:     { tagID: PAGE.Add,     type: 'ptr' },
    current: { tagID: PAGE.Current, type: 'int32' },
  };
}
