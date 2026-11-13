; sharedlib_softfp.s - IEEE 754 double arithmetic for the soft-float
; variants (the library built without -fpu). 68020 and up.
;
; WHAT THIS IS
;
; vbcc's -amiga-softfloat compiles every double operation into an inline
; call through a library base it expects the program to define:
;
;       move.l  _MathIeeeDoubBasBase,a6
;       jsr     -78(a6)                 ; IEEEDPMul, for "a * b"
;
; Until 0.231 that base was the operating system's mathieeedoubbas.library.
; On a machine without an FPU that library (47.3 was measured) is not an
; IEEE 754 implementation, and JavaScript needs one:
;
;   - it has no infinity: 1e308 * 10 gave 1.797e308, 1 / 5e-324 the same,
;     so "while (x < Infinity) x *= 2" never ended;
;   - it has no gradual underflow: 5e-324 / 2 gave 5e-324, so
;     "while (x > 0) x /= 2" never ended; 2 ** -1074 was 5.56e-309;
;   - NaN is not propagated: 1.797e308 + 1e300 gave NaN, NaN operands
;     gave numbers;
;   - multiplication dropped a carry for some operands:
;     2147483647 * 4294967295 was wrong in the 8th digit;
;   - division was not correctly rounded (1 / 1e-300 one unit low);
;   - IEEEDPFloor(-0) was -1 and IEEEDPCeil(+0) was +1, which made
;     Math.floor(-0) = -1, Math.ceil(0) = 1 and new Date(-0) one
;     millisecond before the epoch;
;   - IEEEDPFix is a signed conversion, but the compiler also uses it
;     for (unsigned)d, so values from 2^31 up converted wrongly.
;
; So the soft variants now bring their own arithmetic. This file lays
; out two jump tables shaped like library bases and
; sharedlib_math_soft.c points MathIeeeDoubBasBase and
; MathIeeeDoubTransBase at them. No C source had to change for that: the
; compiler's inline calls land here. The FPU variants do not link this
; file.
;
; The routines keep the library's register conventions, because that is
; what the compiler's call sites assume: first operand in d0:d1 (high
; word, low word), second in d2:d3, result in d0:d1 (d0 for an
; integer). d0, d1, a0 and a1 are scratch; everything else is preserved.
;
; Results are correctly rounded (round to nearest, ties to even), with
; signed zeros, denormals, infinities and NaN as IEEE 754 specifies. A
; NaN result is always the quiet NaN $7FF80000 00000000.
;
; THE ONE THING IT CANNOT DO: the compare entry (-42) has to return
; -1, 0 or +1, because the caller branches on that number, and that
; leaves no way to say "unordered". It answers +1 when an operand is a
; NaN, which makes <, <= and == false and != true, but > and >= true.
; That is why the engine never uses the C comparison operators on
; doubles: it calls qjs_dcmp below through the D_xx macros of
; quickjs-master/dcmp.h, and "make check-dcmp" proves no compiler-made
; compare is left. The -42 and -48 entries are only a safety net.
;
; 68060: the 64-bit forms of MULU.L and DIVU.L are not implemented on a
; 68060 and trap. When assembled with -m68060 the multiply uses 16-bit
; MULU.W steps and the divide a shift-and-subtract loop instead. The
; assembler's __VASM symbol has bit 5 set for the 68060 instruction set.
;
; Tested by library/vbcc/tests/softfp/run.sh: every routine
; against a host-generated table of operands and expected bit patterns.

NO_MUL64	set	(__VASM&32)

	section	"CODE",code

; ---------------------------------------------------------------------
; The two fake library bases. A library function at offset -N is reached
; with "jsr -N(a6)", so the vectors sit below the base label, six bytes
; each like a real library's JMP table.
; ---------------------------------------------------------------------

VEC	macro
	bra.w	\1
	nop
	endm

	cnop	0,4
bas_vectors:
	VEC	sf_ceil			; -96 IEEEDPCeil
	VEC	sf_floor		; -90 IEEEDPFloor
	VEC	sf_div			; -84 IEEEDPDiv
	VEC	sf_mul			; -78 IEEEDPMul
	VEC	sf_sub			; -72 IEEEDPSub
	VEC	sf_add			; -66 IEEEDPAdd
	VEC	sf_neg			; -60 IEEEDPNeg
	VEC	sf_abs			; -54 IEEEDPAbs
	VEC	sf_tst			; -48 IEEEDPTst
	VEC	sf_cmp			; -42 IEEEDPCmp
	VEC	sf_flt			; -36 IEEEDPFlt
	VEC	sf_fix			; -30 IEEEDPFix
	VEC	sf_unused		; -24 reserved
	VEC	sf_unused		; -18 Expunge
	VEC	sf_unused		; -12 Close
	VEC	sf_unused		; -6  Open
	xdef	_qjs_softfp_bas
