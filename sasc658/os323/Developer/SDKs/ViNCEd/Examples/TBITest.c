

/*  Titlebar.image test (7.9.98)  */
/*  Written for SAS/C             */
/*  Compile: SC LINK TBITest      */
/*  © 1998 Massimo Tantignone     */
/*  e-mail: tanti@intercom.it     */


#include "exec/types.h"
#include "dos/dos.h"
#include "intuition/intuition.h"
#include "intuition/gadgetclass.h"
#include "intuition/imageclass.h"
#include "libraries/gadtools.h"
#include "proto/intuition.h"
#include "proto/exec.h"

#include <images/titlebar.h>
#include <clib/titlebarimage_protos.h>
#include <pragmas/titlebarimage_pragmas.h>


/* The library base for the "titlebar.image" class library */

struct Library *TitlebarImageBase;


ULONG main(void)
{
   /* The usual stuff */

   struct Screen *scr;
   struct Window *win;
   struct IntuiMessage *imsg;
   struct DrawInfo *dri;
   ULONG class, code, fine = FALSE;
   ULONG width = 640, height = 200;
   struct Gadget *gad;
   struct Image *i;

   /* Let's try to open the "titlebar.image" library any way we can */

   TitlebarImageBase = OpenLibrary("titlebar.image",40L);

   if (!TitlebarImageBase)
      TitlebarImageBase = OpenLibrary("Images/titlebar.image",40L);

   if (!TitlebarImageBase)
      TitlebarImageBase = OpenLibrary("Classes/Images/titlebar.image",40L);

   /* Really not found? Then quit (and complain a bit) */

   if (!TitlebarImageBase) return (RETURN_FAIL);

   /* Inquire about the real screen size */

   if (scr = LockPubScreen(NULL))
   {
      width = scr->Width;
      height = scr->Height;
      UnlockPubScreen(NULL,scr);
   }

   /* Open a window on the default public screen */

   if (win = OpenWindowTags(NULL,WA_Left,(width - 400) / 2,
                                 WA_Top,(height - 250) / 2,
                                 WA_Width,400,WA_Height,250,
                                 WA_CloseGadget,TRUE,
                                 WA_DepthGadget,TRUE,
                                 WA_SizeGadget,TRUE,
                                 WA_DragBar,TRUE,
                                 WA_SimpleRefresh,TRUE,
                                 WA_Activate,TRUE,
                                 WA_Title,"titlebar.image test",
                                 WA_IDCMP,IDCMP_CLOSEWINDOW |
                                          IDCMP_REFRESHWINDOW,
                                 TAG_END))
   {
      /* Get the screen's DrawInfo, it will be useful... */

      if (dri = GetScreenDrawInfo(win->WScreen))
      {
         ULONG a, b, t = 0L;

         /* Show the various image types */

         for (a = 0; a < 3; a++)
         {
            for (b = 0; b < 2; b++)
            {
               if (i = NewObject(NULL,"tbiclass",SYSIA_Which,POPUPIMAGE + t++,
                                                 SYSIA_DrawInfo,dri,
                                                 TAG_END))
               {

                  DrawImageState(win->RPort,i,
                                 50 + a * 100,50 + b * 100,
                                 IDS_NORMAL,dri);

                  DrawImageState(win->RPort,i,
                                 50 + a * 100 + 40,50 + b * 100,
                                 IDS_SELECTED,dri);

                  DrawImageState(win->RPort,i,
                                 50 + a * 100,50 + b * 100 + 40,
                                 IDS_INACTIVENORMAL,dri);

                  DrawImageState(win->RPort,i,
                                 50 + a * 100 + 40,50 + b * 100 + 40,
                                 IDS_INACTIVESELECTED,dri);

                  WaitBlit();

                  DisposeObject(i);
               }
            }
         }

         /* Create an instance of the "tbiclass" image class */

         if (i = NewObject(NULL,"tbiclass",SYSIA_Which,ICONIFYIMAGE,
                                           SYSIA_DrawInfo,dri,
                                           TAG_END))
         {
            /* Attempt to create a gadget and add it to the titlebar */
            /* Of course it will use our new "tbiclass" image        */

            if (gad = NewObject(NULL,"buttongclass",
                                     GA_RelRight,1 - (3 * (i->Width - 1)),
                                     GA_Top,0,
                                     GA_Width,i->Width - 1,
                                     GA_Height,i->Height,
                                     GA_TopBorder,TRUE,
                                     GA_Image,i,
                                     TAG_END))
            {
               AddGList(win,gad,0,1,NULL);
               RefreshGList(gad,win,NULL,1);
            }

            /* Now let's handle the events until the window gets closed */

            while (!fine)
            {
               Wait(1 << win->UserPort->mp_SigBit);

               while (imsg = (struct IntuiMessage *)GetMsg(win->UserPort))
               {
                  class = imsg->Class;
                  code = imsg->Code;
                  ReplyMsg((struct Message *)imsg);

                  if (class == IDCMP_CLOSEWINDOW) fine = TRUE;

                  if (class == IDCMP_REFRESHWINDOW)
                  {
                     BeginRefresh(win);
                     EndRefresh(win,TRUE);
                  }
               }
            }

            /* If the gadget was added, remove it and free it */

            if (gad)
            {
               RemoveGList(win,gad,1);
               DisposeObject(gad);
            }

            /* Free the image */

            DisposeObject(i);
         }

         /* Release the DrawInfo structure */

         FreeScreenDrawInfo(win->WScreen,dri);
      }

      /* Say good-bye to the window... */

      CloseWindow(win);
   }

   /* ... and to the library */

   CloseLibrary(TitlebarImageBase);

   /* We did our job, now let's go home :-) */

   return (RETURN_OK);
}


