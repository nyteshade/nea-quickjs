; qjsfuncs_asm_all.s — Assembly wrappers for ALL library functions that
; handle JSValue parameters (read *val_ptr or write *result).
;
; These replace C wrappers in qjsfuncs.c where VBCC's __reg("a6")
; annotation corrupts the frame pointer, causing any pointer dereference
; (especially 8-byte JSValue read/write) to use wrong addresses.
;
; Pattern for JSValue-RETURNING functions (have *result):
;   Save a0 (result ptr) in a4, call internal, store d0/d1 through a4.
;
; Pattern for functions that READ JSValue* params:
;   Read 8-byte JSValue via register-indirect BEFORE any push.
;
; CRITICAL: All JSValue reads from pointers happen BEFORE stack pushes,
; using callee-saved d4-d7 registers to hold the values.

	section	code

; ===================================================================
; External references — internal JS_* functions called by wrappers
; ===================================================================

	xref	_JS_Eval
	xref	_JS_FreeValue
	xref	_JS_FreeValueRT
	xref	_JS_DupValue
	xref	_JS_DupValueRT
	xref	_JS_IsLiveObject
	xref	_JS_SetClassProto
	xref	_JS_GetClassProto
	xref	_JS_GetFunctionProto
	xref	_JS_IsEqual
	xref	_JS_IsStrictEqual
	xref	_JS_IsSameValue
	xref	_JS_IsSameValueZero
	xref	_JS_NewNumber
	xref	_JS_NewBigInt64
	xref	_JS_NewBigUint64
	xref	_JS_NewStringLen
	xref	_JS_NewAtomString
	xref	_JS_ToString
	xref	_JS_ToPropertyKey
	xref	_JS_ToCStringLen2
	xref	_JS_ToBool
	xref	_JS_ToInt32
	xref	_JS_ToInt64
	xref	_JS_ToFloat64
	xref	_JS_ToNumber
	xref	_JS_NewObject
	xref	_JS_NewObjectClass
	xref	_JS_NewObjectProto
	xref	_JS_NewArray
	xref	_JS_IsArray
	xref	_JS_IsFunction
	xref	_JS_IsConstructor
	xref	_JS_GetGlobalObject
	xref	_JS_ToObject
	xref	_JS_Throw
	xref	_JS_GetException
	xref	_JS_IsError
	xref	_JS_NewError
	xref	_JS_ThrowOutOfMemory
	xref	_JS_GetProperty
	xref	_JS_GetPropertyUint32
	xref	_JS_GetPropertyStr
	xref	_JS_GetPropertyInt64
	xref	_JS_SetProperty
	xref	_JS_SetPropertyUint32
	xref	_JS_SetPropertyStr
	xref	_JS_HasProperty
	xref	_JS_DeleteProperty
	xref	_JS_SetPrototype
	xref	_JS_GetPrototype
	xref	_JS_GetLength
	xref	_JS_SetLength
	xref	_JS_IsExtensible
	xref	_JS_PreventExtensions
	xref	_JS_SealObject
	xref	_JS_FreezeObject
	xref	_JS_DefinePropertyValue
	xref	_JS_DefinePropertyValueUint32
	xref	_JS_DefinePropertyValueStr
	xref	_JS_SetOpaque
	xref	_JS_GetOpaque
	xref	_JS_GetOpaque2
	xref	_JS_GetOwnPropertyNames
	xref	_JS_IsInstanceOf
	xref	_JS_AtomToValue
	xref	_JS_AtomToString
	xref	_JS_ValueToAtom
	xref	_JS_EvalFunction
	xref	_JS_Call
	xref	_JS_Invoke
	xref	_JS_CallConstructor
	xref	_JS_ParseJSON
	xref	_JS_JSONStringify
	xref	_JS_WriteObject
	xref	_JS_ReadObject
	xref	_JS_GetClassID
	xref	_JS_GetImportMeta
	xref	_JS_GetModuleNamespace
	xref	_JS_SetModuleExport
	xref	_JS_ResolveModule
	xref	_JS_NewCFunction2
	xref	_JS_SetConstructor
	xref	_JS_SetPropertyFunctionList
	xref	_JS_NewPromiseCapability
	xref	_JS_PromiseState
	xref	_JS_PromiseResult
	xref	_JS_IsPromise
	xref	_JS_NewArrayBufferCopy
	xref	_JS_GetArrayBuffer
	xref	_JS_IsArrayBuffer
	xref	_JS_DetachArrayBuffer
	xref	_JS_GetUint8Array
	xref	_JS_NewUint8ArrayCopy
	xref	_JS_IsDate
	xref	_JS_IsRegExp
	xref	_JS_IsMap
	xref	_JS_IsSet
	xref	_JS_NewSymbol
	xref	_JS_SetIsHTMLDDA
	xref	_JS_SetConstructorBit
	xref	_JS_LoadModule
	xref	_JS_SetDumpFlags
	xref	_JS_GetDumpFlags

