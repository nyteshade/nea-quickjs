; bridge_a6.s — Save/restore A6 around LVO calls
;
; VBCC uses A6 as a callee-saved register but __reg("a6") in function
; pointer typedefs clobbers it without save/restore. These helpers
; push/pop A6 on the stack, safe for reentrant/nested bridge calls.
;
; Usage in C:
;   extern void bridge_save_a6(void);
;   extern void bridge_restore_a6(void);
;   bridge_save_a6();   /* pushes A6 onto hidden stack slot */
;   LVO_call(...);      /* clobbers A6 */
;   bridge_restore_a6(); /* restores A6 from hidden stack slot */
;
; Stack manipulation: save_a6 pushes an extra longword onto the stack
; (the saved A6). restore_a6 pops it. They must always be paired.

	section code

	xdef	_bridge_save_a6
	xdef	_bridge_restore_a6

; Save A6: pop return address, push A6, push return address back
_bridge_save_a6:
	move.l	(sp)+,d0	; pop return address into d0
	move.l	a6,-(sp)	; push current A6 (save it)
	move.l	d0,-(sp)	; push return address back
	rts

; Restore A6: pop return address, pop saved A6, push return address back
_bridge_restore_a6:
	move.l	(sp)+,d0	; pop return address into d0
	move.l	(sp)+,a6	; pop saved A6 (restore it)
	move.l	d0,-(sp)	; push return address back
	rts
