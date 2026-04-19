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
	xref	_QJS_EvalBuf_impl
	xref	_JS_GetLibcOpaque
	xref	_JS_SetLibcOpaque
	xref	_JS_AddModuleExportList
	xref	_JS_SetModuleExportList
; --- Remaining simple forwarders ---
	xref	_JS_FreeRuntime
	xref	_JS_NewContextRaw
	xref	_JS_FreeContext
	xref	_JS_GetVersion
	xref	_JS_SetMemoryLimit
	xref	_JS_SetMaxStackSize
	xref	_JS_RunGC
	xref	_JS_AddIntrinsicBaseObjects
	xref	_JS_AddIntrinsicEval
	xref	_JS_AddIntrinsicDate
	xref	_JS_AddIntrinsicRegExp
	xref	_JS_AddIntrinsicJSON
	xref	_JS_AddIntrinsicProxy
	xref	_JS_AddIntrinsicMapSet
	xref	_JS_AddIntrinsicTypedArrays
	xref	_JS_AddIntrinsicPromise
	xref	_JS_AddIntrinsicWeakRef
	xref	_JS_AddIntrinsicDOMException
	xref	_JS_AddPerformance
	xref	_JS_SetRuntimeInfo
	xref	_JS_GetRuntimeOpaque
	xref	_JS_SetRuntimeOpaque
	xref	_JS_UpdateStackTop
	xref	_JS_GetGCThreshold
	xref	_JS_SetGCThreshold
	xref	_JS_DupContext
	xref	_JS_GetContextOpaque
	xref	_JS_SetContextOpaque
	xref	_JS_GetRuntime
	xref	_JS_AddIntrinsicBigInt
	xref	_JS_AddIntrinsicRegExpCompiler
	xref	_JS_ComputeMemoryUsage
	xref	_JS_AddRuntimeFinalizer
	xref	_JS_FreeCString
	xref	_JS_HasException
	xref	_JS_DetectModule
	xref	_js_malloc
	xref	_js_free
	xref	_js_realloc
	xref	_js_calloc
	xref	_js_mallocz
	xref	_js_strdup
	xref	_JS_FreePropertyEnum
	xref	_JS_NewAtomLen
	xref	_JS_NewAtom
	xref	_JS_NewAtomUInt32
	xref	_JS_DupAtom
	xref	_JS_FreeAtom
	xref	_JS_AtomToCStringLen
	xref	_JS_NewClassID
	xref	_JS_NewClass
	xref	_JS_IsRegisteredClass
	xref	_JS_SetModuleLoaderFunc
	xref	_JS_GetModuleName
	xref	_JS_NewCModule
	xref	_JS_AddModuleExport
	xref	_JS_GetScriptOrModuleName
	xref	_JS_IsJobPending
	xref	_JS_ExecutePendingJob
	xref	_JS_SetInterruptHandler
	xref	_JS_SetHostPromiseRejectionTracker
	xref	_JS_SetCanBlock
; --- Complex function impls ---
	xref	_QJS_NewRuntime_impl
	xref	_QJS_NewContext_impl
	xref	_QJS_EvalSimple_impl
	xref	_QJS_NewDate_impl
; --- quickjs-libc module init functions ---
	xref	_js_init_module_std
	xref	_js_init_module_os
	xref	_js_init_module_bjson
	xref	_js_std_init_handlers
	xref	_js_std_free_handlers
	xref	_js_std_add_helpers
	xref	_js_std_loop
	xref	_js_std_eval_binary
	xref	_js_std_dump_error
	xref	_js_load_file
	xref	_QJS_SetModuleLoader_impl

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
	xdef	_QJS_EvalBuf
	xdef	_QJS_GetLibcOpaque
	xdef	_QJS_SetLibcOpaque
	xdef	_QJS_AddModuleExportList
	xdef	_QJS_SetModuleExportList
