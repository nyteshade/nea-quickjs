/* quickjs-master/amiga/ffi/ScreenFont.js
 *
 * The font a public screen draws its gadgets in, and a way to measure
 * text in it before any window exists.
 *
 * Reaction sizes a gadget from the screen's DrawInfo font
 * (dri_Font), so a script that wants a button "as wide as its label
 * plus a margin", or a margin "half a line high", needs the same
 * numbers. This class gets them:
 *
 *   let font = new ScreenFont();          // default public screen
 *   font.height                           // pixels, one line of text
 *   font.widthOf('Quit')                  // pixels, in that font
 *   font.across(font.height)              // the same distance, sideways
 *   font.close();                         // when the window is open
 *
 * How it works (all from NDK 3.2R4 headers):
 *   LockPubScreen(name)        keeps the screen from closing
 *   GetScreenDrawInfo(screen)  -> struct DrawInfo (intuition/screens.h)
 *     +8   dri_Font            struct TextFont *
 *     +14  dri_Resolution.X    ticks per pixel across
 *     +16  dri_Resolution.Y    ticks per pixel down
 *   struct TextFont (graphics/text.h), after a 20-byte Message:
 *     +20  tf_YSize            font height
 *     +24  tf_XSize            nominal character width
 *     +26  tf_Baseline         top of a character to its baseline
 *   A private RastPort (100 bytes, graphics/rastport.h) gets the font
 *   with SetFont, and TextLength measures against it. It has no
 *   bitmap; TextLength does not draw.
 *
 * The screen stays locked until close(). Keep the object until your
 * window is open on that screen, then close it: the window itself
 * holds the screen from then on.
 */

import { Intuition } from './Intuition.js';
import { Graphics } from './Graphics.js';
import { DrawInfo } from './structs/DrawInfo.js';
import { RastPort } from './structs/RastPort.js';
import { TextFont } from './structs/TextFont.js';

export class ScreenFont {
  /**
   * REPL help text.
   *
   * @returns {string}
   */
  static get signature() {
    return `ScreenFont(screenName?)
where:
  screenName? - public screen name; omit for the default public
                screen (normally Workbench).

Properties:
  height        {number} pixels in one line of text
  baseline      {number} pixels from the top of a line to its baseline
  nominalWidth  {number} the font's nominal character width
  pixelAspect   {number} how many pixels across cover the same
                         distance as one pixel down (1 = square)
  screenWidth   {number} the screen's width in pixels
  screenHeight  {number} the screen's height in pixels
  drawInfo      {number} the screen's struct DrawInfo pointer, for
                         classes that want one (SYSIA_DrawInfo)

Methods:
  widthOf(text) {number} pixel width of text in this font
  across(down)  {number} pixels across that look as long as 'down'
                         pixels do vertically
  close()                unlock the screen; call when your window is open

Typical use:
  let font = new ScreenFont();
  let quit = new Button({
    text: '_Quit',
    layoutHints: { weightedWidth: 0,
                   minWidth: font.widthOf('Quit') + 2 * font.height },
  });
  ...open the window...
  font.close();`;
  }

