; bridge_asm_batch1.s — Assembly trampolines for QuickJS library bridge
; Functions 1-85 (QJS_NewRuntime through QJS_Strdup)
; LVO -30 through -546
;
; Generated trampolines for VBCC callers -> quickjs.library
; Each reads C params from stack, maps to Amiga register convention,
; and calls the library via LVO offset.

	section	code
	xref	_QJSBase

; ===================================================================
; JS_NewRuntime() -> JSRuntime*
; LVO -30: QJS_NewRuntime()()
; Stack: [ret:4]
; Returns: pointer in d0
; ===================================================================
	xdef	_JS_NewRuntime
_JS_NewRuntime:
	movem.l	d2/a2-a6,-(sp)		; save 6 regs = 24 bytes
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#30,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_FreeRuntime(JSRuntime *rt) -> void
; LVO -36: QJS_FreeRuntime(rt)(a0)
; Stack: [ret:4] [rt:4]
; ===================================================================
	xdef	_JS_FreeRuntime
_JS_FreeRuntime:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#36,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewContext(JSRuntime *rt) -> JSContext*
; LVO -42: QJS_NewContext(rt)(a0)
; Stack: [ret:4] [rt:4]
; ===================================================================
	xdef	_JS_NewContext
_JS_NewContext:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#42,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewContextRaw(JSRuntime *rt) -> JSContext*
; LVO -48: QJS_NewContextRaw(rt)(a0)
; Stack: [ret:4] [rt:4]
; ===================================================================
	xdef	_JS_NewContextRaw
