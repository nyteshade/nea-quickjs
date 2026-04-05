; bridge_lvo.s — Generic LVO call trampoline
;
; _bridge_lvo_call(lvo_offset, nregs, reg_values[])
;
; Calls a library function at QJSBase - lvo_offset, loading up to 7
; register parameters from a static array. Saves/restores A6 properly.
;
; C prototype:
;   extern ULONG bridge_lvo_call(ULONG lvo_offset, ULONG nregs,
;                                ULONG reg_values[]);
;
; reg_values layout (up to 7 entries, order matches register assignment):
;   [0] = a0 value
;   [1] = a1 value
;   [2] = a2 value
;   [3] = a3 value
;   [4] = d0 value
;   [5] = d1 value
;   [6] = d2 value
;
; Returns: d0 (32-bit return value from library function)

	section	code

	xdef	_bridge_lvo_call
	xref	_QJSBase

_bridge_lvo_call:
	movem.l	d2-d7/a2-a6,-(sp)	; save all callee-saved regs (11 longs = 44 bytes)
	; Stack: [saved_regs 44] [ret_addr 4] [lvo_offset 4] [nregs 4] [reg_values* 4]
	move.l	44+4(sp),d7		; d7 = lvo_offset
	move.l	44+12(sp),a5		; a5 = reg_values pointer

	; Load register parameters from the array
	; Always load all 7 slots (unused ones are harmless)
	move.l	(a5)+,a0		; a0
	move.l	(a5)+,a1		; a1
	move.l	(a5)+,a2		; a2
	move.l	(a5)+,a3		; a3
	move.l	(a5)+,d0		; d0
	move.l	(a5)+,d1		; d1
	move.l	(a5)+,d2		; d2

	; Set A6 = library base
	move.l	_QJSBase,a6

	; Compute function address: QJSBase - lvo_offset
	move.l	a6,a5
	sub.l	d7,a5			; a5 = QJSBase - offset

	; Call the library function
	jsr	(a5)

	; Restore callee-saved registers (including A6)
	movem.l	(sp)+,d2-d7/a2-a6
	rts
