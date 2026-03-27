/*  maxdepthlores.c
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

void Quit(char *whytext,LONG failcode)
{
    if(*whytext) printf("%s\n",whytext);

    if (IntuitionBase)	CloseLibrary(IntuitionBase);
    if (GfxBase)	CloseLibrary(GfxBase);

    exit(failcode);
}

void main(void)
{
    ULONG modeID = LORES_KEY;
    DisplayInfoHandle displayhandle;
    struct DimensionInfo dimensioninfo;

    UWORD maxdepth, maxcolors;
    ULONG soerror = NULL,colornum;
    struct Screen *screen;

    if ((GfxBase = OpenLibrary("graphics.library",36))==NULL)
        Quit("graphics.library is too old <V36",RETURN_FAIL);

    if ((IntuitionBase = OpenLibrary("intuition.library",36))==NULL)
        Quit("intuition.library is too old <V36",RETURN_FAIL);

    if ((displayhandle=FindDisplayInfo(modeID))==NULL)
        Quit("modeID not found in display database",RETURN_FAIL);

    if (GetDisplayInfoData(displayhandle,(UBYTE *) &dimensioninfo,
    sizeof(struct DimensionInfo),DTAG_DIMS,NULL)==0)
        Quit("mode dimension info not available",RETURN_FAIL);

    maxdepth=dimensioninfo.MaxDepth;
    printf("dimensioninfo.MaxDepth=%d\n",(int) maxdepth);

    if (screen=OpenScreenTags(NULL, SA_DisplayID    ,modeID,
                                    SA_Depth        ,(UBYTE) maxdepth,
                                    SA_Title        ,"MaxDepth LORES",
                                    SA_ErrorCode    ,&soerror,
                                    SA_FullPalette  ,TRUE,
                                    TAG_END))
        {
            /* Zowee! we actually got the screen open!
             * now let's try drawing into it.
             */
            maxcolors=1<<maxdepth;

            printf("maxcolors=%d\n",(int) maxcolors);

            for(colornum=0;colornum<maxcolors;++colornum)
            {
                SetAPen(&(screen->RastPort),colornum);
                Move(&(screen->RastPort),colornum,screen->BarHeight + 2);
                Draw(&(screen->RastPort),colornum,screen->Height - 1);
            }
            Delay(TICKS_PER_SECOND * 6);

            CloseScreen(screen);
        }
    else
        {   /* Hmmm.  Couldn't open the screen.  maybe not
             * enough CHIP RAM? Maybe not enough chips! ;-)
             */
            switch(soerror)
            {
                case OSERR_NOCHIPS:
                    Quit("Bummer! You need new chips dude!",RETURN_FAIL);
                    break;

                case OSERR_UNKNOWNMODE:
                    Quit("Bummer! Unknown screen mode.",RETURN_FAIL);
                    break;

                case OSERR_NOCHIPMEM:
                    Quit("Not enough CHIP memory.",RETURN_FAIL);
                    break;

                case OSERR_NOMEM:
                    Quit("Not enough FAST memory.",RETURN_FAIL);
                    break;

                default:
                    printf("soerror=%d\n",soerror);
                    Quit("Screen opening error.",RETURN_FAIL);
                    break;
            }
            Quit("Couldn't open screen.",RETURN_FAIL);
        }

Quit("",RETURN_OK);	/* clean up and exit */
}
