/* quickjs-master/amiga/ffi/boopsi/index.js
 *
 * Wiring for the BOOPSI / Reaction wrappers: places every class on
 * amiga.boopsi and the four base classes on globalThis.
 *
 * This is the entry point of the SECOND FFI bundle. It is loaded on
 * first use of amiga.boopsi or of one of its globals, after the core
 * bundle (../index.js), whose classes (CEnumeration, Intuition, the
 * struct wrappers, ...) it uses. See scripts/bundle_ffi.py.
 */

import { BOOPSIBase, OM, ATTR_TYPES } from './BOOPSIBase.js';
import { GadgetBase, GA, GADGET_ATTRS } from './GadgetBase.js';
import { ImageBase, IA, IMAGE_ATTRS } from './ImageBase.js';
import { EventKind, IDCMP, IDCMP_REACTION_DEFAULT } from './EventKind.js';
import { Label, LabelJustify } from './images/Label.js';
import { Led } from './images/Led.js';
import { Bevel, BevelStyle } from './images/Bevel.js';
import { Glyph, GlyphKind } from './images/Glyph.js';
import { DrawList, DrawOp } from './images/DrawList.js';
import { Bitmap } from './images/Bitmap.js';
import { Button } from './gadgets/Button.js';
import { CheckBox } from './gadgets/CheckBox.js';
import { RadioButton } from './gadgets/RadioButton.js';
import { Slider, SliderOrient, SliderJustify } from './gadgets/Slider.js';
import { Scroller, ScrollerOrient } from './gadgets/Scroller.js';
import { Integer } from './gadgets/Integer.js';
import { StringGadget, StringHookType } from './gadgets/StringGadget.js';
import { Chooser, ChooserJustify, CNA } from './gadgets/Chooser.js';
import { ClickTab, TNA } from './gadgets/ClickTab.js';
import { ListBrowser } from './gadgets/ListBrowser.js';
import { Palette } from './gadgets/Palette.js';
import { Space } from './gadgets/Space.js';
import { FuelGauge, FuelGaugeOrient } from './gadgets/FuelGauge.js';
import { SpeedBar, SBNA } from './gadgets/SpeedBar.js';
import { GetFile } from './gadgets/GetFile.js';
import { GetFont } from './gadgets/GetFont.js';
import { GetScreenMode } from './gadgets/GetScreenMode.js';
import { GetColor } from './gadgets/GetColor.js';
import { DateBrowser } from './gadgets/DateBrowser.js';
import { TextEditor } from './gadgets/TextEditor.js';
import { SketchBoard } from './gadgets/SketchBoard.js';
import { TapeDeck, TapeDeckMode } from './gadgets/TapeDeck.js';
import { ColorWheel } from './gadgets/ColorWheel.js';
import { GradientSlider } from './gadgets/GradientSlider.js';
import { Layout, LayoutOrient } from './gadgets/Layout.js';
import { Page } from './gadgets/Page.js';
import { Virtual } from './gadgets/Virtual.js';
import { ReactionWindow, WindowPosition } from './classes/Window.js';
import { Requester, RequesterType, RequesterImage } from './classes/Requester.js';

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
  Led, Bevel, Glyph, Bitmap, DrawList,
  CheckBox, RadioButton, Slider, Scroller, Integer, StringGadget,
  Chooser, ClickTab, ListBrowser, Palette, Space, FuelGauge, SpeedBar,
  GetFile, GetFont, GetScreenMode, GetColor,
  DateBrowser, TextEditor, SketchBoard, TapeDeck,
  ColorWheel, GradientSlider, Page, Virtual,
  Requester,
};
for (const [name, cls] of Object.entries(flat)) {
  globalThis.amiga.boopsi[name] = cls;
}

globalThis.amiga.boopsi.classes.Window      = ReactionWindow;
globalThis.amiga.boopsi.classes.Requester   = Requester;
globalThis.amiga.boopsi.RequesterType       = RequesterType;
globalThis.amiga.boopsi.RequesterImage      = RequesterImage;
globalThis.amiga.boopsi.images.Label     = Label;
globalThis.amiga.boopsi.images.Led       = Led;
globalThis.amiga.boopsi.images.Bevel     = Bevel;
globalThis.amiga.boopsi.images.Glyph     = Glyph;
globalThis.amiga.boopsi.images.DrawList  = DrawList;
globalThis.amiga.boopsi.DrawOp           = DrawOp;
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
 * Globals: the base classes, for discoverability at the REPL.
 * Conflict-gated like the core globals.
 * ------------------------------------------------------------------ */
const boopsiGlobals = { BOOPSIBase, GadgetBase, ImageBase, EventKind };

for (const [name, cls] of Object.entries(boopsiGlobals)) {
  if (!(name in globalThis)) {
    globalThis[name] = cls;
  }
}
