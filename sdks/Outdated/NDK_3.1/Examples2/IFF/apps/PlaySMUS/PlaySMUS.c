
/** PlaySMUS.c ************************************************************** 
 * 
 * Read (and someday play) a SMUS file - in progress
 * 
 * requires linkage with several IFF modules - see Makefile
 ****************************************************************************/ 

#include "iffp/8svxapp.h"
#include "iffp/smusapp.h"

#include <exec/execbase.h>
#include <graphics/gfxbase.h>
#include <clib/alib_protos.h>


#ifdef __SASC
void __chkabort(void) {}          /* Disable SAS CTRL-C checking. */
#else
#ifdef LATTICE
void chkabort(void) {}            /* Disable LATTICE CTRL-C checking */
#endif
#endif


#define MINARGS 2

#include "playsmus_rev.h"
UBYTE vers[] = VERSTAG;
UBYTE Copyright[] = VERS " - SMUS loader (no play yet) - Freely Redistributable";

char *usage = "Usage: PlaySMUS SMUSname [instrument path]";

/* prototypes for our functions */
void cleanup(void);
void bye(UBYTE *s,int error);
void DUnpack(BYTE source[], LONG n, BYTE dest[]);
BYTE D1Unpack(BYTE source[], LONG n, BYTE dest[], BYTE x);
LONG LoadSample(struct EightSVXInfo *esvx, UBYTE *filename);
void UnloadSample(struct EightSVXInfo *esvx);
LONG LoadSBody(struct EightSVXInfo *esvx);
void UnloadSBody(struct EightSVXInfo *esvx);
LONG ShowSample(struct EightSVXInfo *esvx);

LONG LoadSMUS(struct SMUSInfo *smus, UBYTE *filename);
void UnloadSMUS(struct SMUSInfo *esvx);

LONG OpenAudio(void);
void CloseAudio(void);
LONG PlaySample(struct EightSVXInfo *esvx,
		LONG octave, LONG note, UWORD volume, ULONG delay);

char *inspath = "Instruments:";

/* globals */
struct Library *IFFParseBase   = NULL;
struct Library *GfxBase = NULL;

BOOL   FromWb;

/* SMUS Property chunks to be grabbed
 */
LONG	smusprops[] = {
		ID_SMUS, ID_SHDR,
		ID_SMUS, ID_NAME,
		ID_SMUS, ID_AUTH,
		ID_SMUS, ID_Copyright,
		TAG_DONE
		};

/* SMUS Collection chunks (more than one in file) to be gathered */
LONG	smuscollects[] = {
		ID_SMUS, ID_ANNO,
		TAG_DONE
		};

/* SMUS Chunks to stop on */
LONG	smusstops[] = {
		ID_SMUS, ID_TRAK,
		ID_SMUS, ID_INS1,
		TAG_DONE
		};


/* 8SVX Property chunks to be grabbed
 */
LONG	esvxprops[] = {
		ID_8SVX, ID_VHDR,
		ID_8SVX, ID_NAME,
		ID_8SVX, ID_ATAK,
		ID_8SVX, ID_RLSE,
		ID_8SVX, ID_AUTH,
		ID_8SVX, ID_Copyright,
		TAG_DONE
		};

/* 8SVX Collection chunks (more than one in file) to be gathered */
LONG	esvxcollects[] = {
		ID_8SVX, ID_ANNO,
		TAG_DONE
		};

/* 8SVX Chunk to stop on */
LONG	esvxstops[] = {
		ID_8SVX, ID_BODY,
		TAG_DONE
		};


UBYTE nomem[]  = "Not enough memory\n";
UBYTE noiffh[] = "Can't alloc iff\n";



/* For our allocated SMUSInfo */
struct SMUSInfo *smus = NULL;

/* For allocated 8SVX Infos */
struct EightSVXInfo  *esvxs[MAXINS] = { 0 };
struct EightSVXInfo  *esvx = NULL;
ULONG  ei = 0, ti = 0, tcnt = 0, ecnt = 0;


/* 
 * MAIN 
 */