; --- Remaining functions ---
	xdef	_QJS_NewRuntime
	xdef	_QJS_FreeRuntime
	xdef	_QJS_NewContext
	xdef	_QJS_NewContextRaw
	xdef	_QJS_FreeContext
	xdef	_QJS_GetVersion
	xdef	_QJS_SetMemoryLimit
	xdef	_QJS_SetMaxStackSize
	xdef	_QJS_RunGC
	xdef	_QJS_AddBaseObjects
	xdef	_QJS_AddEval
	xdef	_QJS_AddDate
	xdef	_QJS_AddRegExp
	xdef	_QJS_AddJSON
	xdef	_QJS_AddProxy
	xdef	_QJS_AddMapSet
	xdef	_QJS_AddTypedArrays
	xdef	_QJS_AddPromise
	xdef	_QJS_AddWeakRef
	xdef	_QJS_AddDOMException
	xdef	_QJS_AddPerformance
	xdef	_QJS_EvalSimple
	xdef	_QJS_SetRuntimeInfo
	xdef	_QJS_GetRuntimeOpaque
	xdef	_QJS_SetRuntimeOpaque
	xdef	_QJS_UpdateStackTop
	xdef	_QJS_GetGCThreshold
	xdef	_QJS_SetGCThreshold
	xdef	_QJS_DupContext
	xdef	_QJS_GetContextOpaque
	xdef	_QJS_SetContextOpaque
	xdef	_QJS_GetRuntime
	xdef	_QJS_AddBigInt
	xdef	_QJS_AddRegExpCompiler
	xdef	_QJS_ComputeMemoryUsage
	xdef	_QJS_AddRuntimeFinalizer
	xdef	_QJS_FreeCString
	xdef	_QJS_HasException
	xdef	_QJS_DetectModule
	xdef	_QJS_Malloc
	xdef	_QJS_Free
	xdef	_QJS_Realloc
	xdef	_QJS_Calloc
	xdef	_QJS_Mallocz
	xdef	_QJS_Strdup
	xdef	_QJS_FreePropertyEnum
	xdef	_QJS_NewAtomLen
	xdef	_QJS_NewAtom
	xdef	_QJS_NewAtomUInt32
	xdef	_QJS_DupAtom
	xdef	_QJS_FreeAtom
	xdef	_QJS_AtomToCStringLen
	xdef	_QJS_NewClassID
	xdef	_QJS_NewClass
	xdef	_QJS_IsRegisteredClass
	xdef	_QJS_SetModuleLoaderFunc
	xdef	_QJS_GetModuleName
	xdef	_QJS_NewCModule
	xdef	_QJS_AddModuleExport
	xdef	_QJS_GetScriptOrModuleName
	xdef	_QJS_IsJobPending
	xdef	_QJS_ExecutePendingJob
	xdef	_QJS_SetInterruptHandler
	xdef	_QJS_SetHostPromiseRejectionTracker
	xdef	_QJS_SetCanBlock
	xdef	_QJS_NewDate
; --- quickjs-libc module init ---
	xdef	_QJS_InitModuleStd
	xdef	_QJS_InitModuleOS
	xdef	_QJS_InitModuleBJSON
	xdef	_QJS_StdInitHandlers
	xdef	_QJS_StdFreeHandlers
	xdef	_QJS_StdAddHelpers
	xdef	_QJS_StdLoop
	xdef	_QJS_StdEvalBinary
	xdef	_QJS_StdDumpError
	xdef	_QJS_LoadFile
	xdef	_QJS_SetModuleLoader
	xdef	_QJS_InstallExtended
	xref	_QJS_InstallExtended_impl
	xdef	_QJS_WorkerSpawn
	xref	_QJS_WorkerSpawn_impl
	xdef	_QJS_WorkerPoll
	xref	_QJS_WorkerPoll_impl
	xdef	_QJS_WorkerJoin
	xref	_QJS_WorkerJoin_impl
	xdef	_QJS_WorkerDestroy
	xref	_QJS_WorkerDestroy_impl
	xdef	_QJS_WorkerGetBase
	xref	_QJS_WorkerGetBase_impl
	xdef	_QJS_GetNetCapabilities
	xref	_QJS_GetNetCapabilities_impl
	xdef	_QJS_InitModuleNet
	xref	_js_init_module_net
	xdef	_QJS_GetMathBase
	xref	_QJS_GetMathBase_impl
	xdef	_QJS_InstallChildProcessGlobal
	xref	_qjs_install_child_process_global
	xdef	_QJS_InstallCryptoGlobal
	xref	_qjs_install_crypto_global
	xdef	_QJS_InstallAmigaFFIGlobal
	xref	_qjs_install_amiga_ffi_global


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