_qjs_softfp_bas:
	dc.l	0			; never read; keeps the label inside the section

	ifne	(_qjs_softfp_bas-bas_vectors)-96
	fail	"softfp: the vector table is not 16 six-byte entries"
	endc

; mathieeedoubtrans: the compiler itself only calls two of its vectors,
; the conversions between float and double. The transcendental functions
; are called explicitly, through the real library, by sharedlib_math_soft.c.
	cnop	0,4
trans_vectors:
	VEC	sf_fieee		; -108 IEEEDPFieee  float -> double
	VEC	sf_tieee		; -102 IEEEDPTieee  double -> float
	rept	16
	VEC	sf_unused		; -96 .. -6: not reachable from compiled code
	endr
	xdef	_qjs_softfp_trans
_qjs_softfp_trans:
	dc.l	0

	ifne	(_qjs_softfp_trans-trans_vectors)-108
	fail	"softfp: the trans vector table is not 18 six-byte entries"
	endc

sf_unused:
	moveq	#0,d0
	moveq	#0,d1
	rts

; 32 x 32 -> 64 bit unsigned multiply:  MULU64 src,hi,lo  (lo * src -> hi:lo)
; Flags are not meaningful afterwards.
MULU64	macro
	ifne	NO_MUL64
	move.l	\1,-(sp)
	move.l	\3,-(sp)
	bsr	mul32x32
	move.l	(sp)+,\2
	move.l	(sp)+,\3
	else
	mulu.l	\1,\2:\3
	endc
	endm

; 64 / 32 -> 32 bit unsigned divide of d0:d1 by d2, for d0 < d2:
; quotient in d1, remainder in d0. Destroys d7 on the 68060 path.
DIVU64	macro
	ifne	NO_MUL64
	bsr	div64x32
	else
	divu.l	d2,d0:d1
	endc
	endm

	ifne	NO_MUL64
; in:  4(sp) = a, 8(sp) = b      out: 4(sp) = high, 8(sp) = low of a * b
mul32x32:
	movem.l	d0-d4,-(sp)
	move.l	24(sp),d0
	move.l	28(sp),d1
	move.w	d0,d2
	mulu.w	d1,d2			; al * bl
	move.l	d0,d3
	swap	d3
	mulu.w	d1,d3			; ah * bl
	move.l	d1,d4
	swap	d4
	mulu.w	d0,d4			; bh * al
	swap	d0
	swap	d1
	mulu.w	d1,d0			; ah * bh
	add.l	d4,d3			; the two middle products
	bcc.s	.nc
	add.l	#$10000,d0
.nc:	swap	d3
	moveq	#0,d4
	move.w	d3,d4			; their high half goes to the high word
	clr.w	d3			; their low half, shifted up, to the low word
	add.l	d3,d2
	addx.l	d4,d0
	move.l	d0,24(sp)
	move.l	d2,28(sp)
	movem.l	(sp)+,d0-d4
	rts

div64x32:
	moveq	#31,d7
.loop:	add.l	d1,d1
	addx.l	d0,d0
	bcs.s	.sub
	cmp.l	d2,d0
	bcs.s	.next
.sub:	sub.l	d2,d0
	addq.l	#1,d1
.next:	dbf	d7,.loop
	rts
	endc

; ---------------------------------------------------------------------
; qjs_dcmp: compare two doubles, with a separate answer for NaN.
;
;   int qjs_dcmp(double a, double b)        C call, arguments on the stack
;   returns d0 = -1  a < b
;                 0  a == b   (+0 and -0 are equal)
;                 1  a > b
;                 2  a or b is a NaN ("unordered")
; ---------------------------------------------------------------------
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

; -42 compare: d0 = -1, 0, +1 and the condition codes of that number.
; A NaN operand answers +1 (see the note at the top of the file).
sf_cmp:
	movem.l	d2-d3,-(sp)
	bsr.s	dcmp_core
	movem.l	(sp)+,d2-d3
	cmp.w	#2,d0
	bne.s	.ok
	moveq	#1,d0
.ok:	tst.l	d0
	rts

