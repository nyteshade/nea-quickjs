/* quickjs-master/amiga/ffi/index.js
 *
 * Q2 FFI entry point. Places every wrapper on the `amiga` namespace
 * under its canonical Amiga-library home, then re-exports to
 * globalThis if the slot is free.
 *
 * Placement rule (settled):
 *
 *   Library wrappers (the class that models a .library):
 *     amiga.<ClassName>
 *     globalThis.<ClassName>           (if !in globalThis)
 *
 *   Struct wrappers (a struct type owned by an Amiga library):
 *     amiga.<libname>.<StructName>     — "proper home"
 *     globalThis.<StructName>          (if !in globalThis)
 *
 *   Meta / base classes (LibraryBase, CEnumeration, Struct):
 *     amiga.<ClassName>
 *     globalThis.<ClassName>           (if !in globalThis)
 *
 *   Helpers (ptrOf, withStruct): globalThis only.
 *   makeTags / withTags are Q1 natives — NOT re-exposed here.
 *
 * Eval order at qjs startup:
 *   1. extended.js (qjsc_extended) installs `globalThis.amiga` with
 *      the Q1 FFI primitives and the lowercase per-library tables
 *      (amiga.intuition, amiga.graphics, amiga.exec, …) each
 *      holding `.lvo` and plain flag constants.
 *   2. ffi-bundle (qjsc_ffi) evaluates this file. By now the
 *      lowercase tables are guaranteed populated, so the static
 *      field `static lvo = globalThis.amiga.<lib>.lvo` on each
 *      library wrapper resolves cleanly.
 */

import { LibraryBase } from './LibraryBase.js';
import { CEnumeration } from './CEnumeration.js';
import { ptrOf } from './ptrOf.js';

import { Exec } from './Exec.js';
import { Dos } from './Dos.js';
import { Intuition } from './Intuition.js';
import { Graphics } from './Graphics.js';
import { GadTools } from './GadTools.js';

import { Struct, withStruct } from './structs/Struct.js';
import { NewWindow } from './structs/NewWindow.js';
import { Window } from './structs/Window.js';
import { Screen } from './structs/Screen.js';
import { RastPort } from './structs/RastPort.js';
import { MsgPort } from './structs/MsgPort.js';
import { IntuiMessage } from './structs/IntuiMessage.js';
import { TextAttr } from './structs/TextAttr.js';
import { Image } from './structs/Image.js';
import { Gadget } from './structs/Gadget.js';
import { makeTags, withTags } from './structs/TagItem.js';

globalThis.amiga = globalThis.amiga || {};

/* Ensure the lowercase per-library tables exist. extended.js
 * normally creates them; this guards standalone bundle evaluation
 * during host-side testing. */
for (const libname of ['intuition', 'graphics', 'exec']) {
  if (!globalThis.amiga[libname]) globalThis.amiga[libname] = {};
}

/* ------------------------------------------------------------------
 * Library wrappers — amiga.<ClassName>
 * ------------------------------------------------------------------ */
const libs = {
  Exec, Dos, Intuition, Graphics, GadTools,
};

for (const [name, cls] of Object.entries(libs)) {
  globalThis.amiga[name] = cls;
}

/* ------------------------------------------------------------------
 * Struct wrappers — amiga.<libname>.<StructName>
 *
 * Ownership mapping follows NDK 3.2R4 header provenance:
 *   intuition/screens.h,intuition.h   → Window, NewWindow, Screen,
 *                                        IntuiMessage, Image, Gadget
 *   graphics/rastport.h, text.h       → RastPort, TextAttr
 *   exec/ports.h                      → MsgPort
 * ------------------------------------------------------------------ */
const structsByLib = {
  intuition: { Window, NewWindow, Screen, IntuiMessage, Image, Gadget },
  graphics:  { RastPort, TextAttr },
  exec:      { MsgPort },
};

for (const [libname, members] of Object.entries(structsByLib)) {
  for (const [name, cls] of Object.entries(members)) {
    globalThis.amiga[libname][name] = cls;
  }
}

/* ------------------------------------------------------------------
 * Meta / base classes — amiga.<ClassName>
 * ------------------------------------------------------------------ */
globalThis.amiga.LibraryBase  = LibraryBase;
globalThis.amiga.CEnumeration = CEnumeration;
globalThis.amiga.Struct       = Struct;

/* ------------------------------------------------------------------
 * Globals — convenience for scripts, conflict-gated.
 * ------------------------------------------------------------------ */
const everyGlobal = {
  /* meta */
  LibraryBase, CEnumeration, Struct,
  /* libs */
  Exec, Dos, Intuition, Graphics, GadTools,
  /* structs */
  Window, NewWindow, Screen, RastPort, MsgPort,
  IntuiMessage, TextAttr, Image, Gadget,
  /* helpers (makeTags/withTags intentionally omitted — Q1 natives) */
  ptrOf, withStruct,
};

for (const [name, cls] of Object.entries(everyGlobal)) {
  if (!(name in globalThis)) {
    globalThis[name] = cls;
  }
}

/* Register the close-all exit hook so scripts that exit early or
 * throw don't leak library bases. Best-effort — qjs:os doesn't
 * currently expose setExitHook on Amiga; users can call
 * LibraryBase.closeAll() manually at script end if needed. */
try {
  let os = globalThis.__qjs_os;

  if (os && typeof os.setExitHook === 'function') {
    os.setExitHook(() => LibraryBase.closeAll());
  }
}

catch (_) {
  /* no-op */
}
