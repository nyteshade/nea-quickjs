; bridge_asm.s — Assembly trampolines for bridge functions
;
; These bypass the C bridge entirely, avoiding VBCC's A6/__reg issues.
; Each function reads C parameters from the stack, sets up LVO registers,
; and calls the library. Callee-saved registers are preserved.

	section	code
	xref	_QJSBase

; ===================================================================
; bridge_EvalSimple(ctx, input, len) -> long
; Calls QJS_EvalSimple at LVO -156
; Stack: [ret:4] [ctx:4] [input:4] [len:4]
; ===================================================================
	xdef	_bridge_EvalSimple
_bridge_EvalSimple:
	movem.l	d2/a2-a6,-(sp)		; 6 regs = 24 bytes
	move.l	28(sp),a0		; ctx
	move.l	32(sp),a1		; input
	move.l	36(sp),d0		; len
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#156,a5
	jsr	(a5)			; returns long in d0
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; Helper macro: compute LVO address in A5 and set A6
; ===================================================================

; ===================================================================
; JS_GetLibcOpaque(JSRuntime *rt) -> void*
; LVO -1050
; ===================================================================
	xdef	_JS_GetLibcOpaque
_JS_GetLibcOpaque:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1050,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetLibcOpaque(JSRuntime *rt, void *opaque)
; LVO -1056
; ===================================================================
	xdef	_JS_SetLibcOpaque
_JS_SetLibcOpaque:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	32(sp),a1
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1056,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddModuleExportList(ctx, m, tab, len) -> int
; LVO -1062
; Stack: [ret:4] [ctx:4] [m:4] [tab:4] [len:4]
; ===================================================================
	xdef	_JS_AddModuleExportList
_JS_AddModuleExportList:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0		; ctx
	move.l	32(sp),a1		; m
	move.l	36(sp),a2		; tab
	move.l	40(sp),d0		; len
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1062,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetModuleExportList(ctx, m, tab, len) -> int
; LVO -1068
; Stack: [ret:4] [ctx:4] [m:4] [tab:4] [len:4]
; ===================================================================
	xdef	_JS_SetModuleExportList
_JS_SetModuleExportList:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	32(sp),a1
	move.l	36(sp),a2
	move.l	40(sp),d0
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1068,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; bridge_EvalBuf(ctx, input, input_len, filename, eval_flags) -> long
; LVO -1074: QJS_EvalBuf(ctx,input,input_len,filename,eval_flags)(a0/a1/d0/a2/d1)
; Stack: [ret:4] [ctx:4] [input:4] [input_len:4] [filename:4] [eval_flags:4]
; ===================================================================
	xdef	_bridge_EvalBuf
_bridge_EvalBuf:
	movem.l	d2/a2-a6,-(sp)		; 6 regs = 24 bytes
	move.l	28(sp),a0		; ctx
	move.l	32(sp),a1		; input
	move.l	36(sp),d0		; input_len
	move.l	40(sp),a2		; filename
	move.l	44(sp),d1		; eval_flags
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1074,a5
	jsr	(a5)			; returns long in d0
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetPropertyFunctionList(ctx, obj, tab, len) -> int
; LVO -900: QJS_SetPropertyFunctionList(ctx,obj_ptr,tab,len)(a0/a1/a2/d0)
; Stack: [ret:4] [ctx:4] [obj:8] [tab:4] [len:4]
; ===================================================================
	xdef	_JS_SetPropertyFunctionList
_JS_SetPropertyFunctionList:
	movem.l	d2/a2-a6,-(sp)		; 6 regs = 24 bytes
	move.l	28(sp),a0		; a0 = ctx
	lea	32(sp),a1		; a1 = &obj (8-byte JSValue on stack)
	move.l	40(sp),a2		; a2 = tab
	move.l	44(sp),d0		; d0 = len
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#900,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetGlobalObject(JSContext *ctx) -> JSValue (uint64_t)
; LVO -462: QJS_GetGlobalObject(result,ctx)(a0/a1)
; Stack: [ret:4] [ctx:4]
; Returns: uint64_t in d0/d1
; ===================================================================
	xdef	_JS_GetGlobalObject
_JS_GetGlobalObject:
	movem.l	d2/a2-a6,-(sp)		; save 6 regs = 24 bytes
	; Result buffer on stack (8 bytes for JSValue)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result (on stack)
	move.l	24+8+4(sp),a1		; a1 = ctx (24 saved + 8 result + 4 ret)
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#462,a5
	jsr	(a5)
	; Read result from stack into d0/d1
	move.l	(sp)+,d0		; high 32 bits
	move.l	(sp)+,d1		; low 32 bits
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewObject(JSContext *ctx) -> JSValue
; LVO -420: QJS_NewObject(result,ctx)(a0/a1)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_NewObject
_JS_NewObject:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#420,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewArray(JSContext *ctx) -> JSValue
; LVO -438: QJS_NewArray(result,ctx)(a0/a1)
; ===================================================================
	xdef	_JS_NewArray
