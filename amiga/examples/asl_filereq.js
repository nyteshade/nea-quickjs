/*
 * asl_filereq.js — Pop up a standard ASL file requester and print
 * the user's selection. Exercises the new amiga.Asl wrapper end to
 * end: allocate, request, free.
 *
 * Demonstrates:
 *   - Asl.openFileRequest — single-call allocate/request/free that
 *     returns {ok, drawer, file, path, requester}
 *   - Tag pairs with ASLFR_* constants taken off Asl.consts, so the
 *     script has no hand-coded hex tag IDs
 *   - Graceful cancel vs OK branches
 *
 * Run:        qjs examples/asl_filereq.js
 * Requires:   quickjs.library 0.134+ (adds the Asl wrapper)
 */

import * as std from 'qjs:std';

if (typeof Asl !== 'function') {
  print('amiga.Asl wrapper unavailable — need quickjs.library 0.134+');
  std.exit(1);
}

const A = Asl.consts;

/**
 * Pop up the requester with a friendly title and starting drawer.
 *
 * @returns {{ok: boolean, drawer: string|null, file: string|null, path: string|null, requester: number}}
 */
function pickFile() {
  return Asl.openFileRequest([
    [A.ASLFR_TitleText,     'Pick a file'],
    [A.ASLFR_InitialDrawer, 'SYS:'],
    [A.ASLFR_InitialPattern,'#?'],
    [A.ASLFR_DoPatterns,    1],
  ]);
}

let r = pickFile();

if (!r.ok) {
  print('Cancelled or error.');
  std.exit(0);
}

print('Drawer : ' + r.drawer);
print('File   : ' + r.file);
print('Path   : ' + r.path);