void main(int argc, char **argv)
   {
   UBYTE *smusname=NULL, *esvxname=NULL;
   ULONG oct;
   LONG error=0L;

   FromWb = argc ? FALSE : TRUE;

   if((argc<MINARGS)||(argv[argc-1][0]=='?'))
	{
	printf("%s\n%s\n",Copyright,usage);
        bye("",RETURN_OK);
	}

   smusname = argv[1];
   if(argc > 2)  inspath = argv[2];

/* Open Libraries */
   if(!(IFFParseBase = OpenLibrary("iffparse.library",0)))
      bye("Can't open iffparse library.\n",RETURN_WARN);


/* 
 * Alloc one SMUSInfo struct
 */
    if(!(smus = (struct SMUSInfo *)
	AllocMem(sizeof(struct SMUSInfo),MEMF_PUBLIC|MEMF_CLEAR))) 
		bye(nomem,RETURN_FAIL);

/*
 * Here we set up our SMUSInfo fields for our application.
 * Above we have defined the propery and collection chunks
 * we are interested in.
 * We want to stop on INS1 or TRAK.
 */
    smus->ParseInfo.propchks	= smusprops;
    smus->ParseInfo.collectchks	= smuscollects;
    smus->ParseInfo.stopchks	= smusstops;
/* 
 * Alloc the IFF handle for the frame
 */
    if(!(smus->ParseInfo.iff = AllocIFF())) bye(noiffh,RETURN_FAIL);


/* 
 * Alloc one EightSVXInfo struct for defaults
 */
    if(!(esvx = (struct EightSVXInfo *)
	AllocMem(sizeof(struct EightSVXInfo),MEMF_PUBLIC|MEMF_CLEAR))) 
		bye(nomem,RETURN_FAIL);

/*
 * Here we set up default EightSVXInfo fields for our
 * application.
 * Above we have defined the propery and collection chunks
 * we are interested in (some required like VHDR).
 * We want to stop on BODY.
 */
    esvx->ParseInfo.propchks	= esvxprops;
    esvx->ParseInfo.collectchks	= esvxcollects;
    esvx->ParseInfo.stopchks	= esvxstops;
/* 
 * Alloc the IFF handle for the frame
 */
    if(!(esvx->ParseInfo.iff = AllocIFF())) bye(noiffh,RETURN_FAIL);

    if(error = LoadSMUS(smus, smusname))
	{
	printf("Error %ld: %s\n",error, IFFerr(error));
	goto done;
	}
goto done;

    if(!(error = LoadSample(esvx, esvxname)))
	{
	ShowSample(esvx);

	if(!(error = OpenAudio()))
	    {
	    /* If we think this is a sound effect, play it as such (note=-1) */
	    if((esvx->Vhdr.ctOctave==1)&&(esvx->Vhdr.samplesPerSec)
		&&(esvx->Vhdr.oneShotHiSamples)&&(!esvx->Vhdr.repeatHiSamples))
		{
		PlaySample(esvx,0,-1,64,0);
		}
	    /* Else play it like an instrument */
	    else
		{
	    	for(oct=0; oct < esvx->Vhdr.ctOctave; oct++)
		    {
	    	    PlaySample(esvx,oct,0,64,50);
	    	    PlaySample(esvx,oct,4,64,50);
	    	    PlaySample(esvx,oct,7,64,50);
		    }
		}
	    CloseAudio();
	    }
        else printf("error opening audio device\n");
	}
    else
    	printf("%s\n",IFFerr(error));

done:
    D(bug("done\n"));
    cleanup();
    exit(RETURN_OK);
    }


void bye(UBYTE *s,int error)
   {
   if((*s)&&(!FromWb)) printf("%s\n",s);
   cleanup();
   exit(error);
   }


void cleanup()
   {
   int k;

   D(bug("cleanup:\n"));

   if(esvx)		
	{
/*
	DD(bug("About to UnloadSample\n"));
	UnloadSample(esvx);
*/
	if(esvx->ParseInfo.iff) 	FreeIFF(esvx->ParseInfo.iff);
        FreeMem(esvx,sizeof(struct EightSVXInfo));
	esvx = NULL;
	}

   for(k = 0; (k <MAXINS) && (esvxs[k]) ; k++)
	{
	if(esvxs[k])
	    {
	    D(bug("cleanup: about to UnloadSample %ld\n",k));
	    UnloadSample(esvxs[k]);
	    D(bug("cleanup: about to FreeIFF %ld\n",k));
	    if(esvxs[k]->ParseInfo.iff) 	FreeIFF(esvxs[k]->ParseInfo.iff);
            FreeMem(esvxs[k],sizeof(struct EightSVXInfo));
	    esvxs[k] = NULL;
	    }
	}

   if(smus)
	{
	DD(bug("About to UnloadSMUS\n"));
	UnloadSMUS(smus);
	if(smus->ParseInfo.iff) 	FreeIFF(smus->ParseInfo.iff);
	FreeMem(smus,sizeof(struct SMUSInfo));
	smus = NULL;
	}

   if(IFFParseBase)  	CloseLibrary(IFFParseBase);
   }

 