  /**
   * Lock a public screen and read its gadget font.
   *
   * @param {string|null} [screenName] - public screen name; null or
   *   omitted for the default public screen
   * @throws {Error} if the screen cannot be locked or has no DrawInfo
   */
  constructor(screenName) {
    /** @type {string|null} */
    this._screenName = (typeof screenName === 'string') ? screenName : null;

    /** @type {object|null} the locked Screen wrapper */
    this._screen = Intuition.LockPubScreen(this._screenName);

    /** @type {number} struct DrawInfo pointer */
    this._drawInfoPtr = 0;

    /** @type {number} our private struct RastPort */
    this._rastPortPtr = 0;

    if (!this._screen) {
      throw new Error('ScreenFont: cannot lock public screen ' +
                      (this._screenName || '(default)'));
    }

    this._drawInfoPtr = Intuition.GetScreenDrawInfo(this._screen);

    if (!this._drawInfoPtr) {
      this.close();
      throw new Error('ScreenFont: screen has no DrawInfo');
    }

    /** @type {number} the screen's width in pixels: how wide a
     *  window can be */
    this.screenWidth = this._screen.width;

    /** @type {number} the screen's height in pixels */
    this.screenHeight = this._screen.height;

    let drawInfo = new DrawInfo(this._drawInfoPtr);

    /** @type {number} struct TextFont pointer, owned by the screen */
    this._fontPtr = drawInfo.font;

    let font = new TextFont(this._fontPtr);

    /** @type {number} pixels in one line of text */
    this.height = font.ySize;

    /** @type {number} the font's nominal character width */
    this.nominalWidth = font.xSize;

    /** @type {number} pixels from the top of a line to its baseline */
    this.baseline = font.baseline;

    /* dri_Resolution is the size of one pixel, in ticks. On a 640x256
     * screen a pixel is half as wide as it is tall (22 x 44), so it
     * takes two of them across to match one down. Square pixels give
     * 1. A zero would mean the screen did not say; treat as square. */
    let ticksAcross = drawInfo.resolutionX;
    let ticksDown   = drawInfo.resolutionY;

    /** @type {number} pixels across per pixel down, 1 when square */
    this.pixelAspect = (ticksAcross > 0 && ticksDown > 0)
      ? ticksDown / ticksAcross
      : 1;

    /* amiga.allocMem gives public, zero-filled memory by default. */
    this._rastPortPtr = globalThis.amiga.allocMem(RastPort.SIZE);

    if (!this._rastPortPtr) {
      this.close();
      throw new Error('ScreenFont: out of memory');
    }

    Graphics.InitRastPort(this._rastPortPtr);
    Graphics.SetFont(this._rastPortPtr, this._fontPtr);
  }

  /**
   * The screen's struct DrawInfo, as a pointer: its pens, font and
   * resolution. Classes that draw in the screen's style ask for it
   * (sysiclass needs it as SYSIA_DrawInfo). 0 after close().
   *
   * @returns {number}
   */
  get drawInfo() {
    return this._drawInfoPtr;
  }

  /**
   * The width of a piece of text in this font. An underscore that
   * marks a keyboard shortcut ('_Quit') is not drawn, so leave it out
   * of what you measure.
   *
   * @param {string} text - plain ASCII / Latin-1
   * @returns {number} pixels
   * @throws {Error} if called after close()
   */
  widthOf(text) {
    if (!this._rastPortPtr) {
      throw new Error('ScreenFont: widthOf() after close()');
    }

    text = String(text);
    if (text.length === 0) return 0;

    /* TextLength() measures during the call and keeps nothing. */
    return globalThis.amiga.withString(text, (pointer) =>
      Graphics.TextLength(this._rastPortPtr, pointer, text.length));
  }

  /**
   * Convert a vertical distance into the horizontal one that looks the
   * same length on this screen. On square pixels it returns its
   * argument.
   *
   * @param {number} pixelsDown
   * @returns {number} whole pixels across
   */
  across(pixelsDown) {
    return Math.round(pixelsDown * this.pixelAspect);
  }

  /**
   * Release the DrawInfo, the private RastPort and the screen lock.
   * Safe to call twice. height, baseline, nominalWidth, pixelAspect,
   * screenWidth and screenHeight stay readable afterwards; widthOf()
   * does not work any more.
   *
   * @returns {undefined}
   */
  close() {
    if (this._rastPortPtr) {
      globalThis.amiga.freeMem(this._rastPortPtr, RastPort.SIZE);
      this._rastPortPtr = 0;
    }

    if (this._drawInfoPtr) {
      Intuition.FreeScreenDrawInfo(this._screen, this._drawInfoPtr);
      this._drawInfoPtr = 0;
    }

    if (this._screen) {
      Intuition.UnlockPubScreen(null, this._screen);
      this._screen = null;
    }
  }
}
