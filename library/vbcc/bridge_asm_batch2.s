; bridge_asm_batch2.s — Assembly trampolines for bridge functions (batch 2)
;
; Functions 86-176 from quickjs_lib.sfd (QJS_ThrowOutOfMemory through QJS_LoadModule)
; Skips: GetPropertyStr, SetPropertyStr, SetPropertyUint32, NewCFunction2,
;        DefinePropertyValueStr (already in bridge_asm.s / bridge_dpvs.s)
;
; Register conventions:
;   d2/a2-a6 saved (6 regs = 24 bytes) for most functions
;   d2-d7/a2-a6 saved (11 regs = 44 bytes) when d0-d2 all used for LVO params
;   JSValue result: 8-byte buffer on stack, returned in d0(high)/d1(low)
;   JSValue/_ptr params: lea to pass stack address (by-value via pointer)

	section	code
	xref	_QJSBase

; ===================================================================
; JS_ThrowOutOfMemory(JSContext *ctx) -> JSValue
; LVO -504: QJS_ThrowOutOfMemory(result,ctx)(a0/a1)
; Stack: [ret:4] [ctx:4]
; ===================================================================
; ===================================================================
; JS_DetectModule(const char *input, size_t input_len) -> int
; LVO -510: QJS_DetectModule(input,input_len)(a0/d0)
; Stack: [ret:4] [input:4] [input_len:4]
; ===================================================================
; ===================================================================
; JS_Malloc(JSContext *ctx, size_t size) -> void *
; LVO -516: QJS_Malloc(ctx,size)(a0/d0)
; Stack: [ret:4] [ctx:4] [size:4]
; ===================================================================
	xdef	_JS_Malloc
_JS_Malloc:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),d0		; d0 = size
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#516,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_Free(JSContext *ctx, void *ptr)
; LVO -522: QJS_Free(ctx,ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [ptr:4]
; ===================================================================
	xdef	_JS_Free
_JS_Free:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = ptr
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#522,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_Realloc(JSContext *ctx, void *ptr, size_t size) -> void *
; LVO -528: QJS_Realloc(ctx,ptr,size)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [ptr:4] [size:4]
; ===================================================================
	xdef	_JS_Realloc
_JS_Realloc:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = ptr
	move.l	24+12(sp),d0		; d0 = size
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#528,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_Calloc(JSContext *ctx, size_t count, size_t size) -> void *
; LVO -534: QJS_Calloc(ctx,count,size)(a0/d0/d1)
; Stack: [ret:4] [ctx:4] [count:4] [size:4]
; ===================================================================
	xdef	_JS_Calloc
_JS_Calloc:
	movem.l	d2-d7/a2-a6,-(sp)	; uses d0/d1, save 11 regs = 44 bytes
	move.l	44+4(sp),a0		; a0 = ctx
	move.l	44+8(sp),d0		; d0 = count
	move.l	44+12(sp),d1		; d1 = size
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#534,a5
	jsr	(a5)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; JS_Mallocz(JSContext *ctx, size_t size) -> void *
; LVO -540: QJS_Mallocz(ctx,size)(a0/d0)
; Stack: [ret:4] [ctx:4] [size:4]
; ===================================================================
	xdef	_JS_Mallocz
_JS_Mallocz:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),d0		; d0 = size
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#540,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_Strdup(JSContext *ctx, const char *str) -> char *
; LVO -546: QJS_Strdup(ctx,str)(a0/a1)
; Stack: [ret:4] [ctx:4] [str:4]
; ===================================================================
	xdef	_JS_Strdup
_JS_Strdup:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = str
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#546,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetProperty(JSContext *ctx, JSValueConst this_obj, JSAtom prop) -> JSValue
; LVO -552: QJS_GetProperty(result,ctx,this_ptr,prop)(a0/a1/a2/d0)
; Stack: [ret:4] [ctx:4] [this_obj:8] [prop:4]
; ===================================================================
	xdef	_JS_GetProperty
_JS_GetProperty:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	lea	24+8+8(sp),a2		; a2 = &this_obj
	move.l	24+8+16(sp),d0		; d0 = prop
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#552,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetPropertyUint32(JSContext *ctx, JSValueConst this_obj, uint32_t idx) -> JSValue
; LVO -558: QJS_GetPropertyUint32(result,ctx,this_ptr,idx)(a0/a1/a2/d0)
; Stack: [ret:4] [ctx:4] [this_obj:8] [idx:4]
; ===================================================================
	xdef	_JS_GetPropertyUint32
_JS_GetPropertyUint32:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	lea	24+8+8(sp),a2		; a2 = &this_obj
	move.l	24+8+16(sp),d0		; d0 = idx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#558,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetPropertyInt64(JSContext *ctx, JSValueConst this_obj, int64_t idx) -> JSValue