/** ShowSample() **********************************************
 * 
 * Show sample information after calling LoadSample()
 * 
 *************************************************************************/
LONG ShowSample(struct EightSVXInfo *esvx)
    {
    LONG error = 0L;
    BYTE *buf;
    Voice8Header *vhdr;

    if(!esvx)			return(CLIENT_ERROR);
    if(!(buf = esvx->sample))	return(CLIENT_ERROR);

    /* LoadSample copied VHDR and NAME (if any) to our esvx frame */
    vhdr = &esvx->Vhdr;
    if(esvx->name[0]) printf("\nNAME: %s",esvx->name);

    printf("\n\nVHDR Info:");
    printf("\noneShotHiSamples=%ld", vhdr->oneShotHiSamples); 
    printf("\nrepeatHiSamples=%ld", vhdr->repeatHiSamples); 
    printf("\nsamplesPerHiCycle=%ld", vhdr->samplesPerHiCycle); 
    printf("\nsamplesPerSec=%ld", vhdr->samplesPerSec); 
    printf("\nctOctave=%ld", vhdr->ctOctave); 
    printf("\nsCompression=%ld", vhdr->sCompression); 
    printf("\nvolume=0x%lx", vhdr->volume); 
    printf("\nData = %3ld %3ld %3ld %3ld %3ld %3ld %3ld %3ld",  
           buf[0],buf[1],buf[2],buf[3],buf[4],buf[5],buf[6],buf[7]); 
    printf("\n       %3ld %3ld %3ld %3ld %3ld %3ld %3ld %3ld ...\n",  
           buf[8+0],buf[8+1],buf[8+2],buf[8+3],buf[8+4],buf[8+5],
           buf[8+6],buf[8+ 7]); 

    return(error);
    } 
 

/* OpenAudio
 *
 * Opens audio device for one audio channel, 2 IO requests
 * Returns 0 for success
 *
 * Based on code by Dan Baker
 */

UBYTE           whichannel[] = { 1,2,4,8 };

/* periods for scale starting at   65.40Hz (C) with 128 samples per cycle
 *                            or  130.81Hz (C) with  64 samples per cycle
 *                            or  261.63Hz (C) with  32 samples per cycle
 *                            or  523.25Hz (C) with  16 samples per cycle
 *                            or 1046.50Hz (C) with   8 samples per cycle
 *                            or 2093.00Hz (C) with   4 samples per cycle
 */

UWORD   per_ntsc[12]= { 428, 404, 380, 360,
			340, 320, 302, 286,
			270, 254, 240, 226 };

/* periods adjusted for system clock frequency */
UWORD   per[12];

/* Note - these values 3579545 NTSC, 3546895 PAL */
#define NTSC_CLOCK 3579545L
#define PAL_CLOCK  3546895L

#define AIOCNT 4
struct 	IOAudio *aio[AIOCNT] = {NULL}; 	  /* Ptrs to IO blocks for commands  */

struct 	MsgPort *port;   	/* Pointer to a port so the device can reply */
BOOL	devopened;
ULONG	clock = NTSC_CLOCK;     /* Will check for PAL and change if necessary */


