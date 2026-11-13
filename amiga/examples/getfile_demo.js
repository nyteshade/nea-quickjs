/*
 * getfile_demo.js - a file-chooser gadget that reports the file picked.
 *
 *   +--------------------------------+
 *   | Pick a file:                   |
 *   | [ SYS:                   |[=]] |   the getfile gadget
 *   | [            Quit            ] |
 *   +--------------------------------+
 *
 * Click the gadget and a file requester opens, titled "Pick any file"
 * and starting in SYS:. Choose a file and its full path is printed on
 * the Shell; cancel, and the script says so.
 *
 * The gadget does not open the requester by itself. A click on it
 * arrives here as a FILE_SELECTED event, and the script answers with
 * `fileChooser.request()`, which shows the requester and returns once
 * the user is done (GFILE_REQUEST in gadgets/getfile.h).
 *
 * Assumptions:
 *   - the window opens on the default public screen (normally
 *     Workbench), which has room for a 320 x 100 window interior
 *   - getfile.gadget, label.image, button.gadget, layout.gadget and
 *     window.class are in SYS:Classes, as AmigaOS 3.2 installs them
 *   - SYS: is assigned, as it is on any booted system
 *   - request() returns false when the File field of the requester
 *     was left empty, even if OK was pressed: the gadget's autodoc
 *     says so
 *   - window.class reports gadget clicks even though the `idcmp:` mask
 *     below asks only for close, refresh and attribute updates
 *
 * Requires quickjs.library 0.232+ (GetFile.request arrived then).
 * Run: qjs examples/getfile_demo.js
 */

const { Window, Layout, Button, GetFile, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { FILE: 1, QUIT: 2 };

let fileChooser = new GetFile({
  id:        ID.FILE,
  titleText: 'Pick any file',
  drawer:    'SYS:',

  /* Have 'fullFile' give the complete path, with relative parts
   * expanded (GETFILE_FullFileExpand, gadgets/getfile.h). */
  fullFileExpand: true,
});

let hintLabel  = new Label({ text: 'Pick a file:' });
let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Reaction GetFile',
  innerWidth:  320,
  innerHeight: 100,
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
      hintLabel,
      fileChooser,
      quitButton,
    ],
  }),
});

window.open();
print('Click the gadget to pick a file; Quit to exit.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) break;

    /* The gadget was clicked: show its requester. request() comes
     * back when the user has chosen or cancelled. */
    if (event.kind === EventKind.FILE_SELECTED) {
      if (fileChooser.request()) {
        print('Selected: ' + fileChooser.get('fullFile'));
      }
      else {
        print('No file chosen.');
      }
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