_JS_NewArray:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0
	move.l	24+8+4(sp),a1
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#438,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewStringLen(JSContext *ctx, const char *str, size_t len) -> JSValue
; LVO -354: QJS_NewStringLen(result,ctx,str,len)(a0/a1/a2/d0)
; Stack: [ret:4] [ctx:4] [str:4] [len:4]
; ===================================================================
	xdef	_JS_NewStringLen
_JS_NewStringLen:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	move.l	24+8+8(sp),a2		; str
	move.l	24+8+12(sp),d0		; len
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#354,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_FreeValue(JSContext *ctx, JSValue val)
; LVO -312: QJS_FreeValue(ctx,val_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [val:8]
; ===================================================================
	xdef	_JS_FreeValue
_JS_FreeValue:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &val (on caller's stack)
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#312,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewCFunction2(ctx, func, name, length, cproto, magic) -> JSValue
; LVO -888: QJS_NewCFunction2(result,ctx,func,name,length,cproto,magic)
;           (a0/a1/a2/a3/d0/d1/d2)
; Stack: [ret:4] [ctx:4] [func:4] [name:4] [length:4] [cproto:4] [magic:4]
; ===================================================================
	xdef	_JS_NewCFunction2
_JS_NewCFunction2:
	movem.l	d2-d7/a2-a6,-(sp)	; save 11 regs = 44 bytes
	subq.l	#8,sp			; result buffer
	move.l	sp,a0			; a0 = &result
	move.l	44+8+4(sp),a1		; ctx
	move.l	44+8+8(sp),a2		; func
	move.l	44+8+12(sp),a3		; name
	move.l	44+8+16(sp),d0		; length
	move.l	44+8+20(sp),d1		; cproto
	move.l	44+8+24(sp),d2		; magic
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#888,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; JS_SetPropertyStr(ctx, this_obj, prop, val) -> int
; LVO -588: QJS_SetPropertyStr(ctx,this_ptr,prop_str,val_ptr)(a0/a1/a2/a3)
; Stack: [ret:4] [ctx:4] [this_obj:8] [prop:4] [val:8]
; ===================================================================
	xdef	_JS_SetPropertyStr
_JS_SetPropertyStr:
	movem.l	d2/a2-a6,-(sp)		; 6 regs = 24 bytes
	move.l	28(sp),a0		; a0 = ctx
	lea	32(sp),a1		; a1 = &this_obj
	move.l	40(sp),a2		; a2 = prop_str
	lea	44(sp),a3		; a3 = &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#588,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetPropertyUint32(ctx, this_obj, idx, val) -> int
; LVO -582: QJS_SetPropertyUint32(ctx,this_ptr,idx,val_ptr)(a0/a1/d0/a2)
; Stack: [ret:4] [ctx:4] [this_obj:8] [idx:4] [val:8]
; ===================================================================
	xdef	_JS_SetPropertyUint32
_JS_SetPropertyUint32:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0		; ctx
	lea	32(sp),a1		; &this_obj
	move.l	40(sp),d0		; idx
	lea	44(sp),a2		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#582,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetPropertyStr(ctx, this_obj, prop) -> JSValue
; LVO -564: QJS_GetPropertyStr(result,ctx,this_ptr,prop_str)(a0/a1/a2/a3)
; Stack: [ret:4] [ctx:4] [this_obj:8] [prop:4]
; ===================================================================
	xdef	_JS_GetPropertyStr
_JS_GetPropertyStr:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp			; result buffer
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	lea	24+8+8(sp),a2		; &this_obj
	move.l	24+8+16(sp),a3		; prop
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#564,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_Eval(ctx, input, input_len, filename, eval_flags) -> JSValue
; LVO -162: QJS_Eval(result,ctx,input,input_len,filename,eval_flags)
;           (a0/a1/a2/d0/a3/d1)
; Stack: [ret:4] [ctx:4] [input:4] [input_len:4] [filename:4] [eval_flags:4]
; ===================================================================
	xdef	_JS_Eval
_JS_Eval:
	movem.l	d2-d7/a2-a6,-(sp)	; 11 regs = 44 bytes
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	44+8+4(sp),a1		; ctx
	move.l	44+8+8(sp),a2		; input
	move.l	44+8+12(sp),d0		; input_len
	move.l	44+8+16(sp),a3		; filename
	move.l	44+8+20(sp),d1		; eval_flags
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#162,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2-d7/a2-a6
	rts