LONG OpenAudio()
{
extern	struct ExecBase *SysBase;
LONG 	error=0L;
ULONG   period;
int	k;

if(devopened)	return(-1);

/*-------------------------------------------------------------------------*/
/* Ask the system if we are PAL or NTSC and set clock constant accordingly */
/*-------------------------------------------------------------------------*/
if(GfxBase=OpenLibrary("graphics.library",0L))
    {
    if(((struct GfxBase *)GfxBase)->DisplayFlags & PAL)
		clock = PAL_CLOCK;
    else
		clock = NTSC_CLOCK;
    CloseLibrary((struct Library *) GfxBase);
    }

printf("OpenAudio: For period calculations, clock=%ld\n", clock);

/* calculate period values for one octave based on system clock */
for(k=0; k<12; k++)
    {
    period = ((per_ntsc[k] * clock) + (NTSC_CLOCK >> 1)) / NTSC_CLOCK;
    per[k] = period;
    D(bug("per[%ld]=%ld ",k,per[k]));
    }
D(bug("\n"));

/*-------------------------------------------------------------------*/
/* Create a reply port so the audio device can reply to our commands */
/*-------------------------------------------------------------------*/
if(!(port=CreatePort(0,0)))
	{ error = 1; goto bailout; }

/*--------------------------------------------------------------------------*/
/*  Create audio I/O blocks so we can send commands to the audio device     */
/*--------------------------------------------------------------------------*/
for(k=0; k<AIOCNT; k++)
    {
    if(!(aio[k]=(struct IOAudio *)CreateExtIO(port,sizeof(struct IOAudio))))
	{ error = k+2; goto bailout; }
    }

/*----------------------------------------------------------------------*/
/* Set up the audio I/O block for channel allocation:                   */
/* ioa_Request.io_Message.mn_ReplyPort is the address of a reply port.  */
/* ioa_Request.io_Message.mn_Node.ln_Pri sets the precedence (priority) */
/*   of our use of the audio device. Any tasks asking to use the audio  */
/*   device that have a higher precedence will steal the channel from us.*/
/* ioa_Request.io_Command is the command field for IO.                  */
/* ioa_Request.io_Flags is used for the IO flags.                       */
/* ioa_AllocKey will be filled in by the audio device if the allocation */
/*   succeeds. We must use the key it gives for all other commands sent.*/
/* ioa_Data is a pointer to the array listing the channels we want.     */
/* ioa_Length tells how long our list of channels is.                   */
/*----------------------------------------------------------------------*/
aio[0]->ioa_Request.io_Command               = ADCMD_ALLOCATE;
aio[0]->ioa_Request.io_Flags                 = ADIOF_NOWAIT;
aio[0]->ioa_AllocKey                         = 0;
aio[0]->ioa_Data                             = whichannel;
aio[0]->ioa_Length                           = sizeof(whichannel);

/*-----------------------------------------------*/
/* Open the audio device and allocate a channel  */
/*-----------------------------------------------*/
if(!(OpenDevice("audio.device",0L, (struct IORequest *) aio[0] ,0L)))
	devopened = TRUE;
else { error = 5; goto bailout; }

/* Clone the flags, channel allocation, etc. into other IOAudio requests */
for(k=1; k<AIOCNT; k++)	*aio[k] = *aio[0];

bailout:
if(error)	
    {
    printf("OpenAudio errored out at step %ld\n",error);
    CloseAudio();
    }
return(error);
}


/* CloseAudio
 *
 * Close audio device as opened by OpenAudio, null out pointers
 */
void CloseAudio()
{
int k;

D(bug("Closing audio device...\n"));

/* Note - we know we have no outstanding audio requests */
if(devopened)
    {
    CloseDevice((struct IORequest *) aio[0]);
    devopened = FALSE;
    }

for(k=0; k<AIOCNT; k++)
    {
    if(aio[k]) 	DeleteExtIO(aio[k]), aio[k] = NULL;
    }

if(port)   	DeletePort(port),  port = NULL;
}


/** PlaySample() **********************************************
 * 
 * Play a note in octave for delay/50ths of a second 
 * OR Play a sound effect (set octave and note to 0, -1)
 *
 * Requires successful OpenAudio() called previously
 *
 * When playing notes:
 * Expects note values between 0 (C) and 11 (B#)
 * Uses largest octave sample in 8SVX as octave 0, next smallest
 *   as octave 1, etc.
 *
 * Notes - this simple example routine does not do ATAK and RLSE)
 *       - use of Delay for timing is simplistic, synchronous, and does
 *		not take into account that the oneshot itself may be
 *		longer than the delay.
 *         Use timer.device for more accurate asynchronous delays
 *
 *************************************************************************/
/* Max playable sample in one IO request is 128K */
#define MAXSAMPLE 131072

