/* quickjs-master/amiga/ffi/Intuition.js
 *
 * Wrapper for intuition.library — windows, screens, gadgets, BOOPSI
 * imageclass, IDCMP messaging.
 *
 * Pilot scope: ~25 of 127 LVOs (the most-used surface). The
 * remaining are accessible via amiga.intuition.lvo + amiga.call.
 */

import { LibraryBase } from './LibraryBase.js';
import { CEnumeration } from './CEnumeration.js';
import { ptrOf } from './ptrOf.js';
import { Window } from './structs/Window.js';
import { Screen } from './structs/Screen.js';
import { Image } from './structs/Image.js';

export class Intuition extends LibraryBase {
  /** @type {string} */
  static libraryName = 'intuition.library';

  /** @type {number} */
  static libraryVersion = 39;

  /** @type {Object<string, number>} */
  static lvo = globalThis.amiga.intuition.lvo;

  /**
   * Window/Screen attribute tags, IDCMP flags, window flags, and
   * imageclass attributes from intuition.h. Cases coerce to their
   * numeric value via Symbol.toPrimitive — usable directly in tag
   * lists.
   */
  static consts = class IntuitionConsts extends CEnumeration {
    static {
      /* Window Attributes — WA_Dummy = TAG_USER + 99 = 0x80000063 */
      IntuitionConsts.define('WA_Left',         0x80000064);
      IntuitionConsts.define('WA_Top',          0x80000065);
      IntuitionConsts.define('WA_Width',        0x80000066);
      IntuitionConsts.define('WA_Height',       0x80000067);
      IntuitionConsts.define('WA_DetailPen',    0x80000068);
      IntuitionConsts.define('WA_BlockPen',     0x80000069);
      IntuitionConsts.define('WA_IDCMP',        0x8000006A);
      IntuitionConsts.define('WA_Flags',        0x8000006B);
      IntuitionConsts.define('WA_Gadgets',      0x8000006C);
      IntuitionConsts.define('WA_Title',        0x8000006E);
      IntuitionConsts.define('WA_ScreenTitle',  0x8000006F);
      IntuitionConsts.define('WA_CustomScreen', 0x80000070);
      IntuitionConsts.define('WA_MinWidth',     0x80000072);
      IntuitionConsts.define('WA_MinHeight',    0x80000073);
      IntuitionConsts.define('WA_MaxWidth',     0x80000074);
      IntuitionConsts.define('WA_MaxHeight',    0x80000075);
      IntuitionConsts.define('WA_PubScreenName',0x80000078);
      IntuitionConsts.define('WA_SimpleRefresh',0x80000079);
      IntuitionConsts.define('WA_SmartRefresh', 0x8000007A);
      IntuitionConsts.define('WA_BackFill',     0x8000007F);
      IntuitionConsts.define('WA_AutoAdjust',   0x80000083);

      /* Screen Attributes — SA_Dummy = TAG_USER + 32 = 0x80000020 */
      IntuitionConsts.define('SA_Left',     0x80000021);
      IntuitionConsts.define('SA_Top',      0x80000022);
      IntuitionConsts.define('SA_Width',    0x80000023);
      IntuitionConsts.define('SA_Height',   0x80000024);
      IntuitionConsts.define('SA_Depth',    0x80000025);
      IntuitionConsts.define('SA_Title',    0x80000028);
      IntuitionConsts.define('SA_Type',     0x8000002D);

      /* IA_ tags — IA_Dummy = TAG_USER + 0x20000 = 0x80020000 */
      IntuitionConsts.define('IA_Left',      0x80020001);
      IntuitionConsts.define('IA_Top',       0x80020002);
      IntuitionConsts.define('IA_Width',     0x80020003);
      IntuitionConsts.define('IA_Height',    0x80020004);
      IntuitionConsts.define('IA_FGPen',     0x80020005);
      IntuitionConsts.define('IA_BGPen',     0x80020006);
      IntuitionConsts.define('IA_Recessed',  0x80020015);
      IntuitionConsts.define('IA_FrameType', 0x8002001B);

      /* IDCMP flags */
      IntuitionConsts.define('IDCMP_SIZEVERIFY',    0x00000001);
      IntuitionConsts.define('IDCMP_NEWSIZE',       0x00000002);
      IntuitionConsts.define('IDCMP_REFRESHWINDOW', 0x00000004);
      IntuitionConsts.define('IDCMP_MOUSEBUTTONS',  0x00000008);
      IntuitionConsts.define('IDCMP_MOUSEMOVE',     0x00000010);
      IntuitionConsts.define('IDCMP_GADGETDOWN',    0x00000020);
      IntuitionConsts.define('IDCMP_GADGETUP',      0x00000040);
      IntuitionConsts.define('IDCMP_MENUPICK',      0x00000100);
      IntuitionConsts.define('IDCMP_CLOSEWINDOW',   0x00000200);
      IntuitionConsts.define('IDCMP_RAWKEY',        0x00000400);
      IntuitionConsts.define('IDCMP_VANILLAKEY',    0x00200000);

      /* WFLG — window flags (WA_Flags value) */
      IntuitionConsts.define('WFLG_SIZEGADGET',  0x00000001);
      IntuitionConsts.define('WFLG_DRAGBAR',     0x00000002);
      IntuitionConsts.define('WFLG_DEPTHGADGET', 0x00000004);
      IntuitionConsts.define('WFLG_CLOSEGADGET', 0x00000008);
      IntuitionConsts.define('WFLG_BACKDROP',    0x00000100);
      IntuitionConsts.define('WFLG_REPORTMOUSE', 0x00000200);
      IntuitionConsts.define('WFLG_BORDERLESS',  0x00000800);
      IntuitionConsts.define('WFLG_ACTIVATE',    0x00001000);

      /* Screen types (NewWindow.Type) */
      IntuitionConsts.define('WBENCHSCREEN', 0x0001);
      IntuitionConsts.define('CUSTOMSCREEN', 0x000F);
    }
  };