; -48 test against zero: d0 = -1, 0, +1. NaN answers +1.
sf_tst:
	move.l	d0,a0
	add.l	d0,d0
	or.l	d1,d0
	beq.s	.done			; +0 or -0: d0 is 0 and Z is set
	move.l	a0,d0
	bpl.s	.pos
	add.l	d0,d0
	cmp.l	#$FFE00000,d0
	bhi.s	.pos			; NaN with the sign bit set
	bne.s	.neg
	tst.l	d1
	bne.s	.pos
.neg:	moveq	#-1,d0
	rts
.pos:	moveq	#1,d0
.done:	rts

; -60 negate, -54 absolute value: only the sign bit changes.
sf_neg:
	bchg	#31,d0
	rts
sf_abs:
	bclr	#31,d0
	rts

; ---------------------------------------------------------------------
; -36 signed 32-bit integer in d0 -> double. Always exact.
; ---------------------------------------------------------------------
sf_flt:
	tst.l	d0
	bne.s	.nz
	moveq	#0,d1
	rts
.nz:	move.l	d2,-(sp)
	move.l	d0,d2			; keeps the sign
	bpl.s	.abs
	neg.l	d0
.abs:	bfffo	d0{0:32},d1		; number of leading zero bits, 0..31
	lsl.l	d1,d0			; leading one now in bit 31
	neg.l	d1
	add.l	#1023+31,d1		; biased exponent
	swap	d1
	lsl.l	#4,d1			; into bits 30..20
	and.l	#$80000000,d2
	or.l	d1,d2			; sign and exponent
	move.l	d0,d1
	swap	d1
	clr.w	d1
	lsl.l	#5,d1			; low word: the bottom 11 bits, at the top
	add.l	d0,d0			; drop the leading one
	lsr.l	#8,d0
	lsr.l	#4,d0			; the top 20 fraction bits
	or.l	d2,d0
	move.l	(sp)+,d2
	rts

; ---------------------------------------------------------------------
; -30 double -> 32-bit integer, rounding toward zero.
; For |x| < 2^32 the result is the low 32 bits of the integer, so the
; same routine serves (int)x and (unsigned)x, which is how the compiler
; uses it. NaN gives 0; anything of magnitude 2^32 or more gives
; $7FFFFFFF or $80000000 by sign.
; ---------------------------------------------------------------------
sf_fix:
	move.l	d2,-(sp)
	move.l	d0,d2			; keeps the sign
	bclr	#31,d0
	cmp.l	#$3FF00000,d0
	bcs.s	.zero			; |x| < 1
	cmp.l	#$41F00000,d0
	bcc.s	.big			; |x| >= 2^32, infinity or NaN
	move.l	d0,a0
	lsl.l	#8,d0
	lsl.l	#3,d0
	bset	#31,d0			; leading one and 20 fraction bits
	lsr.l	#8,d1
	lsr.l	#8,d1
	lsr.l	#5,d1			; the next 11 fraction bits
	or.l	d1,d0			; 32 significant bits, leading one in bit 31
	move.l	a0,d1
	swap	d1
	lsr.w	#4,d1			; biased exponent, 1023..1054
	sub.w	#1023+31,d1
	neg.w	d1			; 31 - (exponent - 1023): 0..31
	lsr.l	d1,d0
	tst.l	d2
	bpl.s	.done
	neg.l	d0
.done:	move.l	(sp)+,d2
	rts
.zero:	moveq	#0,d0
	bra.s	.done
.big:	cmp.l	#$7FF00000,d0
	bhi.s	.zero			; NaN
	bne.s	.sat
	tst.l	d1
	bne.s	.zero			; NaN
.sat:	move.l	#$7FFFFFFF,d0
	tst.l	d2
	bpl.s	.done
	addq.l	#1,d0			; $80000000
	bra.s	.done

; ---------------------------------------------------------------------
; shr64s: shift d2:d3 right by d6.w (1 or more) bits. Any one bit
; shifted out sets bit 0 of the result (the "sticky" bit that rounding
; needs). Destroys d5, d6 and a0; preserves d4 through a1.
; ---------------------------------------------------------------------
shr64s:
	cmp.w	#32,d6
	bcs.s	.lt32
	cmp.w	#64,d6
	bcc.s	.all
	sub.w	#32,d6			; 32..63: the low word is lost whole
	move.l	d3,d5
	move.l	d2,d3
	moveq	#0,d2
	tst.w	d6
	beq.s	.st
	move.l	d4,a1
	move.l	d5,a0
	moveq	#32,d4
	sub.w	d6,d4
	move.l	d3,d5
	lsl.l	d4,d5			; the bits about to be lost
	lsr.l	d6,d3
	move.l	a0,d6
	or.l	d6,d5
	move.l	a1,d4
