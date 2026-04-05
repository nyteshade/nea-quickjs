; test_eval_asm.s — Assembly helper for test_eval.c
; Calls QJS_NewCFunction2 with proper register setup

	section	code
	xdef	_call_NewCFunction2
	xdef	_call_NewRuntime
	xdef	_call_NewContext
	xdef	_call_GetGlobalObject
	xdef	_call_FreeValue
	xdef	_call_FreeContext
	xdef	_call_FreeRuntime
	xdef	_call_EvalSimple
	xdef	_call_Eval
	xdef	_call_HasException
	xref	_QJSBase

; void call_NewCFunction2(JSValue *result, JSContext *ctx, void *func,
;                         const char *name, int length, int cproto, int magic)
; Stack: [ret:4] [result:4] [ctx:4] [func:4] [name:4] [length:4] [cproto:4] [magic:4]
_call_NewCFunction2:
	movem.l	d2-d7/a2-a6,-(sp)	; 11 regs = 44 bytes
	move.l	44+4(sp),a0		; result ptr
	move.l	44+8(sp),a1		; ctx
	move.l	44+12(sp),a2		; func
	move.l	44+16(sp),a3		; name
	move.l	44+20(sp),d0		; length
	move.l	44+24(sp),d1		; cproto
	move.l	44+28(sp),d2		; magic
	move.l	_QJSBase,a6		; library base
	move.l	a6,a5
	suba.l	#888,a5
	jsr	(a5)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; int call_SetPropertyStr(JSContext *ctx, JSValue *this_ptr,
;                         const char *prop, JSValue *val_ptr)
; Stack: [ret:4] [ctx:4] [this_ptr:4] [prop:4] [val_ptr:4]
; LVO -588: QJS_SetPropertyStr(ctx,this_ptr,prop_str,val_ptr)(a0/a1/a2/a3)
; JSRuntime *call_NewRuntime(void)
_call_NewRuntime:
	movem.l	d2/a2-a6,-(sp)
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#30,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; JSContext *call_NewContext(JSRuntime *rt)
; Stack: [ret:4] [rt:4]
_call_NewContext:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#42,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; void call_GetGlobalObject(JSValue *result, JSContext *ctx)
; Stack: [ret:4] [result:4] [ctx:4]
_call_GetGlobalObject:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0		; result ptr
	move.l	32(sp),a1		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#462,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; void call_FreeValue(JSContext *ctx, JSValue *val_ptr)
; Stack: [ret:4] [ctx:4] [val_ptr:4]
_call_FreeValue:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0		; ctx
	move.l	32(sp),a1		; val_ptr
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#312,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; void call_FreeContext(JSContext *ctx)
_call_FreeContext:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#54,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; void call_FreeRuntime(JSRuntime *rt)
_call_FreeRuntime:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#36,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; long call_EvalSimple(JSContext *ctx, const char *input, unsigned long len)
; Stack: [ret:4] [ctx:4] [input:4] [len:4]
_call_EvalSimple:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0		; ctx
	move.l	32(sp),a1		; input
	move.l	36(sp),d0		; len
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#156,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; void call_Eval(JSValue *result, JSContext *ctx, const char *input,
;                unsigned long len, const char *filename, int flags)
; Stack: [ret:4] [result:4] [ctx:4] [input:4] [len:4] [filename:4] [flags:4]
_call_Eval:
	movem.l	d2-d7/a2-a6,-(sp)	; 11 regs = 44
	move.l	48(sp),a0		; result
	move.l	52(sp),a1		; ctx
	move.l	56(sp),a2		; input
	move.l	60(sp),d0		; len
	move.l	64(sp),a3		; filename
	move.l	68(sp),d1		; flags
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#162,a5
	jsr	(a5)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; int call_HasException(JSContext *ctx)
_call_HasException:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#486,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

	xdef	_call_SetPropertyStr
_call_SetPropertyStr:
	movem.l	d2/a2-a6,-(sp)		; 6 regs = 24 bytes
	move.l	28(sp),a0		; ctx
	move.l	32(sp),a1		; this_ptr (already a pointer)
	move.l	36(sp),a2		; prop string
	move.l	40(sp),a3		; val_ptr (already a pointer)
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#588,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts
