#ifndef TEXTTABLE_H
#define TEXTTABLE_H


/****************************************************************************/


/* This file was created automatically by CatComp.
 * Do NOT edit by hand!
 */


#ifndef EXEC_TYPES_H
#include <exec/types.h>
#endif

#ifdef CATCOMP_ARRAY
#undef CATCOMP_NUMBERS
#undef CATCOMP_STRINGS
#define CATCOMP_NUMBERS
#define CATCOMP_STRINGS
#endif

#ifdef CATCOMP_BLOCK
#undef CATCOMP_STRINGS
#define CATCOMP_STRINGS
#endif


/****************************************************************************/


#ifdef CATCOMP_NUMBERS

#define ERROR_REQUIRES_V39 5000
#define ERROR_CLIPBOARD_EMPTY 5001
#define ERROR_COULDNT_SAVE_FILE 5002
#define TITLE_CLIPVIEW 5003
#define TITLE_PRINTING 5004
#define TITLE_SELECT_FILE_TO_SAVE_TO 5005
#define LABEL_ABORT 5006
#define LABEL_CONTINUE 5007
#define LABEL_SAVE 5008
#define MENU_PROJECT 5009
#define ITEM_SAVE_AS 5010
#define ITEM_PRINT 5011
#define ITEM_ABOUT 5012
#define ITEM_QUIT 5013
#define MENU_EDIT 5014
#define ITEM_MARK 5015
#define ITEM_COPY 5016
#define LPDERR_NOERR 5100
#define LPDERR_CANCEL 5101
#define LPDERR_NOTGRAPHICS 5102
#define LPDERR_OBS1 5103
#define LPDERR_BADDIMENSION 5104
#define LPDERR_OBS2 5105
#define LPDERR_INTERNALMEMORY 5106
#define LPDERR_BUFFERMEMORY 5107

#endif /* CATCOMP_NUMBERS */


/****************************************************************************/


#ifdef CATCOMP_STRINGS

#define ERROR_REQUIRES_V39_STR "Requires V39"
#define ERROR_CLIPBOARD_EMPTY_STR "Clipboard Empty"
#define ERROR_COULDNT_SAVE_FILE_STR "Couldn't save file %s"
#define TITLE_CLIPVIEW_STR "ClipView"
#define TITLE_PRINTING_STR "Printing..."
#define TITLE_SELECT_FILE_TO_SAVE_TO_STR "Select File to Save to"
#define LABEL_ABORT_STR "Abort"
#define LABEL_CONTINUE_STR "Continue"
#define LABEL_SAVE_STR "Save"
#define MENU_PROJECT_STR "Project"
#define ITEM_SAVE_AS_STR "A\0Save As..."
#define ITEM_PRINT_STR "P\0Print..."
#define ITEM_ABOUT_STR "?\0About..."
#define ITEM_QUIT_STR "Q\0Quit"
#define MENU_EDIT_STR "Edit"
#define ITEM_MARK_STR "B\0Mark"
#define ITEM_COPY_STR "C\0Copy"
#define LPDERR_NOERR_STR "Operation Successful"
#define LPDERR_CANCEL_STR "User Canceled Print Request"
#define LPDERR_NOTGRAPHICS_STR "Printer Cannot Ouput Graphics"
#define LPDERR_OBS1_STR "obsolete"
#define LPDERR_BADDIMENSION_STR "Print Dimensions are Illegal"
#define LPDERR_OBS2_STR "obsolete"
#define LPDERR_INTERNALMEMORY_STR "Not Enough Memory"
#define LPDERR_BUFFERMEMORY_STR "Not Enough Memory"

#endif /* CATCOMP_STRINGS */


/****************************************************************************/


#ifdef CATCOMP_ARRAY

struct CatCompArrayType
{
    LONG   cca_ID;
    STRPTR cca_Str;
};

static const struct CatCompArrayType CatCompArray[] =
{
    {ERROR_REQUIRES_V39,(STRPTR)ERROR_REQUIRES_V39_STR},
    {ERROR_CLIPBOARD_EMPTY,(STRPTR)ERROR_CLIPBOARD_EMPTY_STR},
    {ERROR_COULDNT_SAVE_FILE,(STRPTR)ERROR_COULDNT_SAVE_FILE_STR},
    {TITLE_CLIPVIEW,(STRPTR)TITLE_CLIPVIEW_STR},
    {TITLE_PRINTING,(STRPTR)TITLE_PRINTING_STR},
    {TITLE_SELECT_FILE_TO_SAVE_TO,(STRPTR)TITLE_SELECT_FILE_TO_SAVE_TO_STR},
    {LABEL_ABORT,(STRPTR)LABEL_ABORT_STR},
    {LABEL_CONTINUE,(STRPTR)LABEL_CONTINUE_STR},
    {LABEL_SAVE,(STRPTR)LABEL_SAVE_STR},
    {MENU_PROJECT,(STRPTR)MENU_PROJECT_STR},
    {ITEM_SAVE_AS,(STRPTR)ITEM_SAVE_AS_STR},
    {ITEM_PRINT,(STRPTR)ITEM_PRINT_STR},
    {ITEM_ABOUT,(STRPTR)ITEM_ABOUT_STR},
    {ITEM_QUIT,(STRPTR)ITEM_QUIT_STR},
    {MENU_EDIT,(STRPTR)MENU_EDIT_STR},
    {ITEM_MARK,(STRPTR)ITEM_MARK_STR},
    {ITEM_COPY,(STRPTR)ITEM_COPY_STR},
    {LPDERR_NOERR,(STRPTR)LPDERR_NOERR_STR},
    {LPDERR_CANCEL,(STRPTR)LPDERR_CANCEL_STR},
    {LPDERR_NOTGRAPHICS,(STRPTR)LPDERR_NOTGRAPHICS_STR},
    {LPDERR_OBS1,(STRPTR)LPDERR_OBS1_STR},
    {LPDERR_BADDIMENSION,(STRPTR)LPDERR_BADDIMENSION_STR},
    {LPDERR_OBS2,(STRPTR)LPDERR_OBS2_STR},
    {LPDERR_INTERNALMEMORY,(STRPTR)LPDERR_INTERNALMEMORY_STR},
    {LPDERR_BUFFERMEMORY,(STRPTR)LPDERR_BUFFERMEMORY_STR},
};

#endif /* CATCOMP_ARRAY */


/****************************************************************************/


#ifdef CATCOMP_BLOCK

static const char CatCompBlock[] =
{
    "\x00\x00\x13\x88\x00\x0E"
    ERROR_REQUIRES_V39_STR "\x00\x00"
    "\x00\x00\x13\x89\x00\x10"
    ERROR_CLIPBOARD_EMPTY_STR "\x00"
    "\x00\x00\x13\x8A\x00\x16"
    ERROR_COULDNT_SAVE_FILE_STR "\x00"
    "\x00\x00\x13\x8B\x00\x0A"
    TITLE_CLIPVIEW_STR "\x00\x00"
    "\x00\x00\x13\x8C\x00\x0C"
    TITLE_PRINTING_STR "\x00"
    "\x00\x00\x13\x8D\x00\x18"
    TITLE_SELECT_FILE_TO_SAVE_TO_STR "\x00\x00"
    "\x00\x00\x13\x8E\x00\x06"
    LABEL_ABORT_STR "\x00"
    "\x00\x00\x13\x8F\x00\x0A"
    LABEL_CONTINUE_STR "\x00\x00"
    "\x00\x00\x13\x90\x00\x06"
    LABEL_SAVE_STR "\x00\x00"
    "\x00\x00\x13\x91\x00\x08"
    MENU_PROJECT_STR "\x00"
    "\x00\x00\x13\x92\x00\x0E"
    ITEM_SAVE_AS_STR "\x00\x00"
    "\x00\x00\x13\x93\x00\x0C"
    ITEM_PRINT_STR "\x00\x00"
    "\x00\x00\x13\x94\x00\x0C"
    ITEM_ABOUT_STR "\x00\x00"
    "\x00\x00\x13\x95\x00\x08"
    ITEM_QUIT_STR "\x00\x00"
    "\x00\x00\x13\x96\x00\x06"
    MENU_EDIT_STR "\x00\x00"
    "\x00\x00\x13\x97\x00\x08"
    ITEM_MARK_STR "\x00\x00"
    "\x00\x00\x13\x98\x00\x08"
    ITEM_COPY_STR "\x00\x00"
    "\x00\x00\x13\xEC\x00\x16"
    LPDERR_NOERR_STR "\x00\x00"
    "\x00\x00\x13\xED\x00\x1C"
    LPDERR_CANCEL_STR "\x00"
    "\x00\x00\x13\xEE\x00\x1E"
    LPDERR_NOTGRAPHICS_STR "\x00"
    "\x00\x00\x13\xEF\x00\x0A"
    LPDERR_OBS1_STR "\x00\x00"
    "\x00\x00\x13\xF0\x00\x1E"
    LPDERR_BADDIMENSION_STR "\x00\x00"
    "\x00\x00\x13\xF1\x00\x0A"
    LPDERR_OBS2_STR "\x00\x00"
    "\x00\x00\x13\xF2\x00\x12"
    LPDERR_INTERNALMEMORY_STR "\x00"
    "\x00\x00\x13\xF3\x00\x12"
    LPDERR_BUFFERMEMORY_STR "\x00"
};

#endif /* CATCOMP_BLOCK */


/****************************************************************************/


struct LocaleInfo
{
    APTR li_LocaleBase;
    APTR li_Catalog;
};


#ifdef CATCOMP_CODE

STRPTR GetString(struct LocaleInfo *li, LONG stringNum)
{
LONG   *l;
UWORD  *w;
STRPTR  builtIn;

    l = (LONG *)CatCompBlock;

    while (*l != stringNum)
    {
        w = (UWORD *)((ULONG)l + 4);
        l = (LONG *)((ULONG)l + (ULONG)*w + 6);
    }
    builtIn = (STRPTR)((ULONG)l + 6);

#define XLocaleBase LocaleBase
#define LocaleBase li->li_LocaleBase
    
    if (LocaleBase)
        return(GetCatalogStr(li->li_Catalog,stringNum,builtIn));
#define LocaleBase XLocaleBase
#undef XLocaleBase

    return(builtIn);
}


#endif /* CATCOMP_CODE */


/****************************************************************************/


#endif /* TEXTTABLE_H */
