/* quickjs-master/amiga/ffi/boopsi/gadgets/Page.js
 *
 * page.gadget — Reaction multi-page container (stackable panels).
 * Typically paired with a ClickTab for tabbed navigation.
 *
 * PAGE_Dummy = LAYOUT_Dummy + 0x200 = REACTION_Dummy + 0x7200 =
 * 0x85007200.
 *
 * IMPORTANT: Page is NOT a separate library file on OS3.2. It is
 * served by `gadgets/layout.gadget` — the FD file (NDK3.2R4/FD/
 * layout_lib.fd) lists `LAYOUT_GetClass()` at LVO -30 and
 * `PAGE_GetClass()` at LVO -60 in the same library. Header
 * `gadgets/page.h` is a one-line shim that #include's gadgets/layout.h
 * and contains "Page gadget is part of layout.gadget". Opening
 * `gadgets/page.gadget` directly fails silently, leaving ptr=0 and
 * the visible step content blank. This was the wizard_demo blank-
 * page bug + indirect cause of the clicktab quit-time Guru (ClickTab's
 * CLICKTAB_PageGroup pointing at a null Page).
 *
 * Tags re-derived 2026-04-24 from gadgets/layout.h PAGE_* defines.
 * Previous table had PAGE_Current at +2 — that's actually PAGE_Remove.
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
  static _classLibName = 'gadgets/layout.gadget';

  /** @type {number} — PAGE_GetClass() LVO in layout.gadget per
   *  NDK3.2R4/FD/layout_lib.fd (bias 30; LAYOUT_GetClass at -30,
   *  ActivateLayoutGadget -36, FlushLayoutDomainCache -42, RethinkLayout -48,
   *  LayoutLimits -54, PAGE_GetClass at -60). */
  static _classLibLvo = -60;

  /** Cached class pointer + base, distinct from the Layout class
   *  pointer because Page._libBase shares the layout.gadget OpenLibrary
   *  but _classPtr is the result of PAGE_GetClass not LAYOUT_GetClass. */
  static _classPtr = 0;
  static _libBase  = 0;

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

  /**
   * Override the inherited set() to call RethinkLayout on the Page
   * itself after OM_SET. Standard Reaction page-flip sequence on
   * OS3.2: SetGadgetAttrs(page, win, NULL, PAGE_Current, N, TAG_DONE)
   * is OM_SET-only (no auto-refresh), then RethinkLayout(page, win,
   * NULL, TRUE) re-lays-out the page and redraws the now-current
   * child. BOOPSIBase.set() already does SetGadgetAttrsA but doesn't
   * rethink the gadget itself — only walks _parent for an ancestor
   * Layout to rethink, which for Page means rethinking the OUTER
   * layout (skipping the page-flip itself). Doing both is fine:
   * outer rethink ensures the Page's slot is re-laid-out, inner
   * rethink ensures the Page flips to its new current child.
   *
   * Without this fix, wizard_demo's `pages.set({current: step})`
   * updated the internal index but never repainted; user saw step 1
   * forever no matter how many times they clicked Next.
   *
   * @override
   * @param {object} patch
   */
  set(patch) {
    super.set(patch);
    /* Only rethink-self when in a live window. */
    let winPtr = this._findWindowPtr();
    if (winPtr) {
      try { this.rethink(winPtr, true); }
      catch (e) { /* non-fatal; outer rethink already ran */ }
    }
  }
}
