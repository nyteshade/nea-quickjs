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
 * Children are added via PAGE_Add (one tag per page) instead of
 * LAYOUT_AddChild — Layout's `children: []` semantics would point
 * the children at the wrong tag, so Page overrides the constructor
 * to do the conversion explicitly.
 *
 * Usage:
 *   new Page({
 *     current: 0,                  // initial page index
 *     children: [page1, page2],    // each child is its own Layout
 *   });
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

  /**
   * Construct a Page. Like Layout, accepts a `children: []` array,
   * but each child is added via PAGE_Add instead of LAYOUT_AddChild.
   *
   * @param {object} init
   */
  constructor(init) {
    let raw = (init && typeof init === 'object') ? { ...init } : {};
    let children = raw.children;
    delete raw.children;

    /* Convert children to PAGE_Add tags via _extraPairs. Layout's
     * constructor will see no `children` key, so its own LAYOUT_AddChild
     * conversion is bypassed. */
    let pairs = [];
    if (Array.isArray(children)) {
      for (let c of children) {
        if (!c || !c.ptr) {
          throw new Error(
            'Page: child in children[] has no ptr ' +
            '(disposed, wrapping-only, or not a BOOPSIBase)'
          );
        }
        pairs.push([PAGE.Add, c.ptr]);
      }
    }
    if (pairs.length) raw._extraPairs = pairs;

    super(raw);

    /* Track children for dispose cascade and id-map walks. */
    if (Array.isArray(children)) {
      for (let c of children) {
        c._parent = this;
        this._children.push(c);
      }
    }
  }
}