LONG	PlaySample(struct EightSVXInfo *esvx,
			LONG octave, LONG note, UWORD volume, ULONG delay)
{
/* pointers to outstanding requests */
struct		IOAudio	*aout0=NULL, *aout1=NULL;	
ULONG		period;
LONG		osize, rsize;
BYTE		*oneshot, *repeat;

if(!devopened)	return(-1);

if(note > 11) note=0;

if( note == -1 ) period = clock / esvx->Vhdr.samplesPerSec;
else 		 period = per[note]; /* table set up by OpenAudio */

if(octave > esvx->Vhdr.ctOctave) octave = 0;
if(volume > 64)	volume = 64;

oneshot = esvx->osamps[octave];
osize   = esvx->osizes[octave];
repeat  = esvx->rsamps[octave];
rsize   = esvx->rsizes[octave];

D(bug("oneshot $%lx size %ld, repeat $%lx size %ld\n",
	oneshot, osize, repeat, rsize));

/*------------------------------------------------------------*/
/* Set up audio I/O blocks to play a sample using CMD_WRITE.  */
/* Set up one request for the oneshot and one for repeat      */
/* (all ready for simple case, but we may not need both)      */
/* The io_Flags are set to ADIOF_PERVOL so we can set the     */
/*    period (speed) and volume with the our sample;          */
/* ioa_Data points to the sample; ioa_Length gives the length */
/* ioa_Cycles tells how many times to repeat the sample       */
/* If you want to play the sample at a given sampling rate,   */
/* set ioa_Period = clock/(given sampling rate)               */
/*------------------------------------------------------------*/
aio[0]->ioa_Request.io_Command             =CMD_WRITE;
aio[0]->ioa_Request.io_Flags               =ADIOF_PERVOL;
aio[0]->ioa_Data                           =oneshot;
aio[0]->ioa_Length                         =osize;
aio[0]->ioa_Period                         =period;
aio[0]->ioa_Volume                         =volume;
aio[0]->ioa_Cycles                         =1;

aio[2]->ioa_Request.io_Command             =CMD_WRITE;
aio[2]->ioa_Request.io_Flags               =ADIOF_PERVOL;
aio[2]->ioa_Data                           =repeat;
aio[2]->ioa_Length                         =rsize;
aio[2]->ioa_Period                         =period;
aio[2]->ioa_Volume                         =volume;
aio[2]->ioa_Cycles                         =0;	/* repeat until stopped */

/*---------------------------------------------------*/
/* Send the command to start a sound using BeginIO() */
/* Go to sleep and wait for the sound to finish with */
/* WaitIO() to wait and get the get the ReplyMsg     */
/*---------------------------------------------------*/
printf("Starting tone O len %ld for %0ld cyc, R len %ld for %0ld cyc, per=%ld...",
		osize, aio[0]->ioa_Cycles, rsize, aio[1]->ioa_Cycles, period);

if(osize)
    {
    /* Simple case for oneshot sample <= 128K (ie. most samples) */
    if(osize <= MAXSAMPLE)	BeginIO((struct IORequest *)(aout0=aio[0]));
     }

if(rsize)
    {
    /* Simple case for oneshot sample <= 128K (ie. most samples) */
    if(rsize <= MAXSAMPLE)	BeginIO((struct IORequest *)(aout1=aio[2]));
    }

if(delay)	Delay(delay);	/* crude timing for notes */

/* Wait for any requests we still have out */
if(aout0) WaitIO(aout0);

if(aout1)
   {
   if(note >= 0) AbortIO(aout1);	/* if a note, stop it now */
   WaitIO(aout1);
   }

printf("Done\n");
}


/** LoadSample() **********************************************************
 * 
 * Read 8SVX, given an initialized EightSVXInfo with not-in-use IFFHandle,
 *   and filename.  Leaves the IFFHandle open so you can FindProp()
 *   additional chunks or copychunks().  You must UnloadSample()
 *   when done.  UnloadSample will closeifile if the file is still
 *   open.
 *
 * Fills in esvx->Vhdr and Name, and allocates/loads esvx->sample,
 *   setting esvx->samplebytes to size for deallocation.
 *
 * Returns 0 for success of an IFFERR (libraries/iffparse.h)
 *************************************************************************/
