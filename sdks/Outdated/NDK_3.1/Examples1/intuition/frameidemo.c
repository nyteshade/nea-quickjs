/*
 * frameidemo.c - shows frame types from frameiclass
 *
 * (c) Copyright 1992-1996 ESCOM AG.  All rights reserved.
 *
 * This software is provided as-is and is subject to change; no warranties
 * are made.  All use is at your own risk.  No liability or responsibility
 * is assumed.
 *
 * For V39, the boopsi frameiclass imageclass has been extended to
 * support a bunch of system-standard frames.  This demo shows
 * the default frame, the standard button frame, the ridge, and
 * the icon drop box, and shows the indentation feature.
 */

/*------------------------------------------------------------------------*/

#include <intuition/intuitionbase.h>
#include <intuition/imageclass.h>
#include <graphics/gfxbase.h>

#include <clib/intuition_protos.h>
#include <clib/exec_protos.h>

#include <stdlib.h>

/*------------------------------------------------------------------------*/

void bail_out(int code);

/*------------------------------------------------------------------------*/

struct NewWindow newwin =
    {
    0,0,		/*  LeftEdge, TopEdge */
    600,200,            /*  Width, Height */
    (UBYTE)-1, (UBYTE)-1,               /*  DetailPen, BlockPen */
    IDCMP_CLOSEWINDOW | IDCMP_REFRESHWINDOW,	/*  IDCMPFlags */
    WFLG_DRAGBAR | WFLG_SIZEGADGET | WFLG_DEPTHGADGET | WFLG_CLOSEGADGET |
    WFLG_ACTIVATE|WFLG_SMART_REFRESH,	/* Flags */
    NULL,		/*  FirstGadget */
    NULL,		/*  CheckMark */
    (UBYTE *) "FrameIClass Demo",	/*  Title */
    NULL,		/*  Screen */
    NULL,		/*  BitMap */
    100,50,		/*  MinWidth, MinHeight */
    640,200,		/*  MaxWidth, MaxHeight */
    WBENCHSCREEN,	/*  Type */
    };

/*------------------------------------------------------------------------*/

struct GfxBase *GfxBase;
struct IntuitionBase *IntuitionBase;
struct Window *win;
struct Image *frame;

/*------------------------------------------------------------------------*/

main()
    {
    BOOL terminated;
    struct IntuiMessage *imsg;
    long frametype, recessed;

    terminated = FALSE;
    win = NULL;

    if (!(GfxBase = (struct GfxBase *)
	OpenLibrary("graphics.library",39L)))
	bail_out(20);

    if (!(IntuitionBase = (struct IntuitionBase *)
	OpenLibrary("intuition.library",39L)))
	bail_out(20);

    if (!(win = OpenWindow(&newwin)))
	bail_out(20);

    for ( recessed = 0; recessed <= 1; recessed++ )
    {
	for ( frametype = 0; frametype <= 3; frametype++ )
	{
	    if ( !( frame = NewObject( NULL, "frameiclass",
		IA_FrameType, frametype,
		IA_Recessed, recessed,
		IA_Width, 80,
		IA_Height, 20,
		TAG_DONE ) ) )
		bail_out(20);

	    DrawImage( win->RPort, frame, 20 + frametype*100,
		win->WScreen->Font->ta_YSize + 12 + recessed*30 );
	}
    }
    while (!terminated)
	{
	Wait (1 << win->UserPort->mp_SigBit);
	while (imsg = (struct IntuiMessage *) GetMsg(win->UserPort))
	    {
	    if (imsg->Class == IDCMP_CLOSEWINDOW)
		terminated = TRUE;
	    else if (imsg->Class == IDCMP_REFRESHWINDOW)
		{
		BeginRefresh(win);
		EndRefresh(win,TRUE);
		}
	    ReplyMsg((struct Message *) imsg);
	    }
	}
    bail_out(0);
    }


/*------------------------------------------------------------------------*/

/*/ bail_out()
 *
 * Close any allocated or opened stuff.
 */

void bail_out(code)

    int code;
    {
    if (frame)
	DisposeObject(frame);

    if (win)
	CloseWindow(win);

    if (IntuitionBase)
	CloseLibrary(IntuitionBase);

    if (GfxBase)
	CloseLibrary(GfxBase);

    exit(code);
    }


/*------------------------------------------------------------------------*/