; LVO -570: QJS_GetPropertyInt64(result,ctx,this_ptr,idx)(a0/a1/a2/d0)
; Stack: [ret:4] [ctx:4] [this_obj:8] [idx:4]
; NOTE: idx is int64_t in C but truncated to 32-bit in SFD register d0
; ===================================================================
	xdef	_JS_GetPropertyInt64
_JS_GetPropertyInt64:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	lea	24+8+8(sp),a2		; a2 = &this_obj
	move.l	24+8+16(sp),d0		; d0 = idx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#570,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetProperty(JSContext *ctx, JSValueConst this_obj, JSAtom prop, JSValue val) -> int
; LVO -576: QJS_SetProperty(ctx,this_ptr,prop,val_ptr)(a0/a1/d0/a2)
; Stack: [ret:4] [ctx:4] [this_obj:8] [prop:4] [val:8]
; ===================================================================
	xdef	_JS_SetProperty
_JS_SetProperty:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &this_obj
	move.l	24+16(sp),d0		; d0 = prop
	lea	24+20(sp),a2		; a2 = &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#576,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_HasProperty(JSContext *ctx, JSValueConst this_obj, JSAtom prop) -> int
; LVO -594: QJS_HasProperty(ctx,this_ptr,prop)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [this_obj:8] [prop:4]
; ===================================================================
	xdef	_JS_HasProperty
_JS_HasProperty:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &this_obj
	move.l	24+16(sp),d0		; d0 = prop
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#594,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_DeleteProperty(JSContext *ctx, JSValueConst obj, JSAtom prop, int flags) -> int
; LVO -600: QJS_DeleteProperty(ctx,obj_ptr,prop,flags)(a0/a1/d0/d1)
; Stack: [ret:4] [ctx:4] [obj:8] [prop:4] [flags:4]
; ===================================================================
	xdef	_JS_DeleteProperty
_JS_DeleteProperty:
	movem.l	d2-d7/a2-a6,-(sp)	; uses d0/d1, save 11 regs = 44 bytes
	move.l	44+4(sp),a0		; a0 = ctx
	lea	44+8(sp),a1		; a1 = &obj
	move.l	44+16(sp),d0		; d0 = prop
	move.l	44+20(sp),d1		; d1 = flags
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#600,a5
	jsr	(a5)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; JS_SetPrototype(JSContext *ctx, JSValueConst obj, JSValueConst proto) -> int
