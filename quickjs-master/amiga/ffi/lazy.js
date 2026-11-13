/* quickjs-master/amiga/ffi/lazy.js
 *
 * Loads the FFI wrappers on first use.
 *
 * The wrappers (Intuition, Exec, the struct classes, the Reaction
 * classes, ...) are two bundles of precompiled JavaScript inside
 * quickjs.library. Building them costs several hundred kilobytes of
 * heap and a large part of a second on a 68020, and most scripts use
 * none or only some of them.
 *
 *   group 0, "core":   CEnumeration, LibraryBase, the struct wrappers,
 *                      the library wrappers, ScreenFont
 *   group 1, "boopsi": the BOOPSI / Reaction classes; needs group 0
 *
 * Nothing here runs when qjs starts. The library registers every name
 * a bundle publishes as a HOST LAZY PROPERTY (see
 * qjs_install_lazy_globals in library/vbcc/amiga_ffi.c), from tables
 * that scripts/bundle_ffi.py writes from the index files: the globals
 * at start-up, and the names on `amiga` and its per-library tables
 * once `amiga` exists. The first time a script uses one of those
 * names the library evaluates this file (once) and calls the handler
 * registered at the bottom with the group number.
 *
 * Each bundle is one function body, so it publishes nothing but what
 * its index file assigns. The BOOPSI bundle needs classes that are
 * private to the core bundle; the core leaves them in
 * globalThis.__qjs_ffiShared, which is taken away here at once and put
 * back only while the BOOPSI bundle loads.
 */

(function () {
  'use strict';

  /* Natives from library/vbcc/amiga_ffi.c. */
  const loadBundle = globalThis.__qjs_loadBundle;
  const lazyClear  = globalThis.__qjs_lazyClear;
  const setHandler = globalThis.__qjs_lazyHandler;

  if (typeof loadBundle !== 'function' || typeof lazyClear !== 'function' ||
      typeof setHandler !== 'function') {
    return;
  }

  const NOT_LOADED = 0;   /* check-constants: skip - our own state, not an OS value */
  const LOADING    = 1;
  const LOADED     = 2;

  const BOOPSI_GROUP = 1;   /* check-constants: skip - our own bundle number */
  const CORE_GROUP   = 0;   /* check-constants: skip - our own bundle number */

  /** The library's tag for a group is this plus the group number. */
  const FFI_TAG_BASE = 1000;   /* check-constants: skip - our own module tag */

  /** Which handler slot is this file's (extended.js has slot 0). */
  const FFI_HANDLER_SLOT = 1;   /* check-constants: skip - our own slot number */

  /** Per group: NOT_LOADED, LOADING or LOADED. */
  const state = [NOT_LOADED, NOT_LOADED];

  /** The core bundle's private classes that the BOOPSI bundle uses. */
  let shared;

  /**
   * Load a group's bundle if that has not been done yet.
   *
   * The group's names that are still lazy are removed first, because
   * a bundle only sets a global whose name is free.
   *
   * @param {number} group - CORE_GROUP or BOOPSI_GROUP
   * @returns {undefined}
   */
  function ensureLoaded(group) {
    if (state[group] !== NOT_LOADED) {
      return;
    }

    if (group === BOOPSI_GROUP) {
      ensureLoaded(CORE_GROUP);
    }

    state[group] = LOADING;

    lazyClear(FFI_TAG_BASE + group);

    if (group === BOOPSI_GROUP) {
      globalThis.__qjs_ffiShared = shared;
    }

    try {
      loadBundle(group);
    }
    finally {
      if (group === CORE_GROUP) {
        shared = globalThis.__qjs_ffiShared;
      }

      delete globalThis.__qjs_ffiShared;
    }

    state[group] = LOADED;
  }

  /* The library calls this when one of the wrappers' names is first
   * used. By then the engine has made the property an ordinary one
   * holding undefined; that placeholder is removed first, so that the
   * bundle sees the name as free. */
  setHandler(FFI_HANDLER_SLOT, function (group, object, key) {
    if (object[key] === undefined) {
      delete object[key];
    }

    ensureLoaded(group);
  });
})();