_JS_NewContextRaw:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#48,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_FreeContext(JSContext *ctx) -> void
; LVO -54: QJS_FreeContext(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_FreeContext
_JS_FreeContext:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#54,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetVersion() -> const char*
; LVO -60: QJS_GetVersion()()
; Stack: [ret:4]
; ===================================================================
	xdef	_JS_GetVersion
_JS_GetVersion:
	movem.l	d2/a2-a6,-(sp)
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#60,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetMemoryLimit(JSRuntime *rt, size_t limit) -> void
; LVO -66: QJS_SetMemoryLimit(rt,limit)(a0/d0)
; Stack: [ret:4] [rt:4] [limit:4]
; ===================================================================
	xdef	_JS_SetMemoryLimit
_JS_SetMemoryLimit:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	24+8(sp),d0		; limit
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#66,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetMaxStackSize(JSRuntime *rt, size_t stack_size) -> void
; LVO -72: QJS_SetMaxStackSize(rt,stack_size)(a0/d0)
; Stack: [ret:4] [rt:4] [stack_size:4]
; ===================================================================
	xdef	_JS_SetMaxStackSize
_JS_SetMaxStackSize:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	24+8(sp),d0		; stack_size
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#72,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_RunGC(JSRuntime *rt) -> void
; LVO -78: QJS_RunGC(rt)(a0)
; Stack: [ret:4] [rt:4]
; ===================================================================
	xdef	_JS_RunGC
_JS_RunGC:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#78,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicBaseObjects(JSContext *ctx) -> void
; LVO -84: QJS_AddBaseObjects(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicBaseObjects
_JS_AddIntrinsicBaseObjects:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#84,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicEval(JSContext *ctx) -> void
; LVO -90: QJS_AddEval(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicEval
_JS_AddIntrinsicEval:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#90,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicDate(JSContext *ctx) -> void
; LVO -96: QJS_AddDate(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicDate
_JS_AddIntrinsicDate:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#96,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicRegExp(JSContext *ctx) -> void
; LVO -102: QJS_AddRegExp(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicRegExp
_JS_AddIntrinsicRegExp:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#102,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicJSON(JSContext *ctx) -> void
; LVO -108: QJS_AddJSON(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicJSON
_JS_AddIntrinsicJSON:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#108,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicProxy(JSContext *ctx) -> void
; LVO -114: QJS_AddProxy(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicProxy
_JS_AddIntrinsicProxy:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#114,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicMapSet(JSContext *ctx) -> void
; LVO -120: QJS_AddMapSet(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicMapSet
_JS_AddIntrinsicMapSet:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#120,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicTypedArrays(JSContext *ctx) -> void
; LVO -126: QJS_AddTypedArrays(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicTypedArrays
_JS_AddIntrinsicTypedArrays:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#126,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicPromise(JSContext *ctx) -> void
; LVO -132: QJS_AddPromise(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicPromise
_JS_AddIntrinsicPromise:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#132,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicWeakRef(JSContext *ctx) -> void
; LVO -138: QJS_AddWeakRef(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicWeakRef
_JS_AddIntrinsicWeakRef:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#138,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicDOMException(JSContext *ctx) -> void
; LVO -144: QJS_AddDOMException(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicDOMException
_JS_AddIntrinsicDOMException:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#144,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicPerformance(JSContext *ctx) -> void
; LVO -150: QJS_AddPerformance(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicPerformance
_JS_AddIntrinsicPerformance:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#150,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; QJS_EvalSimple — SKIPPED (library-only, not in quickjs.h)
; LVO -156
; ===================================================================

; ===================================================================
; JS_Eval — SKIPPED (already in bridge_asm.s)
; LVO -162
; ===================================================================

; ===================================================================
; JS_SetRuntimeInfo(JSRuntime *rt, const char *info) -> void
; LVO -168: QJS_SetRuntimeInfo(rt,info)(a0/a1)
; Stack: [ret:4] [rt:4] [info:4]
; ===================================================================
	xdef	_JS_SetRuntimeInfo
_JS_SetRuntimeInfo:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	24+8(sp),a1		; info
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#168,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetRuntimeOpaque(JSRuntime *rt) -> void*
; LVO -174: QJS_GetRuntimeOpaque(rt)(a0)
; Stack: [ret:4] [rt:4]
; ===================================================================
	xdef	_JS_GetRuntimeOpaque
_JS_GetRuntimeOpaque:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#174,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetRuntimeOpaque(JSRuntime *rt, void *opaque) -> void
; LVO -180: QJS_SetRuntimeOpaque(rt,opaque)(a0/a1)
; Stack: [ret:4] [rt:4] [opaque:4]
; ===================================================================
	xdef	_JS_SetRuntimeOpaque
_JS_SetRuntimeOpaque:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	24+8(sp),a1		; opaque
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#180,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_UpdateStackTop(JSRuntime *rt) -> void
; LVO -186: QJS_UpdateStackTop(rt)(a0)
; Stack: [ret:4] [rt:4]
; ===================================================================
	xdef	_JS_UpdateStackTop
_JS_UpdateStackTop:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#186,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetDumpFlags(JSRuntime *rt, uint64_t *flags_ptr) -> void
; LVO -192: QJS_SetDumpFlags(rt,flags_ptr)(a0/a1)
; Stack: [ret:4] [rt:4] [flags_ptr:4]
; ===================================================================
	xdef	_JS_SetDumpFlags
_JS_SetDumpFlags:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	24+8(sp),a1		; flags_ptr
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#192,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetDumpFlags(JSRuntime *rt, uint64_t *result_ptr) -> void
; LVO -198: QJS_GetDumpFlags(rt,result_ptr)(a0/a1)
; Stack: [ret:4] [rt:4] [result_ptr:4]
; ===================================================================
	xdef	_JS_GetDumpFlags
_JS_GetDumpFlags:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	24+8(sp),a1		; result_ptr
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#198,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetGCThreshold(JSRuntime *rt) -> size_t
; LVO -204: QJS_GetGCThreshold(rt)(a0)
; Stack: [ret:4] [rt:4]
; ===================================================================
	xdef	_JS_GetGCThreshold
_JS_GetGCThreshold:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#204,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetGCThreshold(JSRuntime *rt, size_t threshold) -> void
; LVO -210: QJS_SetGCThreshold(rt,threshold)(a0/d0)
; Stack: [ret:4] [rt:4] [threshold:4]
; ===================================================================
	xdef	_JS_SetGCThreshold
_JS_SetGCThreshold:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	24+8(sp),d0		; threshold
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#210,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsLiveObject(JSRuntime *rt, JSValue obj) -> int
; LVO -216: QJS_IsLiveObject(rt,obj_ptr)(a0/a1)
; Stack: [ret:4] [rt:4] [obj:8]
; ===================================================================
	xdef	_JS_IsLiveObject
_JS_IsLiveObject:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	lea	24+8(sp),a1		; &obj (JSValue on stack)
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#216,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_DupContext(JSContext *ctx) -> JSContext*
; LVO -222: QJS_DupContext(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_DupContext
_JS_DupContext:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#222,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetContextOpaque(JSContext *ctx) -> void*
; LVO -228: QJS_GetContextOpaque(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_GetContextOpaque
_JS_GetContextOpaque:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#228,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetContextOpaque(JSContext *ctx, void *opaque) -> void
; LVO -234: QJS_SetContextOpaque(ctx,opaque)(a0/a1)
; Stack: [ret:4] [ctx:4] [opaque:4]
; ===================================================================
	xdef	_JS_SetContextOpaque
_JS_SetContextOpaque:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),a1		; opaque
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#234,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetRuntime(JSContext *ctx) -> JSRuntime*
; LVO -240: QJS_GetRuntime(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_GetRuntime
_JS_GetRuntime:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#240,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_SetClassProto(JSContext *ctx, JSClassID class_id, JSValue obj) -> void
; LVO -246: QJS_SetClassProto(ctx,class_id,obj_ptr)(a0/d0/a2)
; Stack: [ret:4] [ctx:4] [class_id:4] [obj:8]
; ===================================================================
	xdef	_JS_SetClassProto
_JS_SetClassProto:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),d0		; class_id
	lea	24+12(sp),a2		; &obj (JSValue on stack)
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#246,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetClassProto(JSContext *ctx, JSClassID class_id) -> JSValue
; LVO -252: QJS_GetClassProto(result,ctx,class_id)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [class_id:4]
; ===================================================================
	xdef	_JS_GetClassProto
_JS_GetClassProto:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	move.l	24+8+8(sp),d0		; class_id
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#252,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetFunctionProto(JSContext *ctx) -> JSValue
; LVO -258: QJS_GetFunctionProto(result,ctx)(a0/a1)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_GetFunctionProto
_JS_GetFunctionProto:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#258,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicBigInt(JSContext *ctx) -> void
; LVO -264: QJS_AddBigInt(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicBigInt
_JS_AddIntrinsicBigInt:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#264,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddIntrinsicRegExpCompiler(JSContext *ctx) -> void
; LVO -270: QJS_AddRegExpCompiler(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_AddIntrinsicRegExpCompiler
_JS_AddIntrinsicRegExpCompiler:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#270,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsEqual(JSContext *ctx, JSValue op1, JSValue op2) -> int
; LVO -276: QJS_IsEqual(ctx,op1_ptr,op2_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [op1:8] [op2:8]
; ===================================================================
	xdef	_JS_IsEqual
_JS_IsEqual:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	lea	24+8(sp),a1		; &op1
	lea	24+16(sp),a2		; &op2
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#276,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsStrictEqual(JSContext *ctx, JSValue op1, JSValue op2) -> int
; LVO -282: QJS_IsStrictEqual(ctx,op1_ptr,op2_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [op1:8] [op2:8]
; ===================================================================
	xdef	_JS_IsStrictEqual
_JS_IsStrictEqual:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	lea	24+8(sp),a1		; &op1
	lea	24+16(sp),a2		; &op2
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#282,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsSameValue(JSContext *ctx, JSValue op1, JSValue op2) -> int
; LVO -288: QJS_IsSameValue(ctx,op1_ptr,op2_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [op1:8] [op2:8]
; ===================================================================
	xdef	_JS_IsSameValue
_JS_IsSameValue:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	lea	24+8(sp),a1		; &op1
	lea	24+16(sp),a2		; &op2
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#288,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsSameValueZero(JSContext *ctx, JSValue op1, JSValue op2) -> int
; LVO -294: QJS_IsSameValueZero(ctx,op1_ptr,op2_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [op1:8] [op2:8]
; ===================================================================
	xdef	_JS_IsSameValueZero
_JS_IsSameValueZero:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	lea	24+8(sp),a1		; &op1
	lea	24+16(sp),a2		; &op2
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#294,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ComputeMemoryUsage(JSRuntime *rt, JSMemoryUsage *s) -> void
; LVO -300: QJS_ComputeMemoryUsage(rt,s)(a0/a1)
; Stack: [ret:4] [rt:4] [s:4]
; ===================================================================
	xdef	_JS_ComputeMemoryUsage
_JS_ComputeMemoryUsage:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	24+8(sp),a1		; s
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#300,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_AddRuntimeFinalizer(JSRuntime *rt, JSRuntimeFinalizer *finalizer, void *arg) -> void
; LVO -306: QJS_AddRuntimeFinalizer(rt,finalizer,arg)(a0/a1/a2)
; Stack: [ret:4] [rt:4] [finalizer:4] [arg:4]
; ===================================================================
	xdef	_JS_AddRuntimeFinalizer
_JS_AddRuntimeFinalizer:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	move.l	24+8(sp),a1		; finalizer
	move.l	24+12(sp),a2		; arg
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#306,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_FreeValue — SKIPPED (already in bridge_asm.s)
; LVO -312
; ===================================================================

; ===================================================================
; JS_FreeValueRT(JSRuntime *rt, JSValue val) -> void
; LVO -318: QJS_FreeValueRT(rt,val_ptr)(a0/a1)
; Stack: [ret:4] [rt:4] [val:8]
; ===================================================================
	xdef	_JS_FreeValueRT
_JS_FreeValueRT:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; rt
	lea	24+8(sp),a1		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#318,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_DupValue(JSContext *ctx, JSValue val) -> JSValue
; LVO -324: QJS_DupValue(result,ctx,val_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [val:8]
; ===================================================================
	xdef	_JS_DupValue
_JS_DupValue:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	lea	24+8+8(sp),a2		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#324,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_DupValueRT(JSRuntime *rt, JSValue val) -> JSValue
; LVO -330: QJS_DupValueRT(result,rt,val_ptr)(a0/a1/a2)
; Stack: [ret:4] [rt:4] [val:8]
; ===================================================================
	xdef	_JS_DupValueRT
_JS_DupValueRT:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; rt
	lea	24+8+8(sp),a2		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#330,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewNumber(JSContext *ctx, double d) -> JSValue
; LVO -336: QJS_NewNumber(result,ctx,d_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [d:8]
; ===================================================================
	xdef	_JS_NewNumber
_JS_NewNumber:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	lea	24+8+8(sp),a2		; &d (double on stack)
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#336,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewBigInt64(JSContext *ctx, int64_t v) -> JSValue
; LVO -342: QJS_NewBigInt64(result,ctx,v_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [v:8]
; ===================================================================
	xdef	_JS_NewBigInt64
_JS_NewBigInt64:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	lea	24+8+8(sp),a2		; &v
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#342,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewBigUint64(JSContext *ctx, uint64_t v) -> JSValue
; LVO -348: QJS_NewBigUint64(result,ctx,v_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [v:8]
; ===================================================================
	xdef	_JS_NewBigUint64
_JS_NewBigUint64:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	lea	24+8+8(sp),a2		; &v
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#348,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewStringLen — SKIPPED (already in bridge_asm.s)
; LVO -354
; ===================================================================

; ===================================================================
; JS_NewAtomString(JSContext *ctx, const char *str) -> JSValue
; LVO -360: QJS_NewAtomString(result,ctx,str)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [str:4]
; ===================================================================
	xdef	_JS_NewAtomString
_JS_NewAtomString:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	move.l	24+8+8(sp),a2		; str
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#360,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ToString(JSContext *ctx, JSValue val) -> JSValue
; LVO -366: QJS_ToString(result,ctx,val_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [val:8]
; ===================================================================
	xdef	_JS_ToString
_JS_ToString:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	lea	24+8+8(sp),a2		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#366,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ToPropertyKey(JSContext *ctx, JSValue val) -> JSValue
; LVO -372: QJS_ToPropertyKey(result,ctx,val_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [val:8]
; ===================================================================
	xdef	_JS_ToPropertyKey
_JS_ToPropertyKey:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	lea	24+8+8(sp),a2		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#372,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ToCStringLen2(JSContext *ctx, size_t *plen, JSValue val, int cesu8) -> const char*
; LVO -378: QJS_ToCStringLen2(ctx,plen,val_ptr,cesu8)(a0/a2/a1/d0)
; Stack: [ret:4] [ctx:4] [plen:4] [val:8] [cesu8:4]
; ===================================================================
	xdef	_JS_ToCStringLen2
_JS_ToCStringLen2:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),a2		; plen
	lea	24+12(sp),a1		; &val (JSValue on stack)
	move.l	24+20(sp),d0		; cesu8
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#378,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_FreeCString(JSContext *ctx, const char *ptr) -> void
; LVO -384: QJS_FreeCString(ctx,ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [ptr:4]
; ===================================================================
	xdef	_JS_FreeCString
_JS_FreeCString:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),a1		; ptr
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#384,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ToBool(JSContext *ctx, JSValue val) -> int
; LVO -390: QJS_ToBool(ctx,val_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [val:8]
; ===================================================================
	xdef	_JS_ToBool
_JS_ToBool:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	lea	24+8(sp),a1		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#390,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ToInt32(JSContext *ctx, int32_t *pres, JSValue val) -> int
; LVO -396: QJS_ToInt32(ctx,pres,val_ptr)(a0/a2/a1)
; Stack: [ret:4] [ctx:4] [pres:4] [val:8]
; ===================================================================
	xdef	_JS_ToInt32
_JS_ToInt32:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),a2		; pres
	lea	24+12(sp),a1		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#396,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ToInt64(JSContext *ctx, int64_t *pres, JSValue val) -> int
; LVO -402: QJS_ToInt64(ctx,pres,val_ptr)(a0/a2/a1)
; Stack: [ret:4] [ctx:4] [pres:4] [val:8]
; ===================================================================
	xdef	_JS_ToInt64
_JS_ToInt64:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),a2		; pres
	lea	24+12(sp),a1		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#402,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ToFloat64(JSContext *ctx, double *pres, JSValue val) -> int
; LVO -408: QJS_ToFloat64(ctx,pres,val_ptr)(a0/a2/a1)
; Stack: [ret:4] [ctx:4] [pres:4] [val:8]
; ===================================================================
	xdef	_JS_ToFloat64
_JS_ToFloat64:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),a2		; pres
	lea	24+12(sp),a1		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#408,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ToNumber(JSContext *ctx, JSValue val) -> JSValue
; LVO -414: QJS_ToNumber(result,ctx,val_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [val:8]
; ===================================================================
	xdef	_JS_ToNumber
_JS_ToNumber:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	lea	24+8+8(sp),a2		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#414,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewObject — SKIPPED (already in bridge_asm.s)
; LVO -420
; ===================================================================

; ===================================================================
; JS_NewObjectClass(JSContext *ctx, int class_id) -> JSValue
; LVO -426: QJS_NewObjectClass(result,ctx,class_id)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [class_id:4]
; ===================================================================
	xdef	_JS_NewObjectClass
_JS_NewObjectClass:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	move.l	24+8+8(sp),d0		; class_id
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#426,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewObjectProto(JSContext *ctx, JSValue proto) -> JSValue
; LVO -432: QJS_NewObjectProto(result,ctx,proto_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [proto:8]
; ===================================================================
	xdef	_JS_NewObjectProto
_JS_NewObjectProto:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	lea	24+8+8(sp),a2		; &proto
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#432,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewArray — SKIPPED (already in bridge_asm.s)
; LVO -438
; ===================================================================

; ===================================================================
; JS_IsArray(JSValue val) -> int
; LVO -444: QJS_IsArray(val_ptr)(a0)
; Stack: [ret:4] [val:8]
; ===================================================================
	xdef	_JS_IsArray
_JS_IsArray:
	movem.l	d2/a2-a6,-(sp)
	lea	24+4(sp),a0		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#444,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsFunction(JSContext *ctx, JSValue val) -> int
; LVO -450: QJS_IsFunction(ctx,val_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [val:8]
; ===================================================================
	xdef	_JS_IsFunction
_JS_IsFunction:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	lea	24+8(sp),a1		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#450,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsConstructor(JSContext *ctx, JSValue val) -> int
; LVO -456: QJS_IsConstructor(ctx,val_ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [val:8]
; ===================================================================
	xdef	_JS_IsConstructor
_JS_IsConstructor:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	lea	24+8(sp),a1		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#456,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetGlobalObject — SKIPPED (already in bridge_asm.s)
; LVO -462
; ===================================================================

; ===================================================================
; JS_ToObject(JSContext *ctx, JSValue val) -> JSValue
; LVO -468: QJS_ToObject(result,ctx,val_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [val:8]
; ===================================================================
	xdef	_JS_ToObject
_JS_ToObject:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	lea	24+8+8(sp),a2		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#468,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_Throw(JSContext *ctx, JSValue obj) -> JSValue
; LVO -474: QJS_Throw(result,ctx,obj_ptr)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [obj:8]
; ===================================================================
	xdef	_JS_Throw
_JS_Throw:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	lea	24+8+8(sp),a2		; &obj
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#474,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_GetException(JSContext *ctx) -> JSValue
; LVO -480: QJS_GetException(result,ctx)(a0/a1)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_GetException
_JS_GetException:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#480,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_HasException(JSContext *ctx) -> int
; LVO -486: QJS_HasException(ctx)(a0)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_HasException
_JS_HasException:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#486,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_IsError(JSValue val) -> int
; LVO -492: QJS_IsError(val_ptr)(a0)
; Stack: [ret:4] [val:8]
; ===================================================================
	xdef	_JS_IsError
_JS_IsError:
	movem.l	d2/a2-a6,-(sp)
	lea	24+4(sp),a0		; &val
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#492,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_NewError(JSContext *ctx) -> JSValue
; LVO -498: QJS_NewError(result,ctx)(a0/a1)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_NewError
_JS_NewError:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#498,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_ThrowOutOfMemory(JSContext *ctx) -> JSValue
; LVO -504: QJS_ThrowOutOfMemory(result,ctx)(a0/a1)
; Stack: [ret:4] [ctx:4]
; ===================================================================
	xdef	_JS_ThrowOutOfMemory
_JS_ThrowOutOfMemory:
	movem.l	d2/a2-a6,-(sp)
	subq.l	#8,sp
	move.l	sp,a0			; a0 = &result
	move.l	24+8+4(sp),a1		; ctx
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#504,a5
	jsr	(a5)
	move.l	(sp)+,d0
	move.l	(sp)+,d1
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; JS_DetectModule(const char *input, size_t input_len) -> int
; LVO -510: QJS_DetectModule(input,input_len)(a0/d0)
; Stack: [ret:4] [input:4] [input_len:4]
; ===================================================================
	xdef	_JS_DetectModule
_JS_DetectModule:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; input
	move.l	24+8(sp),d0		; input_len
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#510,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; js_malloc(JSContext *ctx, size_t size) -> void*
; LVO -516: QJS_Malloc(ctx,size)(a0/d0)
; Stack: [ret:4] [ctx:4] [size:4]
; ===================================================================
	xdef	_js_malloc
_js_malloc:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),d0		; size
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#516,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; js_free(JSContext *ctx, void *ptr) -> void
; LVO -522: QJS_Free(ctx,ptr)(a0/a1)
; Stack: [ret:4] [ctx:4] [ptr:4]
; ===================================================================
	xdef	_js_free
_js_free:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),a1		; ptr
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#522,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; js_realloc(JSContext *ctx, void *ptr, size_t size) -> void*
; LVO -528: QJS_Realloc(ctx,ptr,size)(a0/a1/d0)
; Stack: [ret:4] [ctx:4] [ptr:4] [size:4]
; ===================================================================
	xdef	_js_realloc
_js_realloc:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),a1		; ptr
	move.l	24+12(sp),d0		; size
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#528,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; js_calloc(JSContext *ctx, size_t count, size_t size) -> void*
; LVO -534: QJS_Calloc(ctx,count,size)(a0/d0/d1)
; Stack: [ret:4] [ctx:4] [count:4] [size:4]
; ===================================================================
	xdef	_js_calloc
_js_calloc:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),d0		; count
	move.l	24+12(sp),d1		; size
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#534,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; js_mallocz(JSContext *ctx, size_t size) -> void*
; LVO -540: QJS_Mallocz(ctx,size)(a0/d0)
; Stack: [ret:4] [ctx:4] [size:4]
; ===================================================================
	xdef	_js_mallocz
_js_mallocz:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),d0		; size
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#540,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; js_strdup(JSContext *ctx, const char *str) -> char*
; LVO -546: QJS_Strdup(ctx,str)(a0/a1)
; Stack: [ret:4] [ctx:4] [str:4]
; ===================================================================
	xdef	_js_strdup
_js_strdup:
	movem.l	d2/a2-a6,-(sp)
	move.l	24+4(sp),a0		; ctx
	move.l	24+8(sp),a1		; str
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#546,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts
