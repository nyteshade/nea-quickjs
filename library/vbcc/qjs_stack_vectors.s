; qjs_stack_vectors.s - the library vectors of the growable JavaScript
; stack. Register arguments in, a plain C call out, like the vectors in
; qjsfuncs_asm_all.s; they are here so that everything about the stack
; is found in the qjs_stack_* files. See docs/STACK.md and the autodoc
; (amiga/docs/quickjs.doc).

	machine	68020
	section	code

	xdef	_QJS_SetStackSizes
	xdef	_QJS_GetStackInfo
	xref	_JS_SetStackSizes
	xref	_JS_GetStackInfo

; ===================================================================
; QJS_SetStackSizes
; SFD: (rt,floor,chunk,cap)(a0/d0/d1/d2)
; Calls: void JS_SetStackSizes(rt, floor, chunk, cap)
; ===================================================================
_QJS_SetStackSizes:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d2,-(sp)		; cap
	move.l	d1,-(sp)		; chunk
	move.l	d0,-(sp)		; floor
	move.l	a0,-(sp)		; rt
	jsr	_JS_SetStackSizes
	lea	16(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetStackInfo
; SFD: (rt,info,size)(a0/a1/d0)
; Calls: void JS_GetStackInfo(rt, info, size)
; ===================================================================
_QJS_GetStackInfo:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)		; size
	move.l	a1,-(sp)		; info
	move.l	a0,-(sp)		; rt
	jsr	_JS_GetStackInfo
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts
