/*****************************************************************
 ** GetWindowPointer                                            **
 ** Get the intuition window of a console handler               **
 **-------------------------------------------------------------**
 ** This program demonstrates how to read the intuition window  **
 ** of a console handler in a way that doesn't break            **
 ** iconification.                                              **
 **                                                             **
 ** Version 1.01 24 Aug 2000            © 2000 THOR-Software    **
 ** Thomas Richter                                              **
 *****************************************************************/

#include <exec/types.h>
#include <exec/memory.h>
#include <dos/dos.h>
#include <dos/dosextens.h>
#include <intuition/intuition.h>

#include <vnc/packets.h>

#include <proto/exec.h>
#include <proto/dos.h>
#include <proto/graphics.h>

struct GfxBase *GfxBase;


#define CON_ID  (('C'<<24L)|('O'<<16L)|('N'<<8L))
#define RAW_ID  (('R'<<24L)|('A'<<16L)|('W'<<8L))

/* Prototypes */
struct Window *FindConsoleWindow(BPTR file);
void ReleaseConsoleWindow(BPTR file);

int main(int argc,char **argv)
{
struct Window *win;
struct RastPort *rp;
long xmin,ymin,xmax,ymax;
long deltax,deltay;
long x1,y1,x2,y2;

/* first, open the required libraries */

        if (GfxBase=(struct GfxBase *)OpenLibrary("graphics.library",37L)) {

/* read the window pointer */

                if (win=FindConsoleWindow(Output())) {

/* Draw some graphics in this window.
   This requires some slight modifications if the window is a
   GZZ window, but so what. It's for demonstration anyways. */

                        xmin = win->BorderLeft;
                        ymin = win->BorderTop;
                        xmax = win->Width-win->BorderRight;
                        ymax = win->Height-win->BorderBottom;
                        deltax = (xmax-xmin+1)/16;
                        deltay = (ymax-ymin+1)/16;

                        x1 = xmin;
                        y1 = ymin;
                        x2 = xmin;
                        y2 = ymax;

                        rp =win->RPort;

                        SetAPen(rp,2L);

                        while (y1<ymax && x2<xmax) {
                                Move(rp,x1,y1);
                                Draw(rp,x2,y2);
                                y1 += deltay;
                                x2 += deltax;
                        }

                        x1 = xmin;
                        y1 = ymax;
                        x2 = xmax;
                        y2 = ymax;

                        while (x1<=xmax && y2>=ymin) {
                                Move(rp,x1,y1);
                                Draw(rp,x2,y2);
                                x1 += deltax;
                                y2 -= deltay;
                        }

                        x1 = xmax;
                        y1 = ymax;
                        x2 = xmax;
                        y2 = ymin;

                        while (y1>=ymin && x2>=xmin) {
                                Move(rp,x1,y1);
                                Draw(rp,x2,y2);
                                y1 -= deltay;
                                x2 -= deltax;
                        }

                        x1 = xmax;
                        y1 = ymin;
                        x2 = xmin;
                        y2 = ymin;

                        while (x1>=xmin && y2<=ymax) {
                                Move(rp,x1,y1);
                                Draw(rp,x2,y2);
                                x1 -= deltax;
                                y2 += deltay;
                        }

/* And now the MOST important thing: RELEASE the window pointer */

                        ReleaseConsoleWindow(Output());
                } else  Printf("The output stream is no console window.\n");
        } else Printf("Can't open the graphics library, V37.\n");

        return 0;
}

/* This routine finds the intuition window accociated to a console
   stream. It returns NULL in case the stream is no console stream.
   In case the stream IS a console, this MUST be matched by a
   ReleaseConsoleWindow() call or the window won't be able to get
   iconfied again.

   INPUTS:      A BPTR to a filehandle
   OUTPUTS:     A pointer to a intuition window, or NULL.
*/

struct Window *FindConsoleWindow(BPTR file)
{
struct FileHandle *fh;
struct InfoData *info;
struct Window *win=NULL;		/* Forgot to NULL this in 1.00. Sigh. */
long error = ERROR_OBJECT_WRONG_TYPE;

        if (fh=BADDR(file)) {

                /* We MUST check if fh->fh_Type points to a valid port.
                   This might be NULL in case you got a handle to the
                   NIL: handler */

                if (fh->fh_Type) {

                        /* Allocate a struct InfoData. We can't take this
                           from stack because it must be long word aligned */

                        if (info=AllocMem(sizeof(struct InfoData),MEMF_PUBLIC | MEMF_CLEAR)) {

                                /* Send the packet to the handler */

                                if (DoPkt(fh->fh_Type,ACTION_DISK_INFO,MKBADDR(info),0L,0L,0L,0L)) {

                                        /* Check whether this is a console */

                                        if (info->id_DiskType==CON_ID || info->id_DiskType==RAW_ID) {

                                                /* Extract the window */

                                                win = (struct Window *)(info->id_VolumeNode);
                                                error = 0;

                                                /* More information is available here. For example,
                                                   info->id_InUse
                                                   points to an IORequest for communications with
                                                   the console device. However, its use is dis-
                                                   couraged since ViNCEd windows operate independently
                                                   to the console device at all. This will point to
                                                   a usable console IOStdReq, but sending out any
                                                   commands with this IORequest will result in a mess.
                                                   Moreover, since more than one task could request
                                                   this packet at a time, you shouldn't use this
                                                   struct IORequest at all.
                                                   You may extract a pointer to the console device unit
                                                   like this:

                                                   conunit = (struct ConUnit *)((struct IOStdReq *)id->id_InUse)->io_Unit;

                                                   However, the use of this unit is discouraged, too,
                                                   since it has no meaning for ViNCEd. It tries, however,
                                                   to keep the information in this unit consistent, at least
                                                   partially. You MAY extract the keyboard and the TAB stop
                                                   positions from there, but not much more. */

                                        }
                                }

                                /* Now release the memory */
                                FreeMem(info,sizeof(struct InfoData));
                        } else error=ERROR_NO_FREE_STORE;
                }
        }

/* Set some useful error code */

        SetIoErr(error);
        return win;
}



/* This routine releases the intuition window obtained before with
   FindConsoleWindow(). It MUST be called if FindConsoleWindow()
   returned NON-NULL. Failure to do so will disable iconification and
   the AUTO ability of the console.

   INPUTS:      A file handle

*/

void ReleaseConsoleWindow(BPTR file)
{
struct FileHandle *fh;
long error=ERROR_OBJECT_WRONG_TYPE;

        if (fh=BADDR(file)) {
                /* Check whether this is a NIL handle or not */
                if (fh->fh_Type) {
                        /* If not, we simply send an ACTION_UNDISK_INFO
                           to the handler. In case of the ordinary
                           CON: handler, this will simply return an
                           error code. However, for ViNCEd, this will work
                           as it should and release the window */

                        DoPkt(fh->fh_Type,ACTION_UNDISK_INFO,0L,0L,0L,0L,0L);
                        error=0;
                }
        }

        SetIoErr(error);
}
