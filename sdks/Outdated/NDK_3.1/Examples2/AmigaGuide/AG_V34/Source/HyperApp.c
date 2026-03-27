/* HyperApp.c
 */

#include <exec/types.h>
#include <exec/libraries.h>
#include <intuition/intuition.h>
#include <graphics/gfx.h>
#include <graphics/text.h>
#include <libraries/amigaguide.h>
#include <clib/alib_protos.h>
#include <clib/exec_protos.h>
#include <clib/intuition_protos.h>
#include <clib/graphics_protos.h>
#include <clib/amigaguide_protos.h>
#include <pragmas/amigaguide_pragmas.h>
#include <stdio.h>
#include <string.h>

#define	DB(x)	;

struct AppInfo
{
    struct Window *ai_Window;				/* Window pointer */
    BOOL ai_Done;					/* Done yet? */
    AMIGAGUIDECONTEXT ai_AmigaGuide;			/* Pointer to the AmigaGuide context */
    LONG ai_Region;					/* Region that the mouse if over */
    struct TextFont *ai_Font;				/* Window font */
};

struct FuncTable
{
    VOID (*ft_Func) (struct AppInfo *);
};

struct EMenuItem
{
    struct MenuItem em_MenuItem;			/* Embedded menu structure */
    LONG em_MenuID;					/* Menu ID */
};

extern struct Library *SysBase, *DOSBase;
struct Library *IntuitionBase, *GfxBase, *AmigaGuideBase;

VOID MainFunc (struct AppInfo *);
VOID QuitFunc (struct AppInfo *);
VOID GadgetFunc (struct AppInfo *);
VOID OkayFunc (struct AppInfo *);
VOID CancelFunc (struct AppInfo *);

/* Context ID's to be sent to AmigaGuide */
STRPTR context[] =
{
    "MAIN",
    "QUIT",
    "GADGET",
    "OKAY",
    "CANCEL",
    NULL
};

/* Simple little prompts to display within the application window */
STRPTR quickhelp[] =
{
    "HyperApp Main Window",
    "",
    "Transmogrify Objects",
    "Positive Quit",
    "Negative Quit",
    NULL
};

struct FuncTable Funcs[] =
{
    MainFunc,
    QuitFunc,
    GadgetFunc,
    OkayFunc,
    CancelFunc,
    NULL
};

struct TextAttr TOPAZ8 =
{(STRPTR) "topaz.font", 8, 0, 0};

struct IntuiText IText3 =
{
    0, 0, JAM1, 2, 1, &TOPAZ8, "Quit", NULL
};

struct EMenuItem MenuItem1 =
{
    NULL, 0, 0, 142, 9, ITEMTEXT | COMMSEQ | ITEMENABLED | HIGHCOMP,
    0, (APTR) & IText3, NULL, 'Q', NULL, MENUNULL, 1L
};

struct Menu Menu1 =
{
    NULL, 2, 0, 64, 0, MENUENABLED, "Project", (struct MenuItem *) & MenuItem1
};

SHORT BData1[] =
{0, 0, 94, 0, 94, 13, 0, 13, 0, 0};
SHORT BData2[] =
{0, 0, 94, 0, 94, 13, 0, 13, 0, 0};

struct Border Border1 =
{0, 0, 1, 0, JAM1, 5, BData1, NULL};
struct Border Border2 =
{0, 0, 1, 0, JAM1, 5, BData2, NULL};

struct IntuiText IText1 =
{1, 0, JAM2, 26, 3, &TOPAZ8, "Cancel", NULL};
struct IntuiText IText2 =
{1, 0, JAM2, 40, 3, &TOPAZ8, "OK", NULL};

struct Gadget Gadget3 =
{
    NULL, -120, -18, 95, 14, GRELBOTTOM | GRELRIGHT, RELVERIFY, BOOLGADGET,
    (APTR) & Border1, NULL, &IText1, NULL, NULL, 4L, NULL
};

