/*
 * screen_info.js - print the size, title and font of the Workbench screen.
 *
 * Nothing opens. The script locks the default public screen, prints a
 * few lines about it on the Shell, and unlocks it again. On a stock
 * PAL Workbench the output looks something like this:
 *
 *   Public screen:
 *     Title:      "Workbench Screen"
 *     Geometry:   640x256 at (0,0)
 *     Flags:      0x...
 *     TitleBar:   11px
 *     Font:       "topaz.font" 8pt (style 0x0, flags 0x...)
 *
 * The screen and its font are struct wrappers: `screen.width` reads
 * the field of the C structure, with no offsets in sight.
 *
 * Assumptions:
 *   - the default public screen is Workbench; if something else has
 *     been made the default, that screen is described instead
 *   - the font's size is printed as "pt" but is really its height in
 *     pixels (ta_YSize), as everywhere on the Amiga
 *
 * Requires quickjs.library 0.127+.
 * Run: qjs examples/screen_info.js
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available - need quickjs.library 0.127+');
  std.exit(1);
}

/* null asks for the default public screen, which is Workbench unless
 * something has changed the default. The lock keeps the screen from
 * closing while it is being read. */
let screen = Intuition.LockPubScreen(null);

if (!screen) {
  print('LockPubScreen(null) failed - is Workbench running?');
  std.exit(1);
}

try {
  print('Public screen:');
  print('  Title:      "' + (screen.title || '<null>') + '"');
  print('  Geometry:   ' + screen.width + 'x' + screen.height +
        ' at (' + screen.leftEdge + ',' + screen.topEdge + ')');
  print('  Flags:      0x' + screen.flags.toString(16));

  /* sc_BarHeight is one less than the title bar's real height. */
  print('  TitleBar:   ' + (screen.barHeight + 1) + 'px');

  let font = screen.font;

  if (font) {
    print('  Font:       "' + (font.name || '<null>') + '" ' +
          font.ySize + 'pt' +
          ' (style 0x' + font.style.toString(16) +
          ', flags 0x' + font.flags.toString(16) + ')');
  }
}
finally {
  /* UnlockPubScreen takes a name or a screen; the name is not needed
   * when the screen itself is given. */
  Intuition.UnlockPubScreen(null, screen);
}