; LVO -606: QJS_SetPrototype(ctx,obj_ptr,proto_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [obj:8] [proto:8]
; ===================================================================
	xdef	_JS_SetPrototype
_JS_SetPrototype:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &obj
	lea	24+16(sp),a2		; a2 = &proto
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#606,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetPrototype(JSContext *ctx, JSValueConst val) -> JSValue
; LVO -612: QJS_GetPrototype(result,ctx,val_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [val:8]
; ===================================================================
	xdef	_JS_GetPrototype
_JS_GetPrototype:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	lea	24+8+8(sp),a2		; a2 = &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#612,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetLength(JSContext *ctx, JSValueConst obj, int64_t *pres) -> int
; LVO -618: QJS_GetLength(ctx,obj_ptr,pres)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [obj:8] [pres:4]
; ===================================================================
	xdef	_JS_GetLength
_JS_GetLength:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &obj
	move.l	24+16(sp),a2		; a2 = pres
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#618,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetLength(JSContext *ctx, JSValueConst obj, int64_t len) -> int
; LVO -624: QJS_SetLength(ctx,obj_ptr,len)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [obj:8] [len:4]
; NOTE: len is int64_t in C but truncated to 32-bit in SFD register d0
; ===================================================================
	xdef	_JS_SetLength
_JS_SetLength:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &obj
	move.l	24+16(sp),d0		; d0 = len
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#624,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsExtensible(JSContext *ctx, JSValueConst obj) -> int
; LVO -630: QJS_IsExtensible(ctx,obj_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [obj:8]
; ===================================================================
	xdef	_JS_IsExtensible
_JS_IsExtensible:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &obj
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#630,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_PreventExtensions(JSContext *ctx, JSValueConst obj) -> int
; LVO -636: QJS_PreventExtensions(ctx,obj_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [obj:8]
; ===================================================================
	xdef	_JS_PreventExtensions
_JS_PreventExtensions:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &obj
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#636,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SealObject(JSContext *ctx, JSValueConst obj) -> int
; LVO -642: QJS_SealObject(ctx,obj_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [obj:8]
; ===================================================================
	xdef	_JS_SealObject
_JS_SealObject:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &obj
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#642,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_FreezeObject(JSContext *ctx, JSValueConst obj) -> int
; LVO -648: QJS_FreezeObject(ctx,obj_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [obj:8]
; ===================================================================
	xdef	_JS_FreezeObject
_JS_FreezeObject:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &obj
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#648,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_DefinePropertyValue(JSContext *ctx, JSValueConst this_obj, JSAtom prop,
;                        JSValue val, int flags) -> int
; LVO -654: QJS_DefinePropertyValue(ctx,this_ptr,prop,val_ptr,flags)(a0/a1/d0/a2/d1)
; Stack: [ret:4] [ctx:4] [this_obj:8] [prop:4] [val:8] [flags:4]
; ===================================================================
	xdef	_JS_DefinePropertyValue
_JS_DefinePropertyValue:
	movem.l	d2-d7/a2-a6,-(sp)	; uses d0/d1, save 11 regs = 44 bytes
	move.l	44+4(sp),a0		; a0 = ctx
	lea	44+8(sp),a1		; a1 = &this_obj
	move.l	44+16(sp),d0		; d0 = prop
	lea	44+20(sp),a2		; a2 = &val
	move.l	44+28(sp),d1		; d1 = flags
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#654,a5
	jsr	(a5)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; JS_DefinePropertyValueUint32(JSContext *ctx, JSValueConst this_obj, uint32_t idx,
;                              JSValue val, int flags) -> int
; LVO -660: QJS_DefinePropertyValueUint32(ctx,this_ptr,idx,val_ptr,flags)(a0/a1/d0/a2/d1)
; Stack: [ret:4] [ctx:4] [this_obj:8] [idx:4] [val:8] [flags:4]
; ===================================================================
	xdef	_JS_DefinePropertyValueUint32
_JS_DefinePropertyValueUint32:
	movem.l	d2-d7/a2-a6,-(sp)	; uses d0/d1, save 11 regs = 44 bytes
	move.l	44+4(sp),a0		; a0 = ctx
	lea	44+8(sp),a1		; a1 = &this_obj
	move.l	44+16(sp),d0		; d0 = idx
	lea	44+20(sp),a2		; a2 = &val
	move.l	44+28(sp),d1		; d1 = flags
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#660,a5
	jsr	(a5)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; JS_SetOpaque(JSValueConst obj, void *opaque)
; LVO -672: QJS_SetOpaque(obj_ptr,opaque)(a1/a0)
; NOTE: Reversed register order! a1=obj_ptr, a0=opaque
; Stack: [ret:4] [obj:8] [opaque:4]
; ===================================================================
	xdef	_JS_SetOpaque
_JS_SetOpaque:
	movem.l	d2/a2-a6,-(sp)
	lea	24+4(sp),a1		; a1 = &obj (JSValue by ptr)
	move.l	24+12(sp),a0		; a0 = opaque
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#672,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetOpaque(JSValueConst obj, JSClassID class_id) -> void *
; LVO -678: QJS_GetOpaque(obj_ptr,class_id)(a0/d0)
; Stack: [ret:4] [obj:8] [class_id:4]
; ===================================================================
	xdef	_JS_GetOpaque
_JS_GetOpaque:
	movem.l	d2/a2-a6,-(sp)
	lea	24+4(sp),a0		; a0 = &obj
	move.l	24+12(sp),d0		; d0 = class_id
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#678,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetOpaque2(JSContext *ctx, JSValueConst obj, JSClassID class_id) -> void *
; LVO -684: QJS_GetOpaque2(ctx,obj_ptr,class_id)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [obj:8] [class_id:4]
; ===================================================================
	xdef	_JS_GetOpaque2
_JS_GetOpaque2:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &obj
	move.l	24+16(sp),d0		; d0 = class_id
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#684,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetOwnPropertyNames(JSContext *ctx, JSPropertyEnum **ptab, uint32_t *plen,
;                        JSValueConst obj, int flags) -> int
; LVO -690: QJS_GetOwnPropertyNames(ctx,ptab,plen,obj_ptr,flags)(a0/a1/a2/a3/d0)
; Stack: [ret:4] [ctx:4] [ptab:4] [plen:4] [obj:8] [flags:4]
; ===================================================================
	xdef	_JS_GetOwnPropertyNames
_JS_GetOwnPropertyNames:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = ptab
	move.l	24+12(sp),a2		; a2 = plen
	lea	24+16(sp),a3		; a3 = &obj
	move.l	24+24(sp),d0		; d0 = flags
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#690,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_FreePropertyEnum(JSContext *ctx, JSPropertyEnum *tab, uint32_t len)
; LVO -696: QJS_FreePropertyEnum(ctx,tab,len)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [tab:4] [len:4]
; ===================================================================
	xdef	_JS_FreePropertyEnum
_JS_FreePropertyEnum:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = tab
	move.l	24+12(sp),d0		; d0 = len
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#696,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsInstanceOf(JSContext *ctx, JSValueConst val, JSValueConst obj) -> int
; LVO -702: QJS_IsInstanceOf(ctx,val_ptr,obj_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [val:8] [obj:8]
; ===================================================================
	xdef	_JS_IsInstanceOf
_JS_IsInstanceOf:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &val
	lea	24+16(sp),a2		; a2 = &obj
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#702,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewAtomLen(JSContext *ctx, const char *str, size_t len) -> JSAtom
; LVO -708: QJS_NewAtomLen(ctx,str,len)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [str:4] [len:4]
; ===================================================================
	xdef	_JS_NewAtomLen
_JS_NewAtomLen:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = str
	move.l	24+12(sp),d0		; d0 = len
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#708,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewAtom(JSContext *ctx, const char *str) -> JSAtom
; LVO -714: QJS_NewAtom(ctx,str)(a0/a1)
; Stack: [ret:4] [ctx:4] [str:4]
; ===================================================================
	xdef	_JS_NewAtom
_JS_NewAtom:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = str
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#714,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewAtomUInt32(JSContext *ctx, uint32_t n) -> JSAtom
; LVO -720: QJS_NewAtomUInt32(ctx,n)(a0/d0)
; Stack: [ret:4] [ctx:4] [n:4]
; ===================================================================
	xdef	_JS_NewAtomUInt32
_JS_NewAtomUInt32:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),d0		; d0 = n
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#720,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_DupAtom(JSContext *ctx, JSAtom v) -> JSAtom
; LVO -726: QJS_DupAtom(ctx,v)(a0/d0)
; Stack: [ret:4] [ctx:4] [v:4]
; ===================================================================
	xdef	_JS_DupAtom
_JS_DupAtom:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),d0		; d0 = v
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#726,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_FreeAtom(JSContext *ctx, JSAtom v)
; LVO -732: QJS_FreeAtom(ctx,v)(a0/d0)
; Stack: [ret:4] [ctx:4] [v:4]
; ===================================================================
	xdef	_JS_FreeAtom
_JS_FreeAtom:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),d0		; d0 = v
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#732,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AtomToValue(JSContext *ctx, JSAtom atom) -> JSValue
; LVO -738: QJS_AtomToValue(result,ctx,atom)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [atom:4]
; ===================================================================
	xdef	_JS_AtomToValue
_JS_AtomToValue:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	move.l	24+8+8(sp),d0		; d0 = atom
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#738,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AtomToString(JSContext *ctx, JSAtom atom) -> JSValue
; LVO -744: QJS_AtomToString(result,ctx,atom)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [atom:4]
; ===================================================================
	xdef	_JS_AtomToString
_JS_AtomToString:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	move.l	24+8+8(sp),d0		; d0 = atom
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#744,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AtomToCStringLen(JSContext *ctx, size_t *plen, JSAtom atom) -> const char *
; LVO -750: QJS_AtomToCStringLen(ctx,plen,atom)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [plen:4] [atom:4]
; ===================================================================
	xdef	_JS_AtomToCStringLen
_JS_AtomToCStringLen:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = plen
	move.l	24+12(sp),d0		; d0 = atom
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#750,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ValueToAtom(JSContext *ctx, JSValueConst val) -> JSAtom
; LVO -756: QJS_ValueToAtom(ctx,val_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [val:8]
; ===================================================================
	xdef	_JS_ValueToAtom
_JS_ValueToAtom:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#756,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_EvalFunction(JSContext *ctx, JSValue fun) -> JSValue
; LVO -762: QJS_EvalFunction(result,ctx,fun_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [fun:8]
; ===================================================================
	xdef	_JS_EvalFunction
_JS_EvalFunction:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	lea	24+8+8(sp),a2		; a2 = &fun
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#762,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_Call(JSContext *ctx, JSValueConst func, JSValueConst this_obj,
;         int argc, JSValueConst *argv) -> JSValue
; LVO -768: QJS_Call(result,ctx,func_ptr,this_ptr,argc,argv_addr)(a0/a1/a2/a3/d0/d1)
; Stack: [ret:4] [ctx:4] [func:8] [this_obj:8] [argc:4] [argv:4]
; NOTE: argv_addr in d1 is ULONG (pointer cast); argc in d0
; ===================================================================
	xdef	_JS_Call
_JS_Call:
	movem.l	d2-d7/a2-a6,-(sp)	; uses d0/d1, save 11 regs = 44 bytes
	subq.l	#8,sp			; result buffer
	move.l	sp,a0			; a0 = &result
	move.l	44+8+4(sp),a1		; a1 = ctx
	lea	44+8+8(sp),a2		; a2 = &func
	lea	44+8+16(sp),a3		; a3 = &this_obj
	move.l	44+8+24(sp),d0		; d0 = argc
	move.l	44+8+28(sp),d1		; d1 = argv (pointer as ULONG)
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#768,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; JS_Invoke(JSContext *ctx, JSValueConst this_obj, JSAtom atom,
;           int argc, JSValueConst *argv) -> JSValue
; LVO -774: QJS_Invoke(result,ctx,this_ptr,argv,atom,argc)(a0/a1/a2/a3/d0/d1)
; Stack: [ret:4] [ctx:4] [this_obj:8] [atom:4] [argc:4] [argv:4]
; NOTE: argv in a3, atom in d0, argc in d1
; ===================================================================
	xdef	_JS_Invoke
_JS_Invoke:
	movem.l	d2-d7/a2-a6,-(sp)	; uses d0/d1, save 11 regs = 44 bytes
	subq.l	#8,sp			; result buffer
	move.l	sp,a0			; a0 = &result
	move.l	44+8+4(sp),a1		; a1 = ctx
	lea	44+8+8(sp),a2		; a2 = &this_obj
	move.l	44+8+24(sp),a3		; a3 = argv (pointer)
	move.l	44+8+16(sp),d0		; d0 = atom
	move.l	44+8+20(sp),d1		; d1 = argc
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#774,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; JS_CallConstructor(JSContext *ctx, JSValueConst func,
;                    int argc, JSValueConst *argv) -> JSValue
; LVO -780: QJS_CallConstructor(result,ctx,func_ptr,argv,argc)(a0/a1/a2/a3/d0)
; Stack: [ret:4] [ctx:4] [func:8] [argc:4] [argv:4]
; ===================================================================
	xdef	_JS_CallConstructor
_JS_CallConstructor:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	lea	24+8+8(sp),a2		; a2 = &func
	move.l	24+8+20(sp),a3		; a3 = argv (pointer)
	move.l	24+8+16(sp),d0		; d0 = argc
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#780,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ParseJSON(JSContext *ctx, const char *buf, size_t buf_len,
;              const char *filename) -> JSValue
; LVO -786: QJS_ParseJSON(result,ctx,buf,filename,buf_len)(a0/a1/a2/a3/d0)
; Stack: [ret:4] [ctx:4] [buf:4] [buf_len:4] [filename:4]
; NOTE: SFD order is (result,ctx,buf,filename,buf_len) — filename before buf_len
; ===================================================================
	xdef	_JS_ParseJSON