.st:	tst.l	d5
	beq.s	.ret
	bset	#0,d3
.ret:	rts
.lt32:	move.l	d4,a1
	moveq	#32,d4
	sub.w	d6,d4			; 32 - n
	move.l	d3,d5
	lsl.l	d4,d5			; the bits about to be lost
	move.l	d5,a0
	lsr.l	d6,d3
	move.l	d2,d5
	lsl.l	d4,d5
	or.l	d5,d3
	lsr.l	d6,d2
	move.l	a1,d4
	move.l	a0,d5
	beq.s	.ret
	bset	#0,d3
	rts
.all:	move.l	d2,d5
	or.l	d3,d5
	moveq	#0,d2
	moveq	#0,d3
	tst.l	d5
	beq.s	.ret
	moveq	#1,d3
	rts

; ---------------------------------------------------------------------
; sf_pack: round and assemble a result, then return to the caller of the
; arithmetic routine (which pushed d2-d7).
;   d0:d1  significand, leading one in bit 63; bit 0 may be a sticky bit
;   d4.w   biased exponent of that leading one (may be <= 0 or >= $7FF)
;   d7     sign in bit 31
; The low 11 bits decide the rounding: bit 10 is the half, the rest say
; whether the value is above the half.
; ---------------------------------------------------------------------
sf_pack:
	tst.w	d4
	ble.s	pack_den
	cmp.w	#$7FF,d4
	bge.s	pack_inf
pack_go:
	move.w	d1,d5
	and.w	#$7FF,d5		; the rounding bits
	lsr.l	#8,d1
	lsr.l	#3,d1
	move.l	d0,d6
	swap	d6
	clr.w	d6
	lsl.l	#5,d6			; the 11 bits that cross into the low word
	or.l	d6,d1
	lsr.l	#8,d0
	lsr.l	#3,d0			; leading one now in bit 20
	subq.w	#1,d4			; the leading one itself adds 1 to the
	swap	d4			;   exponent field; a denormal has none
	clr.w	d4			;   and gets exponent field 0
	lsl.l	#4,d4
	add.l	d4,d0
	cmp.w	#$400,d5
	bcs.s	pack_sign		; below half: truncate
	bhi.s	.up
	btst	#0,d1			; exactly half: to even
	beq.s	pack_sign
.up:	addq.l	#1,d1			; a carry runs into the exponent, which
	bcc.s	pack_sign		;   is right, up to and including infinity
	addq.l	#1,d0
pack_sign:
	and.l	#$80000000,d7
	or.l	d7,d0
sf_ret:
	movem.l	(sp)+,d2-d7
	rts
pack_den:				; denormal or zero: shift down to exponent 1
	move.l	d0,d2
	move.l	d1,d3
	moveq	#1,d6
	sub.w	d4,d6
	bsr	shr64s
	move.l	d2,d0
	move.l	d3,d1
	moveq	#1,d4
	bra.s	pack_go
pack_inf:
	move.l	#$7FF00000,d0
	moveq	#0,d1
	bra.s	pack_sign

ret_nan:
	move.l	#$7FF80000,d0
	moveq	#0,d1
	bra.s	sf_ret

; EXPS: biased exponents of d0 (into d4.w) and d2 (into d5.w)
EXPS	macro
	move.l	d0,d4
	swap	d4
	lsr.w	#4,d4
	and.w	#$7FF,d4
	move.l	d2,d5
	swap	d5
	lsr.w	#4,d5
	and.w	#$7FF,d5
	endm

; SHL64 hi,lo,8,m,tmp: shift a 64-bit value left by 8+m bits (m 1..7;
; an immediate shift count cannot exceed 8). The bits leaving the low
; word are rotated round and moved over.
SHL64	macro
	lsl.l	#\3,\1
	lsl.l	#\4,\1
	rol.l	#\3,\2
	rol.l	#\4,\2
	move.w	\2,\5
	and.w	#(1<<(\3+\4))-1,\5
	or.w	\5,\1
	eor.w	\5,\2
	endm

; ISNAN hi,lo,tmp,label: branch to label if hi:lo is a NaN
ISNAN	macro
	move.l	\1,\3
	add.l	\3,\3
	cmp.l	#$FFE00000,\3
	bhi	\4
	bne.s	.nn\@
	tst.l	\2
	bne	\4
.nn\@:
	endm

; ---------------------------------------------------------------------
; -66 add, -72 subtract
; ---------------------------------------------------------------------
sf_sub:
	movem.l	d2-d7,-(sp)
	bchg	#31,d2
	bra.s	add_common