; ===================================================================
; Public symbols
; ===================================================================

	xdef	_QJS_Eval
	xdef	_QJS_FreeValue
	xdef	_QJS_FreeValueRT
	xdef	_QJS_DupValue
	xdef	_QJS_DupValueRT
	xdef	_QJS_IsLiveObject
	xdef	_QJS_SetClassProto
	xdef	_QJS_GetClassProto
	xdef	_QJS_GetFunctionProto
	xdef	_QJS_IsEqual
	xdef	_QJS_IsStrictEqual
	xdef	_QJS_IsSameValue
	xdef	_QJS_IsSameValueZero
	xdef	_QJS_NewNumber
	xdef	_QJS_NewBigInt64
	xdef	_QJS_NewBigUint64
	xdef	_QJS_NewStringLen
	xdef	_QJS_NewAtomString
	xdef	_QJS_ToString
	xdef	_QJS_ToPropertyKey
	xdef	_QJS_ToCStringLen2
	xdef	_QJS_ToBool
	xdef	_QJS_ToInt32
	xdef	_QJS_ToInt64
	xdef	_QJS_ToFloat64
	xdef	_QJS_ToNumber
	xdef	_QJS_NewObject
	xdef	_QJS_NewObjectClass
	xdef	_QJS_NewObjectProto
	xdef	_QJS_NewArray
	xdef	_QJS_IsArray
	xdef	_QJS_IsFunction
	xdef	_QJS_IsConstructor
	xdef	_QJS_GetGlobalObject
	xdef	_QJS_ToObject
	xdef	_QJS_Throw
	xdef	_QJS_GetException
	xdef	_QJS_IsError
	xdef	_QJS_NewError
	xdef	_QJS_ThrowOutOfMemory
	xdef	_QJS_GetProperty
	xdef	_QJS_GetPropertyUint32
	xdef	_QJS_GetPropertyStr
	xdef	_QJS_GetPropertyInt64
	xdef	_QJS_SetProperty
	xdef	_QJS_SetPropertyUint32
	xdef	_QJS_SetPropertyStr
	xdef	_QJS_HasProperty
	xdef	_QJS_DeleteProperty
	xdef	_QJS_SetPrototype
	xdef	_QJS_GetPrototype
	xdef	_QJS_GetLength
	xdef	_QJS_SetLength
	xdef	_QJS_IsExtensible
	xdef	_QJS_PreventExtensions
	xdef	_QJS_SealObject
	xdef	_QJS_FreezeObject
	xdef	_QJS_DefinePropertyValue
	xdef	_QJS_DefinePropertyValueUint32
	xdef	_QJS_DefinePropertyValueStr
	xdef	_QJS_SetOpaque
	xdef	_QJS_GetOpaque
	xdef	_QJS_GetOpaque2
	xdef	_QJS_GetOwnPropertyNames
	xdef	_QJS_IsInstanceOf
	xdef	_QJS_AtomToValue
	xdef	_QJS_AtomToString
	xdef	_QJS_ValueToAtom
	xdef	_QJS_EvalFunction
	xdef	_QJS_Call
	xdef	_QJS_Invoke
	xdef	_QJS_CallConstructor
	xdef	_QJS_ParseJSON
	xdef	_QJS_JSONStringify
	xdef	_QJS_WriteObject
	xdef	_QJS_ReadObject
	xdef	_QJS_GetClassID
	xdef	_QJS_GetImportMeta
	xdef	_QJS_GetModuleNamespace
	xdef	_QJS_SetModuleExport
	xdef	_QJS_ResolveModule
	xdef	_QJS_NewCFunction2
	xdef	_QJS_SetConstructor
	xdef	_QJS_SetPropertyFunctionList
	xdef	_QJS_NewPromiseCapability
	xdef	_QJS_PromiseState
	xdef	_QJS_PromiseResult
	xdef	_QJS_IsPromise
	xdef	_QJS_NewArrayBufferCopy
	xdef	_QJS_GetArrayBuffer
	xdef	_QJS_IsArrayBuffer
	xdef	_QJS_DetachArrayBuffer
	xdef	_QJS_GetUint8Array
	xdef	_QJS_NewUint8ArrayCopy
	xdef	_QJS_IsDate
	xdef	_QJS_IsRegExp
	xdef	_QJS_IsMap
	xdef	_QJS_IsSet
	xdef	_QJS_NewSymbol
	xdef	_QJS_SetIsHTMLDDA
	xdef	_QJS_SetConstructorBit
	xdef	_QJS_LoadModule
	xdef	_QJS_SetDumpFlags
	xdef	_QJS_GetDumpFlags