_JS_ParseJSON:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	move.l	24+8+8(sp),a2		; a2 = buf
	move.l	24+8+16(sp),a3		; a3 = filename
	move.l	24+8+12(sp),d0		; d0 = buf_len
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#786,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_JSONStringify(JSContext *ctx, JSValueConst obj) -> JSValue
; LVO -792: QJS_JSONStringify(result,ctx,obj_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [obj:8]
; ===================================================================
	xdef	_JS_JSONStringify
_JS_JSONStringify:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	lea	24+8+8(sp),a2		; a2 = &obj
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#792,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_WriteObject(JSContext *ctx, size_t *psize, JSValueConst obj, int flags) -> uint8_t *
; LVO -798: QJS_WriteObject(ctx,psize,obj_ptr,flags)(a0/a1/a2/d0)
; Stack: [ret:4] [ctx:4] [psize:4] [obj:8] [flags:4]
; ===================================================================
	xdef	_JS_WriteObject
_JS_WriteObject:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = psize
	lea	24+12(sp),a2		; a2 = &obj
	move.l	24+20(sp),d0		; d0 = flags
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#798,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ReadObject(JSContext *ctx, const uint8_t *buf, size_t buf_len, int flags) -> JSValue
; LVO -804: QJS_ReadObject(result,ctx,buf,buf_len,flags)(a0/a1/a2/d0/d1)
; Stack: [ret:4] [ctx:4] [buf:4] [buf_len:4] [flags:4]
; ===================================================================
	xdef	_JS_ReadObject
_JS_ReadObject:
	movem.l	d2-d7/a2-a6,-(sp)	; uses d0/d1, save 11 regs = 44 bytes
	subq.l	#8,sp			; result buffer
	move.l	sp,a0			; a0 = &result
	move.l	44+8+4(sp),a1		; a1 = ctx
	move.l	44+8+8(sp),a2		; a2 = buf
	move.l	44+8+12(sp),d0		; d0 = buf_len
	move.l	44+8+16(sp),d1		; d1 = flags
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#804,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; JS_NewClassID(JSRuntime *rt, JSClassID *pclass_id) -> JSClassID
; LVO -810: QJS_NewClassID(rt,pclass_id)(a0/a1)
; Stack: [ret:4] [rt:4] [pclass_id:4]
; ===================================================================
	xdef	_JS_NewClassID
_JS_NewClassID:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = rt
	move.l	24+8(sp),a1		; a1 = pclass_id
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#810,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewClass(JSRuntime *rt, JSClassDef *class_def, JSClassID class_id) -> int
; LVO -816: QJS_NewClass(rt,class_def,class_id)(a0/a1/d0)
; Stack: [ret:4] [rt:4] [class_def:4] [class_id:4]
; ===================================================================
	xdef	_JS_NewClass
_JS_NewClass:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = rt
	move.l	24+8(sp),a1		; a1 = class_def
	move.l	24+12(sp),d0		; d0 = class_id
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#816,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsRegisteredClass(JSRuntime *rt, JSClassID class_id) -> int
; LVO -822: QJS_IsRegisteredClass(rt,class_id)(a0/d0)
; Stack: [ret:4] [rt:4] [class_id:4]
; ===================================================================
	xdef	_JS_IsRegisteredClass
_JS_IsRegisteredClass:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = rt
	move.l	24+8(sp),d0		; d0 = class_id
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#822,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetClassID(JSValueConst val) -> JSClassID
; LVO -828: QJS_GetClassID(val_ptr)(a0)
; Stack: [ret:4] [val:8]
; ===================================================================
	xdef	_JS_GetClassID
_JS_GetClassID:
	movem.l	d2/a2-a6,-(sp)
	lea	24+4(sp),a0		; a0 = &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#828,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetModuleLoaderFunc(JSRuntime *rt, JSModuleNormalizeFunc *normalize_func,
;                        JSModuleLoaderFunc *loader_func, void *opaque)
; LVO -834: QJS_SetModuleLoaderFunc(rt,normalize_func,loader_func,opaque)(a0/a1/a2/a3)
; Stack: [ret:4] [rt:4] [normalize_func:4] [loader_func:4] [opaque:4]
; ===================================================================
	xdef	_JS_SetModuleLoaderFunc
