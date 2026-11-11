/*
 * requester_demo.js - ask a question with a Reaction requester.
 *
 * A requester pops up with a question-mark picture, two lines of text
 * and two buttons, OK and Cancel. Click either one; the number the
 * requester hands back is printed on the Shell and the script ends.
 *
 * Assumptions:
 *   - opens on the default public screen (Workbench); the requester
 *     has no parent window
 *   - requester.class is installed (standard from OS 3.2; earlier with
 *     ClassAct/Reaction)
 *   - the returned number is 0 for the rightmost button and otherwise
 *     counts the buttons from the left starting at 1, so OK is 1 and
 *     Cancel is 0. This was observed, and may differ between versions
 *     of requester.class; see its autodoc.
 *
 * Requires quickjs.library 0.156+.
 * Run: qjs examples/requester_demo.js
 */

const { Requester, RequesterType, RequesterImage } = amiga.boopsi;

/* In gadgetText a bar separates the buttons, and an underscore marks
 * the next letter as that button's keyboard shortcut. */
let requester = new Requester({
  type:       RequesterType.INFO,
  titleText:  'React JS',
  bodyText:   'Hello from QuickJS-ng on Amiga!\nChoose wisely.',
  gadgetText: '_OK|_Cancel',
  image:      RequesterImage.QUESTION,
});

print('Pick a button in the requester.');

try {
  /* openReq does not return until a button has been clicked. The
   * argument is the parent window; null means none. */
  let result = requester.openReq(null);

  print('Requester returned: ' + result);
}
finally {
  requester.dispose();
}
