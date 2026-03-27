OPT MODULE
OPT EXPORT
OPT PREPROCESS

/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-98 THOR-Software inc.                        **
 ** Version 3.60                                        **
 **                                                     **
 ** program version 3.60 20 Aug 1998 THOR               **
 **                                                     **
 ** ViNCEd dynamical memory management                  **
 **-----------------------------------------------------**
 **                                                     **
 ** all use at your own risk,etc.,etc.                  **
 **                                                     **
 ** Everything declared as "reserved" or                **
 ** "not used" is NOT free for your use,                **
 ** it will propably used in a later release.           **
 ** All FREE entries are free for public                **
 ** use and are, if not otherwise noticed,              **
 ** initialized as ZERO                                 **
 **                                                     **
 ** AmigaE version: Tomasz Wiszkowski                   **
 **                                                     **
 *********************************************************/

/* This file is about the dynamical memory nodes.
   Unlike all exec memory, these chunks of memory MIGHT GET MOVED THRU
   SPACE if more room is needed!

   SPECIAL CARE MUST BE TAKEN TO HOLD POINTERS ON THESE, SINCE THE
   POINTERS GET INVALID WHEN THESE STRUCTURES ARE TRAVELING!

   IF YOU NEED A POINTER TO THEM, STORE IT EITHER IN THE ViNCUserNode
   (see vnc/window.h), OR IN A LINKED LIST. THESE POINTERS GET "BEND"
   AUTOMATICALLY IF THE NODES MOVE AROUND.

   IF YOU REMOVE A DYNAMICAL NODE FROM A LIST, MAKE SURE THAT YOU
   SET THE LINK POINTERS TO ZERO!

   BE WARNED! HANDLING WITH THEM IS TRICKY!
*/

/* An occupied piece of memory, doubly linked for easy freeing and
   garbage collection */

OBJECT dynnode
   succ:PTR TO dynnode // linked in UsedList
   pred:PTR TO dynnode
   size:INT            // size, including structure
ENDOBJECT


/* Note that the size is needed in case this one must move thru memory,
   for copying it to the destination. The MemBlock ptr is used for fast
   freeing of the structure */


/* A part of a line on the screen or in the history. */
OBJECT linebody
   succ:PTR TO linebody
   pred:PTR TO linebody    // linked list
   status:CHAR             // see below
   rastermask:CHAR         // used bitplanes for this line for quick scrolling
   packedpenpair:CHAR      // A and BPen of the first word
   packedtype:CHAR         // Drawmode & algostyle
ENDOBJECT

/* This is how a line is allocated from memory, and how it's hold */

OBJECT dynline
   header:dynnode
   body:linebody
ENDOBJECT

/* The allocation is done by AllocLine(), FreeLine(). The size given
   to AllocLine is the number of ADDITIONAL BYTES you need, except
   this structure.
*/

/* How to get the pointer to the first word of a line, i.e. its contents: */

#define VLINE_FIRSTWORD(lin)    (lin+1)

/* REMEMBER THAT LINES LIKE ALL DYNAMICAL NODE STUFF WILL MOVE THRU
   MEMORY. THERE ISN'T A SINGLE BIT IN THE SYSTEM TO PREVENT THEM
   FROM DOING SO! */

/* How the pen pairs are packed:
        The upper nibble of the PackedPenPair is the BPen
        (colors 0..15 in bits 7..4)
        The lower nibble is the APen.
        This is the reason why ViNCEd is limited to sixteen
        colors */

CONST PP_PENMASK      = $0F;
CONST PP_BPENSHIFT    = 4;

/* Shift left by BPENSHIFT to get the BPEN, then and with mask */

/* How the AlgoStyle is packed: */

/* keeps the draw mode for gfx */
CONST PA_DRAWMASK     = $06

/* must be and-ed to turn on JAM2 */
CONST PA_DRAWORF      = $01

/* shift by this number to get the algostyle */
CONST PA_SOFTSHIFT    = 3

/* use this mask to get the algostyle */
CONST PA_SOFTMASK     = $07

