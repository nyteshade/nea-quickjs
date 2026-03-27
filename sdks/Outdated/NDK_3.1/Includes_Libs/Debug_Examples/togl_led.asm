*
* blinkLED.asm - demonstrates blinking of the power LED
*
* Assemble, then link object with amiga.lib
*
	INCLUDE	"exec/types.i"
	INCLUDE "hardware/cia.i"

LDEBUG	SET 	1

	section code

	
	IFGT	LDEBUG
	XREF	_ciaapra
*
* TOGL_LED macro
*

TOGL_LED	MACRO
	BCHG.B	#CIAB_LED,_ciaapra
	ENDM
	ENDC

	IFEQ	LDEBUG
TOGL_LED	MACRO
	ENDM
	ENDC

*
* Sample program calling TOGL_LED macro
*
main:
	TOGL_LED
	move.l	#$200000,d0	; you'd be doing real code here
1$
	sub.l	#1,d0
	bne	1$
	TOGL_LED

	RTS

	END
