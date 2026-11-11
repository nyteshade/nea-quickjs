/*
 * datebrowser_demo.js - a month calendar that reports the day you click.
 *
 *   +------------------------------+
 *   | Pick a date:                 |
 *   |  Mo  Tu  We  Th  Fr  Sa  Su  |   the datebrowser gadget
 *   |           1   2   3   4   5  |
 *   |   6   7   8   9  10  11  12  |
 *   |  13  14  15  16  17  18  19  |
 *   |  20 [21] 22  23  24  25  26  |
 *   |  27  28  29  30              |
 *   | [           Quit           ] |
 *   +------------------------------+
 *
 * The calendar opens on April 2026 with the 21st selected. Click a day
 * and the date is printed on the Shell as YYYY-MM-DD.
 *
 * Assumptions:
 *   - the window opens on the default public screen (normally
 *     Workbench), which has room for a 300 x 240 window interior
 *   - datebrowser.gadget, label.image, button.gadget, layout.gadget
 *     and window.class are in SYS:Classes, as AmigaOS 3.2 installs them
 *   - the day names and which day starts the week come from the
 *     gadget and the system's locale; the picture above is a guess
 *   - the starting date is fixed in the script, not read from the
 *     clock
 *   - window.class reports gadget clicks even though the `idcmp:` mask
 *     below asks only for close, refresh and attribute updates
 *
 * Requires quickjs.library 0.170+.
 * Run: qjs examples/datebrowser_demo.js
 */

const { Window, Layout, Button, DateBrowser, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { CALENDAR: 1, QUIT: 2 };

/** The date selected when the window opens: 21 April 2026. Months and
 *  days both count from 1. */
const START = { year: 2026, month: 4, day: 21 };

/** Digits in the month and the day of a printed date. */
const DATE_PART_DIGITS = 2;

/**
 * Pad a month or day number with a leading zero.
 *
 * @param {number} value - 1 to 31
 * @returns {string} for example "04"
 */
function twoDigits(value) {
  return String(value).padStart(DATE_PART_DIGITS, '0');
}

let calendar = new DateBrowser({
  id:        ID.CALENDAR,
  year:      START.year,
  month:     START.month,
  day:       START.day,
  showTitle: true,
});

let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Reaction DateBrowser',
  innerWidth:  300,
  innerHeight: 240,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,

  layout: new Layout({
    orientation:  'vertical',
    innerSpacing: 4,
    children: [
      new Label({ text: 'Pick a date:' }),
      calendar,
      quitButton,
    ],
  }),
});

window.open();
print('Click a day to pick a date; Quit to exit.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) break;

    if (event.kind === EventKind.DATE_CHANGE) {
      print('Picked: ' + calendar.get('year') +
            '-' + twoDigits(calendar.get('month')) +
            '-' + twoDigits(calendar.get('day')));
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
