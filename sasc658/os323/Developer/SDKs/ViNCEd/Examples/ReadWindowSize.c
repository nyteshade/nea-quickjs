/*********************************************************
 ** ReadWindowSize                                      **
 **                                                     **
 ** An example source how to read the window size       **
 ** in characters using CSI sequences (correctly)       **
 ** © 24.05.2001, THOR                                  **
 ** Thomas Richter                                      **
 *********************************************************/

/// Includes
#include <exec/types.h>
#include <dos/dos.h>
#include <dos/dosextens.h>

#include <proto/exec.h>
#include <proto/dos.h>
///
/// Defines
#define COOKED_MODE     0
#define RAW_MODE        1
#define MAX_DELAY       (5*1000*1000)
///
/// Protos
BOOL WindowSize(BPTR stream,LONG *width,LONG *height);
BOOL CursorPosition(BPTR stream,LONG *x,LONG *y);
BOOL ParsePosition(BPTR file,char answer,LONG *width,LONG *height);
///
/// Statics
char version[]="$VER: ReadWindowSize 1.00 (4.7.2000) © THOR";
extern struct DosLibrary *DOSBase;      /* This is filled in by the startup code */
///

/// Sample main program
int main(int argc,char **argv)
{
LONG width,height;

        if (WindowSize(Output(),&width,&height)) {
                Printf("The window size is %ld x %ld characters.\n",width,height);
                return 0;
        }

        Printf("Could not obtain the window size.\n");
        return 5;
}
///

/// Return the window size in width and height.
BOOL WindowSize(BPTR stream,LONG *width,LONG *height)
{
        if (!ParsePosition(stream,'r',width,height)) {
                /*
                 * Fill in suitable defaults
                 * in case we could not inquiry the
                 * position.
                 */
                if (width)
                        *width = 80;
                if (height)
                        *height = 24;
                return FALSE;
        }
        return TRUE;
}
///
/// Return the cursor position
BOOL CursorPosition(BPTR stream,LONG *x,LONG *y)
{
        if (!ParsePosition(stream,'R',x,y)) {
                /*
                 * Fill in some at least reasonable defaults.
                 * This should be turned into something more
                 * reasonable in your application.
                 */

                if (x)
                        *x = 0;
                if (y)
                        *y = 0;

                return FALSE;
        }
        return TRUE;
}
///
/// Parse a position/size information from the console.
/*
 * file: is the console file or the serial stream to
 * read the position from.
 *
 * "answer" is the expected answer CSI code, expecting two
 * arguments that will be filled into *width and *height.
 *
 */

BOOL ParsePosition(BPTR file,char answer,LONG *width,LONG *height)
{
BOOL success;
BOOL incsi,innum,negative,inesc;
LONG counter;
LONG args[5];
UBYTE in;

        /* the following added for testing
        return FALSE;
        */

        success  = TRUE;
        incsi    = FALSE;
        inesc    = FALSE;
        innum    = FALSE;
        negative = FALSE;
        counter  = 0;

                /* Now send a window borders request to the stream */
        if (answer == 'R') {
                Write(file,"\033[6n",4);
        } else {
                Write(file,"\033[0 q",5);
        }

        /* Now parse an incomming string */
        for(;;) {
                if (WaitForChar(file,MAX_DELAY) == FALSE) {
                        success = FALSE;
                        break;
                }

                if (Read(file,&in,1) != 1) {
                        success = FALSE;
                        break;
                }

                if (incsi) {
                        if ((in<' ') || (in>'~')) {             /* Invalid sequence? */
                                incsi = FALSE;
                        } else if ((in>='0') && (in<='9')) {
                                /* Valid number? */
                                if (innum == FALSE) {
                                        innum = TRUE;
                                        args[counter] = 0;
                                }
                                args[counter] = args[counter]*10+in-'0';
                        } else {
                                /* Abort parsing the number. Install its sign, and let it be. */
                                if (innum) {
                                        if (negative)
                                                args[counter] = -args[counter];
                                        innum    = FALSE;
                                        negative = FALSE;
                                }
                                if ((in>='@') && (in<='~')) {    /* End of sequence? */
                                        if ((in=='r') && (answer=='r') && (counter==3)) {        /* Is it a bounds report? */
                                                if (height)
                                                        *height = args[2]-args[0]+1;
                                                if (width)
                                                        *width  = args[3]-args[1]+1;
                                                break;
                                        }
                                        if ((in=='R') && (answer=='R') && (counter==1)) {       /* Is it a cursor report? */
                                                if (height)
                                                        *height = args[0];
                                                if (width)
                                                        *width  = args[1];
                                                break;
                                        }
                                        incsi = FALSE;          /* Abort sequence */
                                } else if (in==';') {                   /* Argument separator? */
                                        counter++;
                                        if (counter>4) counter=4;       /* Do not parse more than 5 arguments, throw everything else away */
                                        innum    = FALSE;
                                        negative = FALSE;
                                } else if (in=='-') {
                                        if (innum)
                                                incsi = FALSE;  /* minus sign in the middle is invalid */
                                        negative = ~negative;
                                } else if (in==' ') {
                                        /* Ignore SPC prefix */
                                } else {
                                        /* Abort the sequence */
                                        incsi = FALSE;
                                }
                        }
                } else if (inesc) {
                        if (in == '[') {
                                inesc    = FALSE;
                                incsi    = TRUE;   /* found a CSI sequence */
                                innum    = FALSE;  /* but not yet a valid number */
                                negative = FALSE;
                                counter  = 0;
                                args[0]  = args[1]=args[2]=args[3]=args[4] = 1;
                        } else if ((in >= ' ') && (in <= '/')) {
                                /* ignore the ESC sequence contents */
                        } else {
                                inesc    = FALSE;  /* terminate the ESC sequence */
                        }
                } else if (in == 0x9B) {
                                incsi    = TRUE;   /* found a CSI sequence */
                                innum    = FALSE;  /* but not yet a valid number */
                                negative = FALSE;
                                counter  = 0;
                                args[0]  = args[1]=args[2]=args[3]=args[4] = 1;
                } else if (in == 0x1B) {
                                inesc    = TRUE;  /* found an ESC sequence */
                } /* Everything else is thrown away */
        }

        return success;
}
///
