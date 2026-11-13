; sharedlib_int64_soft.s - unsigned long -> double, soft-float variants
;
; The 64-bit integer helpers every variant needs are in
; sharedlib_int64.s and sharedlib_int64_conv.c. This file holds the one
; conversion helper that only a soft-float build calls.

	machine	68020

; ============================================================
; __ieeefltud: unsigned long → IEEE 754 double
; Input: d0 = unsigned long value
; Output: d0:d1 = IEEE 754 double (high:low)
; Uses MathIeeeDoubBasBase LVOs (IEEEDPFlt -36, IEEEDPAdd -66).
; Must be in assembly to avoid VBCC generating recursive softfloat calls.
; ============================================================
	xref	_MathIeeeDoubBasBase
	xdef	__ieeefltud
__ieeefltud:
	movem.l	d2-d3/a6,-(sp)
	move.l	16(sp),d0	; load arg from stack (VBCC pushes it, not in d0)
	move.l	_MathIeeeDoubBasBase,a6
	; IEEEDPFlt: signed long d0 → double d0:d1
	jsr	-36(a6)
	; Check if original value was >= 2^31 (result would be negative)
	tst.l	d0
	bpl.s	.fltud_done
	; Add 4294967296.0 (IEEE 0x41F00000_00000000)
	move.l	d0,d2
	move.l	d1,d3
	move.l	#$41F00000,d0
	moveq	#0,d1
	; IEEEDPAdd: d0:d1 + d2:d3 → d0:d1
	jsr	-66(a6)
.fltud_done:
	movem.l	(sp)+,d2-d3/a6
	rts