_JS_SetModuleLoaderFunc:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = rt
	move.l	24+8(sp),a1		; a1 = normalize_func
	move.l	24+12(sp),a2		; a2 = loader_func
	move.l	24+16(sp),a3		; a3 = opaque
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#834,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetImportMeta(JSContext *ctx, JSModuleDef *m) -> JSValue
; LVO -840: QJS_GetImportMeta(result,ctx,m)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [m:4]
; ===================================================================
	xdef	_JS_GetImportMeta
_JS_GetImportMeta:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	move.l	24+8+8(sp),a2		; a2 = m
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#840,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetModuleName(JSContext *ctx, JSModuleDef *m) -> const char *
; LVO -846: QJS_GetModuleName(ctx,m)(a0/a1)
; Stack: [ret:4] [ctx:4] [m:4]
; ===================================================================
	xdef	_JS_GetModuleName
_JS_GetModuleName:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = m
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#846,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetModuleNamespace(JSContext *ctx, JSModuleDef *m) -> JSValue
; LVO -852: QJS_GetModuleNamespace(result,ctx,m)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [m:4]
; ===================================================================
	xdef	_JS_GetModuleNamespace
_JS_GetModuleNamespace:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	move.l	24+8+8(sp),a2		; a2 = m
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#852,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewCModule(JSContext *ctx, const char *name_str,
;               JSModuleInitFunc *func) -> JSModuleDef *
; LVO -858: QJS_NewCModule(ctx,name_str,func)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [name_str:4] [func:4]
; ===================================================================
	xdef	_JS_NewCModule
