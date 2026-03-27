/* depthawarevisitor.c
 *
 * (c) Copyright 1992-1996 ESCOM AG.  All rights reserved.
 *
 * This software is provided as-is and is subject to change; no warranties
 * are made.  All use is at your own risk.  No liability or responsibility
 * is assumed.
 *
 */

#include <exec/types.h>
#include <intuition/intuition.h>
#include <graphics/displayinfo.h>
#include <dos/dos.h>

#include <clib/exec_protos.h>
#include <clib/intuition_protos.h>
#include <clib/graphics_protos.h>
#include <clib/dos_protos.h>

#include <stdio.h>
#include <stdlib.h>


struct Library *IntuitionBase;
struct Library *GfxBase;
struct Screen  *screen = NULL;


void Quit(char *whytext, LONG failcode)
{
    if(*whytext) printf("%s\n",whytext);

    if (screen)		UnlockPubScreen(NULL, screen);
    if (IntuitionBase)	CloseLibrary(IntuitionBase);
    if (GfxBase)	CloseLibrary(GfxBase);

    exit(failcode);
}


void main(void)
{
    struct Screen *screen;
    struct DrawInfo *drawinfo;
    struct Window *window;
    UWORD depth;

    if ((GfxBase = OpenLibrary("graphics.library",36))==NULL)
        Quit("graphics.library is too old <V36",RETURN_FAIL);

    if ((IntuitionBase = OpenLibrary("intuition.library",36))==NULL)
        Quit("intuition.library is too old <V36",RETURN_FAIL);

    if (!(screen = LockPubScreen(NULL)))
        Quit("Can't lock default public screen",RETURN_FAIL);

    /* Here's where we'll ask Intuition about the screen. */
    if((drawinfo=GetScreenDrawInfo(screen)) == NULL)
	Quit("Can't get DrawInfo",RETURN_FAIL);

    depth=drawinfo->dri_Depth;

    /* Because Intuition allocates the DrawInfo structure,
     * we have to tell it when we're done, to get the memory back.
     */
    FreeScreenDrawInfo(screen, drawinfo);

    /* This next line takes advantage of the stack-based amiga.lib
     * version of OpenWindowTags.
     */
    if (window = OpenWindowTags(NULL, WA_PubScreen ,screen,
                                      WA_Left      ,0,
                                      WA_Width     ,screen->Width,
                                      WA_Top       ,screen->BarHeight,
                                      WA_Height    ,screen->Height - screen->BarHeight,
                                      WA_Flags     ,WINDOWDRAG|WINDOWDEPTH|WINDOWCLOSE|
                                                    ACTIVATE|SIMPLE_REFRESH|NOCAREREFRESH,
                                      WA_Title     ,"Big Visitor",
                                      TAG_END))
    {

        printf("depth=%d\n",depth);

        /* All our window event handling might go here */

        Delay(TICKS_PER_SECOND * 10);

        /* Of course, some other program might come along
         * and change the attributes of the screen that we read from
         * DrawInfo, but that's a mean thing to do to a public screen,
         * so let's hope it doesn't happen.
         */

        CloseWindow(window);
    }

Quit("",RETURN_OK);	/* clean up (close/unlock) and exit */
}