LONG LoadSample(struct EightSVXInfo *esvx, UBYTE *filename)
    {
    struct IFFHandle *iff;
    struct StoredProperty *sp;
    Voice8Header *vhdr;
    BYTE *oneshot, *repeat;
    ULONG osize, rsize, spcyc;
    int oct;
    LONG error = 0L;

    D(bug("LoadSample: looking for %s\n",filename));
    
    if(!esvx)				return(CLIENT_ERROR);
    if(!(iff=esvx->ParseInfo.iff))	return(CLIENT_ERROR);

    if(!(error = openifile((struct ParseInfo *)esvx, filename, IFFF_READ)))
	{
	printf("Reading '%s'...\n",filename);
	error = parseifile((struct ParseInfo *)esvx,
			ID_FORM, ID_8SVX,
			esvx->ParseInfo.propchks,
			esvx->ParseInfo.collectchks,
			esvx->ParseInfo.stopchks);

	D(bug("LoadSample: after parseifile - error = %ld\n",error));

	if((!error)||(error == IFFERR_EOC)||(error == IFFERR_EOF))
	    {
	    if(contextis(iff,ID_8SVX,ID_FORM))
		{
		D(bug("LoadSample: context is 8SVX\n"));
		if(!(sp = FindProp(iff,ID_8SVX,ID_VHDR)))
		    {
		    message("No 8SVX.VHDR!");
		    error = IFFERR_SYNTAX;
		    }
		else
		    {
		    D(bug("LoadSample: Have VHDR\n"));
		    /* copy Voice8Header into frame */
		    vhdr = (Voice8Header *)(sp->sp_Data);
		    *(&esvx->Vhdr) = *vhdr;
		    /* copy name if any */
		    esvx->name[0]='\0';
		    if(sp = FindProp(iff,ID_8SVX,ID_NAME))
			{
			strncpy(esvx->name,sp->sp_Data,sp->sp_Size);
			esvx->name[MIN(sp->sp_Size,79)] = '\0';
			}
	    	    error = LoadSBody(esvx);
		    D(bug("LoadSample: After LoadSBody - error = %ld\n",error));
		    if(!error)
			{
			osize   = esvx->Vhdr.oneShotHiSamples;
			rsize   = esvx->Vhdr.repeatHiSamples;
			spcyc	= esvx->Vhdr.samplesPerHiCycle;
			if(!spcyc) spcyc = esvx->Vhdr.repeatHiSamples;
			if(!spcyc) spcyc = 8;

			oneshot = esvx->sample;

			for(oct = esvx->Vhdr.ctOctave-1; oct >= 0;
				 oct--, oneshot+=(osize+rsize),
					osize <<= 1, rsize <<=1, spcyc <<=1)
    			    {
    			    repeat  = oneshot + osize;
			    esvx->osizes[oct] = osize;
			    if(osize) esvx->osamps[oct] = oneshot;
			    else      esvx->osamps[oct] = 0;
			    esvx->rsizes[oct] = rsize;
			    if(rsize) esvx->rsamps[oct] = repeat;
			    else      esvx->rsamps[oct] = 0;
			    esvx->spcycs[oct] = spcyc;

 			D(bug("oneshot $%lx size %ld, repeat $%lx size %ld\n",
				oneshot, osize, repeat, rsize));

			    }
		        }
		    }
		}
	    else
		{
		message("Not an 8SVX\n");
		error = NOFILE;
		}
	    }
	}

    if(error)
	{
	closeifile((struct ParseInfo *)esvx);
	UnloadSample(esvx);
	}
    return(error);
    }

 
/** UnloadSample() *******************************************************
 * 
 * Frees and closes everything opened/alloc'd by LoadSample()
 *
 *************************************************************************/
void UnloadSample(struct EightSVXInfo *esvx)
    {
    if(esvx)
	{
	D(bug("UnloadSample: About to UnloadSBody\n"));
	UnloadSBody(esvx);
	D(bug("UnloadSample: About to closeifile\n"));
	closeifile((struct ParseInfo *)esvx);
	}
    }


/** LoadSBody() ***********************************************************
 * 
 * Read a 8SVX Sample BODY into RAM.  
 * 
 *************************************************************************/
LONG LoadSBody(struct EightSVXInfo *esvx)
    {
    struct IFFHandle *iff;
    LONG sbytes, rlen, error = 0L; 
    ULONG memtype;
    Voice8Header *vhdr = &esvx->Vhdr;
    BYTE *t;

    D(bug("LoadSBody:\n"));

    if(!(iff=esvx->ParseInfo.iff))	return(CLIENT_ERROR);
    if(!esvx)				return(CLIENT_ERROR);

    if(!(currentchunkis(iff,ID_8SVX,ID_BODY)))
	{
	message("LoadSBody: not at BODY!");
	return(IFFERR_READ);
	}

    sbytes  = ChunkMoreBytes(CurrentChunk(iff)); 

    /* if we have to decompress, let's just load it into public mem */
    memtype = vhdr->sCompression ? MEMF_PUBLIC : MEMF_CHIP;

    D(bug("LoadSBody: samplebytes=%ld, compression=%ld\n",
			sbytes,vhdr->sCompression));
    
    if(!(esvx->sample = (BYTE *)AllocMem(sbytes, memtype))) 
	{
        error = IFFERR_NOMEM;	/* used to be flagged as client error */ 
	}
    else 
	{
	D(bug("LoadSBody: have load buffer\n"));
	esvx->samplebytes = sbytes; 
        if(rlen=ReadChunkBytes(iff,esvx->sample,sbytes) != sbytes)
	    error = IFFERR_READ;

	if(error)
	    {
	    D(bug("LoadSBody: ReadChunkBytes error = %ld, read %ld bytes\n",
			error));
	    }
	else if (vhdr->sCompression == sCmpFibDelta ) /* Decompress, if needed. */
	    {
            if(t = (BYTE *)AllocMem(sbytes<<1, MEMF_CHIP)) 
		{
		D(bug("LoadSBody: have decompression buffer\n"));
            	DUnpack(esvx->sample, sbytes, t); 
            	FreeMem(esvx->sample, sbytes); 
            	esvx->sample = t;
            	esvx->samplebytes = sbytes << 1;
		}
	    else
		{
		error = IFFERR_NOMEM;
		}
	    } 
	else if (vhdr->sCompression)	/* unknown ompression method */
	    {
	    error = CLIENT_ERROR;
	    }
	}
    if(error)	UnloadSample(esvx);
    return(error);
    } 


/** UnloadSBody() ********************************************************
 * 
 * Deallocates esvx->smaple  
 * 
 *************************************************************************/
void UnloadSBody(struct EightSVXInfo *esvx)
    {
    if(esvx)
	{
	D(bug("UnloadSBody:\n"));
	if(esvx->sample)
	    {
	    D(bug("About to free SBody\n"));
	    FreeMem(esvx->sample,esvx->samplebytes);
	    esvx->sample = NULL;
	    }
	esvx->samplebytes = NULL;
	}
    }
 

/* DUnpack.c --- Fibonacci Delta decompression by Steve Hayes */

/* Fibonacci delta encoding for sound data */
BYTE codeToDelta[16] = {-34,-21,-13,-8,-5,-3,-2,-1,0,1,2,3,5,8,13,21};

/* Unpack Fibonacci-delta encoded data from n byte source
 * buffer into 2*n byte dest buffer, given initial data
 * value x.  It returns the lats data value x so you can
 * call it several times to incrementally decompress the data.
 */

BYTE D1Unpack(BYTE source[], LONG n, BYTE dest[], BYTE x)
   {
   BYTE d;
   LONG i, lim;

   lim = n << 1;
   for (i=0; i < lim; ++i)
      {
      /* Decode a data nibble, high nibble then low nibble */
      d = source[i >> 1];    /* get a pair of nibbles */
      if (i & 1)             /* select low or high nibble */
         d &= 0xf;           /* mask to get the low nibble */
      else
         d >>= 4;            /* shift to get the high nibble */
      x += codeToDelta[d];   /* add in the decoded delta */
      dest[i] = x;           /* store a 1 byte sample */
      }
   return(x);
   }

/* Unpack Fibonacci-delta encoded data from n byte
 * source buffer into 2*(n-2) byte dest buffer.
 * Source buffer has a pad byte, an 8-bit initial
 * value, followed by n-2 bytes comprising 2*(n-2)
 * 4-bit encoded samples.
 */

void DUnpack(source, n, dest)
BYTE source[], dest[];
LONG n;
   {
   D1Unpack(source+2, n-2, dest, source[1]);
   }


/** LoadSMUS() **********************************************************
 * 
 * Read SMUS, given an initialized SMUSInfo with not-in-use IFFHandle,
 *   and filename.  Leaves the IFFHandle open so you can FindProp()
 *   additional chunks or copychunks().  You must UnloadSMUS()
 *   when done.  UnloadSMUS will closeifile if the file is still
 *   open.
 *
 * Fills in smus->Shdr and Name, and sets up smus traks[],
 *   array setting smus->nevents[] to number of events in each.
 *
 * Returns 0 for success of an IFFERR (libraries/iffparse.h)
 *************************************************************************/
