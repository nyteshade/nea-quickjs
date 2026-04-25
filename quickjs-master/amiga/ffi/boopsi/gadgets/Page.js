/* quickjs-master/amiga/ffi/boopsi/gadgets/Page.js
 *
 * page.gadget — Reaction multi-page container (stackable panels).
 * Typically paired with a ClickTab for tabbed navigation.
 *
 * PAGE_Dummy = LAYOUT_Dummy + 0x200 = REACTION_Dummy + 0x7200 =
 * 0x85007200.
 *
 * Tags re-derived 2026-04-24 from gadgets/layout.h PAGE_* defines.
 * Previous table had PAGE_Current at +2 — that's actually PAGE_Remove,
 * so wizard_demo / clicktab_demo's `pages.set({current: step})` was
 * sending children to be removed instead of switching the visible page.
 * Header values: Add+1, Remove+2, Current+3, FixedVert+4, FixedHoriz+5,
 * Transparent+6, NoDispose+7.
 */

import { Layout } from './Layout.js';

const PAGE = Object.freeze({
  Add:         0x85007201,   /* +1 (Object*) child to add (varargs OK) */
  Remove:      0x85007202,   /* +2 (Object*) child to remove */
  Current:     0x85007203,   /* +3 (uint32) zero-based visible index */
  FixedVert:   0x85007204,   /* +4 (BOOL) reserve max-of-children height */
  FixedHoriz:  0x85007205,   /* +5 (BOOL) reserve max-of-children width */
  Transparent: 0x85007206,   /* +6 (BOOL) don't fill background */
  NoDispose:   0x85007207,   /* +7 (BOOL) skip child DisposeObject on free */
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
    add:         { tagID: PAGE.Add,         type: 'ptr' },
    remove:      { tagID: PAGE.Remove,      type: 'ptr' },
    current:     { tagID: PAGE.Current,     type: 'int32' },
    fixedVert:   { tagID: PAGE.FixedVert,   type: 'bool' },
    fixedHoriz:  { tagID: PAGE.FixedHoriz,  type: 'bool' },
    transparent: { tagID: PAGE.Transparent, type: 'bool' },
    noDispose:   { tagID: PAGE.NoDispose,   type: 'bool' },
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
