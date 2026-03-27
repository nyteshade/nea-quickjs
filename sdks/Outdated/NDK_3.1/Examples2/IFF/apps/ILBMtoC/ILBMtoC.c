/*--------------------------------------------------------------*/
/*								*/
/* ILBMtoC: reads in ILBM, prints out ascii representation, 	*/
/*  for including in C files. 					*/
/*                                                              */
/* Based on ILBMDump.c by Jerry Morrison and Steve Shaw,	*/
/* Electronic Arts.           					*/
/* Jan 31, 1986							*/
/*                                                              */
/* This software is in the public domain.                       */
/* This version for the Commodore-Amiga computer.               */
/*                                                              */
/*  Callable from CLI ONLY					*/
/*  modified 05-91 for use wuth iffparse modules		*/
/*  Requires linkage with several other modules - see Makefile  */
/*--------------------------------------------------------------*/
#define INTUI_V36_NAMES_ONLY

#include "iffp/ilbmapp.h"


#ifdef __SASC
void __chkabort(void) {}          /* Disable SAS CTRL-C checking. */
#else
#ifdef LATTICE
void chkabort(void) {}            /* Disable LATTICE CTRL-C checking */
#endif
#endif


#include "ilbmtoc_rev.h"
UBYTE vers[] = VERSTAG;
UBYTE Copyright[] = VERS " - Save ILBM as C source - Freely Redistributable";

void GetSuffix(UBYTE *to, UBYTE *fr);
void bye(UBYTE *s, int e);
void cleanup(void);

struct Library *IFFParseBase = NULL;
struct Library *GfxBase = NULL;

/* ILBM frame */
struct ILBMInfo ilbm = {0};


/* ILBM Property chunks to be grabbed - only BMHD needed for this app
 */
LONG	ilbmprops[] = {
		ID_ILBM, ID_BMHD,
		TAG_DONE
		};

/* ILBM Collection chunks (more than one in file) to be gathered */
LONG	*ilbmcollects = NULL;	/* none needed for this app */

/* ILBM Chunk to stop on */
LONG	ilbmstops[] = {
		ID_ILBM, ID_BODY,
		TAG_DONE
		};


UBYTE defSwitch[] = "b";

/** main() ******************************************************************/

void main(int argc, char **argv)
    {
    UBYTE *sw;
    FILE *fp;
    LONG error=NULL;
    UBYTE *ilbmname, name[80], fname[80];

    if ((argc < 2)||(argv[argc-1][0]=='?'))
	{
	printf("Usage from CLI: 'ILBMtoC filename switch-string'\n");
	printf(" where switch-string = \n");
	printf("  <nothing> : Bob format (default)\n");
	printf("  s         : Sprite format (with header and trailer words)\n");
	printf("  sn        : Sprite format (No header and trailer words)\n");
	printf("  a         : Attached sprite (with header and trailer)\n");
	printf("  an        : Attached sprite (No header and trailer)\n");
	printf(" Add 'c' to switch list to output CR's with LF's   \n");
	exit(RETURN_OK);
	}
    

    if(!(GfxBase = OpenLibrary("graphics.library",0)))
	bye("Can't open graphics.library",RETURN_FAIL);

    if(!(IFFParseBase = OpenLibrary("iffparse.library",0)))
	bye("Can't open iffparse.library",RETURN_FAIL);

/*
 * Here we set up default ILBMInfo fields for our
 * application's frames.
 * Above we have defined the propery and collection chunks
 * we are interested in (some required like BMHD)
 */
    ilbm.ParseInfo.propchks      = ilbmprops;
    ilbm.ParseInfo.collectchks   = ilbmcollects;
    ilbm.ParseInfo.stopchks      = ilbmstops;
    if(!(ilbm.ParseInfo.iff = AllocIFF()))
    	bye(IFFerr(IFFERR_NOMEM),RETURN_FAIL);	/* Alloc an IFFHandle */

    sw = (argc>2) ? (UBYTE *)argv[2] : defSwitch;
    ilbmname = argv[1];

    if (error = loadbrush(&ilbm,ilbmname))
        {
        printf("Can't load ilbm \"%s\", ifferr=%s\n",ilbmname,IFFerr(error));
        bye("",RETURN_WARN);
        }
    else /* Successfully loaded ILBM */
	{
	printf(" Creating file %s.c \n",argv[1]);
	GetSuffix(name,argv[1]);
	strcpy(fname,argv[1]);
	strcat(fname,".c");
	fp = fopen(fname,"w");
	if(fp)
	    {
	    BMPrintCRep(ilbm.brbitmap,fp,name,sw);
	    fclose(fp);
	    }
	else  printf("Couldn't open output file: %s. \n", fname);
	unloadbrush(&ilbm);
	}
    printf("\n");
    bye("",RETURN_OK);
    }



/* this copies part of string after the last '/' or ':' */
void GetSuffix(to, fr) UBYTE *to, *fr; {
    int i;
    UBYTE c,*s = fr;
    for (i=0; ;i++) {
	c = *s++;
	if (c == 0) break;
	if (c == '/') fr = s;
	else if (c == ':') fr = s;
	}
    strcpy(to,fr);
    }


void bye(UBYTE *s, int e)
    {
    if(s&&(*s))	printf("%s\n",s);
    cleanup();
    exit(e);
    }


void cleanup()
    {
    if(ilbm.ParseInfo.iff)		FreeIFF(ilbm.ParseInfo.iff);

    if(IFFParseBase)	CloseLibrary(IFFParseBase);
    if(GfxBase)		CloseLibrary(GfxBase);
    }