sf_add:
	movem.l	d2-d7,-(sp)
add_common:
	move.l	d0,d7
	and.l	#$80000000,d7		; bit 31: sign of the result so far (a's)
	move.l	d0,d5
	eor.l	d2,d5
	bpl.s	.same
	bset	#0,d7			; bit 0: the signs differ, so subtract
.same:	EXPS
	cmp.w	#$7FF,d4
	beq	add_special
	cmp.w	#$7FF,d5
	beq	add_special
	and.l	#$000FFFFF,d0
	tst.w	d4
	beq.s	.a_den
	bset	#20,d0
	bra.s	.a_ok
.a_den:	moveq	#1,d4			; zero and denormals: exponent 1, no leading one
.a_ok:	and.l	#$000FFFFF,d2
	tst.w	d5
	beq.s	.b_den
	bset	#20,d2
	bra.s	.b_ok
.b_den:	moveq	#1,d5
.b_ok:	SHL64	d0,d1,8,2,d6		; leading ones to bit 62: one bit of
	SHL64	d2,d3,8,2,d6		;   headroom above, ten guard bits below
	move.w	d4,d6
	sub.w	d5,d6			; how far b must move down
	bge.s	.order
	exg	d0,d2			; keep the larger exponent in a
	exg	d1,d3
	move.w	d5,d4
	neg.w	d6
	btst	#0,d7
	beq.s	.order
	bchg	#31,d7			; the result takes b's sign
.order:	tst.w	d6
	beq.s	.go
	bsr	shr64s
.go:	btst	#0,d7
	bne.s	.sub
	add.l	d3,d1
	addx.l	d2,d0
	bra.s	.norm
.sub:	sub.l	d3,d1
	subx.l	d2,d0
	bcc.s	.diff
	neg.l	d1			; b was the larger: negate, flip the sign
	negx.l	d0
	bchg	#31,d7
.diff:	move.l	d0,d5
	or.l	d1,d5
	bne.s	.norm
	moveq	#0,d0			; x - x is +0 in round-to-nearest
	moveq	#0,d1
	bra	sf_ret
.norm:	tst.l	d0			; bring the leading one up to bit 63
	bmi.s	.top
	bne.s	.shift
	tst.l	d1
	beq.s	.zero			; (+0) + (+0) or (-0) + (-0)
	move.l	d1,d0
	moveq	#0,d1
	sub.w	#32,d4
.shift:	bfffo	d0{0:32},d6
	lsl.l	d6,d0
	move.l	d1,d5
	lsl.l	d6,d1
	moveq	#32,d2
	sub.w	d6,d2
	lsr.l	d2,d5			; a count of 32 gives 0, as wanted
	or.l	d5,d0
	sub.w	d6,d4
.top:	addq.w	#1,d4			; bit 63 is one place above bit 62
	bra	sf_pack
.zero:	moveq	#0,d0
	bra	pack_sign