  /* ============================================================
   * Window lifecycle
   * ============================================================ */

  /**
   * Open a window using the legacy NewWindow struct.
   *
   * @param {NewWindow|number} newWindow
   * @returns {Window|null}
   */
  static OpenWindow(newWindow) {
    let raw = this.call(this.lvo.OpenWindow, { a0: ptrOf(newWindow) });

    return raw ? new Window(raw) : null;
  }

  /**
   * Faithful 1:1 wrapper for OpenWindowTagList.
   *
   * @param {NewWindow|number|null} newWindow
   * @param {number|null} tagList
   * @returns {Window|null}
   */
  static OpenWindowTagList(newWindow, tagList) {
    let raw = this.call(
      this.lvo.OpenWindowTagList,
      { a0: ptrOf(newWindow), a1: ptrOf(tagList) }
    );

    return raw ? new Window(raw) : null;
  }

  /**
   * Convenience over OpenWindowTagList — accepts JS [tag, data] pairs,
   * builds and frees the TagItem array internally.
   *
   * @param {Array<[number, number]>} pairs
   * @returns {Window|null}
   */
  static OpenWindowTags(pairs) {
    let tags = globalThis.amiga.makeTags(pairs);
    let bytes = (pairs.length + 1) * 8;

    try {
      return this.OpenWindowTagList(null, tags);
    }

    finally {
      globalThis.amiga.freeMem(tags, bytes);
    }
  }

  /**
   * Close a window. Pair with every Open*.
   *
   * @param {Window|number} window
   * @returns {undefined}
   */
  static CloseWindow(window) {
    return this.call(this.lvo.CloseWindow, { a0: ptrOf(window) });
  }

  static MoveWindow(window, dx, dy) {
    return this.call(this.lvo.MoveWindow, {
      a0: ptrOf(window), d0: dx | 0, d1: dy | 0,
    });
  }

  static SizeWindow(window, dw, dh) {
    return this.call(this.lvo.SizeWindow, {
      a0: ptrOf(window), d0: dw | 0, d1: dh | 0,
    });
  }

  static WindowToFront(window) {
    return this.call(this.lvo.WindowToFront, { a0: ptrOf(window) });
  }

  static WindowToBack(window) {
    return this.call(this.lvo.WindowToBack, { a0: ptrOf(window) });
  }

  static ActivateWindow(window) {
    return this.call(this.lvo.ActivateWindow, { a0: ptrOf(window) });
  }

  static BeginRefresh(window) {
    return this.call(this.lvo.BeginRefresh, { a0: ptrOf(window) });
  }

