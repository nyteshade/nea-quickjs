; sharedlib_int64.s - vbcc's 64-bit integer helpers, for every variant
;
; vbcc has no inline "long long" arithmetic on the 68k: multiply,
; divide, modulo and shifts are calls to the helpers below. A program
; gets them from vc.lib; a shared library cannot link vc.lib, so these
; are ours. They use integer instructions only and are linked into the
; FPU and the soft-float variants alike.
;
; The conversions between 64-bit integers and double are elsewhere:
;   sharedlib_int64_conv.c   double -> int64 (all variants) and
;                            int64 -> double (soft-float variants)
;   sharedlib_int64_fpu.s    int64 -> double (FPU variants)
;
; Calling convention (from vbcc's output): arguments on the stack,
; high long first; result in d0 (high) : d1 (low); d2-d7 preserved.
;   mul/div/mod: 4(sp)=a_hi 8(sp)=a_lo 12(sp)=b_hi 16(sp)=b_lo
;   shifts:      4(sp)=val_hi 8(sp)=val_lo 12(sp)=count
;
; vbcc picks the helper by -cpu: __mulint64_020, _040 or _060 (the same
; for div and mod). The _060 set exists because the 68060 has no
; 64-bit-product MULU.L and no 64-bit-dividend DIVU.L: both trap and
; are emulated by 68060.library at a cost of many hundreds of cycles
; per use. The _060 routines here use only forms the 68060 executes
; itself. Every other 68020+ instruction used below is native on all
; of 68020/030/040/060.
;
; Tested by perf/int64cmp/run.sh, which runs every helper over a table
; of operands and compares with vc.lib and with exact values.

	machine	68020

; ============================================================
; multiply: d0:d1 = low 64 bits of a * b (signed and unsigned alike)
;   = a_lo*b_lo (full 64 bits) + ((a_hi*b_lo + a_lo*b_hi) << 32)
; ============================================================
	xdef	__mulint64_020
	xdef	__mulint64_040
__mulint64_040:
__mulint64_020:
	movem.l	d2-d3,-(sp)	; 8 bytes: args now at 12(sp)
	move.l	16(sp),d1	; a_lo
	move.l	24(sp),d3	; b_lo
	move.l	d1,d2		; a_lo again, for the cross product
	mulu.l	d3,d0:d1	; d0:d1 = a_lo * b_lo, 64-bit product
	mulu.l	20(sp),d2	; low32(a_lo * b_hi)
	add.l	d2,d0
	mulu.l	12(sp),d3	; low32(b_lo * a_hi)
	add.l	d3,d0
	movem.l	(sp)+,d2-d3
	rts

; 68060: the 32x32->64 product is built from four 16x16->32 MULU.W.
; With a_lo = ah:al and b_lo = bh:bl (16 bits each):
;   a_lo*b_lo = ah*bh<<32 + (ah*bl + al*bh)<<16 + al*bl
	xdef	__mulint64_060
__mulint64_060:
	movem.l	d2-d4,-(sp)	; 12 bytes: args now at 16(sp)
	move.l	20(sp),d0	; a_lo
	move.l	28(sp),d1	; b_lo
	move.l	d0,d2
	swap	d2		; d2.w = ah
	move.l	d1,d3
	swap	d3		; d3.w = bh
	move.l	d0,d4
	mulu.w	d1,d4		; d4 = al*bl
	mulu.w	d2,d1		; d1 = ah*bl
	mulu.w	d3,d0		; d0 = al*bh
	mulu.w	d3,d2		; d2 = ah*bh
	add.l	d0,d1		; d1 = cross sum, low 32 bits
	bcc.s	.nocarry
	add.l	#$10000,d2	; its bit 32 belongs to bit 48 of the product
.nocarry:
	move.l	d1,d0
	clr.w	d0
	swap	d0		; d0 = cross >> 16
	swap	d1
	clr.w	d1		; d1 = cross << 16
	add.l	d4,d1		; low long
	addx.l	d2,d0		; high long of a_lo*b_lo
	move.l	16(sp),d2	; a_hi
	mulu.l	28(sp),d2	; low32(a_hi * b_lo): 32-bit product, native
	add.l	d2,d0
	move.l	20(sp),d2	; a_lo
	mulu.l	24(sp),d2	; low32(a_lo * b_hi)
	add.l	d2,d0
	movem.l	(sp)+,d2-d4
	rts

; ============================================================
; unsigned divide with remainder, the core of div and mod.
;   in:  d0:d1 = a, d2:d3 = b (b != 0; dividing by zero traps or
;        returns garbage, as in C)
;   out: d0:d1 = a / b, d2:d3 = a % b
;   trashes d4-d6
; One macro, expanded once with the 64/32 DIVU.L and once without.
; \1 = label suffix, \2 = 1 if DIVU.L <ea>,Dr:Dq (64/32) may be used
; ============================================================
UDIVMOD	macro
udivmod64_\1:
	tst.l	d2
	bne.s	.wide_divisor
	tst.l	d0
	bne.s	.wide_dividend
	; 32 / 32. DIVUL.L is the 32-bit-dividend form that also gives the
	; remainder; every 68020+ including the 68060 has it.
	divul.l	d3,d2:d1	; d1 = quotient, d2 = remainder
	move.l	d2,d3
	moveq	#0,d2
	rts
.wide_dividend:
	; 64 / 32, long division in two steps: first the high long, then
	; its remainder followed by the low long.
	ifne	\2
	; NOTE: the 64/32 form is DIVU.L <ea>,Dr:Dq. DIVUL.L is 32/32 and
	; ignores Dr as dividend -- using it for both steps made every
	; divide with a dividend >= 2^32 wrong (number printing, Date,
	; BigInt) until 0.208.
	moveq	#0,d4
	divu.l	d3,d4:d0	; d0 = a_hi / b, d4 = a_hi % b
	divu.l	d3,d4:d1	; d1 = (rem:a_lo) / b; rem < b so it fits
	else
	moveq	#0,d4
	divul.l	d3,d4:d0	; d0 = a_hi / b, d4 = a_hi % b (32/32)
	cmp.l	#$ffff,d3
	bhi.s	.bitwise
	; divisor below 2^16 (number formatting divides by the radix):
	; the remainder is below 2^16 too, so (rem:a_lo) / b is two
	; 32/16 DIVU.W steps whose quotients each fit in 16 bits.
	swap	d4		; rem << 16
	swap	d1
	move.w	d1,d4		; rem : high word of a_lo
	divu.w	d3,d4		; d4 = rem' : q1
	move.w	d4,d1
	swap	d1		; d1 = q1 : low word of a_lo
	move.w	d1,d4		; rem' : low word of a_lo
	divu.w	d3,d4		; d4 = rem'' : q0
	move.w	d4,d1		; d1 = q1 : q0
	clr.w	d4
	swap	d4		; d4 = remainder
	bra.s	.narrow_done
.bitwise:
	; divisor from 2^16 to 2^32-1: shift-and-subtract, 32 steps.
	; d4 = running remainder (< b), d1 = a_lo going out at the top
	; and quotient bits coming in at the bottom.
	moveq	#31,d5
.bitloop:
	add.l	d1,d1
	addx.l	d4,d4
	bcs.s	.bitsub		; remainder reached 2^32: it is >= b
	cmp.l	d3,d4
	bcs.s	.bitnext
.bitsub:
	sub.l	d3,d4
	addq.l	#1,d1		; low bit is free after the shift
.bitnext:
	dbf	d5,.bitloop
.narrow_done:
	endc
	move.l	d4,d3
	moveq	#0,d2
	rts
.wide_divisor:
	; b >= 2^32, so the quotient is below 2^32 and the first 32 steps
	; of a 64-step shift-and-subtract would only move a_hi into the
	; remainder: start from there. d4:d5 = running remainder (< b),
	; d1 = a_lo going out at the top, quotient bits coming in below.
	moveq	#0,d4
	move.l	d0,d5
	moveq	#0,d0
	moveq	#31,d6
.wideloop:
	add.l	d1,d1
	addx.l	d5,d5
	addx.l	d4,d4
	bcs.s	.widesub	; remainder reached 2^64: it is >= b
	cmp.l	d2,d4
	bhi.s	.widesub
	bne.s	.widenext	; remainder_hi < b_hi
	cmp.l	d3,d5
	bcs.s	.widenext	; remainder_lo < b_lo
.widesub:
	sub.l	d3,d5
	subx.l	d2,d4
	addq.l	#1,d1
.widenext:
	dbf	d6,.wideloop
	move.l	d4,d2
	move.l	d5,d3
	rts
	endm

; ============================================================
; The four public entry points for one CPU. \1 = label suffix; \2 = a
; second suffix that gets the same code (the 68040 has the 68020's
; instructions here), or \1 again for none.
; Signed division truncates toward zero and the remainder takes the
; sign of the dividend, as C requires: both are done on magnitudes.
; Negating the most negative value leaves its bits unchanged, which is
; its magnitude 2^63 read as unsigned, so that case needs no test.
; ============================================================
DIVMOD	macro
	xdef	__divuint64_\1
__divuint64_\1:
	ifnc	"\1","\2"
	xdef	__divuint64_\2
__divuint64_\2:
	endc
	movem.l	d2-d6,-(sp)	; 20 bytes: args now at 24(sp)
	movem.l	24(sp),d0-d3
	bsr	udivmod64_\1
	movem.l	(sp)+,d2-d6
	rts

	xdef	__moduint64_\1
__moduint64_\1:
	ifnc	"\1","\2"
	xdef	__moduint64_\2
__moduint64_\2:
	endc
	movem.l	d2-d6,-(sp)
	movem.l	24(sp),d0-d3
	bsr	udivmod64_\1
	move.l	d2,d0
	move.l	d3,d1
	movem.l	(sp)+,d2-d6
	rts

	xdef	__divsint64_\1
__divsint64_\1:
	ifnc	"\1","\2"
	xdef	__divsint64_\2
__divsint64_\2:
	endc
	movem.l	d2-d7,-(sp)	; 24 bytes: args now at 28(sp)
	movem.l	28(sp),d0-d3
	move.l	d0,d7
	eor.l	d2,d7		; sign of the quotient in bit 31
	tst.l	d0
	bpl.s	.a_pos
	neg.l	d1
	negx.l	d0
.a_pos:
	tst.l	d2
	bpl.s	.b_pos
	neg.l	d3
	negx.l	d2
.b_pos:
	bsr	udivmod64_\1
	tst.l	d7
	bpl.s	.done
	neg.l	d1
	negx.l	d0
.done:
	movem.l	(sp)+,d2-d7
	rts

	xdef	__modsint64_\1
__modsint64_\1:
	ifnc	"\1","\2"
	xdef	__modsint64_\2
__modsint64_\2:
	endc
	movem.l	d2-d7,-(sp)
	movem.l	28(sp),d0-d3
	move.l	d0,d7		; sign of the remainder = sign of a
	bpl.s	.a_pos
	neg.l	d1
	negx.l	d0
.a_pos:
	tst.l	d2
	bpl.s	.b_pos
	neg.l	d3
	negx.l	d2
.b_pos:
	bsr	udivmod64_\1
	move.l	d2,d0
	move.l	d3,d1
	tst.l	d7
	bpl.s	.done
	neg.l	d1
	negx.l	d0
.done:
	movem.l	(sp)+,d2-d7
	rts
	endm

	UDIVMOD	020,1
	DIVMOD	020,040
	UDIVMOD	060,0
	DIVMOD	060,060

; ============================================================
; left shift: d0:d1 = val << count (count taken modulo 64)
; ============================================================
	xdef	__lshint64
__lshint64:
	movem.l	d2-d4,-(sp)	; 12 bytes: args now at 16(sp)
	move.l	16(sp),d0	; val_hi
	move.l	20(sp),d1	; val_lo
	move.l	24(sp),d2	; count
	and.l	#63,d2
	beq.s	.lsh_done
	cmp.l	#32,d2
	bge.s	.lsh_big
	; shift < 32: high = (high << n) | (low >> (32-n)), low = low << n
	moveq	#32,d3
	sub.l	d2,d3		; 32 - count
	move.l	d1,d4
	lsr.l	d3,d4		; bits moving from low to high
	lsl.l	d2,d0
	or.l	d4,d0
	lsl.l	d2,d1
	bra.s	.lsh_done
.lsh_big:
	sub.l	#32,d2
	move.l	d1,d0
	lsl.l	d2,d0
	moveq	#0,d1
.lsh_done:
	movem.l	(sp)+,d2-d4
	rts

; ============================================================
; signed right shift: d0:d1 = val >> count (arithmetic)
; ============================================================
	xdef	__rshsint64
__rshsint64:
	movem.l	d2-d4,-(sp)
	move.l	16(sp),d0	; val_hi
	move.l	20(sp),d1	; val_lo
	move.l	24(sp),d2	; count
	and.l	#63,d2
	beq.s	.rshs_done
	cmp.l	#32,d2
	bge.s	.rshs_big
	moveq	#32,d3
	sub.l	d2,d3
	move.l	d0,d4
	lsl.l	d3,d4		; bits moving from high to low
	asr.l	d2,d0
	lsr.l	d2,d1
	or.l	d4,d1
	bra.s	.rshs_done
.rshs_big:
	sub.l	#32,d2
	move.l	d0,d1
	asr.l	d2,d1		; high long moves down, keeping its sign
	moveq	#31,d3
	asr.l	d3,d0		; high long becomes all sign bits
.rshs_done:
	movem.l	(sp)+,d2-d4
	rts

; ============================================================
; unsigned right shift: d0:d1 = val >> count (logical)
; ============================================================
	xdef	__rshuint64
__rshuint64:
	movem.l	d2-d4,-(sp)
	move.l	16(sp),d0	; val_hi
	move.l	20(sp),d1	; val_lo
	move.l	24(sp),d2	; count
	and.l	#63,d2
	beq.s	.rshu_done
	cmp.l	#32,d2
	bge.s	.rshu_big
	moveq	#32,d3
	sub.l	d2,d3
	move.l	d0,d4
	lsl.l	d3,d4		; bits moving from high to low
	lsr.l	d2,d0
	lsr.l	d2,d1
	or.l	d4,d1
	bra.s	.rshu_done
.rshu_big:
	sub.l	#32,d2
	move.l	d0,d1
	lsr.l	d2,d1
	moveq	#0,d0
.rshu_done:
	movem.l	(sp)+,d2-d4
	rts