; ===================================================================
; QJS_GetLibcOpaque
; SFD: (rt)(a0)
; Calls: void *JS_GetLibcOpaque(rt)
; Returns: pointer in d0
; ===================================================================
_QJS_GetLibcOpaque:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)		; rt
	jsr	_JS_GetLibcOpaque
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetLibcOpaque
; SFD: (rt,opaque)(a0/a1)
; Calls: void JS_SetLibcOpaque(rt, opaque)
; ===================================================================
_QJS_SetLibcOpaque:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)		; opaque
	move.l	a0,-(sp)		; rt
	jsr	_JS_SetLibcOpaque
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_AddModuleExportList
; SFD: (ctx,m,tab,len)(a0/a1/a2/d0)
; Calls: int JS_AddModuleExportList(ctx, m, tab, len)
; Returns: int in d0
; ===================================================================
_QJS_AddModuleExportList:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)		; len
	move.l	a2,-(sp)		; tab
	move.l	a1,-(sp)		; m
	move.l	a0,-(sp)		; ctx
	jsr	_JS_AddModuleExportList
	lea	16(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_SetModuleExportList
; SFD: (ctx,m,tab,len)(a0/a1/a2/d0)
; Calls: int JS_SetModuleExportList(ctx, m, tab, len)
; Returns: int in d0
; ===================================================================
_QJS_SetModuleExportList:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)		; len
	move.l	a2,-(sp)		; tab
	move.l	a1,-(sp)		; m
	move.l	a0,-(sp)		; ctx
	jsr	_JS_SetModuleExportList
	lea	16(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; REMAINING FUNCTIONS — moved from C to assembly
; ===================================================================

; QJS_NewRuntime — COMPLEX, calls _QJS_NewRuntime_impl(base)
_QJS_NewRuntime:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a6,-(sp)
	jsr	_QJS_NewRuntime_impl
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_FreeRuntime — (rt)(a0)
_QJS_FreeRuntime:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_FreeRuntime
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_NewContext — COMPLEX, calls _QJS_NewContext_impl(rt)
_QJS_NewContext:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_QJS_NewContext_impl
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_NewContextRaw — (rt)(a0)
_QJS_NewContextRaw:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_NewContextRaw
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_FreeContext — (ctx)(a0)
_QJS_FreeContext:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_FreeContext
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_GetVersion — ()()
_QJS_GetVersion:
	movem.l	d2-d7/a2-a6,-(sp)
	jsr	_JS_GetVersion
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_SetMemoryLimit — (rt,limit)(a0/d0)
_QJS_SetMemoryLimit:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_SetMemoryLimit
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_SetMaxStackSize — (rt,stack_size)(a0/d0)
_QJS_SetMaxStackSize:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_SetMaxStackSize
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_RunGC — (rt)(a0)
_QJS_RunGC:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_RunGC
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddBaseObjects — (ctx)(a0)
_QJS_AddBaseObjects:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicBaseObjects
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddEval — (ctx)(a0)
_QJS_AddEval:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicEval
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddDate — (ctx)(a0)
_QJS_AddDate:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicDate
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddRegExp — (ctx)(a0)
_QJS_AddRegExp:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicRegExp
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddJSON — (ctx)(a0)
_QJS_AddJSON:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicJSON
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddProxy — (ctx)(a0)
_QJS_AddProxy:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicProxy
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddMapSet — (ctx)(a0)
_QJS_AddMapSet:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicMapSet
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddTypedArrays — (ctx)(a0)
_QJS_AddTypedArrays:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicTypedArrays
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddPromise — (ctx)(a0)
_QJS_AddPromise:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicPromise
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddWeakRef — (ctx)(a0)
_QJS_AddWeakRef:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicWeakRef
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddDOMException — (ctx)(a0)
_QJS_AddDOMException:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicDOMException
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddPerformance — (ctx)(a0)
_QJS_AddPerformance:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddPerformance
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_EvalSimple — COMPLEX, (ctx,input,input_len)(a0/a1/d0)
_QJS_EvalSimple:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_QJS_EvalSimple_impl
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_SetRuntimeInfo — (rt,info)(a0/a1)
_QJS_SetRuntimeInfo:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_SetRuntimeInfo
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_GetRuntimeOpaque — (rt)(a0)
_QJS_GetRuntimeOpaque:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_GetRuntimeOpaque
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_SetRuntimeOpaque — (rt,opaque)(a0/a1)
_QJS_SetRuntimeOpaque:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_SetRuntimeOpaque
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_UpdateStackTop — (rt)(a0)
_QJS_UpdateStackTop:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_UpdateStackTop
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_GetGCThreshold — (rt)(a0)
_QJS_GetGCThreshold:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_GetGCThreshold
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_SetGCThreshold — (rt,threshold)(a0/d0)
_QJS_SetGCThreshold:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_SetGCThreshold
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_DupContext — (ctx)(a0)
_QJS_DupContext:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_DupContext
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_GetContextOpaque — (ctx)(a0)
_QJS_GetContextOpaque:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_GetContextOpaque
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_SetContextOpaque — (ctx,opaque)(a0/a1)
_QJS_SetContextOpaque:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_SetContextOpaque
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_GetRuntime — (ctx)(a0)
_QJS_GetRuntime:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_GetRuntime
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddBigInt — (ctx)(a0)
_QJS_AddBigInt:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicBigInt
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddRegExpCompiler — (ctx)(a0)
_QJS_AddRegExpCompiler:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddIntrinsicRegExpCompiler
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_ComputeMemoryUsage — (rt,s)(a0/a1)
_QJS_ComputeMemoryUsage:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_ComputeMemoryUsage
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddRuntimeFinalizer — (rt,finalizer,arg)(a0/a1/a2)
_QJS_AddRuntimeFinalizer:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a2,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddRuntimeFinalizer
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_FreeCString — (ctx,ptr)(a0/a1)
_QJS_FreeCString:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_FreeCString
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_HasException — (ctx)(a0)
_QJS_HasException:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_HasException
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_DetectModule — (input,input_len)(a0/d0)
_QJS_DetectModule:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_DetectModule
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_Malloc — (ctx,size)(a0/d0)
_QJS_Malloc:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_js_malloc
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_Free — (ctx,ptr)(a0/a1)
_QJS_Free:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_js_free
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_Realloc — (ctx,ptr,size)(a0/a1/d0)
_QJS_Realloc:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_js_realloc
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_Calloc — (ctx,count,size)(a0/d0/d1)
_QJS_Calloc:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d1,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_js_calloc
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_Mallocz — (ctx,size)(a0/d0)
_QJS_Mallocz:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_js_mallocz
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_Strdup — (ctx,str)(a0/a1)
_QJS_Strdup:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_js_strdup
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_FreePropertyEnum — (ctx,tab,len)(a0/a1/d0)
_QJS_FreePropertyEnum:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_FreePropertyEnum
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_NewAtomLen — (ctx,str,len)(a0/a1/d0)
_QJS_NewAtomLen:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_NewAtomLen
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_NewAtom — (ctx,str)(a0/a1)
_QJS_NewAtom:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_NewAtom
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_NewAtomUInt32 — (ctx,n)(a0/d0)
_QJS_NewAtomUInt32:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_NewAtomUInt32
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_DupAtom — (ctx,v)(a0/d0)
_QJS_DupAtom:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_DupAtom
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_FreeAtom — (ctx,v)(a0/d0)
_QJS_FreeAtom:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_FreeAtom
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AtomToCStringLen — (ctx,plen,atom)(a0/a1/d0)
_QJS_AtomToCStringLen:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AtomToCStringLen
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_NewClassID — (rt,pclass_id)(a0/a1)
_QJS_NewClassID:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_NewClassID
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_NewClass — (rt,class_def,class_id)(a0/a1/d0)
; NOTE: JS_NewClass takes (rt, class_id, class_def) — args reordered
_QJS_NewClass:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)		; class_def (3rd C arg)
	move.l	d0,-(sp)		; class_id (2nd C arg)
	move.l	a0,-(sp)		; rt
	jsr	_JS_NewClass
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_IsRegisteredClass — (rt,class_id)(a0/d0)
_QJS_IsRegisteredClass:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_IsRegisteredClass
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_SetModuleLoaderFunc — (rt,normalize_func,loader_func,opaque)(a0/a1/a2/a3)
_QJS_SetModuleLoaderFunc:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a3,-(sp)
	move.l	a2,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_SetModuleLoaderFunc
	lea	16(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_GetModuleName — (ctx,m)(a0/a1)
_QJS_GetModuleName:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_GetModuleName
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_NewCModule — (ctx,name_str,func)(a0/a1/a2)
_QJS_NewCModule:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a2,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_NewCModule
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_AddModuleExport — (ctx,m,name_str)(a0/a1/a2)
_QJS_AddModuleExport:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a2,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_AddModuleExport
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_GetScriptOrModuleName — (ctx,n_stack_levels)(a0/d0)
_QJS_GetScriptOrModuleName:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_GetScriptOrModuleName
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_IsJobPending — (rt)(a0)
_QJS_IsJobPending:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_IsJobPending
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_ExecutePendingJob — (rt,pctx)(a0/a1)
_QJS_ExecutePendingJob:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_ExecutePendingJob
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_SetInterruptHandler — (rt,cb,opaque)(a0/a1/a2)
_QJS_SetInterruptHandler:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a2,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_SetInterruptHandler
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_SetHostPromiseRejectionTracker — (rt,cb,opaque)(a0/a1/a2)
_QJS_SetHostPromiseRejectionTracker:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a2,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_SetHostPromiseRejectionTracker
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_SetCanBlock — (rt,can_block)(a0/d0)
_QJS_SetCanBlock:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)
	move.l	a0,-(sp)
	jsr	_JS_SetCanBlock
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_NewDate — COMPLEX, (result,ctx,epoch_ms_ptr)(a0/a1/a2)
_QJS_NewDate:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a2,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_QJS_NewDate_impl
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; QJS_EvalBuf
; SFD: (ctx,input,input_len,filename,eval_flags)(a0/a1/d0/a2/d1)
; Calls: long QJS_EvalBuf_impl(ctx, input, input_len, filename, eval_flags)
; Plain C function — no __reg, so JSValue locals work correctly.
; Returns: long in d0
; ===================================================================
_QJS_EvalBuf:
	movem.l	d2-d7/a2-a6,-(sp)

	; Push right-to-left: eval_flags, filename, input_len, input, ctx
	move.l	d1,-(sp)		; eval_flags
	move.l	a2,-(sp)		; filename
	move.l	d0,-(sp)		; input_len
	move.l	a1,-(sp)		; input
	move.l	a0,-(sp)		; ctx
	jsr	_QJS_EvalBuf_impl
	lea	20(sp),sp

	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; quickjs-libc module init / std helpers
