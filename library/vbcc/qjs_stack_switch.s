; qjs_stack_switch.s - run one C function on another stack block
;
; The JavaScript stack of quickjs.library is a chain of blocks (see
; docs/STACK.md). When the block in use runs low the engine allocates
; another and continues the nested call there. This file is the only
; place where the stack pointer changes hands.
;
;   void qjs_stack_switch(struct StackSwapStruct *sss,   4(sp)
;                         void (*fn)(void *),            8(sp)
;                         void *arg,                    12(sp)
;                         struct ExecBase *SysBase);    16(sp)
;
; sss describes the new block (stk_Lower, stk_Upper, stk_Pointer) and
; must not lie on either stack; the engine keeps it in the block's own
; header. fn(arg) is called on the new block and qjs_stack_switch
; returns, on the old stack, when fn returns. fn has no result: what it
; produces goes through arg.
;
; Why exec's StackSwap() and not a plain "move.l a0,sp": StackSwap()
; also exchanges tc_SPLower and tc_SPUpper of the task, under Disable.
; Those two fields are what stack-watching tools, dos.library and this
; library's own limit code (qjs_amiga_stack_bounds) read, so they have
; to describe the block the stack pointer is really in.
;
; StackSwap(sss) leaves the old bounds and the old stack pointer in
; sss, so the second call with the same structure goes back. Between
; the two calls nothing may be addressed relative to the old stack
; pointer: everything needed is in registers that C functions preserve
; (vbcc keeps d2-d7 and a2-a6 across a call).
;
; There is no other way back from the new block than fn returning.
; The engine reports errors by return value, never by longjmp, so
; every nested call unwinds through here (docs/STACK.md, "Unwinding").

	include	"lvo/exec_lib.i"

	machine	68020
	section	code

	xdef	_qjs_stack_switch

_qjs_stack_switch:
	movem.l	a2/a3/a5/a6,-(sp)	; 16 bytes: arguments now at 20(sp)
	move.l	20(sp),a2		; sss
	move.l	24(sp),a3		; fn
	move.l	28(sp),a5		; arg
	move.l	32(sp),a6		; SysBase

	move.l	a2,a0
	jsr	_LVOStackSwap(a6)	; now on the new block

	move.l	a5,-(sp)
	jsr	(a3)			; fn(arg)
	addq.l	#4,sp

	move.l	a2,a0
	jsr	_LVOStackSwap(a6)	; back on the old stack

	movem.l	(sp)+,a2/a3/a5/a6
	rts