; an operand is infinite or a NaN (b's sign already flipped for subtract)
add_special:
	ISNAN	d0,d1,d6,ret_nan
	ISNAN	d2,d3,d6,ret_nan
	cmp.w	#$7FF,d4
	bne.s	.b_inf			; a is finite, so b is the infinity
	cmp.w	#$7FF,d5
	bne	sf_ret			; only a is infinite: the answer is a
	btst	#0,d7
	bne	ret_nan			; infinity minus infinity
	bra	sf_ret
.b_inf:	move.l	d2,d0
	move.l	d3,d1
	bra	sf_ret

; NORMDEN hi,lo,exp: give a denormal its leading one in bit 20 of hi,
; with the exponent that goes with it (1 minus the number of shifts)
NORMDEN	macro
	moveq	#1,\3
.nd\@:	add.l	\2,\2
	addx.l	\1,\1
	subq.w	#1,\3
	btst	#20,\1
	beq.s	.nd\@
	endm

; ---------------------------------------------------------------------
; -78 multiply
; ---------------------------------------------------------------------
sf_mul:
	movem.l	d2-d7,-(sp)
	move.l	d0,d7
	eor.l	d2,d7			; sign of the result
	EXPS
	cmp.w	#$7FF,d4
	beq	mul_special
	cmp.w	#$7FF,d5
	beq	mul_special
	and.l	#$000FFFFF,d0
	and.l	#$000FFFFF,d2
	tst.w	d4
	bne.s	.a_norm
	move.l	d0,d6
	or.l	d1,d6
	beq	ret_zero
	NORMDEN	d0,d1,d4
	bra.s	.a_ok
.a_norm:
	bset	#20,d0
.a_ok:	tst.w	d5
	bne.s	.b_norm
	move.l	d2,d6
	or.l	d3,d6
	beq	ret_zero
	NORMDEN	d2,d3,d5
	bra.s	.b_ok
.b_norm:
	bset	#20,d2
.b_ok:	add.w	d5,d4
	sub.w	#1023,d4
	SHL64	d0,d1,8,3,d6		; both leading ones to bit 63
	SHL64	d2,d3,8,3,d6
	move.w	d4,a0			; free d4 and d7 for the products
	move.l	d7,a1
	; (d0:d1) * (d2:d3) -> d3:d0:d6:d5, a 128-bit product
	move.l	d1,d5
	MULU64	d3,d6,d5		; d6:d5 = al * bl
	move.l	d0,d4
	MULU64	d3,d7,d4		; d7:d4 = ah * bl
	add.l	d4,d6
	moveq	#0,d4
	addx.l	d4,d7
	MULU64	d2,d4,d1		; d4:d1 = al * bh
	add.l	d1,d6
	addx.l	d4,d7
	moveq	#0,d1
	addx.l	d1,d1			; the carry out of that sum
	MULU64	d2,d3,d0		; d3:d0 = ah * bh
	add.l	d7,d0
	addx.l	d1,d3
	move.w	a0,d4
	tst.l	d3			; the product of two numbers in [1,2)
	bmi.s	.top			;   is in [1,4): leading one in bit 127
	add.l	d6,d6			;   or in bit 126
	addx.l	d0,d0
	addx.l	d3,d3
	bra.s	.m
.top:	addq.w	#1,d4
.m:	or.l	d5,d6			; everything below the top 64 bits
	beq.s	.exact
	bset	#0,d0
.exact:	move.l	d0,d1
	move.l	d3,d0
	move.l	a1,d7
	bra	sf_pack

ret_zero:				; a zero with the sign in d7
	moveq	#0,d0
	moveq	#0,d1
	bra	pack_sign
ret_inf:				; an infinity with the sign in d7
	bra	pack_inf

; ISZERO hi,lo,tmp: Z set if hi:lo is +0 or -0
ISZERO	macro
	move.l	\1,\3
	add.l	\3,\3
	or.l	\2,\3
	endm

mul_special:				; an operand is infinite or a NaN
	ISNAN	d0,d1,d6,ret_nan
	ISNAN	d2,d3,d6,ret_nan
	ISZERO	d0,d1,d6
	beq	ret_nan			; zero times infinity
	ISZERO	d2,d3,d6
	beq	ret_nan
	bra	ret_inf

; ---------------------------------------------------------------------
; -84 divide
;
; Both significands are moved up to bit 63. If the dividend is not
; below the divisor it is halved, so the quotient X * 2^64 / D lies in
; [2^63, 2^64) and is the result's significand directly. It is found
; as two 32-bit digits by schoolbook division: each digit is estimated
; from the divisor's high word (at most 2 too large, since that word
; has its top bit set) and corrected by adding the divisor back.
; ---------------------------------------------------------------------
sf_div:
	movem.l	d2-d7,-(sp)
	move.l	d0,d7
	eor.l	d2,d7			; sign of the result
	EXPS
	cmp.w	#$7FF,d4
	beq	div_special
	cmp.w	#$7FF,d5
	beq	div_special
	and.l	#$000FFFFF,d0
	and.l	#$000FFFFF,d2
	tst.w	d5
	bne.s	.b_norm
	move.l	d2,d6
	or.l	d3,d6
	bne.s	.b_den
	tst.w	d4			; division by zero
	bne	ret_inf
	move.l	d0,d6
	or.l	d1,d6
	beq	ret_nan			; 0 / 0
	bra	ret_inf
.b_den:	NORMDEN	d2,d3,d5
	bra.s	.b_ok
.b_norm:
	bset	#20,d2
.b_ok:	tst.w	d4
	bne.s	.a_norm
	move.l	d0,d6
	or.l	d1,d6
	beq	ret_zero
	NORMDEN	d0,d1,d4
	bra.s	.a_ok
.a_norm:
	bset	#20,d0
.a_ok:	sub.w	d5,d4
	add.w	#1023-1,d4
	SHL64	d0,d1,8,3,d6
	SHL64	d2,d3,8,3,d6
	cmp.l	d2,d0
	bcs.s	.below
	bhi.s	.halve
	cmp.l	d3,d1
	bcs.s	.below
.halve:	lsr.l	#1,d0
	roxr.l	#1,d1
	addq.w	#1,d4