_JS_NewCModule:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = name_str
	move.l	24+12(sp),a2		; a2 = func
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#858,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddModuleExport(JSContext *ctx, JSModuleDef *m, const char *name_str) -> int
; LVO -864: QJS_AddModuleExport(ctx,m,name_str)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [m:4] [name_str:4]
; ===================================================================
	xdef	_JS_AddModuleExport
_JS_AddModuleExport:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = m
	move.l	24+12(sp),a2		; a2 = name_str
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#864,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetModuleExport(JSContext *ctx, JSModuleDef *m, const char *export_name,
;                    JSValue val) -> int
; LVO -870: QJS_SetModuleExport(ctx,m,export_name,val_ptr)(a0/a1/a2/a3)
; Stack: [ret:4] [ctx:4] [m:4] [export_name:4] [val:8]
; ===================================================================
	xdef	_JS_SetModuleExport
_JS_SetModuleExport:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = m
	move.l	24+12(sp),a2		; a2 = export_name
	lea	24+16(sp),a3		; a3 = &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#870,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ResolveModule(JSContext *ctx, JSValueConst obj) -> int
; LVO -876: QJS_ResolveModule(ctx,obj_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [obj:8]
; ===================================================================
	xdef	_JS_ResolveModule
_JS_ResolveModule:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &obj
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#876,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetScriptOrModuleName(JSContext *ctx, int n_stack_levels) -> const char *
; LVO -882: QJS_GetScriptOrModuleName(ctx,n_stack_levels)(a0/d0)
; Stack: [ret:4] [ctx:4] [n_stack_levels:4]
; ===================================================================
	xdef	_JS_GetScriptOrModuleName
_JS_GetScriptOrModuleName:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),d0		; d0 = n_stack_levels
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#882,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetConstructor(JSContext *ctx, JSValueConst func, JSValueConst proto)
; LVO -894: QJS_SetConstructor(ctx,func_ptr,proto_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [func:8] [proto:8]
; ===================================================================
	xdef	_JS_SetConstructor
_JS_SetConstructor:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &func
	lea	24+16(sp),a2		; a2 = &proto
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#894,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetPropertyFunctionList(JSContext *ctx, JSValueConst obj,
;                            const JSCFunctionListEntry *tab, int len)
; LVO -900: QJS_SetPropertyFunctionList(ctx,obj_ptr,tab,len)(a0/a1/a2/d0)
; Stack: [ret:4] [ctx:4] [obj:8] [tab:4] [len:4]
; ===================================================================
; ===================================================================
; JS_IsJobPending(JSRuntime *rt) -> int
; LVO -906: QJS_IsJobPending(rt)(a0)
; Stack: [ret:4] [rt:4]
; ===================================================================
	xdef	_JS_IsJobPending
