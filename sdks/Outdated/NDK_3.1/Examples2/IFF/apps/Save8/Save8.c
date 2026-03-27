/* save8.c  7/92   C. Scheppner CBM
 *
 * requires linkage with several iffp modules - see Makefile
 */
#define INTUI_V36_NAMES_ONLY

#include "iffp/ilbmapp.h"

#ifdef __SASC
void __chkabort(void) {}          /* Disable SAS CTRL-C checking. */
#else
#ifdef LATTICE
void chkabort(void) {}            /* Disable LATTICE CTRL-C checking */
#endif
#endif

void chkmsg(void);
void cleanup(void);
void bye(UBYTE *s,int error);

#define SAVECHANGES

#define MINARGS 2

#include "save8_rev.h"
UBYTE vers[] = VERSTAG;
UBYTE Copyright[] = VERS " Save 8bit RGB demo - Freely Redistributable";

char *usage = "Usage: save8 savename [grayscale]\n";

char *savename;

struct Library *IntuitionBase  = NULL;
struct Library *GfxBase        = NULL;
struct Library *IFFParseBase   = NULL;

/* Note - these fields are also available in the ILBMInfo structure */
struct   Screen         *scr;         /* for ptr to screen structure */
struct   Window         *win;         /* for ptr to window structure */
struct   RastPort       *wrp;         /* for ptr to RastPort  */
struct   ViewPort       *vp;          /* for ptr to Viewport  */

struct   IntuiMessage   *msg;

struct   NewWindow      mynw = {
   0, 0,                                  /* LeftEdge and TopEdge */
   0, 0,                          	  /* Width and Height */
   (UBYTE)-1, (UBYTE)-1,                  /* DetailPen and BlockPen */
   IDCMP_VANILLAKEY | IDCMP_MOUSEBUTTONS, /* IDCMP Flags with Flags below */
   WFLG_BACKDROP | WFLG_BORDERLESS |
   WFLG_SMART_REFRESH | WFLG_NOCAREREFRESH |
   WFLG_ACTIVATE | WFLG_RMBTRAP,
   NULL, NULL,                            /* Gadget and Image pointers */
   NULL,                                  /* Title string */
   NULL,                                  /* Screen ptr null till opened */
   NULL,                                  /* BitMap pointer */
   50, 20,                                /* MinWidth and MinHeight */
   0 , 0,                                 /* MaxWidth and MaxHeight */
   CUSTOMSCREEN                           /* Type of window */
   };


BOOL   FromWb, Done, grayscale;


UBYTE nomem[]  = "Not enough memory\n";
UBYTE noiffh[] = "Can't alloc iff\n";

/* our indexes to reference our frames
 * DEFault, and SCReen
 */
#define DEF	0
#define SCR	1
#define UICOUNT 2

/* For our ILBM frames */
struct ILBMInfo  *ilbms[UICOUNT]  = { NULL };


/* 
 * MAIN 
 */
void main(int argc, char **argv)
   {
   UBYTE ans, c;
   BPTR lock;
   LONG saverror;
   USHORT width, height, depth, bw, bh, x, y;
   ULONG  r, g, b;
   ULONG modeid = 0x8004;
   ULONG  co, maxco;

   width = 640;
   height = 400;
   depth = 8;

   FromWb = argc ? FALSE : TRUE;
   grayscale = FALSE;

   if((argc<MINARGS)||(argv[argc-1][0]=='?'))
	{
	printf("%s\n%s\n",Copyright,usage);
        bye("",RETURN_OK);
	}

   savename	= argv[1];
   if(argc > 2)  grayscale = TRUE;

   /* if dest not clipboard, warn if dest file already exists */
   if(strcmp(savename,"-c"))
	{
	if(lock = Lock(savename,ACCESS_READ))
	    {
	    UnLock(lock);
	    printf("Dest file \"%s\" already exists.  Overwrite (y or n) ? ",
			savename);
	    ans = 0;
	    while((c = getchar()) != '\n') if(!ans)  ans = c | 0x20;
	    if(ans == 'n')   bye("Exiting.\n",RETURN_OK);
	    }
	}
	    
   /* Open Libraries */

   if(!(IntuitionBase = OpenLibrary("intuition.library", 39)))
      bye("Can't open V39 intuition library.\n",RETURN_WARN);
      
   if(!(GfxBase = OpenLibrary("graphics.library",0)))
      bye("Can't open graphics library.\n",RETURN_WARN);

   if(!(IFFParseBase = OpenLibrary("iffparse.library",0)))
      bye("Can't open iffparse library.\n",RETURN_WARN);



/* 
 * Alloc two ILBMInfo structs (one each for defaults, screen) 
 */
    if(!(ilbms[0] = (struct ILBMInfo *)
	AllocMem(UICOUNT * sizeof(struct ILBMInfo),MEMF_PUBLIC|MEMF_CLEAR))) 
		bye(nomem,RETURN_FAIL);
    else 
	{
	ilbms[SCR] = ilbms[0] + 1;
	}

/*
 * Here we set up default ILBMInfo fields for our
 * application's frames.

    ilbms[DEF]->windef	= &mynw;
/* 
 * Initialize our working ILBM frames from our default one
 */
    *ilbms[SCR] = *ilbms[DEF];	/* for our screen */

/* 
 * Alloc two IFF handles (one for screen frame, one for brush frame) 
 */
    if(!(ilbms[SCR]->ParseInfo.iff = AllocIFF())) bye(noiffh,RETURN_FAIL);

    if(!(opendisplay(ilbms[SCR], width, height, depth, modeid)))
	bye("failed to open display",RETURN_FAIL);

    /* These were set up by our successful showilbm() above */
    win = ilbms[SCR]->win;	/* our window */
    wrp = ilbms[SCR]->wrp;	/* our window's RastPort */
    scr = ilbms[SCR]->scr;	/* our screen */
    vp  = ilbms[SCR]->vp;	/* our screen's ViewPort */

    ScreenToFront(scr);


 /* Now let's load colors and render some stuff
  */
 
    maxco = vp->ColorMap->Count;
    bh = height / 40;
    bw = width / maxco;
    r = g = b = 0;

    if(!grayscale)
    	{
	for(x=64, co=0; co < maxco; co++, x+=bw)
	    	{
		if(co)
		    {
	    	    r = co;
	    	    g = (maxco - 1) - co;
	    	    b = (maxco - 1) - ABS((LONG)g-(LONG)r);
		    }
		
	        r = (r << 24) | (r << 16) | ( r << 8) | r;
        	g = (g << 24) | (g << 16) | ( g << 8) | g;
        	b = (b << 24) | (b << 16) | ( b << 8) | b;

		D(bug("x=%ld, co=%ld, R:G:B = $%02lx:%02lx:%02lx\n",x,co,r,g,b));

	    	if(GfxBase->lib_Version >= 39)
			SetRGB32(vp,co,r,g,b);
		else
			SetRGB4(vp,co,r,g,b);
		SetAPen(wrp,co);
		RectFill(wrp,x,0,x+bw-1,height-1);
		}
	}
   else
    	{
    	/* 256 Gray scale */
    	x = 0;
    	y = 0;
    	r = 0x00000000;

    	for(x=64, co=0; co<maxco; co++, x+=bw, r+=0x01010101)
	    {
	    if(GfxBase->lib_Version >= 39)
		SetRGB32(vp,co,r,r,r);
	    else 
		SetRGB4(vp,co,r,r,r);
	    SetAPen(wrp,co);
	    RectFill(wrp,x,0,x+bw-1,height-1);
	    }
    	}


    if(saverror = screensave(ilbms[SCR], ilbms[SCR]->scr,
				NULL, NULL,
				savename))
			printf("%s\n",IFFerr(saverror));

   Done = FALSE;
   while(!Done)
      {
      Wait(1<<win->UserPort->mp_SigBit);
      chkmsg();
      }


   cleanup();
   exit(RETURN_OK);
   }


void chkmsg(void)
    {
    ULONG class;
    UWORD code;
    WORD  mousex, mousey;

    while(msg = (struct IntuiMessage *)GetMsg(win->UserPort))
	{
	class = msg->Class;
      	code  = msg->Code;
      	mousex = msg->MouseX;
      	mousey = msg->MouseY;

      	ReplyMsg(msg);
      	switch(class)
   	    {
	    case IDCMP_MOUSEBUTTONS:
	    switch(code)
		{
		/* emulate a close gadget */
		case SELECTDOWN:
		   if((mousex < 12)&&(mousey < 12))	Done = TRUE;
		   break;
		default:
		   break;
		}
            case IDCMP_VANILLAKEY:
            switch(code)
               	{
		/* also quit on CTRL-C, CTRL-D, or q */
               	case 'q': case 0x04: case 0x03:
                  Done = TRUE;
                  break;
			
               	default:
                  break;
		}
            default:
            break;
            }
      	}
    }


void bye(UBYTE *s,int error)
   {
   if((*s)&&(!FromWb)) printf("%s\n",s);
   cleanup();
   exit(error);
   }


void cleanup()
   {
   if(ilbms[SCR])
	{
   	if(ilbms[SCR]->scr)		unshowilbm(ilbms[SCR]);
   	if(ilbms[SCR]->ParseInfo.iff)	FreeIFF(ilbms[SCR]->ParseInfo.iff);
	}

   if(ilbms[0])
	{
	FreeMem(ilbms[0],UICOUNT * sizeof(struct ILBMInfo));
	}

   if(GfxBase) 	     CloseLibrary(GfxBase);
   if(IntuitionBase) CloseLibrary(IntuitionBase);
   if(IFFParseBase)  CloseLibrary(IFFParseBase);
   }