; ===================================================================

; QJS_InitModuleStd — (ctx,module_name)(a0/a1)
_QJS_InitModuleStd:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_js_init_module_std
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_InitModuleOS — (ctx,module_name)(a0/a1)
_QJS_InitModuleOS:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_js_init_module_os
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_InitModuleBJSON — (ctx,module_name)(a0/a1)
_QJS_InitModuleBJSON:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_js_init_module_bjson
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_StdInitHandlers — (rt)(a0)
_QJS_StdInitHandlers:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_js_std_init_handlers
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_StdFreeHandlers — (rt)(a0)
_QJS_StdFreeHandlers:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_js_std_free_handlers
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_StdAddHelpers — (ctx,argc,argv)(a0/d0/a1)
_QJS_StdAddHelpers:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)		; argv
	move.l	d0,-(sp)		; argc
	move.l	a0,-(sp)		; ctx
	jsr	_js_std_add_helpers
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_StdLoop — (ctx)(a0)
_QJS_StdLoop:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_js_std_loop
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_StdEvalBinary — (ctx,buf,buf_len,flags)(a0/a1/d0/d1)
_QJS_StdEvalBinary:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d1,-(sp)		; flags
	move.l	d0,-(sp)		; buf_len
	move.l	a1,-(sp)		; buf
	move.l	a0,-(sp)		; ctx
	jsr	_js_std_eval_binary
	lea	16(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_StdDumpError — (ctx)(a0)
_QJS_StdDumpError:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_js_std_dump_error
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_LoadFile — (ctx,pbuf_len,filename)(a0/a1/a2)
_QJS_LoadFile:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a2,-(sp)		; filename
	move.l	a1,-(sp)		; pbuf_len
	move.l	a0,-(sp)		; ctx
	jsr	_js_load_file
	lea	12(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_SetModuleLoader — (rt)(a0)
; Sets up js_module_loader as the module loader for the runtime
_QJS_SetModuleLoader:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_QJS_SetModuleLoader_impl
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_InstallExtended — (ctx)(a0)
; Installs extended.js bytecode (URL, TextEncoder, process, path, console.*, etc.)
_QJS_InstallExtended:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_QJS_InstallExtended_impl
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ============================================================
; Worker primitive trampolines
; SFD: QJS_WorkerSpawn(job_fn,user_data,flags)(a0/a1/d0)
;      QJS_WorkerPoll(worker)(a0)
;      QJS_WorkerJoin(worker)(a0)
;      QJS_WorkerDestroy(worker)(a0)
;      QJS_WorkerGetBase(worker,which)(a0/d0)
; ============================================================

; QJS_WorkerSpawn — (job_fn, user_data, flags)(a0/a1/d0)
_QJS_WorkerSpawn:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)		; flags
	move.l	a1,-(sp)		; user_data
	move.l	a0,-(sp)		; job_fn
	jsr	_QJS_WorkerSpawn_impl
	lea	12(sp),sp
	move.l	d0,a0			; return value lives in a0 per SFD
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_WorkerPoll — (worker)(a0) -> d0 (long)
_QJS_WorkerPoll:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_QJS_WorkerPoll_impl
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_WorkerJoin — (worker)(a0) -> d0 (long)
_QJS_WorkerJoin:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_QJS_WorkerJoin_impl
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_WorkerDestroy — (worker)(a0) -> void
_QJS_WorkerDestroy:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_QJS_WorkerDestroy_impl
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_WorkerGetBase — (worker, which)(a0/d0) -> a0 (struct Library*)
_QJS_WorkerGetBase:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)		; which
	move.l	a0,-(sp)		; worker
	jsr	_QJS_WorkerGetBase_impl
	lea	8(sp),sp
	move.l	d0,a0			; return in a0
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; ===================================================================
; W7 net capability probe
; SFD: QJS_GetNetCapabilities()()             -> ULONG in d0
;      QJS_InitModuleNet(ctx,module_name)(a0/a1) -> JSModuleDef* in d0
; ===================================================================