/* the following bits have a special meaning */

/* set if part of the marked block */
CONST PA_INBLOCK_BIT          = 6
CONST PA_INBLOCK_MASK         = 1<<6

/* set if not user input, but printed by DOS (ignore on input) */
CONST PA_PRINT_BIT            = 7
CONST PA_PRINT_MASK           = 1<<7

/* vln_status bits */

/* this was the line the DOS put the cursor in */
CONST VLN_DOSLINE_BIT         = 1
CONST VLN_DOSLINE_MASK        = 1<<1

/* this is set if the line end is marked to be in the block as well */
CONST VLN_CRADDED_BIT         = 2
CONST VLN_CRADDED_MASK        = 1<<2

/* the next three are reserved for foldings. Not yet used, however */
CONST VLN_INFOLD_BIT          = 3
CONST VLN_INFOLD_MASK         = 1<<3
CONST VLN_STARTFOLD_BIT       = 4
CONST VLN_STARTFOLD_MASK      = 1<<4
CONST VLN_ENDFOLD_BIT         = 5
CONST VLN_ENDFOLD_MASK        = 1<<5

/* this one is set if the line is part of a marked block */
CONST VLN_INBLOCK_BIT         = 6
CONST VLN_INBLOCK_MASK        = 1<<6

/* set if the complete line contains no user input */
CONST VLN_PRINT_BIT           = 7
CONST VLN_PRINT_MASK          = 1<<7


/* The snip documentation is removed from this file. The snip
   structures have changed and are now PRIVATE. */


/* The next two represent a line in the output buffer of ViNCEd.
   Again, AllocLine() and FreeLine() are used to allocate/free them,
   and again a dynamical node is used for allocation.
   The size is again the same as the LineBody!
   BEWARE: THIS WILL MOVE THRU MEMORY IF NEEDED ! */

OBJECT outnodebody
   succ:PTR TO outnodebody
   pred:PTR TO outnodebody // again, doubly linked list
   textsize:INT            // readable characters in here
   offset:INT              // offset from beginning of the output buffer
ENDOBJECT

/* And this is how it looks like in memory */

OBJECT dynoutnode
   header:dynnode
   body:outnodebody
ENDOBJECT


/* Use this macro to get the first character in here */
#define DOUTN_FIRSTCHAR(on)     (on+1)


/* This is the word structure I mentioned above.
   Unlike what you might think, it does not hold a "word" in the common
   sense, but a sequence of characters of the same pens and draw
   modes. Big areas of blank spaces are not hold in the word structures
   as well, since they only eat up memory. They are removed from the
   lines, and the word position is adjusted.
   This is the ViNCEd way to compress its contents. */

OBJECT viword
   size:CHAR          // size of word in characters. zero if this is
                      // the last word in a line
   packedpenpair:CHAR // PP, packed like in lines
   packedtype:CHAR    // DrawMode and style, again packed like above
   xpos:CHAR          // absolute position in the line
ENDOBJECT

/*How to get the contents of a ViWord: */

#define WORD_BODY(wd)   (wd+1)

/*And how to get the next word */

#define NEXT_WORD(wd)   (WORD_BODY(wd)+(wd::viword.size))


/* The maximum size of a line */
CONST VLINE_MAXLENGTH         = 243
CONST VLINE_ML                = VLINE_MAXLENGTH+1

/* Additional room */
CONST VCHAR_SIZE              = 258

/* The next one is not dynamic, and holds an uncompressed line */
OBJECT vchartype
   packedpenpair:CHAR
   packedtype:CHAR
ENDOBJECT

OBJECT vcharline
   char[VCHAR_SIZE]:ARRAY OF CHAR
   types[VCHAR_SIZE]:ARRAY OF vchartype
ENDOBJECT

/* VCharLines are easier to handle, DynLines take up less memory and are
   used everywhere else except for the current editor line (the line under
   the cursor).
   Use LineToLinear() and LinearToAlloc()/LinearToLine() to convert between
   the types. */