  static EndRefresh(window, complete) {
    return this.call(this.lvo.EndRefresh, {
      a0: ptrOf(window), d0: complete ? 1 : 0,
    });
  }

  /* ============================================================
   * Screen lifecycle
   * ============================================================ */

  static OpenScreenTagList(newScreen, tagList) {
    let raw = this.call(this.lvo.OpenScreenTagList, {
      a0: ptrOf(newScreen), a1: ptrOf(tagList),
    });

    return raw ? new Screen(raw) : null;
  }

  static OpenScreenTags(pairs) {
    let tags = globalThis.amiga.makeTags(pairs);
    let bytes = (pairs.length + 1) * 8;

    try {
      return this.OpenScreenTagList(null, tags);
    }

    finally {
      globalThis.amiga.freeMem(tags, bytes);
    }
  }

  static CloseScreen(screen) {
    return this.call(this.lvo.CloseScreen, { a0: ptrOf(screen) });
  }

  static ScreenToFront(screen) {
    return this.call(this.lvo.ScreenToFront, { a0: ptrOf(screen) });
  }

  static ScreenToBack(screen) {
    return this.call(this.lvo.ScreenToBack, { a0: ptrOf(screen) });
  }

  /**
   * Lock the named public screen (NULL = default Workbench).
   *
   * @param {string|number|null} name
   * @returns {Screen|null}
   */
  static LockPubScreen(name) {
    let namePtr = ptrOf(name);
    let bytes = 0;

    if (typeof name === 'string') {
      bytes = name.length + 1;
      namePtr = globalThis.amiga.allocMem(bytes);
      globalThis.amiga.pokeString(namePtr, name);
    }

    try {
      let raw = this.call(this.lvo.LockPubScreen, { a0: namePtr });

      return raw ? new Screen(raw) : null;
    }

    finally {
      if (bytes) globalThis.amiga.freeMem(namePtr, bytes);
    }
  }

  static UnlockPubScreen(name, screen) {
    return this.call(this.lvo.UnlockPubScreen, {
      a0: ptrOf(name), a1: ptrOf(screen),
    });
  }

  /* ============================================================
   * BOOPSI
   * ============================================================ */

  /**
   * NewObjectA(class, classID, tagList) — a0/a1/a2.
   *
   * @param {number} klass class pointer (NULL for public class by name)
   * @param {string|number} classID class ID string or NULL
   * @param {number|null} tagList
   * @returns {Image|number|null} Image wrapper for image classes; raw
   *   pointer otherwise; null on failure
   */
  static NewObjectA(klass, classID, tagList) {
    let idPtr = ptrOf(classID);
    let bytes = 0;

    if (typeof classID === 'string') {
      bytes = classID.length + 1;
      idPtr = globalThis.amiga.allocMem(bytes);
      globalThis.amiga.pokeString(idPtr, classID);
    }

    try {
      let raw = this.call(this.lvo.NewObjectA, {
        a0: ptrOf(klass), a1: idPtr, a2: ptrOf(tagList),
      });

      if (!raw) return null;

      /* Heuristic: image classes typically end in 'image' or contain
       * 'iclass'. Wrap in Image for those. Caller can re-wrap manually
       * if heuristic missed. */
      if (typeof classID === 'string' &&
          (classID.endsWith('image') || classID.includes('iclass'))) {
        return new Image(raw);
      }

      return raw;
    }

    finally {
      if (bytes) globalThis.amiga.freeMem(idPtr, bytes);
    }
  }

  /**
   * NewObjectA convenience taking a JS array of [tag, data] pairs.
   *
   * @param {string|number} classID
   * @param {Array<[number, number]>} pairs
   * @returns {Image|number|null}
   */
  static NewObjectTags(classID, pairs) {
    let tags = globalThis.amiga.makeTags(pairs);
    let bytes = (pairs.length + 1) * 8;

    try {
      return this.NewObjectA(0, classID, tags);
    }

    finally {
      globalThis.amiga.freeMem(tags, bytes);
    }
  }

  static DisposeObject(obj) {
    return this.call(this.lvo.DisposeObject, { a0: ptrOf(obj) });
  }

  static SetAttrsA(obj, tagList) {
    return this.call(this.lvo.SetAttrsA, {
      a0: ptrOf(obj), a1: ptrOf(tagList),
    });
  }