; ===================================================================
; QJS_Eval
; SFD: (result,ctx,input,input_len,filename,eval_flags)(a0/a1/a2/d0/a3/d1)
; Calls: JSValue JS_Eval(ctx, input, input_len, filename, eval_flags)
; Result: 8 bytes written through *result (a0)
; ===================================================================
_QJS_Eval:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	; Push right-to-left: eval_flags, filename, input_len, input, ctx
	move.l	d1,-(sp)		; eval_flags
	move.l	a3,-(sp)		; filename
	move.l	d0,-(sp)		; input_len
	move.l	a2,-(sp)		; input
	move.l	a1,-(sp)		; ctx
	jsr	_JS_Eval
	lea	20(sp),sp

	move.l	d0,(a4)			; store result high
	move.l	d1,4(a4)		; store result low
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_FreeValue
; SFD: (ctx,val_ptr)(a0/a1)
; Calls: void JS_FreeValue(ctx, val)  — val by value (8 bytes)
; ===================================================================
_QJS_FreeValue:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; val high
	move.l	4(a1),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_FreeValue
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_FreeValueRT
; SFD: (rt,val_ptr)(a0/a1)
; Calls: void JS_FreeValueRT(rt, val)  — val by value (8 bytes)
; ===================================================================
_QJS_FreeValueRT:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; val high
	move.l	4(a1),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a0,-(sp)		; rt
	jsr	_JS_FreeValueRT
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_DupValue
; SFD: (result,ctx,val_ptr)(a0/a1/a2)
; Calls: JSValue JS_DupValue(ctx, val)  — val by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_DupValue:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; val high
	move.l	4(a2),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_DupValue
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_DupValueRT
; SFD: (result,rt,val_ptr)(a0/a1/a2)
; Calls: JSValue JS_DupValueRT(rt, val)  — val by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_DupValueRT:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; val high
	move.l	4(a2),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a1,-(sp)		; rt
	jsr	_JS_DupValueRT
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsLiveObject
; SFD: (rt,obj_ptr)(a0/a1)
; Calls: int JS_IsLiveObject(rt, obj)  — obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsLiveObject:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; rt
	jsr	_JS_IsLiveObject
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetClassProto
; SFD: (ctx,class_id,obj_ptr)(a0/d0/a2)
; Calls: void JS_SetClassProto(ctx, class_id, obj)  — obj by value (8 bytes)
; ===================================================================
_QJS_SetClassProto:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a2),d4			; obj high
	move.l	4(a2),d5		; obj low

	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	d0,-(sp)		; class_id
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetClassProto
	lea	16(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetClassProto
; SFD: (result,ctx,class_id)(a0/a1/d0)
; Calls: JSValue JS_GetClassProto(ctx, class_id)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_GetClassProto:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	d0,-(sp)		; class_id
	move.l	a1,-(sp)		; ctx
	jsr	_JS_GetClassProto
	lea	8(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetFunctionProto
; SFD: (result,ctx)(a0/a1)
; Calls: JSValue JS_GetFunctionProto(ctx)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_GetFunctionProto:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	a1,-(sp)		; ctx
	jsr	_JS_GetFunctionProto
	lea	4(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsEqual
; SFD: (ctx,op1_ptr,op2_ptr)(a0/a1/a2)
; Calls: int JS_IsEqual(ctx, op1, op2)  — both by value (8 bytes each)
; Returns: int in d0
; ===================================================================
_QJS_IsEqual:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; op1 high
	move.l	4(a1),d5		; op1 low
	move.l	(a2),d6			; op2 high
	move.l	4(a2),d7		; op2 low

	move.l	d7,-(sp)		; op2 low
	move.l	d6,-(sp)		; op2 high
	move.l	d5,-(sp)		; op1 low
	move.l	d4,-(sp)		; op1 high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_IsEqual
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsStrictEqual
; SFD: (ctx,op1_ptr,op2_ptr)(a0/a1/a2)
; Calls: int JS_IsStrictEqual(ctx, op1, op2)
; ===================================================================
_QJS_IsStrictEqual:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; op1 high
	move.l	4(a1),d5		; op1 low
	move.l	(a2),d6			; op2 high
	move.l	4(a2),d7		; op2 low

	move.l	d7,-(sp)		; op2 low
	move.l	d6,-(sp)		; op2 high
	move.l	d5,-(sp)		; op1 low
	move.l	d4,-(sp)		; op1 high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_IsStrictEqual
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsSameValue
; SFD: (ctx,op1_ptr,op2_ptr)(a0/a1/a2)
; Calls: int JS_IsSameValue(ctx, op1, op2)
; ===================================================================
_QJS_IsSameValue:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; op1 high
	move.l	4(a1),d5		; op1 low
	move.l	(a2),d6			; op2 high
	move.l	4(a2),d7		; op2 low

	move.l	d7,-(sp)		; op2 low
	move.l	d6,-(sp)		; op2 high
	move.l	d5,-(sp)		; op1 low
	move.l	d4,-(sp)		; op1 high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_IsSameValue
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsSameValueZero
; SFD: (ctx,op1_ptr,op2_ptr)(a0/a1/a2)
; Calls: int JS_IsSameValueZero(ctx, op1, op2)
; ===================================================================
_QJS_IsSameValueZero:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; op1 high
	move.l	4(a1),d5		; op1 low
	move.l	(a2),d6			; op2 high
	move.l	4(a2),d7		; op2 low

	move.l	d7,-(sp)		; op2 low
	move.l	d6,-(sp)		; op2 high
	move.l	d5,-(sp)		; op1 low
	move.l	d4,-(sp)		; op1 high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_IsSameValueZero
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewNumber
; SFD: (result,ctx,d_ptr)(a0/a1/a2)
; a2 = double* (8 bytes)
; Calls: JSValue JS_NewNumber(ctx, d)  — d is double (8 bytes on stack)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_NewNumber:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; double high
	move.l	4(a2),d5		; double low

	move.l	d5,-(sp)		; double low
	move.l	d4,-(sp)		; double high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewNumber
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewBigInt64
; SFD: (result,ctx,v_ptr)(a0/a1/a2)
; a2 = long long* (8 bytes)
; Calls: JSValue JS_NewBigInt64(ctx, v)  — v is int64 (8 bytes on stack)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_NewBigInt64:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; int64 high
	move.l	4(a2),d5		; int64 low

	move.l	d5,-(sp)		; int64 low
	move.l	d4,-(sp)		; int64 high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewBigInt64
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewBigUint64
; SFD: (result,ctx,v_ptr)(a0/a1/a2)
; a2 = unsigned long long* (8 bytes)
; Calls: JSValue JS_NewBigUint64(ctx, v)  — v is uint64 (8 bytes on stack)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_NewBigUint64:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; uint64 high
	move.l	4(a2),d5		; uint64 low

	move.l	d5,-(sp)		; uint64 low
	move.l	d4,-(sp)		; uint64 high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewBigUint64
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewStringLen
; SFD: (result,ctx,str,len)(a0/a1/a2/d0)
; Calls: JSValue JS_NewStringLen(ctx, str, len)
; Result: 8 bytes written through *result
; No JSValue* read, but has *result write
; ===================================================================
_QJS_NewStringLen:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	d0,-(sp)		; len
	move.l	a2,-(sp)		; str
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewStringLen
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewAtomString
; SFD: (result,ctx,str)(a0/a1/a2)
; Calls: JSValue JS_NewAtomString(ctx, str)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_NewAtomString:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	a2,-(sp)		; str
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewAtomString
	lea	8(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ToString
; SFD: (result,ctx,val_ptr)(a0/a1/a2)
; Calls: JSValue JS_ToString(ctx, val)  — val by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_ToString:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; val high
	move.l	4(a2),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_ToString
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ToPropertyKey
; SFD: (result,ctx,val_ptr)(a0/a1/a2)
; Calls: JSValue JS_ToPropertyKey(ctx, val)  — val by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_ToPropertyKey:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; val high
	move.l	4(a2),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_ToPropertyKey
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ToCStringLen2
; SFD: (ctx,plen,val_ptr,cesu8)(a0/a2/a1/d0)
; NOTE: SFD has swapped a1/a2! a1=val_ptr, a2=plen
; Calls: const char *JS_ToCStringLen2(ctx, plen, val, cesu8)
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
; QJS_ToBool
; SFD: (ctx,val_ptr)(a0/a1)
; Calls: int JS_ToBool(ctx, val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_ToBool:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; val high
	move.l	4(a1),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_ToBool
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ToInt32
; SFD: (ctx,pres,val_ptr)(a0/a2/a1)
; NOTE: SFD has swapped a1/a2! a1=val_ptr, a2=pres
; Calls: int JS_ToInt32(ctx, pres, val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_ToInt32:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; val high from *a1
	move.l	4(a1),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a2,-(sp)		; pres
	move.l	a0,-(sp)		; ctx
	jsr	_JS_ToInt32
	lea	16(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ToInt64
; SFD: (ctx,pres,val_ptr)(a0/a2/a1)
; NOTE: SFD has swapped a1/a2! a1=val_ptr, a2=pres
; Calls: int JS_ToInt64(ctx, pres, val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_ToInt64:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; val high from *a1
	move.l	4(a1),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a2,-(sp)		; pres
	move.l	a0,-(sp)		; ctx
	jsr	_JS_ToInt64
	lea	16(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ToFloat64
; SFD: (ctx,pres,val_ptr)(a0/a2/a1)
; NOTE: SFD has swapped a1/a2! a1=val_ptr, a2=pres
; Calls: int JS_ToFloat64(ctx, pres, val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_ToFloat64:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; val high from *a1
	move.l	4(a1),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a2,-(sp)		; pres
	move.l	a0,-(sp)		; ctx
	jsr	_JS_ToFloat64
	lea	16(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ToNumber
; SFD: (result,ctx,val_ptr)(a0/a1/a2)
; Calls: JSValue JS_ToNumber(ctx, val)  — val by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_ToNumber:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; val high
	move.l	4(a2),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_ToNumber
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewObject
; SFD: (result,ctx)(a0/a1)
; Calls: JSValue JS_NewObject(ctx)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_NewObject:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewObject
	lea	4(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewObjectClass
; SFD: (result,ctx,class_id)(a0/a1/d0)
; Calls: JSValue JS_NewObjectClass(ctx, class_id)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_NewObjectClass:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	d0,-(sp)		; class_id
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewObjectClass
	lea	8(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewObjectProto
; SFD: (result,ctx,proto_ptr)(a0/a1/a2)
; Calls: JSValue JS_NewObjectProto(ctx, proto)  — proto by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_NewObjectProto:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; proto high
	move.l	4(a2),d5		; proto low

	move.l	d5,-(sp)		; proto low
	move.l	d4,-(sp)		; proto high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewObjectProto
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewArray
; SFD: (result,ctx)(a0/a1)
; Calls: JSValue JS_NewArray(ctx)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_NewArray:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewArray
	lea	4(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsArray
; SFD: (val_ptr)(a0)
; Calls: int JS_IsArray(val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsArray:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a0),d4			; val high
	move.l	4(a0),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	jsr	_JS_IsArray
	lea	8(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsFunction
; SFD: (ctx,val_ptr)(a0/a1)
; Calls: int JS_IsFunction(ctx, val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsFunction:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; val high
	move.l	4(a1),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_IsFunction
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsConstructor
; SFD: (ctx,val_ptr)(a0/a1)
; Calls: int JS_IsConstructor(ctx, val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsConstructor:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; val high
	move.l	4(a1),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_IsConstructor
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetGlobalObject
; SFD: (result,ctx)(a0/a1)
; Calls: JSValue JS_GetGlobalObject(ctx)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_GetGlobalObject:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	a1,-(sp)		; ctx
	jsr	_JS_GetGlobalObject
	lea	4(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ToObject
; SFD: (result,ctx,val_ptr)(a0/a1/a2)
; Calls: JSValue JS_ToObject(ctx, val)  — val by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_ToObject:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; val high
	move.l	4(a2),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_ToObject
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_Throw
; SFD: (result,ctx,obj_ptr)(a0/a1/a2)
; Calls: JSValue JS_Throw(ctx, obj)  — obj by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_Throw:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; obj high
	move.l	4(a2),d5		; obj low

	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_Throw
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetException
; SFD: (result,ctx)(a0/a1)
; Calls: JSValue JS_GetException(ctx)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_GetException:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	a1,-(sp)		; ctx
	jsr	_JS_GetException
	lea	4(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsError
; SFD: (val_ptr)(a0)
; Calls: int JS_IsError(val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsError:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a0),d4			; val high
	move.l	4(a0),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	jsr	_JS_IsError
	lea	8(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewError
; SFD: (result,ctx)(a0/a1)
; Calls: JSValue JS_NewError(ctx)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_NewError:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewError
	lea	4(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ThrowOutOfMemory
; SFD: (result,ctx)(a0/a1)
; Calls: JSValue JS_ThrowOutOfMemory(ctx)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_ThrowOutOfMemory:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	a1,-(sp)		; ctx
	jsr	_JS_ThrowOutOfMemory
	lea	4(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetProperty
; SFD: (result,ctx,this_ptr,prop)(a0/a1/a2/d0)
; Calls: JSValue JS_GetProperty(ctx, this_obj, prop)
;   this_obj by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_GetProperty:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; this high
	move.l	4(a2),d5		; this low

	move.l	d0,-(sp)		; prop
	move.l	d5,-(sp)		; this low
	move.l	d4,-(sp)		; this high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_GetProperty
	lea	16(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetPropertyUint32
; SFD: (result,ctx,this_ptr,idx)(a0/a1/a2/d0)
; Calls: JSValue JS_GetPropertyUint32(ctx, this_obj, idx)
;   this_obj by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_GetPropertyUint32:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; this high
	move.l	4(a2),d5		; this low

	move.l	d0,-(sp)		; idx
	move.l	d5,-(sp)		; this low
	move.l	d4,-(sp)		; this high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_GetPropertyUint32
	lea	16(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetPropertyStr
; SFD: (result,ctx,this_ptr,prop_str)(a0/a1/a2/a3)
; Calls: JSValue JS_GetPropertyStr(ctx, this_obj, prop)
;   this_obj by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_GetPropertyStr:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; this high
	move.l	4(a2),d5		; this low

	move.l	a3,-(sp)		; prop_str
	move.l	d5,-(sp)		; this low
	move.l	d4,-(sp)		; this high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_GetPropertyStr
	lea	16(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetPropertyInt64
; SFD: (result,ctx,this_ptr,idx)(a0/a1/a2/d0)
; Calls: JSValue JS_GetPropertyInt64(ctx, this_obj, idx)
;   this_obj by value (8 bytes), idx is int64 (but SFD passes as LONG)
;   C wrapper sign-extends to long long
; Result: 8 bytes written through *result
; ===================================================================
_QJS_GetPropertyInt64:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; this high
	move.l	4(a2),d5		; this low

	; Sign-extend d0 (LONG) to 64-bit for long long idx
	move.l	d0,d6			; low word of int64
	move.l	d0,d7
	asr.l	#8,d7
	asr.l	#8,d7
	asr.l	#8,d7
	asr.l	#7,d7			; d7 = sign extension (0 or -1)
	move.l	d6,-(sp)		; idx low
	move.l	d7,-(sp)		; idx high (sign extended)
	move.l	d5,-(sp)		; this low
	move.l	d4,-(sp)		; this high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_GetPropertyInt64
	lea	20(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetProperty
; SFD: (ctx,this_ptr,prop,val_ptr)(a0/a1/d0/a2)
; Calls: int JS_SetProperty(ctx, this_obj, prop, val)
;   this_obj by value (8 bytes), val by value (8 bytes, consumed)
; Returns: int in d0
; ===================================================================
_QJS_SetProperty:
	movem.l	d2-d7/a2-a6,-(sp)
	; Read JSValues BEFORE any push
	move.l	(a1),d4			; this high
	move.l	4(a1),d5		; this low
	move.l	(a2),d6			; val high
	move.l	4(a2),d7		; val low

	; Push right-to-left: val, prop, this_obj, ctx
	move.l	d7,-(sp)		; val low
	move.l	d6,-(sp)		; val high
	move.l	d0,-(sp)		; prop
	move.l	d5,-(sp)		; this low
	move.l	d4,-(sp)		; this high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetProperty
	lea	24(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetPropertyUint32
; SFD: (ctx,this_ptr,idx,val_ptr)(a0/a1/d0/a2)
; Calls: int JS_SetPropertyUint32(ctx, this_obj, idx, val)
;   this_obj by value (8 bytes), val by value (8 bytes, consumed)
; Returns: int in d0
; ===================================================================
_QJS_SetPropertyUint32:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; this high
	move.l	4(a1),d5		; this low
	move.l	(a2),d6			; val high
	move.l	4(a2),d7		; val low

	move.l	d7,-(sp)		; val low
	move.l	d6,-(sp)		; val high
	move.l	d0,-(sp)		; idx
	move.l	d5,-(sp)		; this low
	move.l	d4,-(sp)		; this high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetPropertyUint32
	lea	24(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetPropertyStr
; SFD: (ctx,this_ptr,prop_str,val_ptr)(a0/a1/a2/a3)
; Calls: int JS_SetPropertyStr(ctx, this_obj, prop, val)
;   this_obj by value (8 bytes), val by value (8 bytes, consumed)
; Returns: int in d0
; ===================================================================
_QJS_SetPropertyStr:
	movem.l	d2-d7/a2-a6,-(sp)
	; Read JSValues BEFORE any push
	move.l	(a1),d4			; this high
	move.l	4(a1),d5		; this low
	move.l	(a3),d6			; val high
	move.l	4(a3),d7		; val low

	; Push right-to-left: val, prop_str, this_obj, ctx
	move.l	d7,-(sp)		; val low
	move.l	d6,-(sp)		; val high
	move.l	a2,-(sp)		; prop_str
	move.l	d5,-(sp)		; this low
	move.l	d4,-(sp)		; this high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetPropertyStr
	lea	24(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_HasProperty
; SFD: (ctx,this_ptr,prop)(a0/a1/d0)
; Calls: int JS_HasProperty(ctx, this_obj, prop)
;   this_obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_HasProperty:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; this high
	move.l	4(a1),d5		; this low

	move.l	d0,-(sp)		; prop
	move.l	d5,-(sp)		; this low
	move.l	d4,-(sp)		; this high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_HasProperty
	lea	16(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_DeleteProperty
; SFD: (ctx,obj_ptr,prop,flags)(a0/a1/d0/d1)
; Calls: int JS_DeleteProperty(ctx, obj, prop, flags)
;   obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_DeleteProperty:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	d1,-(sp)		; flags
	move.l	d0,-(sp)		; prop
	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_DeleteProperty
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetPrototype
; SFD: (ctx,obj_ptr,proto_ptr)(a0/a1/a2)
; Calls: int JS_SetPrototype(ctx, obj, proto_val)
;   obj by value (8 bytes), proto by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_SetPrototype:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low
	move.l	(a2),d6			; proto high
	move.l	4(a2),d7		; proto low

	move.l	d7,-(sp)		; proto low
	move.l	d6,-(sp)		; proto high
	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetPrototype
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetPrototype
; SFD: (result,ctx,val_ptr)(a0/a1/a2)
; Calls: JSValue JS_GetPrototype(ctx, val)  — val by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_GetPrototype:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; val high
	move.l	4(a2),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_GetPrototype
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetLength
; SFD: (ctx,obj_ptr,pres)(a0/a1/a2)
; Calls: int JS_GetLength(ctx, obj, pres)
;   obj by value (8 bytes), pres is long long*
; Returns: int in d0
; ===================================================================
_QJS_GetLength:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	a2,-(sp)		; pres
	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_GetLength
	lea	16(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetLength
; SFD: (ctx,obj_ptr,len)(a0/a1/d0)
; Calls: int JS_SetLength(ctx, obj, len)
;   obj by value (8 bytes), len sign-extended to long long
; Returns: int in d0
; ===================================================================
_QJS_SetLength:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	; Sign-extend d0 (LONG) to long long
	move.l	d0,d6			; len low
	move.l	d0,d7
	asr.l	#8,d7
	asr.l	#8,d7
	asr.l	#8,d7
	asr.l	#7,d7			; d7 = sign extension
	move.l	d6,-(sp)		; len low
	move.l	d7,-(sp)		; len high
	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetLength
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsExtensible
; SFD: (ctx,obj_ptr)(a0/a1)
; Calls: int JS_IsExtensible(ctx, obj)  — obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsExtensible:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_IsExtensible
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_PreventExtensions
; SFD: (ctx,obj_ptr)(a0/a1)
; Calls: int JS_PreventExtensions(ctx, obj)  — obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_PreventExtensions:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_PreventExtensions
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SealObject
; SFD: (ctx,obj_ptr)(a0/a1)
; Calls: int JS_SealObject(ctx, obj)  — obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_SealObject:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SealObject
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_FreezeObject
; SFD: (ctx,obj_ptr)(a0/a1)
; Calls: int JS_FreezeObject(ctx, obj)  — obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_FreezeObject:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_FreezeObject
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_DefinePropertyValue
; SFD: (ctx,this_ptr,prop,val_ptr,flags)(a0/a1/d0/a2/d1)
; Calls: int JS_DefinePropertyValue(ctx, this_obj, prop, val, flags)
;   this_obj by value (8 bytes), val by value (8 bytes, consumed)
; Returns: int in d0
; ===================================================================
_QJS_DefinePropertyValue:
	movem.l	d2-d7/a2-a6,-(sp)
	; Read JSValues BEFORE push
	move.l	(a1),d4			; this high
	move.l	4(a1),d5		; this low
	move.l	(a2),d6			; val high
	move.l	4(a2),d7		; val low

	; Push right-to-left: flags, val, prop, this_obj, ctx
	move.l	d1,-(sp)		; flags
	move.l	d7,-(sp)		; val low
	move.l	d6,-(sp)		; val high
	move.l	d0,-(sp)		; prop
	move.l	d5,-(sp)		; this low
	move.l	d4,-(sp)		; this high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_DefinePropertyValue
	lea	28(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_DefinePropertyValueUint32
; SFD: (ctx,this_ptr,idx,val_ptr,flags)(a0/a1/d0/a2/d1)
; Calls: int JS_DefinePropertyValueUint32(ctx, this_obj, idx, val, flags)
;   this_obj by value (8 bytes), val by value (8 bytes, consumed)
; Returns: int in d0
; ===================================================================
_QJS_DefinePropertyValueUint32:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; this high
	move.l	4(a1),d5		; this low
	move.l	(a2),d6			; val high
	move.l	4(a2),d7		; val low

	move.l	d1,-(sp)		; flags
	move.l	d7,-(sp)		; val low
	move.l	d6,-(sp)		; val high
	move.l	d0,-(sp)		; idx
	move.l	d5,-(sp)		; this low
	move.l	d4,-(sp)		; this high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_DefinePropertyValueUint32
	lea	28(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_DefinePropertyValueStr
; SFD: (ctx,this_ptr,val_ptr,prop_str,flags)(a0/a1/a2/a3/d0)
; Calls: int JS_DefinePropertyValueStr(ctx, this_obj, prop, val, flags)
;   this_obj by value (8 bytes), val by value (8 bytes, consumed)
; Returns: int in d0
; ===================================================================
_QJS_DefinePropertyValueStr:
	movem.l	d2-d7/a2-a6,-(sp)
	; Read JSValues BEFORE push
	move.l	(a1),d4			; this high
	move.l	4(a1),d5		; this low
	move.l	(a2),d6			; val high
	move.l	4(a2),d7		; val low

	; Push right-to-left: flags, val, prop_str, this_obj, ctx
	move.l	d0,-(sp)		; flags
	move.l	d7,-(sp)		; val low
	move.l	d6,-(sp)		; val high
	move.l	a3,-(sp)		; prop_str
	move.l	d5,-(sp)		; this low
	move.l	d4,-(sp)		; this high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_DefinePropertyValueStr
	lea	28(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetOpaque
; SFD: (obj_ptr,opaque)(a1/a0)  — NOTE: swapped! a1=obj_ptr, a0=opaque
; Calls: int JS_SetOpaque(obj, opaque)  — obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_SetOpaque:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	a0,-(sp)		; opaque
	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	jsr	_JS_SetOpaque
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetOpaque
; SFD: (obj_ptr,class_id)(a0/d0)
; Calls: void *JS_GetOpaque(obj, class_id)  — obj by value (8 bytes)
; Returns: pointer in d0
; ===================================================================
_QJS_GetOpaque:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a0),d4			; obj high
	move.l	4(a0),d5		; obj low

	move.l	d0,-(sp)		; class_id
	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	jsr	_JS_GetOpaque
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetOpaque2
; SFD: (ctx,obj_ptr,class_id)(a0/a1/d0)
; Calls: void *JS_GetOpaque2(ctx, obj, class_id)  — obj by value (8 bytes)
; Returns: pointer in d0
; ===================================================================
_QJS_GetOpaque2:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	d0,-(sp)		; class_id
	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_GetOpaque2
	lea	16(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetOwnPropertyNames
; SFD: (ctx,ptab,plen,obj_ptr,flags)(a0/a1/a2/a3/d0)
; Calls: int JS_GetOwnPropertyNames(ctx, ptab, plen, obj, flags)
;   obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_GetOwnPropertyNames:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a3),d4			; obj high
	move.l	4(a3),d5		; obj low

	move.l	d0,-(sp)		; flags
	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a2,-(sp)		; plen
	move.l	a1,-(sp)		; ptab
	move.l	a0,-(sp)		; ctx
	jsr	_JS_GetOwnPropertyNames
	lea	24(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsInstanceOf
; SFD: (ctx,val_ptr,obj_ptr)(a0/a1/a2)
; Calls: int JS_IsInstanceOf(ctx, val, obj)
;   val by value (8 bytes), obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsInstanceOf:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; val high
	move.l	4(a1),d5		; val low
	move.l	(a2),d6			; obj high
	move.l	4(a2),d7		; obj low

	move.l	d7,-(sp)		; obj low
	move.l	d6,-(sp)		; obj high
	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_IsInstanceOf
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_AtomToValue
; SFD: (result,ctx,atom)(a0/a1/d0)
; Calls: JSValue JS_AtomToValue(ctx, atom)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_AtomToValue:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	d0,-(sp)		; atom
	move.l	a1,-(sp)		; ctx
	jsr	_JS_AtomToValue
	lea	8(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_AtomToString
; SFD: (result,ctx,atom)(a0/a1/d0)
; Calls: JSValue JS_AtomToString(ctx, atom)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_AtomToString:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	d0,-(sp)		; atom
	move.l	a1,-(sp)		; ctx
	jsr	_JS_AtomToString
	lea	8(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ValueToAtom
; SFD: (ctx,val_ptr)(a0/a1)
; Calls: JSAtom JS_ValueToAtom(ctx, val)  — val by value (8 bytes)
; Returns: ULONG in d0
; ===================================================================
_QJS_ValueToAtom:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; val high
	move.l	4(a1),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_ValueToAtom
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_EvalFunction
; SFD: (result,ctx,fun_ptr)(a0/a1/a2)
; Calls: JSValue JS_EvalFunction(ctx, fun_obj)  — fun by value (8 bytes, consumed)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_EvalFunction:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; fun high
	move.l	4(a2),d5		; fun low

	move.l	d5,-(sp)		; fun low
	move.l	d4,-(sp)		; fun high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_EvalFunction
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_Call
; SFD: (result,ctx,func_ptr,this_ptr,argc,argv_addr)(a0/a1/a2/a3/d0/d1)
; Calls: JSValue JS_Call(ctx, func_obj, this_obj, argc, argv)
;   func by value (8 bytes), this by value (8 bytes)
;   argv_addr is a ULONG cast of JSValue* pointer
; Result: 8 bytes written through *result
; ===================================================================
_QJS_Call:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	; Read JSValues BEFORE push
	move.l	(a2),d4			; func high
	move.l	4(a2),d5		; func low
	move.l	(a3),d6			; this high
	move.l	4(a3),d7		; this low

	; Push right-to-left: argv, argc, this_obj, func_obj, ctx
	move.l	d1,-(sp)		; argv_addr (pointer)
	move.l	d0,-(sp)		; argc
	move.l	d7,-(sp)		; this low
	move.l	d6,-(sp)		; this high
	move.l	d5,-(sp)		; func low
	move.l	d4,-(sp)		; func high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_Call
	lea	28(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_Invoke
; SFD: (result,ctx,this_ptr,argv,atom,argc)(a0/a1/a2/a3/d0/d1)
; Calls: JSValue JS_Invoke(ctx, this_val, atom, argc, argv)
;   this by value (8 bytes), argv is JSValue* pointer (passed through)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_Invoke:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; this high
	move.l	4(a2),d5		; this low

	; Push right-to-left: argv, argc, atom, this_val, ctx
	move.l	a3,-(sp)		; argv (pointer, not dereferenced)
	move.l	d1,-(sp)		; argc
	move.l	d0,-(sp)		; atom
	move.l	d5,-(sp)		; this low
	move.l	d4,-(sp)		; this high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_Invoke
	lea	24(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_CallConstructor
; SFD: (result,ctx,func_ptr,argv,argc)(a0/a1/a2/a3/d0)
; Calls: JSValue JS_CallConstructor(ctx, func_obj, argc, argv)
;   func by value (8 bytes), argv is JSValue* pointer (passed through)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_CallConstructor:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; func high
	move.l	4(a2),d5		; func low

	; Push right-to-left: argv, argc, func_obj, ctx
	move.l	a3,-(sp)		; argv (pointer)
	move.l	d0,-(sp)		; argc
	move.l	d5,-(sp)		; func low
	move.l	d4,-(sp)		; func high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_CallConstructor
	lea	20(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ParseJSON
; SFD: (result,ctx,buf,filename,buf_len)(a0/a1/a2/a3/d0)
; Calls: JSValue JS_ParseJSON(ctx, buf, buf_len, filename)
; Result: 8 bytes written through *result
; No JSValue* read, but has *result write
; ===================================================================
_QJS_ParseJSON:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	; Push right-to-left: filename, buf_len, buf, ctx
	move.l	a3,-(sp)		; filename
	move.l	d0,-(sp)		; buf_len
	move.l	a2,-(sp)		; buf
	move.l	a1,-(sp)		; ctx
	jsr	_JS_ParseJSON
	lea	16(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_JSONStringify
; SFD: (result,ctx,obj_ptr)(a0/a1/a2)
; Calls: JSValue JS_JSONStringify(ctx, obj, replacer, space0)
;   obj by value (8 bytes), replacer=undefined, space0=undefined
;   undefined = { .u.int32=0, .tag=3 } = high=3, low=0
; Result: 8 bytes written through *result
; ===================================================================
_QJS_JSONStringify:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; obj high
	move.l	4(a2),d5		; obj low

	; Push right-to-left: space0(undef), replacer(undef), obj, ctx
	; undefined JSValue: tag=3 (high), int32=0 (low)
	clr.l	-(sp)			; space0 low (0)
	move.l	#3,-(sp)		; space0 high (tag=3=UNDEFINED)
	clr.l	-(sp)			; replacer low (0)
	move.l	#3,-(sp)		; replacer high (tag=3=UNDEFINED)
	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_JSONStringify
	lea	28(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_WriteObject
; SFD: (ctx,psize,obj_ptr,flags)(a0/a1/a2/d0)
; Calls: unsigned char *JS_WriteObject(ctx, &ssize, obj, flags)
;   obj by value (8 bytes)
; Returns: pointer in d0
; NOTE: C wrapper uses local size_t then copies to *psize.
;   In asm we pass psize directly — JS_WriteObject takes size_t*
;   which is ULONG* on 32-bit, matching the caller's ULONG*.
; ===================================================================
_QJS_WriteObject:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a2),d4			; obj high
	move.l	4(a2),d5		; obj low

	move.l	d0,-(sp)		; flags
	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a1,-(sp)		; psize
	move.l	a0,-(sp)		; ctx
	jsr	_JS_WriteObject
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ReadObject
; SFD: (result,ctx,buf,buf_len,flags)(a0/a1/a2/d0/d1)
; Calls: JSValue JS_ReadObject(ctx, buf, buf_len, flags)
; Result: 8 bytes written through *result
; No JSValue* read, but has *result write
; ===================================================================
_QJS_ReadObject:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	d1,-(sp)		; flags
	move.l	d0,-(sp)		; buf_len
	move.l	a2,-(sp)		; buf
	move.l	a1,-(sp)		; ctx
	jsr	_JS_ReadObject
	lea	16(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetClassID
; SFD: (val_ptr)(a0)
; Calls: unsigned long JS_GetClassID(v)  — v by value (8 bytes)
; Returns: ULONG in d0
; ===================================================================
_QJS_GetClassID:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a0),d4			; val high
	move.l	4(a0),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	jsr	_JS_GetClassID
	lea	8(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetImportMeta
; SFD: (result,ctx,m)(a0/a1/a2)
; Calls: JSValue JS_GetImportMeta(ctx, m)
; Result: 8 bytes written through *result
; m is JSModuleDef* (plain pointer, not JSValue*)
; ===================================================================
_QJS_GetImportMeta:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	a2,-(sp)		; m
	move.l	a1,-(sp)		; ctx
	jsr	_JS_GetImportMeta
	lea	8(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetModuleNamespace
; SFD: (result,ctx,m)(a0/a1/a2)
; Calls: JSValue JS_GetModuleNamespace(ctx, m)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_GetModuleNamespace:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	a2,-(sp)		; m
	move.l	a1,-(sp)		; ctx
	jsr	_JS_GetModuleNamespace
	lea	8(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetModuleExport
; SFD: (ctx,m,export_name,val_ptr)(a0/a1/a2/a3)
; Calls: int JS_SetModuleExport(ctx, m, export_name, val)
;   val by value (8 bytes, consumed)
; Returns: int in d0
; ===================================================================
_QJS_SetModuleExport:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a3),d4			; val high
	move.l	4(a3),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	move.l	a2,-(sp)		; export_name
	move.l	a1,-(sp)		; m
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetModuleExport
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_ResolveModule
; SFD: (ctx,obj_ptr)(a0/a1)
; Calls: int JS_ResolveModule(ctx, obj)  — obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_ResolveModule:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_ResolveModule
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewCFunction2
; SFD: (result,ctx,func,name,length,cproto,magic)(a0/a1/a2/a3/d0/d1/d2)
; Calls: JSValue JS_NewCFunction2(ctx, func, name, length, cproto, magic)
; Result: 8 bytes written through *result
; No JSValue* read, but has *result write (and 7 reg params)
; ===================================================================
_QJS_NewCFunction2:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	; Push right-to-left: magic, cproto, length, name, func, ctx
	move.l	d2,-(sp)		; magic
	move.l	d1,-(sp)		; cproto
	move.l	d0,-(sp)		; length
	move.l	a3,-(sp)		; name
	move.l	a2,-(sp)		; func
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewCFunction2
	lea	24(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetConstructor
; SFD: (ctx,func_ptr,proto_ptr)(a0/a1/a2)
; Calls: int JS_SetConstructor(ctx, func_obj, proto)
;   func by value (8 bytes), proto by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_SetConstructor:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; func high
	move.l	4(a1),d5		; func low
	move.l	(a2),d6			; proto high
	move.l	4(a2),d7		; proto low

	move.l	d7,-(sp)		; proto low
	move.l	d6,-(sp)		; proto high
	move.l	d5,-(sp)		; func low
	move.l	d4,-(sp)		; func high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetConstructor
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetPropertyFunctionList
; SFD: (ctx,obj_ptr,tab,len)(a0/a1/a2/d0)
; Calls: int JS_SetPropertyFunctionList(ctx, obj, tab, len)
;   obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_SetPropertyFunctionList:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	d0,-(sp)		; len
	move.l	a2,-(sp)		; tab
	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetPropertyFunctionList
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewPromiseCapability
; SFD: (result,ctx,resolving_funcs)(a0/a1/a2)
; Calls: JSValue JS_NewPromiseCapability(ctx, resolving_funcs)
;   resolving_funcs is JSValue* array (pointer, not dereferenced as value)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_NewPromiseCapability:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	a2,-(sp)		; resolving_funcs (pointer)
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewPromiseCapability
	lea	8(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_PromiseState
; SFD: (ctx,promise_ptr)(a0/a1)
; Calls: int JS_PromiseState(ctx, promise)  — promise by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_PromiseState:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; promise high
	move.l	4(a1),d5		; promise low

	move.l	d5,-(sp)		; promise low
	move.l	d4,-(sp)		; promise high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_PromiseState
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_PromiseResult
; SFD: (result,ctx,promise_ptr)(a0/a1/a2)
; Calls: JSValue JS_PromiseResult(ctx, promise)  — promise by value (8 bytes)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_PromiseResult:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer
	move.l	(a2),d4			; promise high
	move.l	4(a2),d5		; promise low

	move.l	d5,-(sp)		; promise low
	move.l	d4,-(sp)		; promise high
	move.l	a1,-(sp)		; ctx
	jsr	_JS_PromiseResult
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsPromise
; SFD: (val_ptr)(a0)
; Calls: int JS_IsPromise(val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsPromise:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a0),d4			; val high
	move.l	4(a0),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	jsr	_JS_IsPromise
	lea	8(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewArrayBufferCopy
; SFD: (result,ctx,buf,len)(a0/a1/a2/d0)
; Calls: JSValue JS_NewArrayBufferCopy(ctx, buf, len)
; Result: 8 bytes written through *result
; No JSValue* read, but has *result write
; ===================================================================
_QJS_NewArrayBufferCopy:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	d0,-(sp)		; len
	move.l	a2,-(sp)		; buf
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewArrayBufferCopy
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetArrayBuffer
; SFD: (ctx,psize,obj_ptr)(a0/a1/a2)
; Calls: unsigned char *JS_GetArrayBuffer(ctx, psize, obj)
;   obj by value (8 bytes)
; Returns: pointer in d0
; ===================================================================
_QJS_GetArrayBuffer:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a2),d4			; obj high
	move.l	4(a2),d5		; obj low

	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a1,-(sp)		; psize
	move.l	a0,-(sp)		; ctx
	jsr	_JS_GetArrayBuffer
	lea	16(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsArrayBuffer
; SFD: (val_ptr)(a0)
; Calls: int JS_IsArrayBuffer(obj)  — obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsArrayBuffer:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a0),d4			; val high
	move.l	4(a0),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	jsr	_JS_IsArrayBuffer
	lea	8(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_DetachArrayBuffer
; SFD: (ctx,obj_ptr)(a0/a1)
; Calls: void JS_DetachArrayBuffer(ctx, obj)  — obj by value (8 bytes)
; ===================================================================
_QJS_DetachArrayBuffer:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_DetachArrayBuffer
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetUint8Array
; SFD: (ctx,psize,obj_ptr)(a0/a1/a2)
; Calls: unsigned char *JS_GetUint8Array(ctx, psize, obj)
;   obj by value (8 bytes)
; Returns: pointer in d0
; ===================================================================
_QJS_GetUint8Array:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a2),d4			; obj high
	move.l	4(a2),d5		; obj low

	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a1,-(sp)		; psize
	move.l	a0,-(sp)		; ctx
	jsr	_JS_GetUint8Array
	lea	16(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewUint8ArrayCopy
; SFD: (result,ctx,buf,len)(a0/a1/a2/d0)
; Calls: JSValue JS_NewUint8ArrayCopy(ctx, buf, len)
; Result: 8 bytes written through *result
; ===================================================================
_QJS_NewUint8ArrayCopy:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	d0,-(sp)		; len
	move.l	a2,-(sp)		; buf
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewUint8ArrayCopy
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsDate
; SFD: (val_ptr)(a0)
; Calls: int JS_IsDate(val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsDate:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a0),d4			; val high
	move.l	4(a0),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	jsr	_JS_IsDate
	lea	8(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsRegExp
; SFD: (val_ptr)(a0)
; Calls: int JS_IsRegExp(val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsRegExp:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a0),d4			; val high
	move.l	4(a0),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	jsr	_JS_IsRegExp
	lea	8(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsMap
; SFD: (val_ptr)(a0)
; Calls: int JS_IsMap(val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsMap:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a0),d4			; val high
	move.l	4(a0),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	jsr	_JS_IsMap
	lea	8(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_IsSet
; SFD: (val_ptr)(a0)
; Calls: int JS_IsSet(val)  — val by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_IsSet:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a0),d4			; val high
	move.l	4(a0),d5		; val low

	move.l	d5,-(sp)		; val low
	move.l	d4,-(sp)		; val high
	jsr	_JS_IsSet
	lea	8(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_NewSymbol
; SFD: (result,ctx,description,is_global)(a0/a1/a2/d0)
; Calls: JSValue JS_NewSymbol(ctx, description, is_global)
; Result: 8 bytes written through *result
; No JSValue* read, but has *result write
; ===================================================================
_QJS_NewSymbol:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	d0,-(sp)		; is_global
	move.l	a2,-(sp)		; description
	move.l	a1,-(sp)		; ctx
	jsr	_JS_NewSymbol
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetIsHTMLDDA
; SFD: (ctx,obj_ptr)(a0/a1)
; Calls: void JS_SetIsHTMLDDA(ctx, obj)  — obj by value (8 bytes)
; ===================================================================
_QJS_SetIsHTMLDDA:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; obj high
	move.l	4(a1),d5		; obj low

	move.l	d5,-(sp)		; obj low
	move.l	d4,-(sp)		; obj high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetIsHTMLDDA
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetConstructorBit
; SFD: (ctx,func_ptr,val)(a0/a1/d0)
; Calls: int JS_SetConstructorBit(ctx, func_obj, val)
;   func_obj by value (8 bytes)
; Returns: int in d0
; ===================================================================
_QJS_SetConstructorBit:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; func high
	move.l	4(a1),d5		; func low

	move.l	d0,-(sp)		; val (int)
	move.l	d5,-(sp)		; func low
	move.l	d4,-(sp)		; func high
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetConstructorBit
	lea	16(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_LoadModule
; SFD: (result,ctx,basename,filename)(a0/a1/a2/a3)
; Calls: JSValue JS_LoadModule(ctx, basename, filename)
; Result: 8 bytes written through *result
; No JSValue* read, but has *result write
; ===================================================================
_QJS_LoadModule:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,a4			; save result pointer

	move.l	a3,-(sp)		; filename
	move.l	a2,-(sp)		; basename
	move.l	a1,-(sp)		; ctx
	jsr	_JS_LoadModule
	lea	12(sp),sp

	move.l	d0,(a4)
	move.l	d1,4(a4)
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetDumpFlags
; SFD: (rt,flags_ptr)(a0/a1)
; a1 = unsigned long long* (8 bytes to read)
; Calls: void JS_SetDumpFlags(rt, flags)  — flags is uint64 (8 bytes)
; ===================================================================
_QJS_SetDumpFlags:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	(a1),d4			; flags high
	move.l	4(a1),d5		; flags low

	move.l	d5,-(sp)		; flags low
	move.l	d4,-(sp)		; flags high
	move.l	a0,-(sp)		; rt
	jsr	_JS_SetDumpFlags
	lea	12(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_GetDumpFlags
; SFD: (rt,result_ptr)(a0/a1)
; a1 = unsigned long long* (8 bytes to write)
; Calls: unsigned long long JS_GetDumpFlags(rt)
; Returns: uint64 in d0/d1, store through *result_ptr
; ===================================================================
_QJS_GetDumpFlags:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,a4			; save result pointer

	move.l	a0,-(sp)		; rt
	jsr	_JS_GetDumpFlags
	lea	4(sp),sp

	move.l	d0,(a4)			; high word
	move.l	d1,4(a4)		; low word
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; end of qjsfuncs_asm_all.s