struct Gadget Gadget2 =
{
    &Gadget3, 12, -18, 95, 14, GRELBOTTOM, RELVERIFY, BOOLGADGET,
    (APTR) & Border2, NULL, &IText2, NULL, NULL, 3L, NULL
};

struct Gadget Gadget1 =
{
    &Gadget2, 12, 27, -40, -48, GADGHCOMP | GRELWIDTH | GRELHEIGHT | SELECTED,
    TOGGLESELECT | RELVERIFY, BOOLGADGET, NULL, NULL, NULL, NULL, NULL,
    2L, NULL
};

struct TagItem WinTags[] =
{
    WA_MenuHelp, TRUE,
    TAG_DONE,
};

/* NewWindow Structures */
struct ExtNewWindow NewWindowStructure1 =
{
    0, 0, 640, 100, (UBYTE)-1, (UBYTE)-1,
    IDCMP_RAWKEY | IDCMP_CLOSEWINDOW | IDCMP_MENUPICK | IDCMP_MENUHELP |
    IDCMP_GADGETUP | IDCMP_MOUSEMOVE,
    WINDOWSIZING | WINDOWDRAG | WINDOWDEPTH | WINDOWCLOSE | WFLG_REPORTMOUSE |
    SIZEBRIGHT | ACTIVATE | NOCAREREFRESH | WFLG_NW_EXTENDED,
    &Gadget1, NULL, "HyperApp (Press HELP over Gadget or Menu)", NULL, NULL,
    320, 50, 65535, 65535, WBENCHSCREEN, WinTags,
};

/* Determine if a point is within a rectangle */
ULONG PointInBox (WORD x, WORD y, struct IBox * box)
{

    if ((x >= box->Left) &&
	(x <= (box->Left + box->Width)) &&
	(y >= box->Top) &&
	(y <= (box->Top + box->Height)))
    {
	return (1L);
    }

    return (0L);
}

/* Find the rectangle of a gadget */
VOID gadgetBox (struct Gadget * g, struct IBox * domain, struct IBox * box)
{

    /* Set the 'normal' rectangle */
    box->Left = g->LeftEdge;
    box->Top = g->TopEdge;
    box->Width = g->Width;
    box->Height = g->Height;

    /* Check for relativity */
    if (g->Flags & GRELRIGHT)
	box->Left += domain->Width - 1;
    if (g->Flags & GRELBOTTOM)
	box->Top += domain->Height - 1;
    if (g->Flags & GRELWIDTH)
	box->Width += domain->Width;
    if (g->Flags & GRELHEIGHT)
	box->Height += domain->Height;
}

/* Process menu events */
VOID HandleMenuEvent (struct IntuiMessage * msg)
{
    struct Window *win = msg->IDCMPWindow;
    struct AppInfo *ai = (struct AppInfo *) win->UserData;
    UWORD selection = msg->Code;
    struct EMenuItem *item;

    /* Turn off the menu button */
    win->Flags |= RMBTRAP;

    /* Process all menu events */
    while (selection != MENUNULL)
    {
	/* Get the MenuItem structure address */
	if (item = (struct EMenuItem *)
	    ItemAddress (win->MenuStrip, (LONG) selection))
	{
	    (*(Funcs[item->em_MenuID].ft_Func)) (ai);

	    /* Get the next selection */
	    selection = item->em_MenuItem.NextSelect;
	}
	else
	{
	    selection = MENUNULL;
	}
    }

    /* Turn menu events back on. */
    win->Flags &= ~RMBTRAP;
}

/* Process MenuHelp events */
VOID HandleMenuHelp (struct IntuiMessage * msg)
{
    struct Window *win = msg->IDCMPWindow;
    struct AppInfo *ai = (struct AppInfo *) win->UserData;
    struct EMenuItem *item;
    WORD mnum, inum, snum;

    mnum = MENUNUM (msg->Code);
    inum = ITEMNUM (msg->Code);
    snum = SUBNUM (msg->Code);

    printf ("m %d i %d s %d\n", mnum, inum, snum);

    /* Get the MenuItem structure address */
    if (item = (struct EMenuItem *)
	ItemAddress (win->MenuStrip, (LONG) msg->Code))
    {
	/* Set the AmigaGuide context */
	SetAmigaGuideContext (ai->ai_AmigaGuide, item->em_MenuID, NULL);

	/* Display the node */
	SendAmigaGuideContext (ai->ai_AmigaGuide, NULL);
    }
    else
    {
	/* No selectable item where help was pressed */
	printf ("No item here\n");
    }
}

/* Process MouseMove events */
VOID HandleMouseMove (struct IntuiMessage * msg)
{
    struct Window *win = msg->IDCMPWindow;
    struct AppInfo *ai = (struct AppInfo *) win->UserData;
    struct Gadget *gad = win->FirstGadget;
    struct IBox box;
    LONG region;

    if ((msg->MouseX < 0) || (msg->MouseX > win->Width) ||
	(msg->MouseY < 0) || (msg->MouseY > win->Height))
    {
	region = -1L;
    }
    else
    {
	region = 0L;

	/* Step through the gadgets to see which one the pointer was over */
	while (gad && (region == 0L))
	{
	    /* Calculate the gadget rectangle */
	    gadgetBox (gad, (struct IBox *) & (win->LeftEdge), &box);

	    /* Is the pointer within this gadget? */
	    if (PointInBox (msg->MouseX, msg->MouseY, &box))
	    {
		/* Is it a system gadget? */
		if (!(gad->GadgetType & GTYP_SYSGADGET))
		{
		    /* Set the region */
		    region = (LONG) gad->GadgetID;
		}
	    }

	    /* Get the next gadget */
	    gad = gad->NextGadget;
	}
    }

    if (region != ai->ai_Region)
    {
	WORD tx, ty;
	WORD bx, by;

	tx = win->BorderLeft + 8;
	ty = win->BorderTop + 2;
	bx = win->Width - (win->BorderRight + 8);
	by = ty + win->RPort->TxHeight;

	SetDrMd (win->RPort, JAM1);

	/* Clear the quick help region */
	SetAPen (win->RPort, 0);
	RectFill (win->RPort, tx, ty, bx, by);

	/* Remember the region */
	ai->ai_Region = region;

	/* Display the quick help if within the window */
	if (region >= 0)
	{
	    SetAPen (win->RPort, 1);
	    Move (win->RPort, tx, ty + win->RPort->TxBaseline);
	    Text (win->RPort, quickhelp[region], strlen (quickhelp[region]));
	}
    }
}

/* Process GadgetHelp events */
VOID HandleGadgetHelp (struct IntuiMessage * msg)
{
    struct Window *win = msg->IDCMPWindow;
    struct AppInfo *ai = (struct AppInfo *) win->UserData;
    struct Gadget *gad = win->FirstGadget;
    struct IBox box;
    LONG region;

    region = 0L;

    /* Step through the gadgets to see which one the pointer was over */
    while (gad && (region == 0L))
    {
	/* Calculate the gadget rectangle */
	gadgetBox (gad, (struct IBox *) & (win->LeftEdge), &box);

	/* Is the pointer within this gadget? */
	if (PointInBox (msg->MouseX, msg->MouseY, &box))
	{
	    /* Is it a system gadget? */
	    if (gad->GadgetType & GTYP_SYSGADGET)
	    {
		ULONG sys;

		/* Which system gadget? */
		sys = (ULONG) ((gad->GadgetType & 0xF0) / 16);

		/* Set the region */
		region = HTFC_SYSGADS + sys;
	    }
	    else
	    {
		/* Set the region */
		region = (LONG) gad->GadgetID;
	    }
	}

	/* Get the next gadget */
	gad = gad->NextGadget;
    }

    /* Set the AmigaGuide context. */
    SetAmigaGuideContext (ai->ai_AmigaGuide, region, NULL);

    /* Display the current node */
    SendAmigaGuideContext (ai->ai_AmigaGuide, NULL);
}

