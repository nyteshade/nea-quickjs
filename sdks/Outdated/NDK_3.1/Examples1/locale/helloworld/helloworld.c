/*
COPYRIGHT: Unless otherwise noted, all files are Copyright (c) 1992-1996
ESCOM AG.  All rights reserved.

DISCLAIMER: This software is provided "as is".  No representations or
warranties are made with respect to the accuracy, reliability, performance,
currentness, or operation of this software, and all use is at your own risk.
Neither commodore nor the authors assume any responsibility or liability
whatsoever with respect to your use of this software.
*/

#include <exec/types.h>
#include <libraries/locale.h>
#include <stdio.h>
#include <dos.h>

#include <clib/exec_protos.h>
#include <clib/locale_protos.h>

#include <pragmas/exec_pragmas.h>
#include <pragmas/locale_pragmas.h>

#define CATCOMP_NUMBERS
#include "helloworld_strings.h"


extern struct Library *SysBase;
extern struct Library *DOSBase;
struct Library *LocaleBase;


STRPTR __asm GetString(register __a0 struct LocaleInfo *li,
                       register __d0 LONG stringNum);


VOID main(VOID)
{
struct LocaleInfo li;

    li.li_Catalog = NULL;
    if (LocaleBase = OpenLibrary("locale.library",38))
    {
        li.li_LocaleBase = LocaleBase;
        li.li_Catalog    = OpenCatalogA(NULL,"helloworld.catalog",NULL);
    }

    printf("%s\n",GetString(&li,MSG_HELLO));
    printf("%s\n",GetString(&li,MSG_BYE));

    if (LocaleBase)
    {
        CloseCatalog(li.li_Catalog);
        CloseLibrary(LocaleBase);
    }
}