.below:	move.w	d4,a0
	move.l	d7,a1
	; first digit: (d0:d1:0) / (d2:d3) -> d5, remainder d0:d6
	cmp.l	d2,d0
	bcc.s	.ovf1
	DIVU64
	move.l	d1,d5
	move.l	d3,d6
	MULU64	d5,d7,d6
	neg.l	d6
	subx.l	d7,d0
	bcc.s	.ok1
.fix1:	subq.l	#1,d5
	add.l	d3,d6
	addx.l	d2,d0
	bcc.s	.fix1
.ok1:	; second digit: (d0:d6:0) / (d2:d3) -> d1, remainder d0:d6
	cmp.l	d2,d0
	bcc.s	.ovf2
	move.l	d6,d1
	DIVU64
	move.l	d3,d6
	MULU64	d1,d7,d6
	neg.l	d6
	subx.l	d7,d0
	bcc.s	.ok2
.fix2:	subq.l	#1,d1
	add.l	d3,d6
	addx.l	d2,d0
	bcc.s	.fix2
.ok2:	or.l	d6,d0			; a remainder means the quotient is inexact
	beq.s	.exact
	bset	#0,d1
.exact:	move.l	d5,d0
	move.w	a0,d4
	move.l	a1,d7
	bra	sf_pack
	; The high word equals the divisor's: the digit estimate is
	; $FFFFFFFF, and the remainder is (low - dlow + dhigh):dlow, which
	; is negative unless that addition carries.
.ovf1:	moveq	#-1,d5
	move.l	d1,d0
	sub.l	d3,d0
	move.l	d3,d6
	add.l	d2,d0
	bcc.s	.fix1
	bra.s	.ok1
.ovf2:	moveq	#-1,d1
	move.l	d6,d0
	sub.l	d3,d0
	move.l	d3,d6
	add.l	d2,d0
	bcc.s	.fix2
	bra.s	.ok2

div_special:				; an operand is infinite or a NaN
	ISNAN	d0,d1,d6,ret_nan
	ISNAN	d2,d3,d6,ret_nan
	cmp.w	#$7FF,d4
	bne	ret_zero		; finite / infinity
	cmp.w	#$7FF,d5
	beq	ret_nan			; infinity / infinity
	bra	ret_inf

; ---------------------------------------------------------------------
; -90 floor: the largest integer not above x. floor(-0) is -0.
; -96 ceil:  -floor(-x), which also gives ceil(-0.5) = -0.
; ---------------------------------------------------------------------
sf_ceil:
	bchg	#31,d0
	bsr.s	sf_floor
	bchg	#31,d0
	rts

sf_floor:
	movem.l	d2-d3,-(sp)
	move.l	d0,d2
	swap	d2
	lsr.w	#4,d2
	and.w	#$7FF,d2
	sub.w	#1023,d2		; the exponent, unbiased
	blt.s	.small			; |x| < 1
	cmp.w	#52,d2
	bge.s	.done			; no fraction bits; also infinity and NaN
	cmp.w	#20,d2
	bge.s	.lo
	; fraction: the low 20-e bits of the high word and all the low word
	moveq	#20,d3
	sub.w	d2,d3
	moveq	#-1,d2
	lsl.l	d3,d2			; ones over the integer bits
	move.l	d0,d3
	and.l	d2,d3			; high word with the fraction cut off
	cmp.l	d3,d0
	bne.s	.hfrac
	tst.l	d1
	beq.s	.done			; already an integer
.hfrac:	tst.l	d0
	bpl.s	.hcut
	neg.l	d2			; negative: one more in magnitude; a
	add.l	d2,d3			;   carry into the exponent is right
.hcut:	move.l	d3,d0
	moveq	#0,d1
	bra.s	.done
.lo:	; fraction: the low 52-e bits (1..32) of the low word
	moveq	#52,d3
	sub.w	d2,d3
	moveq	#-1,d2
	lsl.l	d3,d2			; a count of 32 gives 0, as wanted
	move.l	d1,d3
	and.l	d2,d3
	cmp.l	d3,d1
	beq.s	.done			; already an integer
	tst.l	d0
	bpl.s	.lcut
	neg.l	d2			; the unit of the integer part
	bne.s	.addlo
	addq.l	#1,d0			; it is the high word's bit 0
	bra.s	.lcut
.addlo:	add.l	d2,d3
	bcc.s	.lcut
	addq.l	#1,d0
.lcut:	move.l	d3,d1
.done:	movem.l	(sp)+,d2-d3
	rts
