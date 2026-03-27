*
* XipCode.asm - Minimal test of Amiga XIP (execute-in-place) code
* slink from xipcode.o to xipcode library lib:amiga.lib
*
	INCLUDE	"exec/types.i"
	INCLUDE	"exec/resident.i"
	INCLUDE	"exec/macros.i"
	INCLUDE "graphics/view.i"
	INCLUDE	"intuition/screens.i"

	section	text,code

bcresident:
		dc.w	RTC_MATCHWORD
		dc.l	bcresident
		dc.l	EndModule
		dc.b	RTF_COLDSTART
		dc.b	0
		dc.b	0
		dc.b	0		;before strap
		dc.l	0
		dc.l	0
		dc.l	startme

startme:

	movem.l	d1-d7/a0-a6,-(sp)

	move.l	4,a6
	lea	iname(pc),a1
	moveq	#00,d0

	JSRLIB	OpenLibrary
	tst.l	d0
	beq.s	badopen

	move.l	d0,a6			;intuition

	lea	myscreen,a0
	JSRLIB	OpenScreen
;	tst.l	d0
;	beq.s	badopen


wait:
	btst	#6,$bfe001
	bne.s	wait			;wait for mouse button

	move.l	d0,a0
	JSRLIB	CloseScreen

	moveq	#00,d0			;if not joy fire, return FALSE
	btst	#7,$bfe001
	bne.s	badopen
	moveq	#01,d0			;if joy fire, return TRUE
badopen:
	movem.l	(sp)+,d1-d7/a0-a6
	rts

myscreen:
	dc.w	0
	dc.w	0
	dc.w	640
	dc.w	200
	dc.w	2
	dc.b	0
	dc.b	1
	dc.w	V_HIRES
	dc.w	CUSTOMSCREEN
	dc.l	0
	dc.l	myname
	dc.l	0
	dc.l	0

myname:
	dc.b	'Just a test screen',0

iname:
	dc.b	'intuition.library',0

	CNOP 0,4
EndModule:

	end
