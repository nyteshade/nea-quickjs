*
* DTest.asm - demonstrates use of a parallel debugging macro from assembler 
*
* Assemble, then
* alink from dtest.o to dtest lib lib:amiga.lib,lib:ddebug.lib
*
	INCLUDE	"exec/types.i"

MYDEBUG	SET	1

	section code

* The debugging macro DDBUG
* Only generates code if MYDEBUG is > 0
*

	IFGT	MYDEBUG

* note - current 2.0 debug.lib has this entry
	XREF	DPutFmt

* DDBUG macro for format string and two variables
*	 preserves all registers   
*        outputs to parallel port   link with amiga.lib,ddebug.lib
* Usage: pass name of format string,value,value
*        values may be register name, variablename(PC), or #value
*        

DDBUG	MACRO	* passed name of format string, with args on stack
	MOVEM.L	d0-d7/a0-a6,-(sp)
	MOVE.L  \3,-(sp)
	MOVE.L  \2,-(sp)
	LEA.L	\1(PC),a0
	LEA.L   (sp),a1
	JSR	DPutFmt
	ADDA.L	#8,sp
	MOVEM.L	(sp)+,d0-d7/a0-a6	
	ENDM
	ENDC

	IFEQ	MYDEBUG
DDBUG	MACRO
* disabled debug macro
	ENDC

*
* Sample program calling DBUG macro
*
main:
	DDBUG	strTest,#0,#0	; Let's print test string first

	DDBUG	fmtA0,a0,#0	; Let's see what a0 contains

	* Let's see where we are and what D0 is
	* format string is 'In %s routine:  d0 = $%lx',10,0
	DDBUG	fmtRtnD0,#testname,d0  ; format string, addr of rtn name, d0

	RTS


	IFGT 	MYDEBUG
* your format strings for dprintf - linefeed and null terminated
strTest		DC.B	'This is a test of dprintf',10,0
fmtA0		DC.B	'a0 = $%lx',10,0
fmtRtnD0	DC.B	'In %s routine: d0 = $%lx',10,0

* other strings for insertion - null terminated
testname:	DC.B	'Test',0
	ENDC

	END