.small:	tst.l	d0
	bmi.s	.sneg
	moveq	#0,d0			; 0 <= x < 1
	moveq	#0,d1
	bra.s	.done
.sneg:	move.l	d0,d2
	add.l	d2,d2
	or.l	d1,d2
	beq.s	.done			; -0 stays -0
	move.l	#$BFF00000,d0		; -1 < x < 0
	moveq	#0,d1
	bra.s	.done

; ---------------------------------------------------------------------
; -102 double in d0:d1 -> float in d0, correctly rounded
; ---------------------------------------------------------------------
sf_tieee:
	movem.l	d2-d5,-(sp)
	move.l	d0,d4			; keeps the sign
	move.l	d0,d2
	swap	d2
	lsr.w	#4,d2
	and.w	#$7FF,d2
	cmp.w	#$7FF,d2
	beq.s	.special
	and.l	#$000FFFFF,d0
	tst.w	d2
	beq.s	.zero			; a double denormal is far below any float
	bset	#20,d0
	lsl.l	#3,d0			; 24 significant bits in d0,
	rol.l	#3,d1			;   the other 29 at the top of d1
	move.w	d1,d3
	and.w	#7,d3
	or.w	d3,d0
	eor.w	d3,d1
	sub.w	#1023-127,d2		; float exponent
	ble.s	.den
	cmp.w	#255,d2
	bge.s	.inf
.round:	subq.w	#1,d2			; as in sf_pack: the leading one adds 1
	swap	d2
	clr.w	d2
	lsl.l	#7,d2
	add.l	d2,d0
	add.l	d1,d1			; the half bit into carry
	bcc.s	.sign
	bne.s	.up			; above half
	btst	#0,d0			; exactly half: to even
	beq.s	.sign
.up:	addq.l	#1,d0
.sign:	and.l	#$80000000,d4
	or.l	d4,d0
	movem.l	(sp)+,d2-d5
	rts
.den:	moveq	#1,d3			; float denormal: shift down by 1 - e
	sub.w	d2,d3
	cmp.w	#26,d3
	bcc.s	.zero			; below half the smallest denormal
	moveq	#32,d5
	sub.w	d3,d5
	move.l	d0,d2
	lsl.l	d5,d2			; the bits shifted out, at the top
	tst.l	d1
	beq.s	.nost
	bset	#0,d2
.nost:	move.l	d2,d1
	lsr.l	d3,d0
	moveq	#1,d2
	bra.s	.round
.zero:	moveq	#0,d0
	bra.s	.sign
.inf:	move.l	#$7F800000,d0
	bra.s	.sign
.special:
	and.l	#$000FFFFF,d0
	or.l	d1,d0
	beq.s	.inf
	move.l	#$7FC00000,d0		; NaN
	movem.l	(sp)+,d2-d5
	rts

; ---------------------------------------------------------------------
; -108 float in d0 -> double in d0:d1. Always exact.
; ---------------------------------------------------------------------
sf_fieee:
	move.l	d2,-(sp)
	move.l	d0,d2			; keeps the sign
	move.l	d0,d1
	and.l	#$007FFFFF,d1		; 23 fraction bits
	swap	d0
	lsr.w	#7,d0
	and.w	#$FF,d0
	beq.s	.den
	cmp.w	#$FF,d0
	beq.s	.special
	add.w	#1023-127,d0
.go:	swap	d0
	clr.w	d0
	lsl.l	#4,d0			; exponent into bits 30..20
	and.l	#$80000000,d2
	or.l	d2,d0
	move.l	d1,d2
	lsr.l	#3,d2
	or.l	d2,d0			; top 20 fraction bits
	ror.l	#3,d1
	and.l	#$E0000000,d1		; the other 3
	move.l	(sp)+,d2
	rts
.den:	tst.l	d1
	beq.s	.zero
	move.w	#1023-126,d0		; float denormal: find its leading one
.l:	subq.w	#1,d0
	add.l	d1,d1
	btst	#23,d1
	beq.s	.l
	bclr	#23,d1
	bra.s	.go
.zero:	move.l	d2,d0
	and.l	#$80000000,d0
	moveq	#0,d1
	move.l	(sp)+,d2
	rts
.special:
	tst.l	d1
	bne.s	.nan
	move.l	d2,d0
	and.l	#$80000000,d0
	or.l	#$7FF00000,d0
	moveq	#0,d1
	move.l	(sp)+,d2
	rts
.nan:	move.l	#$7FF80000,d0
	moveq	#0,d1
	move.l	(sp)+,d2
	rts
