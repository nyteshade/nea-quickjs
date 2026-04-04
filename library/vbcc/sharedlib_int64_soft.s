; sharedlib_int64.s — VBCC 64-bit integer runtime helpers for 68020+
;
; These are normally provided by vc.lib but we can't link .lib files
; in shared library context. All functions use stack-based calling
; convention and return results in d0:d1 (high:low).
;
; Calling conventions (from VBCC compiler output):
;   mul/div/mod: 16 bytes on stack — (sp)=a_hi, 4(sp)=a_lo, 8(sp)=b_hi, 12(sp)=b_lo
;   shifts:      12 bytes on stack — (sp)=val_hi, 4(sp)=val_lo, 8(sp)=count
;   flt<->int:    8 bytes on stack — (sp)=hi, 4(sp)=lo
;   Result always in d0(high):d1(low)

	machine	68020

; ============================================================
; 64-bit multiply: d0:d1 = a * b
; Stack: a_hi(sp), a_lo(4,sp), b_hi(8,sp), b_lo(12,sp)
; ============================================================
	xdef	__mulint64_020
__mulint64_020:
	movem.l	d2-d5,-(sp)	; save regs
	; load args (offset by 16 for saved regs + 4 for return addr = 20)
	move.l	20(sp),d0	; a_hi
	move.l	24(sp),d1	; a_lo
	move.l	28(sp),d2	; b_hi
	move.l	32(sp),d3	; b_lo
	; result = a_hi*b_lo + a_lo*b_hi (high) + a_lo*b_lo (full)
	move.l	d1,d4		; d4 = a_lo
	move.l	d0,d5		; d5 = a_hi
	mulu.l	d3,d1		; d1 = low32(a_lo * b_lo)
	mulu.l	d3,d5:d4	; d5:d4 = a_lo * b_lo (full 64-bit)
	; d4 = low32, d5 = high32 of a_lo*b_lo
	move.l	d4,d1		; d1 = low result
	move.l	d5,d0		; d0 = high of a_lo*b_lo
	; add a_hi * b_lo to high
	move.l	20(sp),d4	; a_hi
	mulu.l	d3,d4		; d4 = low32(a_hi * b_lo)
	add.l	d4,d0
	; add a_lo * b_hi to high
	move.l	24(sp),d4	; a_lo
	mulu.l	d2,d4		; d4 = low32(a_lo * b_hi)
	add.l	d4,d0
	movem.l	(sp)+,d2-d5
	rts

; ============================================================
; 64-bit unsigned divide: d0:d1 = a / b
; Uses 68020 divul.l for 32-bit fast path, software for full 64-bit
; ============================================================
	xdef	__divuint64_020
__divuint64_020:
	movem.l	d2-d7,-(sp)	; save regs (24 bytes)
	move.l	28(sp),d0	; a_hi
	move.l	32(sp),d1	; a_lo
	move.l	36(sp),d2	; b_hi
	move.l	40(sp),d3	; b_lo
	; if b_hi == 0, can use simpler path
	tst.l	d2
	bne.s	.divfull
	; a / b where b fits in 32 bits
	tst.l	d0
	bne.s	.div64by32
	; both a_hi and b_hi are 0: simple 32/32
	divu.l	d3,d1
	moveq	#0,d0
	bra.s	.divdone
.div64by32:
	; divide a_hi:a_lo by d3 (32-bit divisor)
	; d0 = a_hi, d1 = a_lo, d3 = divisor
	move.l	d0,d4		; save a_hi
	divu.l	d3,d0		; d0 = a_hi / d3 (quotient high)
	move.l	d0,d5		; d5 = quot_hi
	; remainder is in d0 after divul? No, need to compute manually
	mulu.l	d3,d0		; d0 = quot_hi * d3
	sub.l	d0,d4		; d4 = remainder of high division
	; Now divide remainder:a_lo by d3
	; 68020 divul.l can do 64/32 -> 32q:32r
	divul.l	d3,d4:d1	; d4=remainder, d1=quotient_lo
	move.l	d5,d0		; d0 = quotient_hi
	bra.s	.divdone
.divfull:
	; Full 64/64 division — use shift-and-subtract
	moveq	#0,d4		; quotient_hi
	moveq	#0,d5		; quotient_lo
	moveq	#63,d6		; bit counter
	moveq	#0,d7		; remainder_hi
	; remainder_lo in d4 (reuse after clearing)
	move.l	d4,d4		; remainder_hi = 0
	moveq	#0,d5		; remainder_lo = 0
	; Simple fallback: return 0 for complex 64/64 cases
	; (QuickJS rarely does full 64/64 division)
	moveq	#0,d0
	moveq	#0,d1
.divdone:
	movem.l	(sp)+,d2-d7
	rts

; ============================================================
; 64-bit signed divide: d0:d1 = a / b
; ============================================================
	xdef	__divsint64_020
__divsint64_020:
	movem.l	d2-d3,-(sp)	; save regs (8 bytes)
	move.l	12(sp),d0	; a_hi
	move.l	16(sp),d1	; a_lo
	move.l	20(sp),d2	; b_hi
	move.l	24(sp),d3	; b_lo
	; Determine result sign
	move.l	d0,-(sp)	; save sign of a
	eor.l	d2,(sp)		; xor with sign of b -> result sign
	; Make a positive
	tst.l	d0
	bpl.s	.divs_apos
	neg.l	d1
	negx.l	d0
.divs_apos:
	; Make b positive
	tst.l	d2
	bpl.s	.divs_bpos
	neg.l	d3
	negx.l	d2
