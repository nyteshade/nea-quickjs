; bridge_asm_libc.s — Bridge trampolines for quickjs-libc LVO functions
;
; These allow the CLI to call module init/std helper functions
; through quickjs.library's LVO jump table.

	section	code
	xref	_QJSBase

; ===================================================================
; bridge_InitModuleStd(ctx, module_name) -> void*
; LVO -1080: QJS_InitModuleStd(ctx,module_name)(a0/a1)
; Stack: [ret:4] [ctx:4] [module_name:4]
; ===================================================================
	xdef	_bridge_InitModuleStd
_bridge_InitModuleStd:
	movem.l	d2/a2-a6,-(sp)		; 6 regs = 24 bytes
	move.l	28(sp),a0		; ctx
	move.l	32(sp),a1		; module_name
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1080,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; bridge_InitModuleOS(ctx, module_name) -> void*
; LVO -1086
; ===================================================================
	xdef	_bridge_InitModuleOS
_bridge_InitModuleOS:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	32(sp),a1
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1086,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; bridge_InitModuleBJSON(ctx, module_name) -> void*
; LVO -1092
; ===================================================================
	xdef	_bridge_InitModuleBJSON
_bridge_InitModuleBJSON:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	32(sp),a1
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1092,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; bridge_StdInitHandlers(rt) -> void
; LVO -1098
; ===================================================================
	xdef	_bridge_StdInitHandlers
_bridge_StdInitHandlers:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1098,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; bridge_StdFreeHandlers(rt) -> void
; LVO -1104
; ===================================================================
	xdef	_bridge_StdFreeHandlers
_bridge_StdFreeHandlers:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1104,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; bridge_StdAddHelpers(ctx, argc, argv) -> void
; LVO -1110: QJS_StdAddHelpers(ctx,argc,argv)(a0/d0/a1)
; Stack: [ret:4] [ctx:4] [argc:4] [argv:4]
; ===================================================================
	xdef	_bridge_StdAddHelpers
_bridge_StdAddHelpers:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0		; ctx
	move.l	32(sp),d0		; argc
	move.l	36(sp),a1		; argv
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1110,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; bridge_StdLoop(ctx) -> int
; LVO -1116
; ===================================================================
	xdef	_bridge_StdLoop
_bridge_StdLoop:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1116,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; bridge_StdEvalBinary(ctx, buf, buf_len, flags) -> void
; LVO -1122: QJS_StdEvalBinary(ctx,buf,buf_len,flags)(a0/a1/d0/d1)
; Stack: [ret:4] [ctx:4] [buf:4] [buf_len:4] [flags:4]
; ===================================================================
	xdef	_bridge_StdEvalBinary
_bridge_StdEvalBinary:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0		; ctx
	move.l	32(sp),a1		; buf
	move.l	36(sp),d0		; buf_len
	move.l	40(sp),d1		; flags
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1122,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; bridge_StdDumpError(ctx) -> void
; LVO -1128
; ===================================================================
	xdef	_bridge_StdDumpError
_bridge_StdDumpError:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1128,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; bridge_LoadFile(ctx, pbuf_len, filename) -> void*
; LVO -1134: QJS_LoadFile(ctx,pbuf_len,filename)(a0/a1/a2)
; Stack: [ret:4] [ctx:4] [pbuf_len:4] [filename:4]
; ===================================================================
	xdef	_bridge_LoadFile
_bridge_LoadFile:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0		; ctx
	move.l	32(sp),a1		; pbuf_len
	move.l	36(sp),a2		; filename
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1134,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts

; ===================================================================
; bridge_SetModuleLoader(rt) -> void
; LVO -1140
; ===================================================================
	xdef	_bridge_SetModuleLoader
_bridge_SetModuleLoader:
	movem.l	d2/a2-a6,-(sp)
	move.l	28(sp),a0
	move.l	_QJSBase,a6
	move.l	a6,a5
	suba.l	#1140,a5
	jsr	(a5)
	movem.l	(sp)+,d2/a2-a6
	rts
