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
import { Asl } from './Asl.js';
import { Diskfont } from './Diskfont.js';

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
import { DrawInfo } from './structs/DrawInfo.js';
import { Menu } from './structs/Menu.js';
import { MenuItem } from './structs/MenuItem.js';
import { IntuiText } from './structs/IntuiText.js';
import { BitMap } from './structs/BitMap.js';
import { ColorMap } from './structs/ColorMap.js';
import { ViewPort } from './structs/ViewPort.js';
import { FileInfoBlock } from './structs/FileInfoBlock.js';
import { InputEvent } from './structs/InputEvent.js';
import { IORequest } from './structs/IORequest.js';
import { TimerRequest } from './structs/TimerRequest.js';
import { makeTags, withTags } from './structs/TagItem.js';

import { BOOPSIBase, OM, ATTR_TYPES } from './boopsi/BOOPSIBase.js';
import { GadgetBase, GA, GADGET_ATTRS } from './boopsi/GadgetBase.js';
import { ImageBase, IA, IMAGE_ATTRS } from './boopsi/ImageBase.js';
import { EventKind, IDCMP, IDCMP_REACTION_DEFAULT } from './boopsi/EventKind.js';
import { Label, LabelJustify } from './boopsi/images/Label.js';
import { Led } from './boopsi/images/Led.js';
import { Bevel, BevelStyle } from './boopsi/images/Bevel.js';
import { Glyph, GlyphKind } from './boopsi/images/Glyph.js';
import { Bitmap } from './boopsi/images/Bitmap.js';
import { Button } from './boopsi/gadgets/Button.js';
import { CheckBox } from './boopsi/gadgets/CheckBox.js';
import { RadioButton } from './boopsi/gadgets/RadioButton.js';
import { Slider, SliderOrient, SliderJustify } from './boopsi/gadgets/Slider.js';
import { Scroller, ScrollerOrient } from './boopsi/gadgets/Scroller.js';
import { Integer } from './boopsi/gadgets/Integer.js';
import { StringGadget, StringHookType } from './boopsi/gadgets/StringGadget.js';
import { Chooser, ChooserJustify, CNA } from './boopsi/gadgets/Chooser.js';
import { ClickTab, TNA } from './boopsi/gadgets/ClickTab.js';
import { ListBrowser } from './boopsi/gadgets/ListBrowser.js';
import { Palette } from './boopsi/gadgets/Palette.js';
import { Space } from './boopsi/gadgets/Space.js';
import { FuelGauge, FuelGaugeOrient } from './boopsi/gadgets/FuelGauge.js';
import { SpeedBar, SBNA } from './boopsi/gadgets/SpeedBar.js';
import { GetFile } from './boopsi/gadgets/GetFile.js';
import { GetFont } from './boopsi/gadgets/GetFont.js';
import { GetScreenMode } from './boopsi/gadgets/GetScreenMode.js';
import { GetColor } from './boopsi/gadgets/GetColor.js';
import { DateBrowser } from './boopsi/gadgets/DateBrowser.js';
import { TextEditor } from './boopsi/gadgets/TextEditor.js';
import { SketchBoard } from './boopsi/gadgets/SketchBoard.js';
import { TapeDeck, TapeDeckMode } from './boopsi/gadgets/TapeDeck.js';
import { ColorWheel } from './boopsi/gadgets/ColorWheel.js';
import { GradientSlider } from './boopsi/gadgets/GradientSlider.js';
import { Layout, LayoutOrient } from './boopsi/gadgets/Layout.js';
import { Page } from './boopsi/gadgets/Page.js';
import { Virtual } from './boopsi/gadgets/Virtual.js';
import { ReactionWindow, WindowPosition } from './boopsi/classes/Window.js';

globalThis.amiga = globalThis.amiga || {};

/* Ensure the lowercase per-library tables exist. extended.js
 * normally creates them; this guards standalone bundle evaluation
 * during host-side testing. */
for (const libname of ['intuition', 'graphics', 'exec', 'dos', 'devices']) {
  if (!globalThis.amiga[libname]) globalThis.amiga[libname] = {};
}