  static SetAttrsTags(obj, pairs) {
    let tags = globalThis.amiga.makeTags(pairs);
    let bytes = (pairs.length + 1) * 8;

    try {
      return this.SetAttrsA(obj, tags);
    }

    finally {
      globalThis.amiga.freeMem(tags, bytes);
    }
  }

  /**
   * SetGadgetAttrsA(gadget, window, requester, tagList) — the OM_SET
   * path that also re-renders the gadget. Required any time a gadget
   * attribute is changed while the window is open; per layout_gc.doc
   * "If using OM_SET, you MUST call through SetGadgetAttrs() to
   * protect the window layout properly." Raw SetAttrsA only updates
   * internal state and leaves the visible pixels stale.
   *
   * Register convention: a0=gadget, a1=window, a2=requester,
   * a3=tagList (intuition.library LVO -660).
   *
   * @param {number|object} gadget    — struct Gadget *
   * @param {number|object} window    — struct Window * (or 0)
   * @param {number|object} requester — struct Requester * (or 0)
   * @param {number}        tagList   — TagItem * (or 0)
   * @returns {number}
   */
  static SetGadgetAttrsA(gadget, window, requester, tagList) {
    return this.call(this.lvo.SetGadgetAttrsA, {
      a0: ptrOf(gadget),
      a1: ptrOf(window),
      a2: ptrOf(requester),
      a3: ptrOf(tagList),
    });
  }

  /**
   * RefreshGList(firstGadget, window, requester, numGadgets) — force
   * Intuition to re-render the specified gadgets. Unlike SetAttrs
   * (which only updates internal state) this performs the actual
   * paint, including erasing old content. Required after plain
   * SetAttrsA on an image child or after relayout shifts the pixels
   * around, because WM_RETHINK only drives relayout, not refresh.
   *
   * Register convention: a0=firstGadget, a1=window, a2=requester,
   * d0=numGadgets (intuition.library LVO -432).
   * numGadgets = -1 refreshes all gadgets from firstGadget onwards
   * AND the window frame; numGadgets = 1 refreshes just one gadget
   * (but for a layout that means its whole subtree).
   *
   * @param {number|object} firstGadget — struct Gadget *
   * @param {number|object} window      — struct Window *
   * @param {number|object} requester   — struct Requester * (or 0)
   * @param {number}        numGadgets  — count or -1 for "all + frame"
   * @returns {undefined}
   */
  static RefreshGList(firstGadget, window, requester, numGadgets) {
    return this.call(this.lvo.RefreshGList, {
      a0: ptrOf(firstGadget),
      a1: ptrOf(window),
      a2: ptrOf(requester),
      d0: numGadgets | 0,
    });
  }

  /**
   * GetAttr(attrID, obj, storagePtr) — d0=attrID, a0=obj, a1=storage.
   * Writes the attribute's current value through `storagePtr`
   * (typically a ULONG). Returns 1 on success, 0 if the class
   * doesn't support that attr.
   *
   * @param {number}     attrID
   * @param {number}     obj
   * @param {number}     storagePtr — ptr to a ULONG receiver
   * @returns {number}   1 on success, 0 on failure
   */
  static GetAttr(attrID, obj, storagePtr) {
    return this.call(this.lvo.GetAttr, {
      d0: attrID | 0, a0: ptrOf(obj), a1: ptrOf(storagePtr),
    });
  }

  /**
   * Ergonomic GetAttr — allocates a ULONG receiver, calls GetAttr,
   * returns the receiver's value (or null if GetAttr returned 0).
   *
   * @param {number} attrID
   * @param {number} obj
   * @returns {number|null}
   */
  static getAttr(attrID, obj) {
    let storage = globalThis.amiga.allocMem(4);
    if (!storage) return null;

    try {
      let ok = this.GetAttr(attrID, obj, storage);
      if (!ok) return null;
      return globalThis.amiga.peek32(storage);
    }

    finally {
      globalThis.amiga.freeMem(storage, 4);
    }
  }

  /* ============================================================
   * Misc
   * ============================================================ */

  static DrawImage(rport, image, x, y) {
    return this.call(this.lvo.DrawImage, {
      a0: ptrOf(rport), a1: ptrOf(image),
      d0: x | 0, d1: y | 0,
    });
  }

  static DisplayBeep(screen) {
    return this.call(this.lvo.DisplayBeep, { a0: ptrOf(screen) });
  }
}