; QJS_GetNetCapabilities — () -> d0 (ULONG caps)
; Impl needs the library base to read iNetCaps; push A6 before movem
; overwrites it on stack (movem copies — a6 is preserved in a6 too).
_QJS_GetNetCapabilities:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a6,-(sp)		; base
	jsr	_QJS_GetNetCapabilities_impl
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_InitModuleNet — (ctx, module_name)(a0/a1)
_QJS_InitModuleNet:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a1,-(sp)
	move.l	a0,-(sp)
	jsr	_js_init_module_net
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_GetMathBase — (which:d0) -> d0 (struct Library*)
; Impl reads the base's iMath*Base fields; must pass A6.
_QJS_GetMathBase:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	d0,-(sp)		; which
	move.l	a6,-(sp)		; base
	jsr	_QJS_GetMathBase_impl
	lea	8(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_InstallChildProcessGlobal — (ctx)(a0) -> void
; Installs globalThis.__qjs_spawnSync. Extended.js wraps that in
; globalThis.child_process.{spawnSync, spawn, exec, execSync}.
_QJS_InstallChildProcessGlobal:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_qjs_install_child_process_global
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_InstallCryptoGlobal — (ctx)(a0) -> void
; E1: installs globalThis.__qjs_cryptoDigest and __qjs_cryptoRandom.
; extended.js wraps in WebCrypto shape (crypto.subtle.digest, etc.).
_QJS_InstallCryptoGlobal:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_qjs_install_crypto_global
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; QJS_InstallAmigaFFIGlobal — (ctx)(a0) -> void
; Q1 (0.124): installs globalThis.__qjs_amiga_* FFI primitives.
; extended.js wraps these in globalThis.amiga with LVO constant tables
; for exec/dos/intuition/graphics/gadtools.
_QJS_InstallAmigaFFIGlobal:
	movem.l	d2-d7/a2-a6,-(sp)
	move.l	a0,-(sp)
	jsr	_qjs_install_amiga_ffi_global
	lea	4(sp),sp
	movem.l	(sp)+,d2-d7/a2-a6
	rts

; end of qjsfuncs_asm_all.s