/* ------------------------------------------------------------------
 * Library wrappers — amiga.<ClassName>
 * ------------------------------------------------------------------ */
const libs = {
  Exec, Dos, Intuition, Graphics, GadTools, Asl, Diskfont,
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
  intuition: {
    Window, NewWindow, Screen, IntuiMessage, Image, Gadget,
    DrawInfo, Menu, MenuItem, IntuiText,
  },
  graphics:  { RastPort, TextAttr, BitMap, ColorMap, ViewPort },
  exec:      { MsgPort, IORequest },
  dos:       { FileInfoBlock },
  /* timer.device / inputevent.device live under "devices" in the
   * NDK; mirror that. */
  devices:   { TimerRequest, InputEvent },
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
 * BOOPSI / Reaction namespace — amiga.boopsi.*
 *
 * Two-tier organization per the 2026-04-21 design decision
 * (decision:fdo95p76jj20vduy5hl6):
 *
 *   amiga.boopsi.Window           ← flat alias
 *   amiga.boopsi.classes.Window   ← origin-namespaced
 *
 * classes.*   — .class libraries (window.class, arexx.class, ...)
 * gadgets.*   — .gadget libraries (button.gadget, layout.gadget, ...)
 * images.*    — .image libraries (label.image, bitmap.image, ...)
 *
 * Phase A ships the base classes and EventKind only; concrete class
 * wrappers (Window, Button, Layout, Label, ...) land in Phase B+.
 * ------------------------------------------------------------------ */
globalThis.amiga.boopsi = globalThis.amiga.boopsi || {};
globalThis.amiga.boopsi.classes = globalThis.amiga.boopsi.classes || {};
globalThis.amiga.boopsi.gadgets = globalThis.amiga.boopsi.gadgets || {};
globalThis.amiga.boopsi.images  = globalThis.amiga.boopsi.images  || {};

globalThis.amiga.boopsi.BOOPSIBase   = BOOPSIBase;
globalThis.amiga.boopsi.GadgetBase   = GadgetBase;
globalThis.amiga.boopsi.ImageBase    = ImageBase;
globalThis.amiga.boopsi.EventKind    = EventKind;
globalThis.amiga.boopsi.IDCMP        = IDCMP;
globalThis.amiga.boopsi.IDCMP_REACTION_DEFAULT = IDCMP_REACTION_DEFAULT;
globalThis.amiga.boopsi.OM           = OM;
globalThis.amiga.boopsi.GA           = GA;
globalThis.amiga.boopsi.IA           = IA;
globalThis.amiga.boopsi.ATTR_TYPES   = ATTR_TYPES;
globalThis.amiga.boopsi.GADGET_ATTRS = GADGET_ATTRS;
globalThis.amiga.boopsi.IMAGE_ATTRS  = IMAGE_ATTRS;

/* Concrete classes — flat aliases under amiga.boopsi plus origin-
 * namespaced locations under amiga.boopsi.{classes,gadgets,images}. */
const flat = {
  Window: ReactionWindow, Layout, Button, Label,
  Led, Bevel, Glyph, Bitmap,
  CheckBox, RadioButton, Slider, Scroller, Integer, StringGadget,
  Chooser, ClickTab, ListBrowser, Palette, Space, FuelGauge, SpeedBar,
  GetFile, GetFont, GetScreenMode, GetColor,
  DateBrowser, TextEditor, SketchBoard, TapeDeck,
  ColorWheel, GradientSlider, Page, Virtual,
};
for (const [name, cls] of Object.entries(flat)) {
  globalThis.amiga.boopsi[name] = cls;
}

globalThis.amiga.boopsi.classes.Window   = ReactionWindow;
globalThis.amiga.boopsi.images.Label     = Label;
globalThis.amiga.boopsi.images.Led       = Led;
globalThis.amiga.boopsi.images.Bevel     = Bevel;
globalThis.amiga.boopsi.images.Glyph     = Glyph;
globalThis.amiga.boopsi.images.Bitmap    = Bitmap;
globalThis.amiga.boopsi.gadgets.Button         = Button;
globalThis.amiga.boopsi.gadgets.CheckBox       = CheckBox;
globalThis.amiga.boopsi.gadgets.RadioButton    = RadioButton;
globalThis.amiga.boopsi.gadgets.Slider         = Slider;
globalThis.amiga.boopsi.gadgets.Scroller       = Scroller;
globalThis.amiga.boopsi.gadgets.Integer        = Integer;
globalThis.amiga.boopsi.gadgets.StringGadget   = StringGadget;
globalThis.amiga.boopsi.gadgets.Chooser        = Chooser;
globalThis.amiga.boopsi.gadgets.ClickTab       = ClickTab;
globalThis.amiga.boopsi.gadgets.ListBrowser    = ListBrowser;
globalThis.amiga.boopsi.gadgets.Palette        = Palette;
globalThis.amiga.boopsi.gadgets.Space          = Space;
globalThis.amiga.boopsi.gadgets.FuelGauge      = FuelGauge;
globalThis.amiga.boopsi.gadgets.SpeedBar       = SpeedBar;
globalThis.amiga.boopsi.gadgets.GetFile        = GetFile;
globalThis.amiga.boopsi.gadgets.GetFont        = GetFont;
globalThis.amiga.boopsi.gadgets.GetScreenMode  = GetScreenMode;
globalThis.amiga.boopsi.gadgets.GetColor       = GetColor;
globalThis.amiga.boopsi.gadgets.DateBrowser    = DateBrowser;
globalThis.amiga.boopsi.gadgets.TextEditor     = TextEditor;
globalThis.amiga.boopsi.gadgets.SketchBoard    = SketchBoard;
globalThis.amiga.boopsi.gadgets.TapeDeck       = TapeDeck;
globalThis.amiga.boopsi.gadgets.ColorWheel     = ColorWheel;
globalThis.amiga.boopsi.gadgets.GradientSlider = GradientSlider;
globalThis.amiga.boopsi.gadgets.Layout         = Layout;
globalThis.amiga.boopsi.gadgets.Page           = Page;
globalThis.amiga.boopsi.gadgets.Virtual        = Virtual;

/* Value enums */
globalThis.amiga.boopsi.LayoutOrient    = LayoutOrient;
globalThis.amiga.boopsi.LabelJustify    = LabelJustify;
globalThis.amiga.boopsi.WindowPosition  = WindowPosition;
globalThis.amiga.boopsi.BevelStyle      = BevelStyle;
globalThis.amiga.boopsi.GlyphKind       = GlyphKind;
globalThis.amiga.boopsi.SliderOrient    = SliderOrient;
globalThis.amiga.boopsi.SliderJustify   = SliderJustify;
globalThis.amiga.boopsi.ScrollerOrient  = ScrollerOrient;
globalThis.amiga.boopsi.StringHookType  = StringHookType;
globalThis.amiga.boopsi.ChooserJustify  = ChooserJustify;
globalThis.amiga.boopsi.FuelGaugeOrient = FuelGaugeOrient;
globalThis.amiga.boopsi.TapeDeckMode    = TapeDeckMode;
globalThis.amiga.boopsi.CNA             = CNA;
globalThis.amiga.boopsi.TNA             = TNA;
globalThis.amiga.boopsi.SBNA            = SBNA;

/* ------------------------------------------------------------------
 * Globals — convenience for scripts, conflict-gated.
 * ------------------------------------------------------------------ */
const everyGlobal = {
  /* meta */
  LibraryBase, CEnumeration, Struct,
  /* libs */
  Exec, Dos, Intuition, Graphics, GadTools, Asl, Diskfont,
  /* structs */
  Window, NewWindow, Screen, RastPort, MsgPort,
  IntuiMessage, TextAttr, Image, Gadget,
  DrawInfo, Menu, MenuItem, IntuiText, BitMap, ColorMap, ViewPort,
  FileInfoBlock, InputEvent, IORequest, TimerRequest,
  /* BOOPSI bases — globalThis for discoverability at the REPL */
  BOOPSIBase, GadgetBase, ImageBase, EventKind,
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