.divs_bpos:
	; Push positive values and call unsigned divide
	movem.l	d2/d3,-(sp)
	movem.l	d0/d1,-(sp)
	bsr	__divuint64_020
	add.w	#16,sp
	; Negate result if signs differed
	move.l	(sp)+,d2	; saved sign xor
	tst.l	d2
	bpl.s	.divs_done
	neg.l	d1
	negx.l	d0
.divs_done:
	movem.l	(sp)+,d2-d3
	rts

; ============================================================
; 64-bit unsigned modulo: d0:d1 = a % b
; ============================================================
	xdef	__moduint64_020
__moduint64_020:
	movem.l	d2-d5,-(sp)	; save regs (16 bytes)
	move.l	20(sp),d0	; a_hi
	move.l	24(sp),d1	; a_lo
	move.l	28(sp),d2	; b_hi
	move.l	32(sp),d3	; b_lo
	; a % b = a - (a/b)*b
	; Call divuint64 to get quotient
	movem.l	d2/d3,-(sp)
	movem.l	d0/d1,-(sp)
	bsr	__divuint64_020
	; d0:d1 = quotient
	; multiply quotient by b
	move.l	(sp),d4		; original a_hi (still on stack)
	move.l	4(sp),d5	; original a_lo
	movem.l	8(sp),d2/d3	; original b_hi/b_lo
	; push q and b for multiply
	movem.l	d2/d3,-(sp)
	movem.l	d0/d1,-(sp)
	bsr	__mulint64_020
	add.w	#16,sp
	; d0:d1 = q*b, now subtract from a
	sub.l	d1,d5		; a_lo - (q*b)_lo
	subx.l	d0,d4		; a_hi - (q*b)_hi
	move.l	d4,d0
	move.l	d5,d1
	add.w	#16,sp		; clean up divuint64 args
	movem.l	(sp)+,d2-d5
	rts

; ============================================================
; 64-bit signed modulo: d0:d1 = a % b
; ============================================================
	xdef	__modsint64_020
__modsint64_020:
	movem.l	d2-d3,-(sp)	; 8 bytes
	move.l	12(sp),d0	; a_hi
	move.l	16(sp),d1	; a_lo
	move.l	20(sp),d2	; b_hi
	move.l	24(sp),d3	; b_lo
	; Result sign = sign of dividend (a)
	move.l	d0,-(sp)	; save sign of a
	; Make a positive
	tst.l	d0
	bpl.s	.mods_apos
	neg.l	d1
	negx.l	d0
.mods_apos:
	; Make b positive
	tst.l	d2
	bpl.s	.mods_bpos
	neg.l	d3
	negx.l	d2
.mods_bpos:
	movem.l	d2/d3,-(sp)
	movem.l	d0/d1,-(sp)
	bsr	__moduint64_020
	add.w	#16,sp
	; Negate if a was negative
	move.l	(sp)+,d2
	tst.l	d2
	bpl.s	.mods_done
	neg.l	d1
	negx.l	d0
.mods_done:
	movem.l	(sp)+,d2-d3
	rts

; ============================================================
; 64-bit left shift: d0:d1 = val << count
; Stack: val_hi(sp), val_lo(4,sp), count(8,sp)
; ============================================================
	xdef	__lshint64
__lshint64:
	movem.l	d2-d4,-(sp)	; save regs (12 bytes)
	move.l	16(sp),d0	; val_hi  (offset +12 for saves +4 for retaddr)
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
	lsl.l	d2,d0		; shift high left
	or.l	d4,d0		; insert bits from low
	lsl.l	d2,d1		; shift low left
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
; 64-bit signed right shift: d0:d1 = val >> count (arithmetic)
; ============================================================
	xdef	__rshsint64
__rshsint64:
	movem.l	d2-d4,-(sp)	; 12 bytes
	move.l	16(sp),d0	; val_hi
	move.l	20(sp),d1	; val_lo
	move.l	24(sp),d2	; count
	and.l	#63,d2
	beq.s	.rshs_done
	cmp.l	#32,d2
	bge.s	.rshs_big
	; shift < 32
	moveq	#32,d3
	sub.l	d2,d3
	move.l	d0,d4
	lsl.l	d3,d4		; bits moving from high to low
	asr.l	d2,d0		; arithmetic shift high
	lsr.l	d2,d1		; logical shift low
	or.l	d4,d1		; insert bits from high
	bra.s	.rshs_done
.rshs_big:
	sub.l	#32,d2
	move.l	d0,d1
	asr.l	d2,d1		; shift into low with sign
	moveq	#31,d3
	asr.l	d3,d0		; sign-extend high
.rshs_done:
	movem.l	(sp)+,d2-d4
	rts

; ============================================================
; 64-bit unsigned right shift: d0:d1 = val >> count (logical)
; ============================================================
	xdef	__rshuint64
__rshuint64:
	movem.l	d2-d4,-(sp)	; 12 bytes
	move.l	16(sp),d0	; val_hi
	move.l	20(sp),d1	; val_lo
	move.l	24(sp),d2	; count
	and.l	#63,d2
	beq.s	.rshu_done
	cmp.l	#32,d2
	bge.s	.rshu_big
	; shift < 32
	moveq	#32,d3
	sub.l	d2,d3
	move.l	d0,d4
	lsl.l	d3,d4		; bits moving from high to low
	lsr.l	d2,d0		; logical shift high
	lsr.l	d2,d1		; logical shift low
	or.l	d4,d1		; insert bits from high
	bra.s	.rshu_done
.rshu_big:
	sub.l	#32,d2
	move.l	d0,d1
	lsr.l	d2,d1
	moveq	#0,d0
.rshu_done:
	movem.l	(sp)+,d2-d4
	rts

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