/* Process Gadget events */
VOID HandleGadgetEvent (struct IntuiMessage * msg)
{
    struct Window *win = msg->IDCMPWindow;
    struct AppInfo *ai = (struct AppInfo *) win->UserData;
    struct Gadget *gad = (struct Gadget *) msg->IAddress;

    if (gad)
    {
	(*(Funcs[gad->GadgetID].ft_Func)) (ai);
    }
}

/* Process Intuition messages */
VOID HandleIDCMP (struct AppInfo * ai)
{
    struct Window *win = ai->ai_Window;
    struct IntuiMessage *imsg;

    while (imsg = (struct IntuiMessage *) GetMsg (win->UserPort))
    {
	switch (imsg->Class)
	{
	    case IDCMP_MOUSEMOVE:
		HandleMouseMove (imsg);
		break;

	    case IDCMP_CLOSEWINDOW:
		ai->ai_Done = TRUE;
		break;

	    case IDCMP_MENUPICK:
		HandleMenuEvent (imsg);
		break;

	    case IDCMP_MENUHELP:
		HandleMenuHelp (imsg);
		break;

	    case IDCMP_GADGETUP:
		HandleGadgetEvent (imsg);
		break;

	    case IDCMP_RAWKEY:
		if (imsg->Code == 95)
		{
		    HandleGadgetHelp (imsg);
		}

		break;
	}

	/* Reply to the message */
	ReplyMsg ((struct Message *) imsg);
    }
}

VOID DisplayError (LONG err)
{

    printf ("%s\n", GetAmigaGuideString (err));
}

STRPTR err_type[] =
{
    "NO ERROR",
    "HTERR_NOT_ENOUGH_MEMORY",
    "HTERR_CANT_OPEN_DATABASE",
    "HTERR_CANT_FIND_NODE",
    "HTERR_CANT_OPEN_NODE",
    "HTERR_CANT_OPEN_WINDOW",
    "HTERR_INVALID_COMMAND",
    "HTERR_CANT_COMPLETE",
    "HTERR_PORT_CLOSED",
    "HTERR_CANT_CREATE_PORT",
    NULL
};

STRPTR msg_type[] =
{
    "<unknown>",
    "StartupMsgID",
    "LoginToolID",
    "LogoutToolID",
    "ShutdownMsgID",
    "ActivateToolID",
    "DeactivateToolID",
    "ActiveToolID",
    "InactiveToolID",
    "ToolStatusID",
    "ToolCmdID",
    "ToolCmdReplyID",
    "ShutdownToolID",
    NULL
};

VOID display_msg (struct AmigaGuideMsg * msg)
{
    LONG type, err;

    type = msg->agm_Type - StartupMsgID + 1;
    err = msg->agm_Sec_Ret - HTERR_NOT_ENOUGH_MEMORY + 1;

    if (err < 0)
	err = 0;

    if (type < 0)
	type = 0;

    if (msg->agm_Msg.mn_Node.ln_Type == NT_REPLYMSG)
    {
	DB (kprintf ("Reply "));
    }
    else if (msg->agm_Msg.mn_Node.ln_Type == NT_MESSAGE)
    {
	DB (kprintf ("Message "));
    }
    else
    {
	DB (kprintf ("Unknown "));
    }

    DB (kprintf ("%s : %s\n", msg_type[type], err_type[err]));
}

/* Process AmigaGuide messages */
VOID HandleAmigaGuide (struct AppInfo * ai)
{
    struct AmigaGuideMsg *agm;

    /* process amigaguide messages */
    while (agm = GetAmigaGuideMsg (ai->ai_AmigaGuide))
    {
	DB (display_msg (agm));

	/* check message types */
	switch (agm->agm_Type)
	{
		/* AmigaGuide is ready for us */
	    case ActiveToolID:
		break;

		/* This is a reply to our cmd */
	    case ToolCmdReplyID:
		if (agm->agm_Pri_Ret)
		{
		    DisplayError (agm->agm_Sec_Ret);
		}
		break;

		/* This is a status message */
	    case ToolStatusID:
		if (agm->agm_Pri_Ret)
		{
		    DisplayError (agm->agm_Sec_Ret);
		}
		break;

		/* Shutdown message */
	    case ShutdownMsgID:
		if (agm->agm_Pri_Ret)
		{
		    DisplayError (agm->agm_Sec_Ret);
		}
		break;

	    default:
		break;
	}

	/* Reply to the message */
	ReplyAmigaGuideMsg (agm);
    }
}

