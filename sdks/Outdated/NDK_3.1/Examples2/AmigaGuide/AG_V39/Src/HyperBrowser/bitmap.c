/* bitmap.c
 *
 * (c) Copyright 1992-1996 ESCOM AG.  All rights reserved.
 *
 * This software is provided as-is and is subject to change; no warranties
 * are made.  All use is at your own risk.  No liability or responsibility
 * is assumed.
 *
 */

#include "hyperbrowser.h"

/*****************************************************************************/

STRPTR DumpBitMapFlags (struct GlobalData *gd, struct Screen *scr)
{
    UBYTE buffer[256];
    ULONG value;

    memset (buffer, 0, sizeof (buffer));

    value = GetBitMapAttr (scr->RastPort.BitMap, BMA_FLAGS);
    if (value & BMF_DISPLAYABLE)
	strcat (buffer, "displayable ");
    if (value & BMF_INTERLEAVED)
	strcat (buffer, "interleaved ");
    if (value & BMF_STANDARD)
	strcat (buffer, "standard ");

    return (buffer);
}

