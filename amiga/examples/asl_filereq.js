/*
 * asl_filereq.js - ask for a file with the standard file requester.
 *
 * The system file requester opens, titled "Pick a file", with a
 * pattern gadget. Choose a file and press OK, and the script prints
 * the drawer, the file name and the two joined into a path. Press
 * Cancel and it says so.
 *
 * One call does everything: Asl.openFileRequest allocates the
 * requester, shows it, reads the answer and frees it again.
 *
 * Assumptions:
 *   - asl.library is installed (it is part of every Workbench from
 *     2.0 on)
 *   - the default public screen (normally Workbench) is open; the
 *     requester appears there
 *   - SYS: exists, as the drawer the requester is asked to start in
 *   - a requester that could not be opened looks the same to this
 *     script as one that was cancelled
 *
 * Requires quickjs.library 0.213+.
 * Run: qjs examples/asl_filereq.js
 */

import * as std from 'qjs:std';

if (typeof Asl !== 'function') {
  print('amiga.Asl wrapper unavailable - need quickjs.library 0.134+');
  std.exit(1);
}

/** asl.library's constants: the ASLFR_ file-requester tags. */
const C = Asl.consts;

/**
 * What Asl.openFileRequest returns.
 *
 * @typedef {object} FileChoice
 * @property {boolean} ok - true if the user pressed OK
 * @property {string|null} drawer - the directory chosen
 * @property {string|null} file - the file name chosen
 * @property {string|null} path - drawer and file joined
 * @property {number} requester - address of the requester, already
 *   freed; of no further use
 */

/**
 * Show the requester and wait for the user to answer it.
 *
 * @returns {FileChoice}
 */
function pickFile() {
  return Asl.openFileRequest([
    [C.ASLFR_TitleText,      'Pick a file'],
    [C.ASLFR_InitialDrawer,  'SYS:'],
    [C.ASLFR_InitialPattern, '#?'],      /* #? matches every name */
    [C.ASLFR_DoPatterns,     1],         /* show the pattern gadget */
  ]);
}

let choice = pickFile();

if (!choice.ok) {
  print('Cancelled or error.');
  std.exit(0);
}

print('Drawer : ' + choice.drawer);
print('File   : ' + choice.file);
print('Path   : ' + choice.path);
