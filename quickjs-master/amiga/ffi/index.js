/* quickjs-master/amiga/ffi/index.js
 *
 * Q2 FFI entry point — imports and globally exposes:
 *
 *   globalThis.LibraryBase
 *   globalThis.CEnumeration
 *   globalThis.Exec, Dos, Intuition, Graphics, GadTools
 *   globalThis.Window, NewWindow, Screen, RastPort, IntuiMessage,
 *     MsgPort, TextAttr, Image, Gadget
 *
 *   amiga.Exec, amiga.Intuition, amiga.Graphics, ...  — same classes
 *     on the `amiga` namespace, case-distinct from the lowercase Q1
 *     tables at amiga.exec / amiga.intuition / etc. (the lowercase
 *     tables still hold `.lvo` and flag constants.)
 *
 * The library evaluation order at qjs startup is:
 *   1. quickjs.library installs `globalThis.amiga` (Q1 FFI) via the
 *      `amiga-ffi` manifest in extended.js
 *   2. amiga-ffi-classes evaluates the bytecode produced from this
 *      file (qjsc_ffi)
 *
 * That guarantees `globalThis.amiga.<lib>.lvo` is populated before
 * any class here references it.
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

const libs = {
  LibraryBase, CEnumeration,
  Exec, Dos, Intuition, Graphics, GadTools,
};

const structs = {
  Struct, NewWindow, Window, Screen, RastPort, MsgPort,
  IntuiMessage, TextAttr, Image, Gadget,
};

const helpers = {
  ptrOf, withStruct, makeTags, withTags,
};

/* amiga.<ClassName> — populate with library classes and struct
 * wrappers. Case-distinct from the Q1 lowercase tables
 * (amiga.intuition, amiga.exec, ...) that hold `.lvo` and plain
 * flag constants.
 *
 * IMPORTANT: do NOT spread `helpers` into this loop. extended.js
 * already defines `amiga.makeTags` and `amiga.withTags` as Q1
 * natives, and the Q2 JS wrappers in structs/TagItem.js have
 * different signatures — plus the JS `makeTags` internally calls
 * `globalThis.amiga.makeTags`, which would infinitely self-recurse
 * once reassigned. Helpers stay in globalThis.* only. */
for (const [name, cls] of Object.entries({ ...libs, ...structs })) {
  globalThis.amiga[name] = cls;
}

/* globalThis.<Name> if the slot is free — convenience for scripts.
 * Helpers are included here since they don't collide with Q1. */
for (const [name, cls] of Object.entries({ ...libs, ...structs, ...helpers })) {
  if (!(name in globalThis)) {
    globalThis[name] = cls;
  }
}

/* Register the close-all exit hook so scripts that exit early or
 * throw don't leak library bases. Best-effort — qjs:os doesn't
 * currently expose setExitHook on Amiga; users can call
 * LibraryBase.closeAll() manually at script end if needed. */
try {
  /* Future-proof: if a setExitHook ever shows up on qjs:os, use it. */
  let os = globalThis.__qjs_os;

  if (os && typeof os.setExitHook === 'function') {
    os.setExitHook(() => LibraryBase.closeAll());
  }
}

catch (_) {
  /* no-op */
}