main (int argc, char **argv)
{
    struct NewAmigaGuide nag = {NULL};
    struct AppInfo ai = {NULL};

    /* Initialize the global data */
    ai.ai_Region = -1;

    /* Open Intuition library */
    IntuitionBase = OpenLibrary ("intuition.library", 0);

    /* Open the graphics library */
    GfxBase = OpenLibrary ("graphics.library", 0);

    /* amigaguide.library works with 1.3 and newer versions of the OS */
    if (AmigaGuideBase = OpenLibrary ("amigaguide.library", 33))
    {
	/* Open the window font */
	if (ai.ai_Font = OpenFont (&TOPAZ8))
	{
	    /* Open the window */
	    if (ai.ai_Window = OpenWindow (&NewWindowStructure1))
	    {
		ULONG sigr = 0L, sigi = 0L, sigb = 0L;

		/* Set the window font */
		SetFont (ai.ai_Window->RPort, ai.ai_Font);

		/* Set the menu */
		SetMenuStrip (ai.ai_Window, &Menu1);

		/* Remember the AppInfo */
		ai.ai_Window->UserData = (APTR) & ai;

		/* Show that we're not done running the application yet */
		ai.ai_Done = FALSE;

		/* Set the application base name */
		nag.nag_BaseName = "HyperApp";

		/* Set the document name */
		nag.nag_Name = "hyperapp.guide";

		/* establish the base name to use for hypertext ARexx port */
		nag.nag_ClientPort = "AGAPP_HELP";

		/* Set up the context table */
		nag.nag_Context = context;

		/* Open the help system */
		ai.ai_AmigaGuide = OpenAmigaGuideAsync (&nag, NULL);

		/* Get our signal bits */
		sigb = AmigaGuideSignal (ai.ai_AmigaGuide);
		sigi = (1L << ai.ai_Window->UserPort->mp_SigBit);

		/* Clear the AmigaGuide context */
		SetAmigaGuideContext (ai.ai_AmigaGuide, 0L, NULL);

		/* Continue until done */
		while (!(ai.ai_Done))
		{
		    /* Wait for something to happen */
		    sigr = Wait (sigb | sigi);

		    /* Process Intuition messages */
		    if (sigr & sigi)
		    {
			HandleIDCMP (&ai);
		    }

		    /* Process AmigaGuide messages */
		    if (sigr & sigb)
		    {
			HandleAmigaGuide (&ai);
		    }
		}

		/* Shutdown the help system */
		CloseAmigaGuide (ai.ai_AmigaGuide);

		/* Do we have a menu? */
		if (ai.ai_Window->MenuStrip)
		{
		    /* Clear it */
		    ClearMenuStrip (ai.ai_Window);
		}

		/* Close the application window */
		CloseWindow (ai.ai_Window);
	    }

	    /* Close the font */
	    CloseFont (ai.ai_Font);
	}

	/* close the library */
	CloseLibrary (AmigaGuideBase);
    }

    CloseLibrary (GfxBase);
    CloseLibrary (IntuitionBase);
}

VOID MainFunc (struct AppInfo * ai)
{

    printf ("I don't do anything...\n");
}

VOID QuitFunc (struct AppInfo * ai)
{

    /* All done, guys */
    ai->ai_Done = TRUE;
}

VOID GadgetFunc (struct AppInfo * ai)
{

    printf ("Pressed the big gadget\n");
}

VOID OkayFunc (struct AppInfo * ai)
{

    /* All done, guys */
    ai->ai_Done = TRUE;
}

VOID CancelFunc (struct AppInfo * ai)
{

    /* All done, guys */
    ai->ai_Done = TRUE;
}
