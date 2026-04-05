; bridge_dpvs.s — Assembly trampoline for JS_DefinePropertyValueStr
;
; C signature: int JS_DefinePropertyValueStr(
;     JSContext *ctx, JSValueConst this_obj, const char *prop,
;     JSValue val, int flags)
;
; Stack layout at entry (after JSR pushes return address):
;   SP+0:  return address (4 bytes)
;   SP+4:  ctx (4 bytes)
;   SP+8:  this_obj (8 bytes, JSValue = uint64_t)
;   SP+16: prop (4 bytes, const char *)
;   SP+20: val (8 bytes, JSValue = uint64_t)
;   SP+28: flags (4 bytes, int)
;
; LVO -666: QJS_DefinePropertyValueStr(ctx,this_ptr,val_ptr,prop_str,flags)
;           Registers: a0=ctx, a1=&this_obj, a2=&val, a3=prop, d0=flags, a6=base
;
; We pass STACK ADDRESSES for this_obj and val — no copying needed.

	section	code
	xdef	_JS_DefinePropertyValueStr
	xref	_QJSBase

_JS_DefinePropertyValueStr:
	movem.l	d2/a2-a6,-(sp)		; save callee-saved (6 regs = 24 bytes)
	; Stack: 24(saved regs) + 4(ret addr) = 28 bytes before first param
	; Params: ctx(4) this_obj(8) prop(4) val(8) flags(4)
	move.l	28(sp),a0		; a0 = ctx
	lea	32(sp),a1		; a1 = &this_obj (8-byte JSValue on stack)
	move.l	40(sp),a3		; a3 = prop string
	lea	44(sp),a2		; a2 = &val (8-byte JSValue on stack)
	move.l	52(sp),d0		; d0 = flags
	move.l	_QJSBase,a6		; a6 = library base
	; Compute LVO address
	move.l	a6,a5
	suba.l	#666,a5			; a5 = QJSBase - 666
	jsr	(a5)			; call library function, result in d0
	movem.l	(sp)+,d2/a2-a6		; restore callee-saved
	rts