LONG LoadSMUS(struct SMUSInfo *smus, UBYTE *filename)
    {
    struct ContextNode *cn;
    struct IFFHandle *iff;
    struct StoredProperty *sp;
    SScoreHeader *shdr;
    LONG error = 0L, rlen, inslock, oldlock;
    UBYTE insname[80];

    D(bug("LoadSMUS:\n"));
    
    if(!smus)				return(CLIENT_ERROR);
    if(!(iff=smus->ParseInfo.iff))	return(CLIENT_ERROR);

    if(!(error = openifile((struct ParseInfo *)smus, filename, IFFF_READ)))
	{
	printf("Reading '%s'...\n",filename);
	error = parseifile((struct ParseInfo *)smus,
			ID_FORM, ID_SMUS,
			smus->ParseInfo.propchks,
			smus->ParseInfo.collectchks,
			smus->ParseInfo.stopchks);

	D(bug("LoadSMUS: after parseifile - error:%ld, %s\n",error,IFFerr(error)));

	if((!error)||(error == IFFERR_EOC)||(error == IFFERR_EOF))
	    {
	    if(contextis(iff,ID_SMUS,ID_FORM))
		{  /* Is a SMUS */
		D(bug("LoadSMUS: context is SMUS\n"));
		if(!(sp = FindProp(iff,ID_SMUS,ID_SHDR)))
		    {
		    message("No SMUS.SHDR!");
		    error = IFFERR_SYNTAX;
		    }
		else
		    {
		    D(bug("LoadSMUS: Have SHDR\n"));
		    /* copy SScoreHeader into frame */
		    shdr = (SScoreHeader *)(sp->sp_Data);
		    *(&smus->Shdr) = *shdr;
		    /* copy name if any */
		    smus->name[0]='\0';
		    if(sp = FindProp(iff,ID_SMUS,ID_NAME))
			{
			strncpy(smus->name,sp->sp_Data,sp->sp_Size);
			smus->name[MIN(sp->sp_Size,79)] = '\0';
			}
        	    while(1)
                	{
                	/* We only asked to stop at SMUS INS1 and TRAK chunks
                 	* If no error we've hit a stop chunk
                 	*/
                	cn = CurrentChunk(iff);

                	if((cn)&&(cn->cn_Type == ID_SMUS)&&
					(cn->cn_ID == ID_INS1))
                            {
                            printf("INS1 chunk found\n");
			    if(esvxs[ei] = (struct EightSVXInfo *)
				AllocMem(sizeof(struct EightSVXInfo),
						MEMF_PUBLIC|MEMF_CLEAR))
				{
				/* Clone but needs new handle */
				*(esvxs[ei]) = *esvx;
	    			if(!(esvxs[ei]->ParseInfo.iff =
				    AllocIFF())) bye(noiffh,RETURN_FAIL); 

				/* Get name of sound */
        		        rlen=ReadChunkBytes(iff,&smus->insflags[ei],4);
        		        rlen=ReadChunkBytes(iff,insname,
					  MIN(cn->cn_Size - 4, 79));

				if(rlen != (cn->cn_Size-4)) error = IFFERR_READ;
				else insname[rlen] = '\0';

				D(bug("Instrument name is %s\n",insname));
				if(!error)
				    {
				    if(inslock = Lock(inspath,ACCESS_READ))
					{
					oldlock = CurrentDir(inslock);
					error = LoadSample(esvxs[ei],insname);
					CurrentDir(oldlock);
					UnLock(inslock);
					}
				if (error) printf("Can't load instrument %s\n",
							insname);
				    }
				ei++;
				ecnt++;
				}
			    }
			else if((cn)&&(cn->cn_Type == ID_SMUS)&&
					(cn->cn_ID == ID_TRAK))
			    {
			    printf("TRAK chunk found, size=%ld\n",
					cn->cn_Size);

			    if( smus->traks[ti]  = (SEvent *)
				AllocMem(cn->cn_Size, MEMF_PUBLIC))
				{
			    	smus->tbytes[ti] = cn->cn_Size;
        			if((rlen=ReadChunkBytes(iff,smus->traks[ti],
					  cn->cn_Size)) != cn->cn_Size)
	    				error = IFFERR_READ;
			        printf("   Loaded at $%lx\n",smus->traks[ti]);
				ti++;
				tcnt++;
				}
			    else error = IFFERR_NOMEM;
			    }
			if(error) break;
                	else error = ParseIFF(iff,IFFPARSE_SCAN);
                	if(error == IFFERR_EOC) continue;       /* enter next context */
                	else if(error) break;
			}
		    }
		}
	    else
		{
		message("Not a SMUS\n");
		error = NOFILE;
		}
	    }
	}

    if(error == IFFERR_EOC) error = 0;

    D(bug("LoadSMUS: error = %ld\n",error));

    if(error)
	{
	closeifile((struct ParseInfo *)smus);
	UnloadSMUS(smus);
	}

    return(error);
    }

 
/** UnloadSMUS() *******************************************************
 * 
 * Frees and closes everything opened/alloc'd by LoadSMUS()
 *
 *************************************************************************/
void UnloadSMUS(struct SMUSInfo *smus)
    {
    int ti;

    D(bug("In UnloadSMUS\n"));
    if(smus)
	{
	for(ti=0; (ti < MAXTRACKS) && (smus->traks[ti]); ti++)
	    {
	    printf("Freeing %ld at $%lx\n",smus->traks[ti],smus->tbytes[ti]);
	    FreeMem(smus->traks[ti],smus->tbytes[ti]);
	    smus->traks[ti] = NULL;
	    }
	closeifile((struct ParseInfo *)smus);
	}
    }

