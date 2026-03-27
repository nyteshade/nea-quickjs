*
* DebTones.asm and Sample calling program by C. Scheppner 
* A debugging routine and macro - hits the audio hardware to make a tone
* Can be useful when debugging drivers, devices, etc. without a terminal    
* For debugging use only - does not arbitrate for audio channel
* Macro usage: DEBTONE period (try 400 to 4000 for period) 
*
* Assemble, then link (no startup code)

	INCLUDE	"exec/types.i"

DEBUG	SET	1

	section code

	IFGT	DEBUG
	INCLUDE	"hardware/custom.i"
	INCLUDE	"hardware/dmabits.i"
	INCLUDE	"hardware/intbits.i"


* For software delay loops - Try 0 for 68000, 2 for 68020, 3 for 68030
PROSPEED	EQU	3
SDELAY		EQU	(64<<PROSPEED)

DEBTONE	MACRO	* period (try 400 to 4000)
	MOVE.W  #\1,$DFF000+aud0+ac_per
	JSR	DebTone(PC)
	ENDM
	ENDC

	IFEQ	DEBUG
DEBTONE	MACRO
* disabled debtone macro
	ENDC


*
* Sample program calling DEBTONE macro
*
main:
	DEBTONE 400
	DEBTONE 800
	DEBTONE 2000
	RTS


* DebTone subroutine called by the DEBTONE macro
* If you can place this close enough for a BSR, you can
* change the macro's JSR DebTone(PC) to BSR Debtone

	IFGT DEBUG	
DebTone:
	MOVE.L	#4,$DFF000+aud0+ac_ptr
	MOVE.W	#8,$DFF000+aud0+ac_len
	MOVE.W  #16,$DFF000+aud0+ac_vol
	MOVE.W  #(DMAF_SETCLR+DMAF_AUD0+DMAF_MASTER),$DFF000+dmacon
	MOVEM.L d0-d1,-(sp)
	MOVE.L	#SDELAY,d1
DebTone1
	MOVE.L	#3200,d0
DebTone2
	SUBQ.L	#1,d0
	BNE.S	DebTone2
	SUBQ.L	#1,d1
	BNE.S	DebTone1
	MOVEM.L	(sp)+,d0-d1
	MOVE.W  #0,$DFF000+aud0+ac_vol
	MOVE.W	#DMAF_AUD0,$DFF000+dmacon   ; turn off sound
        RTS
	ENDC

	END
