#ifndef PRAGMAS_QUICKJS_PRAGMAS_H
#define PRAGMAS_QUICKJS_PRAGMAS_H

/*
**	$VER: quickjs_pragmas.h 0.49 (27.3.2026)
**
**	SAS/C format pragma file for quickjs.library
**	Uses #pragma libcall with explicit QuickJSBase reference.
*/

#ifndef CLIB_QUICKJS_PROTOS_H
#include <clib/quickjs_protos.h>
#endif /* CLIB_QUICKJS_PROTOS_H */

/* "quickjs.library" */
/*--- Runtime management ---*/
#pragma libcall QuickJSBase QJS_NewRuntime 1e 0
#pragma libcall QuickJSBase QJS_FreeRuntime 24 801
#pragma libcall QuickJSBase QJS_SetMemoryLimit 2a 0802
#pragma libcall QuickJSBase QJS_SetMaxStackSize 30 0802
#pragma libcall QuickJSBase QJS_RunGC 36 801
#pragma libcall QuickJSBase QJS_SetRuntimeInfo 3c 9802
#pragma libcall QuickJSBase QJS_GetRuntimeOpaque 42 801
#pragma libcall QuickJSBase QJS_SetRuntimeOpaque 48 9802
#pragma libcall QuickJSBase QJS_UpdateStackTop 4e 801
#pragma libcall QuickJSBase QJS_IsLiveObject 54 9802
/*--- Context management ---*/
#pragma libcall QuickJSBase QJS_NewContext 5a 801
#pragma libcall QuickJSBase QJS_FreeContext 60 801
#pragma libcall QuickJSBase QJS_DupContext 66 801
#pragma libcall QuickJSBase QJS_GetRuntime 6c 801
#pragma libcall QuickJSBase QJS_GetContextOpaque 72 801
#pragma libcall QuickJSBase QJS_SetContextOpaque 78 9802
#pragma libcall QuickJSBase QJS_NewContextRaw 7e 801
/*--- Intrinsics ---*/
#pragma libcall QuickJSBase QJS_AddIntrinsicBaseObjects 84 801
#pragma libcall QuickJSBase QJS_AddIntrinsicDate 8a 801
#pragma libcall QuickJSBase QJS_AddIntrinsicEval 90 801
#pragma libcall QuickJSBase QJS_AddIntrinsicRegExpCompiler 96 801
#pragma libcall QuickJSBase QJS_AddIntrinsicRegExp 9c 801
#pragma libcall QuickJSBase QJS_AddIntrinsicJSON a2 801
#pragma libcall QuickJSBase QJS_AddIntrinsicProxy a8 801
#pragma libcall QuickJSBase QJS_AddIntrinsicMapSet ae 801
#pragma libcall QuickJSBase QJS_AddIntrinsicTypedArrays b4 801
#pragma libcall QuickJSBase QJS_AddIntrinsicPromise ba 801
#pragma libcall QuickJSBase QJS_AddIntrinsicBigInt c0 801
#pragma libcall QuickJSBase QJS_AddIntrinsicWeakRef c6 801
#pragma libcall QuickJSBase QJS_AddPerformance cc 801
#pragma libcall QuickJSBase QJS_AddIntrinsicDOMException d2 801
/*--- Eval ---*/
#pragma libcall QuickJSBase QJS_Eval d8 1B0A9806
#pragma libcall QuickJSBase QJS_EvalThis de 210BA9807
#pragma libcall QuickJSBase QJS_EvalFunction e4 A9803
#pragma libcall QuickJSBase QJS_DetectModule ea 0802
#pragma libcall QuickJSBase QJS_ResolveModule f0 9802
/*--- Value creation ---*/
#pragma libcall QuickJSBase QJS_NewInt32 f6 09803
#pragma libcall QuickJSBase QJS_NewFloat64 fc A9803
#pragma libcall QuickJSBase QJS_NewString 102 A9803
#pragma libcall QuickJSBase QJS_NewStringLen 108 0A9804
#pragma libcall QuickJSBase QJS_NewBool 10e 09803
#pragma libcall QuickJSBase QJS_NewObject 114 9802
#pragma libcall QuickJSBase QJS_NewArray 11a 9802
#pragma libcall QuickJSBase QJS_NewNumber 120 A9803
#pragma libcall QuickJSBase QJS_NewAtomString 126 A9803
#pragma libcall QuickJSBase QJS_NewObjectProto 12c A9803
#pragma libcall QuickJSBase QJS_NewObjectClass 132 09803
#pragma libcall QuickJSBase QJS_NewObjectProtoClass 138 0A9804
#pragma libcall QuickJSBase QJS_NewError 13e 9802
#pragma libcall QuickJSBase QJS_NewDate 144 A9803
#pragma libcall QuickJSBase QJS_NewSymbol 14a 0A9804
/*--- Value extraction ---*/
#pragma libcall QuickJSBase QJS_ToCString 150 9802
#pragma libcall QuickJSBase QJS_FreeCString 156 9802
#pragma libcall QuickJSBase QJS_ToCStringLen2 15c 0A9804
#pragma libcall QuickJSBase QJS_ToInt32 162 A9803
#pragma libcall QuickJSBase QJS_ToFloat64 168 A9803
#pragma libcall QuickJSBase QJS_ToBool 16e 9802
#pragma libcall QuickJSBase QJS_ToNumber 174 A9803
#pragma libcall QuickJSBase QJS_ToString 17a A9803
#pragma libcall QuickJSBase QJS_ToPropertyKey 180 A9803
#pragma libcall QuickJSBase QJS_ToObject 186 A9803
/*--- Type checking ---*/
#pragma libcall QuickJSBase QJS_IsNumber 18c 801
#pragma libcall QuickJSBase QJS_IsString 192 801
#pragma libcall QuickJSBase QJS_IsObject 198 801
#pragma libcall QuickJSBase QJS_IsUndefined 19e 801
#pragma libcall QuickJSBase QJS_IsNull 1a4 801
#pragma libcall QuickJSBase QJS_IsException 1aa 801
#pragma libcall QuickJSBase QJS_IsError 1b0 801
#pragma libcall QuickJSBase QJS_IsFunction 1b6 9802
#pragma libcall QuickJSBase QJS_IsConstructor 1bc 9802
#pragma libcall QuickJSBase QJS_IsArray 1c2 801
#pragma libcall QuickJSBase QJS_IsProxy 1c8 801
#pragma libcall QuickJSBase QJS_IsPromise 1ce 801
#pragma libcall QuickJSBase QJS_IsDate 1d4 801
#pragma libcall QuickJSBase QJS_IsRegExp 1da 801
#pragma libcall QuickJSBase QJS_IsMap 1e0 801
#pragma libcall QuickJSBase QJS_IsSet 1e6 801
#pragma libcall QuickJSBase QJS_IsDataView 1ec 801
#pragma libcall QuickJSBase QJS_IsArrayBuffer 1f2 801
/*--- Value lifecycle ---*/
#pragma libcall QuickJSBase QJS_FreeValue 1f8 9802
#pragma libcall QuickJSBase QJS_FreeValueRT 1fe 9802
#pragma libcall QuickJSBase QJS_DupValue 204 A9803
#pragma libcall QuickJSBase QJS_DupValueRT 20a A9803
/*--- Properties ---*/
#pragma libcall QuickJSBase QJS_GetPropertyStr 210 BA9804
#pragma libcall QuickJSBase QJS_SetPropertyStr 216 BA9804
#pragma libcall QuickJSBase QJS_GetProperty 21c 0A9804
#pragma libcall QuickJSBase QJS_SetProperty 222 A09804
#pragma libcall QuickJSBase QJS_GetPropertyUint32 228 0A9804
#pragma libcall QuickJSBase QJS_SetPropertyUint32 22e A09804
#pragma libcall QuickJSBase QJS_HasProperty 234 09803
#pragma libcall QuickJSBase QJS_DeleteProperty 23a 109804
#pragma libcall QuickJSBase QJS_GetOwnPropertyNames 240 0BA9805
#pragma libcall QuickJSBase QJS_FreePropertyEnum 246 09803
#pragma libcall QuickJSBase QJS_DefinePropertyValue 24c 1A09805
#pragma libcall QuickJSBase QJS_DefinePropertyValueStr 252 0BA9805
#pragma libcall QuickJSBase QJS_DefinePropertyValueUint32 258 1A09805
#pragma libcall QuickJSBase QJS_DefinePropertyGetSet 25e 1BA09806
#pragma libcall QuickJSBase QJS_GetOwnProperty 264 0A9804
#pragma libcall QuickJSBase QJS_DefineProperty 26a 21BA09807
/*--- Object operations ---*/
#pragma libcall QuickJSBase QJS_SetPrototype 270 A9803
#pragma libcall QuickJSBase QJS_GetPrototype 276 A9803
#pragma libcall QuickJSBase QJS_IsExtensible 27c 9802
#pragma libcall QuickJSBase QJS_PreventExtensions 282 9802
#pragma libcall QuickJSBase QJS_SealObject 288 9802
#pragma libcall QuickJSBase QJS_FreezeObject 28e 9802
#pragma libcall QuickJSBase QJS_SetConstructorBit 294 09803
#pragma libcall QuickJSBase QJS_SetConstructor 29a A9803
/*--- Function calls ---*/
#pragma libcall QuickJSBase QJS_Call 2a0 10BA9806
#pragma libcall QuickJSBase QJS_CallConstructor 2a6 10A9805
#pragma libcall QuickJSBase QJS_Invoke 2ac 210A9806
/*--- Error handling ---*/
#pragma libcall QuickJSBase QJS_Throw 2b2 A9803
#pragma libcall QuickJSBase QJS_GetException 2b8 9802
#pragma libcall QuickJSBase QJS_HasException 2be 801
#pragma libcall QuickJSBase QJS_IsUncatchableError 2c4 801
#pragma libcall QuickJSBase QJS_SetUncatchableError 2ca 9802
#pragma libcall QuickJSBase QJS_ClearUncatchableError 2d0 9802
#pragma libcall QuickJSBase QJS_ResetUncatchableError 2d6 801
#pragma libcall QuickJSBase QJS_ThrowOutOfMemory 2dc 9802
#pragma libcall QuickJSBase QJS_ThrowTypeErrorMsg 2e2 A9803
#pragma libcall QuickJSBase QJS_ThrowRangeErrorMsg 2e8 A9803
#pragma libcall QuickJSBase QJS_ThrowReferenceErrorMsg 2ee A9803
#pragma libcall QuickJSBase QJS_ThrowSyntaxErrorMsg 2f4 A9803
#pragma libcall QuickJSBase QJS_ThrowInternalErrorMsg 2fa A9803
/*--- Atoms ---*/
#pragma libcall QuickJSBase QJS_NewAtom 300 9802
#pragma libcall QuickJSBase QJS_NewAtomLen 306 09803
#pragma libcall QuickJSBase QJS_NewAtomUInt32 30c 0802
#pragma libcall QuickJSBase QJS_DupAtom 312 0802
#pragma libcall QuickJSBase QJS_FreeAtom 318 0802
#pragma libcall QuickJSBase QJS_AtomToValue 31e 09803
#pragma libcall QuickJSBase QJS_AtomToString 324 09803
#pragma libcall QuickJSBase QJS_ValueToAtom 32a 9802
/*--- Global object ---*/
#pragma libcall QuickJSBase QJS_GetGlobalObject 330 9802
/*--- JSON ---*/
#pragma libcall QuickJSBase QJS_ParseJSON 336 B0A9805
#pragma libcall QuickJSBase QJS_JSONStringify 33c 0BA9805
/*--- ArrayBuffer and TypedArray ---*/
#pragma libcall QuickJSBase QJS_NewArrayBufferCopy 342 0A9804
#pragma libcall QuickJSBase QJS_GetArrayBuffer 348 A9803
#pragma libcall QuickJSBase QJS_DetachArrayBuffer 34e 9802
#pragma libcall QuickJSBase QJS_GetUint8Array 354 A9803
#pragma libcall QuickJSBase QJS_NewUint8ArrayCopy 35a 0A9804
#pragma libcall QuickJSBase QJS_NewTypedArray 360 1A09805
#pragma libcall QuickJSBase QJS_GetTypedArrayBuffer 366 10BA9806
#pragma libcall QuickJSBase QJS_GetTypedArrayType 36c 801
/*--- Promise ---*/
#pragma libcall QuickJSBase QJS_NewPromiseCapability 372 A9803
#pragma libcall QuickJSBase QJS_PromiseState 378 9802
#pragma libcall QuickJSBase QJS_PromiseResult 37e A9803
#pragma libcall QuickJSBase QJS_NewSettledPromise 384 A09804
/*--- Module system ---*/
#pragma libcall QuickJSBase QJS_NewCModule 38a A9803
#pragma libcall QuickJSBase QJS_AddModuleExport 390 A9803
#pragma libcall QuickJSBase QJS_SetModuleExport 396 BA9804
#pragma libcall QuickJSBase QJS_GetModuleName 39c 9802
#pragma libcall QuickJSBase QJS_GetImportMeta 3a2 A9803
#pragma libcall QuickJSBase QJS_GetModuleNamespace 3a8 A9803
#pragma libcall QuickJSBase QJS_LoadModule 3ae BA9804
/*--- C function creation ---*/
#pragma libcall QuickJSBase QJS_NewCFunction2 3b4 210BA9807
#pragma libcall QuickJSBase QJS_NewCFunctionData 3ba 3210A9807
#pragma libcall QuickJSBase QJS_SetPropertyFunctionList 3c0 0A9804
/*--- Class system ---*/
#pragma libcall QuickJSBase QJS_NewClassID 3c6 9802
#pragma libcall QuickJSBase QJS_NewClass 3cc 90803
#pragma libcall QuickJSBase QJS_GetClassID 3d2 801
#pragma libcall QuickJSBase QJS_IsRegisteredClass 3d8 0802
#pragma libcall QuickJSBase QJS_SetClassProto 3de 90803
#pragma libcall QuickJSBase QJS_GetClassProto 3e4 09803
#pragma libcall QuickJSBase QJS_SetOpaque 3ea 9802
#pragma libcall QuickJSBase QJS_GetOpaque 3f0 0802
#pragma libcall QuickJSBase QJS_GetOpaque2 3f6 09803
#pragma libcall QuickJSBase QJS_GetClassName 3fc 0802
/*--- Memory management ---*/
#pragma libcall QuickJSBase QJS_Malloc 402 0802
#pragma libcall QuickJSBase QJS_Free 408 9802
#pragma libcall QuickJSBase QJS_Realloc 40e 09803
#pragma libcall QuickJSBase QJS_Mallocz 414 0802
#pragma libcall QuickJSBase QJS_Strdup 41a 9802
#pragma libcall QuickJSBase QJS_FreeCStringRT 420 9802
/*--- Serialization ---*/
#pragma libcall QuickJSBase QJS_WriteObject 426 0A9804
#pragma libcall QuickJSBase QJS_ReadObject 42c 10A9805
/*--- Job queue ---*/
#pragma libcall QuickJSBase QJS_IsJobPending 432 801
#pragma libcall QuickJSBase QJS_ExecutePendingJob 438 9802
/*--- Comparison ---*/
#pragma libcall QuickJSBase QJS_IsEqual 43e A9803
#pragma libcall QuickJSBase QJS_IsStrictEqual 444 A9803
#pragma libcall QuickJSBase QJS_IsSameValue 44a A9803
#pragma libcall QuickJSBase QJS_IsInstanceOf 450 A9803
/*--- std/os library helpers ---*/
#pragma libcall QuickJSBase QJS_InitModuleStd 456 9802
#pragma libcall QuickJSBase QJS_InitModuleOs 45c 9802
#pragma libcall QuickJSBase QJS_StdAddHelpers 462 90803
#pragma libcall QuickJSBase QJS_StdInitHandlers 468 801
#pragma libcall QuickJSBase QJS_StdFreeHandlers 46e 801
#pragma libcall QuickJSBase QJS_StdLoop 474 801
#pragma libcall QuickJSBase QJS_StdDumpError 47a 801
#pragma libcall QuickJSBase QJS_StdEvalBinary 480 109804
/*--- Miscellaneous ---*/
#pragma libcall QuickJSBase QJS_GetVersion 486 0
#pragma libcall QuickJSBase QJS_ComputeMemoryUsage 48c 9802
#pragma libcall QuickJSBase QJS_GetScriptOrModuleName 492 0802
#pragma libcall QuickJSBase QJS_SetDumpFlags 498 0802
#pragma libcall QuickJSBase QJS_GetGCThreshold 49e 801
#pragma libcall QuickJSBase QJS_SetGCThreshold 4a4 0802
/*--- Additional value operations ---*/
#pragma libcall QuickJSBase QJS_NewProxy 4aa BA9804
#pragma libcall QuickJSBase QJS_GetProxyTarget 4b0 A9803
#pragma libcall QuickJSBase QJS_GetProxyHandler 4b6 A9803
#pragma libcall QuickJSBase QJS_SetIsHTMLDDA 4bc 9802
/*--- Callbacks ---*/
#pragma libcall QuickJSBase QJS_SetInterruptHandler 4c2 A9803
#pragma libcall QuickJSBase QJS_SetModuleLoaderFunc 4c8 BA9804
#pragma libcall QuickJSBase QJS_SetCanBlock 4ce 0802
#pragma libcall QuickJSBase QJS_EnqueueJob 4d4 A09804
/*--- Additional ---*/
#pragma libcall QuickJSBase QJS_MarkValue 4da A9803
#pragma libcall QuickJSBase QJS_AddRuntimeFinalizer 4e0 A9803
#pragma libcall QuickJSBase QJS_NewObjectFrom 4e6 BA09805
#pragma libcall QuickJSBase QJS_NewObjectFromStr 4ec BA09805
#pragma libcall QuickJSBase QJS_NewArrayFrom 4f2 A09804
#pragma libcall QuickJSBase QJS_SetLength 4f8 09803
#pragma libcall QuickJSBase QJS_PrintValue 4fe 0BA9805
#pragma libcall QuickJSBase QJS_Eval2 504 B0A9805
#pragma libcall QuickJSBase QJS_IsImmutableArrayBuffer 50a 801
#pragma libcall QuickJSBase QJS_SetImmutableArrayBuffer 510 0802

#endif /* PRAGMAS_QUICKJS_PRAGMAS_H */
