; bridge_a6.s — Save/restore A6 using a separate stack
;
; Uses a small BSS array as an A6 save stack, NOT the real stack.
; This avoids corrupting SP-relative addressing that VBCC may use.
; Reentrant up to 32 levels of nesting (bridge → callback → bridge).
;
; Clobbers D0 (caller-saved, OK).

	section	data

	xdef	_bridge_a6_idx
_bridge_a6_idx:
	dc.l	0		; current index (0 = empty)

	section	bss

_bridge_a6_stk:
	ds.l	32		; save stack (32 entries)

	section	code

	xdef	_bridge_save_a6
	xdef	_bridge_restore_a6

_bridge_save_a6:
	lea	_bridge_a6_stk,a0
	move.l	_bridge_a6_idx,d0
	move.l	a6,0(a0,d0.l)
	addq.l	#4,d0
	move.l	d0,_bridge_a6_idx
	rts

_bridge_restore_a6:
	lea	_bridge_a6_stk,a0
	move.l	_bridge_a6_idx,d0
	subq.l	#4,d0
	move.l	0(a0,d0.l),a6
	move.l	d0,_bridge_a6_idx
	rts
