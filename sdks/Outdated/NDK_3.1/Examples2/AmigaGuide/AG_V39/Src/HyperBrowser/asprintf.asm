 *
 * (c) Copyright 1992-1996 ESCOM AG.  All rights reserved.
 *
 * This software is provided as-is and is subject to change; no warranties
 * are made.  All use is at your own risk.  No liability or responsibility
 * is assumed.
 *

	XDEF _asprintf
	XREF _AbsExecBase
	XREF _LVORawDoFmt

	section	text,code

; void ASM asprintf (REG (a3) STRPTR buffer, REG (a0) STRPTR fmt, REG (a1) APTR data);
_asprintf:	; ( ostring, format, {values} )
	movem.l a2/a6,-(sp)

	lea.l	stuffChar(pc),a2
	move.l	_AbsExecBase,a6
	jsr	_LVORawDoFmt(a6)

	movem.l (sp)+,a2/a6
	rts

;------ PutChProc function used by RawDoFmt -----------
stuffChar:
	move.b	d0,(a3)+        ;Put data to output string
	rts

	end
