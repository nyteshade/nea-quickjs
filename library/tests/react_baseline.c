/*
 * react_baseline.c — minimal pure-C Reaction button test.
 *
 * Mirrors examples/react_hello.js exactly: a centered window with two
 * buttons (Say hi / Quit), driven through WM_HANDLEINPUT until close
 * gadget or Quit button. Built with VBCC + Reaction macros, no JS
 * involvement at all.
 *
 * Purpose: known-working baseline to A/B against the JS wrapper. If
 * this prints "WMHI_GADGETUP id=..." on each button click, the JS
 * wrapper is what's broken. If THIS is also silent, our entire
 * understanding of Reaction event flow on this OS3.2 build is wrong.
 *
 * Build:  make -f Makefile.react_baseline
 *         (produces amiga/c/react_baseline)
 *
 * Run on Amiga:  react_baseline
 */
#define _USEOLDEXEC_ 1

#include <exec/types.h>
#include <intuition/intuition.h>
#include <intuition/icclass.h>
#include <intuition/gadgetclass.h>
#include <intuition/classes.h>

#include <gadgets/button.h>
#include <gadgets/layout.h>
#include <classes/window.h>
#include <reaction/reaction.h>
#include <reaction/reaction_macros.h>

#include <proto/exec.h>
#include <proto/intuition.h>
#include <proto/dos.h>
#include <proto/utility.h>
#include <proto/button.h>
#include <proto/layout.h>
#include <proto/window.h>

#include <stdio.h>

extern struct ExecBase     *SysBase;
struct Library             *IntuitionBase;
struct Library             *UtilityBase;
struct Library             *WindowBase;
struct Library             *LayoutBase;
struct Library             *ButtonBase;

enum { GID_B1 = 1, GID_B2 = 2 };

static const char ver[] = "$VER: react_baseline 0.1 (21.4.2026)";

int main(void)
{
    Object        *winObj  = NULL;
    struct Window *win     = NULL;
    ULONG          sigMask = 0;
    BOOL           done    = FALSE;
    UWORD          code    = 0;
    ULONG          result;
    int            rc      = 0;

    IntuitionBase = OpenLibrary("intuition.library", 39);
    UtilityBase   = OpenLibrary("utility.library",   39);
    if (!IntuitionBase || !UtilityBase) {
        printf("ERROR: cannot open intuition/utility\n");
        rc = 20; goto cleanup;
    }

    WindowBase = OpenLibrary("window.class",          40);
    LayoutBase = OpenLibrary("gadgets/layout.gadget", 40);
    ButtonBase = OpenLibrary("gadgets/button.gadget", 40);
    if (!WindowBase || !LayoutBase || !ButtonBase) {
        printf("ERROR: cannot open Reaction class libs (W=%p L=%p B=%p)\n",
               (void*)WindowBase, (void*)LayoutBase, (void*)ButtonBase);
        rc = 20; goto cleanup;
    }

    printf("Reaction libs opened.\n");

    winObj = WindowObject,
        WA_Title,           "React Baseline",
        WA_InnerWidth,      260,
        WA_InnerHeight,     100,
        WA_Activate,        TRUE,
        WA_DragBar,         TRUE,
        WA_DepthGadget,     TRUE,
        WA_CloseGadget,     TRUE,
        WINDOW_Position,    WPOS_CENTERSCREEN,
        WINDOW_ParentGroup, VLayoutObject,
            LAYOUT_AddChild, ButtonObject,
                GA_ID,        GID_B1,
                GA_RelVerify, TRUE,
                GA_Text,      "Say hi",
            ButtonEnd,
            LAYOUT_AddChild, ButtonObject,
                GA_ID,        GID_B2,
                GA_RelVerify, TRUE,
                GA_Text,      "Quit",
            ButtonEnd,
        EndGroup,
    EndWindow;

    if (!winObj) {
        printf("ERROR: WindowObject construction failed\n");
        rc = 20; goto cleanup;
    }
    printf("WindowObject ptr=%p\n", (void*)winObj);

    win = (struct Window *)RA_OpenWindow(winObj);
    if (!win) {
        printf("ERROR: RA_OpenWindow returned NULL\n");
        rc = 20; goto cleanup;
    }

    GetAttr(WINDOW_SigMask, winObj, &sigMask);
    printf("Opened. struct Window=%p IDCMPFlags=0x%08lx sigMask=0x%08lx\n",
           (void*)win, win->IDCMPFlags, sigMask);
    printf("Click each button several times, then close the window.\n");

    while (!done) {
        ULONG sig = Wait(sigMask | SIGBREAKF_CTRL_C);

        if (sig & SIGBREAKF_CTRL_C) {
            printf("Ctrl-C\n");
            done = TRUE;
            continue;
        }

        while ((result = RA_HandleInput(winObj, &code)) != WMHI_LASTMSG) {
            ULONG cls  = result & WMHI_CLASSMASK;
            ULONG data = result & WMHI_GADGETMASK;
            printf("WMHI: result=0x%08lx class=%lu data=%lu code=%u\n",
                   result, cls >> 16, data, (unsigned)code);
            switch (cls) {
                case WMHI_CLOSEWINDOW:
                    printf("  CLOSEWINDOW\n");
                    done = TRUE;
                    break;
                case WMHI_GADGETUP:
                    printf("  GADGETUP id=%lu\n", data);
                    if (data == GID_B2) done = TRUE;
                    break;
                default:
                    break;
            }
        }
    }

    printf("Clean exit.\n");

cleanup:
    if (winObj)        DisposeObject(winObj);
    if (ButtonBase)    CloseLibrary(ButtonBase);
    if (LayoutBase)    CloseLibrary(LayoutBase);
    if (WindowBase)    CloseLibrary(WindowBase);
    if (UtilityBase)   CloseLibrary(UtilityBase);
    if (IntuitionBase) CloseLibrary(IntuitionBase);
    return rc;
}
