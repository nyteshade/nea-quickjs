; sharedlib_int64_fpu.s - 64-bit integer -> double, FPU variants only
;
; vbcc calls these for (double)(long long) and
; (double)(unsigned long long). The argument is on the stack, high long
; first; the double comes back as its bit pattern in d0 (high) : d1
; (low), also in an FPU build.
;
; Both compute (double)hi * 2^32 + (double)(unsigned)lo. The two terms
; are exact in the FPU's registers, so the sum is rounded once, to the
; nearest double: either by the add itself when the FPU runs in
; double precision, or by the store when it runs in extended precision
; (whose 64-bit mantissa holds any 64-bit integer exactly).
;
; FMOVE.L, FADD, FMUL and FMOVE.D are native on the 6888x, 68040 and
; 68060: nothing here traps. The opposite direction (double -> int64)
; is integer code in sharedlib_int64_conv.c.
;
; Tested by perf/int64cmp/run.sh.

	machine	68020

; ============================================================
; signed: 4(sp)=hi 8(sp)=lo
; ============================================================
	xdef	__sint64toflt64
__sint64toflt64:
	move.l	8(sp),d1	; lo
	; Does the value fit in 32 bits, i.e. is hi the sign extension of
	; lo? The compare must be the last thing before the branch: until
	; 0.231 a "move.l (sp)+,d1" sat between them and replaced the
	; condition codes, so the branch tested lo != 0 and every non-zero
	; multiple of 2^32 (65536*65536, 2^53, ...) converted to 0.0.
	move.l	d1,d0
	add.l	d0,d0
	subx.l	d0,d0		; d0 = 0 or -1: what hi must be
	cmp.l	4(sp),d0
	bne.s	.s2f_big
	fmove.l	d1,fp0
	bra.s	.s2f_ret
.s2f_big:
	fmove.l	4(sp),fp0	; (double)(signed)hi
	fmul.s	#$4f800000,fp0	; * 2^32
	fmove.l	d1,fp1		; (double)(signed)lo
	tst.l	d1
	bpl.s	.s2f_lo_pos
	fadd.s	#$4f800000,fp1	; lo is unsigned: add 2^32 back
.s2f_lo_pos:
	fadd.x	fp1,fp0
.s2f_ret:
	fmove.d	fp0,-(sp)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	rts

; ============================================================
; unsigned: 4(sp)=hi 8(sp)=lo
; ============================================================
	xdef	__uint64toflt64
__uint64toflt64:
	move.l	8(sp),d1	; lo
	fmove.l	d1,fp0		; (double)(signed)lo
	tst.l	d1
	bpl.s	.u2f_lo_pos
	fadd.s	#$4f800000,fp0	; lo is unsigned: add 2^32 back
.u2f_lo_pos:
	move.l	4(sp),d0	; hi
	beq.s	.u2f_ret
	fmove.l	d0,fp1		; (double)(signed)hi
	tst.l	d0
	bpl.s	.u2f_hi_pos
	fadd.s	#$4f800000,fp1	; hi is unsigned too
.u2f_hi_pos:
	fmul.s	#$4f800000,fp1	; * 2^32
	fadd.x	fp1,fp0
.u2f_ret:
	fmove.d	fp0,-(sp)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	rts
