;/* testmydebug.c - Execute me to compile me with Lattice 5.04
LC -b1 -cfistq -v -y -j73 testmydebug.c
Blink FROM LIB:c.o,testmydebug.o TO testmydebug LIB LIB:LC.lib,LIB:amiga.lib,LIB:debug.lib
quit
*/

#include <exec/types.h>
#include <exec/memory.h>
#include <exec/libraries.h>
#include <libraries/dos.h>
#include <intuition/intuition.h>

#ifdef LATTICE
#include <clib/exec_protos.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
int CXBRK(void) { return(0); }  /* Disable Lattice CTRL/C handling */
int chkabort(void) { return(0); }  /* really */
#endif

#include "mydebug.h"

/* 2.0 style version string for the VERSION command */
char *vers = "\0$VER: testmydebug 36.10";

char *Copyright = 
"testmydebug v36.10\nCopyright (c) 1990 Commodore-Amiga, Inc.  All Rights Reserved";

struct 	Library *LibBase = NULL;

void main(int argc, char **argv)
	{
	LibBase = OpenLibrary("bogus.library",0);

	/* This will print if MYDEBUG is set in mydebug.h
	 * If KDEBUG is set in mydebug.h, this will kprintf instead of printf
	 */
	D(bug("OpenLibrary bogus.library returned $%lx\n",LibBase));

	/* This will print if MYDEBUG and DEBUGLEVEL2 are set in mydebug.h 
	 * If KDEBUG is set in mydebug.h, this will kprintf instead of printf
	 */
	D2(bug("AvailMem = $%lx\n",AvailMem(0L)));

	if(LibBase)	CloseLibrary(LibBase);
	exit(RETURN_OK);
	}
