/** $VER: Autodoc.ttx 1.0 (5.Aug.91)
 ** Written by David N. Junod
 **
 ** Display hypertext Autodoc page.
 **
 ** Add the following lines to your S:user-startup file.
 **
 **   RX "AddLib('amigaguide.library',0,-30)"
 **   RX "LoadXRef('autodocs.xref')"
 **
 **/

OPTIONS RESULTS
PARSE ARG word mode

IF ~SHOW('L','amigaguide.library') THEN
   CALL ADDLIB('amigaguide.library',0,-30)

/* See if the Autodoc cross-reference table is loaded */
line = GetXRef("OpenWindow()")
IF line = 10 THEN DO

   /* The Autodoc table wasn't loaded, so load it. */
   LoadXRef(autodocs.xref)
   END

/* See if the word is in the cross-reference table */
function = word
xref = 0
line = GetXRef(function)
IF line = 10 THEN DO
  /* Add the parens to the name */
  function = word||"()"

  /* Try again */
  line = GetXRef(function)
  IF line = 10 THEN DO
     function = word
     END
  ELSE DO
     xref = 1
     END
  END
ELSE DO
  xref = 1
  END

/* See if we have an Autodoc viewing window open */
IF ~SHOW('P','AUTODOCS') THEN DO

  /* See if we are trying to load a database or a document */
  IF xref = 0 THEN
     cmd = "run AmigaGuide "||function||" portname AUTODOCS"
  ELSE
     cmd = "run AmigaGuide document "||function||" portname AUTODOCS"

  ADDRESS COMMAND cmd

  END

ELSE DO

  /* See if we are trying to load a database or a document */
  IF xref = 0 THEN
     cmd = "Link "||function||"/main"
  ELSE
     cmd = "Link "||function

  /* Align the window */
  ADDRESS AUTODOCS cmd

  /* I want it to come to the front, because I have limited space */
  ADDRESS AUTODOCS "windowtofront"

  END
