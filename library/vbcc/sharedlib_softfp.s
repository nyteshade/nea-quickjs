; sharedlib_softfp.s - double-precision support for the soft-float
; variants (the library built without -fpu). 68020 and up.
;
; qjs_dcmp: compare two doubles, with a separate answer for NaN.
;
;   int qjs_dcmp(double a, double b)        C call, arguments on the stack
;   returns d0 = -1  a < b
;                 0  a == b   (+0 and -0 are equal)
;                 1  a > b
;                 2  a or b is a NaN ("unordered")
;
; The engine's D_LT/D_LE/D_GT/D_GE/D_EQ/D_NE macros (quickjs-master/dcmp.h)
; call this instead of using the C operators, because the compare the
; compiler emits for a soft-float build cannot say "unordered"; dcmp.h
; has the whole story. The work is done on the bit patterns, so it does
; not depend on a maths library and costs about 25 instructions.

	machine	68020

	section	"CODE",code

	xdef	_qjs_dcmp
	cnop	0,4
_qjs_dcmp:
	movem.l	4(sp),d0-d1/a0-a1	; d0:d1 = a, a0:a1 = b (hi:lo)
	movem.l	d2-d3,-(sp)
	move.l	a0,d2
	move.l	a1,d3
	bsr.s	dcmp_core
	movem.l	(sp)+,d2-d3
	rts

; dcmp_core: d0:d1 = a, d2:d3 = b  ->  d0 = -1, 0, 1 or 2 as above.
; Destroys d1-d3 and a0.
;
; A double is a NaN when its exponent field is all ones and its
; fraction is not zero: with the sign shifted out, the high word is
; above $FFE00000, or equal to it with a non-zero low word.
; For the ordering each value is turned into a 64-bit two's complement
; number that sorts the same way: a negative double is sign and
; magnitude, so its magnitude is negated. That also makes -0 equal +0.
	cnop	0,4
dcmp_core:
	move.l	d0,a0
	add.l	d0,d0			; shift the sign out
	cmp.l	#$FFE00000,d0
	bcs.s	.a_num			; below: finite
	bhi.s	.unord
	tst.l	d1
	bne.s	.unord			; infinity has a zero fraction
.a_num:
	move.l	d2,d0
	add.l	d0,d0
	cmp.l	#$FFE00000,d0
	bcs.s	.b_num
	bhi.s	.unord
	tst.l	d3
	bne.s	.unord
.b_num:
	move.l	a0,d0
	bpl.s	.a_pos
	bclr	#31,d0
	neg.l	d1
	negx.l	d0
.a_pos:
	tst.l	d2
	bpl.s	.b_pos
	bclr	#31,d2
	neg.l	d3
	negx.l	d2
.b_pos:
	cmp.l	d2,d0			; high words, signed
	blt.s	.less
	bgt.s	.greater
	cmp.l	d3,d1			; low words, unsigned
	bcs.s	.less
	bhi.s	.greater
	moveq	#0,d0
	rts
.less:
	moveq	#-1,d0
	rts
.greater:
	moveq	#1,d0
	rts
.unord:
	moveq	#2,d0
	rts
