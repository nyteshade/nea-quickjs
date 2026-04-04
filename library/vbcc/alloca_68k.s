; alloca_68k.s — stack allocation for VBCC m68k
;
; alloca(size) allocates 'size' bytes on the stack and returns a
; pointer to the allocated memory. The memory is automatically freed
; when the calling function returns (since it adjusts SP).
;
; VBCC calling convention: first arg in d0, return in d0.
; We adjust SP, but must preserve the return address.

	xdef	_alloca

_alloca:
	; d0 = size to allocate
	; (sp) = return address pushed by JSR
	move.l	(sp)+,a0	; save return address in a0
	addq.l	#3,d0		; round up to longword
	andi.l	#$fffffffc,d0
	sub.l	d0,sp		; allocate space on stack
	move.l	sp,d0		; return pointer to allocated space
	jmp	(a0)		; return to caller (don't push return addr again)
