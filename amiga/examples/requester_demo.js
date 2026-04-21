/*
 * requester_demo.js — modal Requester class, variadic makeTags form.
 *
 * Opens an info requester with OK/Cancel buttons. The click result
 * comes back as REQ_ReturnCode (read via .get('returnCode') after
 * openReq returns).
 */

import * as std from 'qjs:std';

const { Requester, RequesterType, RequesterImage } = amiga.boopsi;

let r = new Requester({
  type:        RequesterType.INFO,
  titleText:   'React JS',
  bodyText:    'Hello from QuickJS-ng on Amiga!\nChoose wisely.',
  gadgetText:  '_OK|_Cancel',
  image:       RequesterImage.QUESTION,
});

/* openReq is modal — it blocks until the user clicks a button or the
 * optional timeout fires.  Returns 0 for the rightmost gadget, else
 * N for the Nth gadget left-to-right (1-based for some versions —
 * see requester.class autodoc). */
let result = r.openReq(null);
print('Requester returned: ' + result);

r.dispose();