_JS_IsJobPending:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = rt
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#906,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ExecutePendingJob(JSRuntime *rt, JSContext **pctx) -> int
; LVO -912: QJS_ExecutePendingJob(rt,pctx)(a0/a1)
; Stack: [ret:4] [rt:4] [pctx:4]
; ===================================================================
	xdef	_JS_ExecutePendingJob
_JS_ExecutePendingJob:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = rt
	move.l	24+8(sp),a1		; a1 = pctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#912,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewPromiseCapability(JSContext *ctx, JSValue *resolving_funcs) -> JSValue
; LVO -918: QJS_NewPromiseCapability(result,ctx,resolving_funcs)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [resolving_funcs:4]
; ===================================================================
	xdef	_JS_NewPromiseCapability
_JS_NewPromiseCapability:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	move.l	24+8+8(sp),a2		; a2 = resolving_funcs
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#918,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_PromiseState(JSContext *ctx, JSValueConst promise) -> int (JSPromiseStateEnum)
; LVO -924: QJS_PromiseState(ctx,promise_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [promise:8]
; ===================================================================
	xdef	_JS_PromiseState
_JS_PromiseState:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &promise
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#924,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_PromiseResult(JSContext *ctx, JSValueConst promise) -> JSValue
; LVO -930: QJS_PromiseResult(result,ctx,promise_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [promise:8]
; ===================================================================
	xdef	_JS_PromiseResult
_JS_PromiseResult:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	lea	24+8+8(sp),a2		; a2 = &promise
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#930,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsPromise(JSValueConst val) -> int
; LVO -936: QJS_IsPromise(val_ptr)(a0)
; Stack: [ret:4] [val:8]
; ===================================================================
	xdef	_JS_IsPromise
_JS_IsPromise:
	movem.l	d2/a2-a6,-(sp)
	lea	24+4(sp),a0		; a0 = &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#936,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetInterruptHandler(JSRuntime *rt, JSInterruptHandler *cb, void *opaque)
; LVO -942: QJS_SetInterruptHandler(rt,cb,opaque)(a0/a1/a2)
; Stack: [ret:4] [rt:4] [cb:4] [opaque:4]
; ===================================================================
	xdef	_JS_SetInterruptHandler
_JS_SetInterruptHandler:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = rt
	move.l	24+8(sp),a1		; a1 = cb
	move.l	24+12(sp),a2		; a2 = opaque
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#942,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetHostPromiseRejectionTracker(JSRuntime *rt,
;     JSHostPromiseRejectionTracker *cb, void *opaque)
; LVO -948: QJS_SetHostPromiseRejectionTracker(rt,cb,opaque)(a0/a1/a2)
; Stack: [ret:4] [rt:4] [cb:4] [opaque:4]
; ===================================================================
	xdef	_JS_SetHostPromiseRejectionTracker
_JS_SetHostPromiseRejectionTracker:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = rt
	move.l	24+8(sp),a1		; a1 = cb
	move.l	24+12(sp),a2		; a2 = opaque
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#948,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetCanBlock(JSRuntime *rt, int can_block)
; LVO -954: QJS_SetCanBlock(rt,can_block)(a0/d0)
; Stack: [ret:4] [rt:4] [can_block:4]
; ===================================================================
	xdef	_JS_SetCanBlock
_JS_SetCanBlock:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = rt
	move.l	24+8(sp),d0		; d0 = can_block
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#954,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewArrayBufferCopy(JSContext *ctx, const uint8_t *buf, size_t len) -> JSValue
; LVO -960: QJS_NewArrayBufferCopy(result,ctx,buf,len)(a0/a1/a2/d0)
; Stack: [ret:4] [ctx:4] [buf:4] [len:4]
; ===================================================================
	xdef	_JS_NewArrayBufferCopy
_JS_NewArrayBufferCopy:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	move.l	24+8+8(sp),a2		; a2 = buf
	move.l	24+8+12(sp),d0		; d0 = len
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#960,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetArrayBuffer(JSContext *ctx, size_t *psize, JSValueConst obj) -> uint8_t *
; LVO -966: QJS_GetArrayBuffer(ctx,psize,obj_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [psize:4] [obj:8]
; ===================================================================
	xdef	_JS_GetArrayBuffer
_JS_GetArrayBuffer:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = psize
	lea	24+12(sp),a2		; a2 = &obj
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#966,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsArrayBuffer(JSValueConst val) -> int
; LVO -972: QJS_IsArrayBuffer(val_ptr)(a0)
; Stack: [ret:4] [val:8]
; ===================================================================
	xdef	_JS_IsArrayBuffer
_JS_IsArrayBuffer:
	movem.l	d2/a2-a6,-(sp)
	lea	24+4(sp),a0		; a0 = &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#972,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_DetachArrayBuffer(JSContext *ctx, JSValueConst obj)
; LVO -978: QJS_DetachArrayBuffer(ctx,obj_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [obj:8]
; ===================================================================
	xdef	_JS_DetachArrayBuffer
_JS_DetachArrayBuffer:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &obj
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#978,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetUint8Array(JSContext *ctx, size_t *psize, JSValueConst obj) -> uint8_t *
; LVO -984: QJS_GetUint8Array(ctx,psize,obj_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [psize:4] [obj:8]
; ===================================================================
	xdef	_JS_GetUint8Array
_JS_GetUint8Array:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	move.l	24+8(sp),a1		; a1 = psize
	lea	24+12(sp),a2		; a2 = &obj
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#984,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewUint8ArrayCopy(JSContext *ctx, const uint8_t *buf, size_t len) -> JSValue
; LVO -990: QJS_NewUint8ArrayCopy(result,ctx,buf,len)(a0/a1/a2/d0)
; Stack: [ret:4] [ctx:4] [buf:4] [len:4]
; ===================================================================
	xdef	_JS_NewUint8ArrayCopy
_JS_NewUint8ArrayCopy:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	move.l	24+8+8(sp),a2		; a2 = buf
	move.l	24+8+12(sp),d0		; d0 = len
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#990,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsDate(JSValueConst val) -> int
; LVO -996: QJS_IsDate(val_ptr)(a0)
; Stack: [ret:4] [val:8]
; ===================================================================
	xdef	_JS_IsDate
_JS_IsDate:
	movem.l	d2/a2-a6,-(sp)
	lea	24+4(sp),a0		; a0 = &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#996,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsRegExp(JSValueConst val) -> int
; LVO -1002: QJS_IsRegExp(val_ptr)(a0)
; Stack: [ret:4] [val:8]
; ===================================================================
	xdef	_JS_IsRegExp
_JS_IsRegExp:
	movem.l	d2/a2-a6,-(sp)
	lea	24+4(sp),a0		; a0 = &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1002,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsMap(JSValueConst val) -> int
; LVO -1008: QJS_IsMap(val_ptr)(a0)
; Stack: [ret:4] [val:8]
; ===================================================================
	xdef	_JS_IsMap
_JS_IsMap:
	movem.l	d2/a2-a6,-(sp)
	lea	24+4(sp),a0		; a0 = &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1008,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsSet(JSValueConst val) -> int
; LVO -1014: QJS_IsSet(val_ptr)(a0)
; Stack: [ret:4] [val:8]
; ===================================================================
	xdef	_JS_IsSet
_JS_IsSet:
	movem.l	d2/a2-a6,-(sp)
	lea	24+4(sp),a0		; a0 = &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1014,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewSymbol(JSContext *ctx, const char *description, int is_global) -> JSValue
; LVO -1020: QJS_NewSymbol(result,ctx,description,is_global)(a0/a1/a2/d0)
; Stack: [ret:4] [ctx:4] [description:4] [is_global:4]
; ===================================================================
	xdef	_JS_NewSymbol
_JS_NewSymbol:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	move.l	24+8+8(sp),a2		; a2 = description
	move.l	24+8+12(sp),d0		; d0 = is_global
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1020,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewDate(JSContext *ctx, double epoch_ms) -> JSValue
; LVO -1026: QJS_NewDate(result,ctx,epoch_ms_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [epoch_ms:8]
; NOTE: epoch_ms is double (8 bytes), passed by pointer to library
; ===================================================================
	xdef	_JS_NewDate
_JS_NewDate:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	lea	24+8+8(sp),a2		; a2 = &epoch_ms (on caller's stack)
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1026,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetIsHTMLDDA(JSContext *ctx, JSValueConst obj)
; LVO -1032: QJS_SetIsHTMLDDA(ctx,obj_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [obj:8]
; ===================================================================
	xdef	_JS_SetIsHTMLDDA
_JS_SetIsHTMLDDA:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &obj
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1032,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetConstructorBit(JSContext *ctx, JSValueConst func, int val)
; LVO -1038: QJS_SetConstructorBit(ctx,func_ptr,val)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [func:8] [val:4]
; ===================================================================
	xdef	_JS_SetConstructorBit
_JS_SetConstructorBit:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; a0 = ctx
	lea	24+8(sp),a1		; a1 = &func
	move.l	24+16(sp),d0		; d0 = val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1038,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_LoadModule(JSContext *ctx, const char *basename, const char *filename) -> JSValue
; LVO -1044: QJS_LoadModule(result,ctx,basename,filename)(a0/a1/a2/a3)
; Stack: [ret:4] [ctx:4] [basename:4] [filename:4]
; ===================================================================
	xdef	_JS_LoadModule
_JS_LoadModule:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; a1 = ctx
	move.l	24+8+8(sp),a2		; a2 = basename
	move.l	24+8+12(sp),a3		; a3 = filename
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1044,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts
