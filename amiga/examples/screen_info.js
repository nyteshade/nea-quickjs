/*
 * screen_info.js — dump the default public screen's geometry, font,
 * and border info via the Q2 wrapper API.
 *
 * Intuition.LockPubScreen(null) returns a Screen struct instance
 * whose named getters read the underlying C struct fields. Screen
 * also reports its Font as a TextAttr wrapper with its own getters.
 *
 * Run:        qjs examples/screen_info.js
 * Requires:   quickjs.library 0.127+
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available — need quickjs.library 0.127+');
  std.exit(1);
}

let screen = Intuition.LockPubScreen(null);

if (!screen) {
  print('LockPubScreen(null) failed — is Workbench running?');
  std.exit(1);
}

try {
  print('Public screen:');
  print('  Title:      "' + (screen.title || '<null>') + '"');
  print('  Geometry:   ' + screen.width + 'x' + screen.height +
        ' at (' + screen.leftEdge + ',' + screen.topEdge + ')');
  print('  Flags:      0x' + screen.flags.toString(16));
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
  /* UnlockPubScreen(name=NULL, screen=ptr) */
  Intuition.UnlockPubScreen(null, screen);
}
