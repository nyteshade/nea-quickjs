; 060-safe arithmetic candidates (no 64-bit MULU.L/DIVU.L forms). Research probes, not shipped.
	machine	68020
	section	code

; unsigned 32x32 -> 64.  in: 4(sp)=a, 8(sp)=b   out: d0=hi d1=lo.  4 x MULU.W, no trap on any CPU.
	xdef	_umul64_w
_umul64_w:
	movem.l	d2-d4,-(sp)
	move.l	16(sp),d0	; a
	move.l	20(sp),d1	; b
	move.l	d0,d2
	swap	d2		; d2.w = ah
	move.l	d1,d3
	swap	d3		; d3.w = bh
	move.l	d0,d4
	mulu.w	d1,d4		; d4 = al*bl
	mulu.w	d2,d1		; d1 = ah*bl
	mulu.w	d3,d0		; d0 = al*bh
	mulu.w	d3,d2		; d2 = ah*bh
	add.l	d0,d1		; d1 = cross (low 32), X = bit 32
	bcc.s	.nc
	add.l	#$10000,d2
.nc:	move.l	d1,d0
	clr.w	d0
	swap	d0		; d0 = cross >> 16
	swap	d1
	clr.w	d1		; d1 = cross << 16
	add.l	d4,d1		; lo
	addx.l	d2,d0		; hi
	movem.l	(sp)+,d2-d4
	rts

; reference: the trapping form (one instruction on 020/030/040)
	xdef	_umul64_l
_umul64_l:
	move.l	4(sp),d1
	mulu.l	8(sp),d0:d1
	rts

; unsigned 64 / 16-bit divisor -> 64-bit quotient, remainder.  in: 4(sp)=hi 8(sp)=lo 12(sp)=divisor(<65536) 16(sp)=uint32 *rem
; out d0=qhi d1=qlo.  4 x DIVU.W (32/16), no trap on any CPU.
	xdef	_udiv64_16
_udiv64_16:
	movem.l	d2-d3,-(sp)
	move.l	20(sp),d2	; divisor
	moveq	#0,d3
	move.w	12(sp),d3	; top 16 bits
	divu.w	d2,d3		; d3 = rem:q3
	move.w	d3,d0		; q3
	move.w	14(sp),d3	; rem:next16
	divu.w	d2,d3
	swap	d0
	move.w	d3,d0		; d0 = q3:q2
	move.w	16(sp),d3
	divu.w	d2,d3
	move.w	d3,d1
	move.w	18(sp),d3
	divu.w	d2,d3
	swap	d1
	move.w	d3,d1		; d1 = q1:q0
	clr.w	d3
	swap	d3		; remainder
	move.l	24(sp),a0
	move.l	d3,(a0)
	movem.l	(sp)+,d2-d3
	rts

; reference 64/32 with the trapping form: two chained DIVU.L 64/32
	xdef	_udiv64_32l
_udiv64_32l:
	movem.l	d2-d3,-(sp)
	move.l	12(sp),d0
	move.l	16(sp),d1
	move.l	20(sp),d2
	moveq	#0,d3
	divu.l	d2,d3:d0
	divu.l	d2,d3:d1
	move.l	24(sp),a0
	move.l	d3,(a0)
	movem.l	(sp)+,d2-d3
	rts
