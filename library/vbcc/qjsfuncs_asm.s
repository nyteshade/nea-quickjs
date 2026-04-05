; qjsfuncs_asm.s — Assembly wrappers for library functions where
; VBCC's __reg parameter handling fails (too many register params).
;
; These replace C wrappers in qjsfuncs.c for functions with 7+ register params.

	section	code

; ===================================================================
; QJS_NewCFunction2 — LVO entry for JS_NewCFunction2
;
; Register params from caller:
;   a6 = library base (ignored)
;   a0 = JSValue *result (out-parameter)
;   a1 = JSContext *ctx
;   a2 = void *func (C function pointer)
;   a3 = const char *name
;   d0 = int length
;   d1 = int cproto (JSCFunctionEnum)
;   d2 = int magic
;
; Calls internal: JSValue JS_NewCFunction2(ctx, func, name, length, cproto, magic)
; Result: 8 bytes written through a0
; ===================================================================

	xdef	_QJS_NewCFunction2
	xdef	_QJS_SetPropertyStr
	xdef	_QJS_Eval
	xdef	_QJS_ToCStringLen2
	xdef	_QJS_FreeValue
	xref	_JS_NewCFunction2
	xref	_JS_SetPropertyStr
	xref	_JS_Eval
	xref	_JS_ToCStringLen2
	xref	_JS_FreeValue

_QJS_NewCFunction2:
	; Save callee-saved regs + a0 (result pointer)
	movem.l	d2-d7/a2-a6,-(sp)	; 11 regs = 44 bytes
	move.l	a0,a4			; save result pointer in a4 (callee-saved)

	; Push params for C call to JS_NewCFunction2(ctx, func, name, length, cproto, magic)
	; Push right-to-left:
	move.l	d2,-(sp)		; magic
	move.l	d1,-(sp)		; cproto
	move.l	d0,-(sp)		; length
	move.l	a3,-(sp)		; name
	move.l	a2,-(sp)		; func
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewCFunction2	; returns uint64_t in d0/d1
	lea	24(sp),sp		; clean 6 params (24 bytes)

	; Store result through saved a0 (now in a4)
	; d0 = high 32 bits, d1 = low 32 bits of uint64_t
	move.l	d0,(a4)			; high word at result+0
	move.l	d1,4(a4)		; low word at result+4

	movem.l	(sp)+,d2-d7/a2-a6	; restore
	rts

; ===================================================================
; QJS_SetPropertyStr — LVO entry for JS_SetPropertyStr
;
; Register params:
;   a6 = library base (ignored)
;   a0 = JSContext *ctx
;   a1 = JSValue *this_ptr (8-byte JSValue)
;   a2 = const char *prop_str
;   a3 = JSValue *val_ptr (8-byte JSValue, consumed)
;
; Calls internal: int JS_SetPropertyStr(ctx, this_obj, prop, val)
;   where this_obj and val are passed by VALUE (8 bytes each on stack)
; ===================================================================

; ===================================================================
; QJS_Eval — LVO entry for JS_Eval
;
; Register params:
;   a6 = library base (ignored)
;   a0 = JSValue *result (out-parameter, 8 bytes)
;   a1 = JSContext *ctx
;   a2 = const char *input
;   d0 = ULONG input_len
;   a3 = const char *filename
;   d1 = int eval_flags
;
; Calls: JSValue JS_Eval(ctx, input, input_len, filename, eval_flags)
; Returns 8 bytes through *result
; ===================================================================

_QJS_Eval:
	movem.l	d2-d7/a2-a6,-(sp)	; 11 regs = 44 bytes
	move.l	a0,a4			; save result pointer

	; Push params right-to-left for JS_Eval(ctx, input, input_len, filename, eval_flags)
	move.l	d1,-(sp)		; eval_flags
	move.l	a3,-(sp)		; filename
	move.l	d0,-(sp)		; input_len
	move.l	a2,-(sp)		; input
	move.l	a1,-(sp)		; ctx
	jsr	_JS_Eval		; returns uint64_t in d0/d1
	lea	20(sp),sp		; clean 5 params (20 bytes)

	; Store result through saved pointer
	move.l	d0,(a4)			; high word
	move.l	d1,4(a4)		; low word

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
_QJS_SetPropertyStr:
	movem.l	d2-d7/a2-a6,-(sp)	; 11 regs = 44 bytes

	; Read JSValue this_obj (8 bytes) from *a1
	move.l	(a1),d4			; this_obj high
	move.l	4(a1),d5		; this_obj low

	; Read JSValue val (8 bytes) from *a3
	move.l	(a3),d6			; val high
	move.l	4(a3),d7		; val low

	; Push params for C call right-to-left:
	; JS_SetPropertyStr(ctx, this_obj, prop_str, val)
	move.l	d7,-(sp)		; val low
	move.l	d6,-(sp)		; val high
	move.l	a2,-(sp)		; prop_str
	move.l	d5,-(sp)		; this_obj low
	move.l	d4,-(sp)		; this_obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetPropertyStr	; returns int in d0
	lea	24(sp),sp		; clean 24 bytes (4+8+4+8)

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ToCStringLen2 — LVO entry
; SFD: (ctx,plen,val_ptr,cesu8)(a0/a2/a1/d0) — note swapped a1/a2!
;
; Calls: const char *JS_ToCStringLen2(ctx, plen, val, cesu8)
;   val passed by VALUE (8 bytes)
; Returns: pointer in d0
; ===================================================================

_QJS_ToCStringLen2:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; val high from *a1
	move.l	4(a1),d5		; val low
	move.l	d0,-(sp)		; cesu8
	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a2,-(sp)		; plen
	move.l	a0,-(sp)		; ctx
	jsr	_JS_ToCStringLen2
	lea	20(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_FreeValue — LVO entry
; SFD: (ctx,val_ptr)(a0/a1)
;
; Calls: void JS_FreeValue(ctx, val)
;   val passed by VALUE (8 bytes)
; ===================================================================

_QJS_FreeValue:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; val high from *a1
	move.l	4(a1),d5		; val low
	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_FreeValue
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts
