/* Simple test for amigaguide.library
 * Written by David N. Junod
 */

OPTIONS RESULTS
PARSE ARG node

/* Load the ARexx utility library */
IF ~SHOW('L','amigaguide.library') THEN
   CALL ADDLIB('amigaguide.library',0,-30)

   line=GetXRef(node)
   say line
