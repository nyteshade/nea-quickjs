#ifndef VNC_DYNAMICS_H
#define VNC_DYNAMICS_H
/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-2021 THOR-Software inc.                      **
 ** Version 3.102                                       **
 **                                                     **
 ** program version 3.102 10 July 2021 THOR             **
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
 *********************************************************/

#ifndef EXEC_TYPES_H
#include <exec/types.h>
#endif

/* This file is about the dynamical memory nodes.
   Unlike all exec memory, these chunks of memory MIGHT GET MOVED THRU
   SPACE if more room is needed!

   SPECIAL CARE MUST BE TAKEN TO HOLD POINTERS ON THESE, SINCE THE
   POINTERS GET INVALID WHEN THESE STRUCTURES ARE TRAVELING!

   IF YOU NEED A POINTER TO THEM, STORE IT EITHER IN THE ViNCUserNode
   (see vnc/window.h), OR IN A LINKED LIST. THESE POINTERS GET "BEND"
   AUTOMATICALLY IF THE NODES MOVE AROUND.

   IF YOU REMOVE A DYNAMICAL NODE FROM A LIST, MAKE SHURE THAT YOU
   SET THE LINK POINTERS TO ZERO!

   BE WARNED! HANDLING WITH THEM IS TRICKY!
*/

/* An occupied piece of memory, doubly linked for easy freeing and
   garbage collection */

struct DynNode {
        struct DynNode                  *dynnd_succ;
        struct DynNode                  *dynnd_pred;    /* linked in
                                                           UsedList */
        UWORD                            dynnd_size;    /* size, including
                                                           structure */
};


/* Note that the size is needed in case this one must move thru memory,
   for copying it to the destination. The MemBlock ptr is used for fast
   freeing of the structure */


/* A part of a line on the screen or in the history. */
struct DynLine {
        struct DynLine                  *vln_succln;
        struct DynLine                  *vln_predln;    /* linked list */
        UWORD                            vln_size;
        UBYTE                            vln_Status;    /* see below */
        UBYTE                            vln_RasterMask;/* used bitplanes
                                                           for this line
                                                           for quick
                                                           scrolling */
        UBYTE                            vln_PackedPenPair;
                                                        /* A and BPen of
                                                           the first word */
        UBYTE                            vln_PackedType;
                                                        /* Drawmode &
                                                           algostyle */
};

/* The allocation is done by AllocLine(), FreeLine(). The size given
   to AllocLine is the number of ADDITIONAL BYTES you need, except
   this structure.
*/

/* How to get the pointer to the first word of a line, i.e. its contents: */

#define VLINE_FIRSTWORD(lin)    ((struct ViWord *)((lin)+1));

/* REMEMBER THAT LINES LIKE ALL DYNAMICAL NODE STUFF WILL MOVE THRU
   MEMORY. THERE ISN'T A SINGLE BIT IN THE SYSTEM TO PREVENT THEM
   FROM DOING SO! */

/* How the pen pairs are packed:
        The upper nibble of the PackedPenPair is the BPen
        (colors 0..15 in bits 7..4)
        The lower nibble is the APen.
        This is the reason why ViNCEd is limited to sixteen
        colors */

#define PP_PENMASK      0x0F;
#define PP_BPENSHIFT    4;

/* Shift left by BPENSHIFT to get the BPEN, then and with mask */

/* How the AlgoStyle is packed: */

/* keeps the draw mode for gfx */
#define PA_DRAWMASK     0x06

/* must be and-ed to turn on JAM2 */
#define PA_DRAWORF      0x01

/* shift by this number to get the algostyle */
#define PA_SOFTSHIFT    3

/* use this mask to get the algostyle */
#define PA_SOFTMASK     0x07

/* the following bits have a special meaning */

/* set if part of the marked block */
#define PA_INBLOCK_BIT          6
#define PA_INBLOCK_MASK         (1L<<6)

/* set if not user input, but printed by DOS (ignore on input) */
#define PA_PRINT_BIT            7
#define PA_PRINT_MASK           (1L<<7)

/* vln_status bits */

/* this was the line the DOS put the cursor in */
#define VLN_DOSLINE_BIT         1
#define VLN_DOSLINE_MASK        (1L<<1)

/* this is set if the line end is marked to be in the block as well */
#define VLN_CRADDED_BIT         2
#define VLN_CRADDED_MASK        (1L<<2)

/* the next three are reserved for foldings. Not yet used, however */
#define VLN_INFOLD_BIT          3
#define VLN_INFOLD_MASK         (1L<<3)
#define VLN_STARTFOLD_BIT       4
#define VLN_STARTFOLD_MASK      (1L<<4)
#define VLN_ENDFOLD_BIT         5
#define VLN_ENDFOLD_MASK        (1L<<5)

/* this one is set if the line is part of a marked block */
#define VLN_INBLOCK_BIT         6
#define VLN_INBLOCK_MASK        (1L<<6)

/* set if the complete line contains no user input */
#define VLN_PRINT_BIT           7
#define VLN_PRINT_MASK          (1L<<7)


/* The snip documentation is removed from this file. The snip
   structures have changed and are now PRIVATE. */


/* The next two represent a line in the output buffer of ViNCEd.
   Again, AllocLine() and FreeLine() are used to allocate/free them,
   and again a dynamical node is used for allocation.
   The size is again the same as the LineBody!
   BEWARE: THIS WILL MOVE THRU MEMORY IF NEEDED ! */

struct DynOutNode {
        struct DynOutNode       *von_succ;
        struct DynOutNode       *von_pred;      /* again, doubly
                                                   linked list */
        UWORD                    von_size;
        UWORD                    von_TextSize;  /* readable characters
                                                   in here */
        UWORD                    von_Offset;    /* offset from beginning
                                                   of the output buffer */
};

/* Use this macro to get the first character in here */
#define DOUTN_FIRSTCHAR(on)     ((char *)((on)+1))


/* This is the word structure I mentioned above.
   Unlike what you might think, it does not hold a "word" in the common
   sense, but a sequence of characters of the same pens and draw
   modes. Big areas of blank spaces are not hold in the word structures
   as well, since they only eat up memory. They are removed from the
   lines, and the word position is adjusted.
   This is the ViNCEd way to compress its contents. */

struct ViWord {
        UBYTE           vwd_size;       /* size of word in characters.
                                           zero if this is the last word
                                           in a line */
        UBYTE           vwd_PackedPenPair;      /* PP, packed like in
                                                   lines */
        UBYTE           vwd_PackedType; /* DrawMode and style, again
                                           packed like above */
        UBYTE           vwd_Blanks;     /* blank spaces upfront the word */
};

/*How to get the contents of a ViWord: */

#define WORD_BODY(wd)   ((char *)((wd)+1))

/*And how to get the next word */

#define NEXT_WORD(wd)   ((struct ViWord *)(WORD_BODY((wd))+(wd->vwd_size)))


/* The maximum size of a line */
#define VLINE_MAXLENGTH         243
#define VLINE_ML                (VLINE+MAXLENGTH+1)

/* Additional room */
#define VCHAR_SIZE              258

/* The next one is not dynamic, and holds an uncompressed line */
struct VCharLine {
        char            vch_char[VCHAR_SIZE];
        struct {
                UBYTE vch_PackedPenPair;
                UBYTE vch_PackedType;
        }               vch_Types[VCHAR_SIZE];
};


/* VCharLines are easier to handle, DynLines take up less memory and are
   used everywhere else except for the current editor line (the line under
   the cursor).
   Use LineToLinear() and LinearToAlloc()/LinearToLine() to convert between
   the types. */

#endif
