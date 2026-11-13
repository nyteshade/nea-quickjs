; sharedlib_fpu_mode.s - run every library call in a known FPU mode
;                        (FPU variants only)
;
; The FPU control register (FPCR) belongs to the calling task and the
; library must work whatever is in it. Two things go wrong otherwise:
;
;  1. Rounding mode. mathieeedoubbas.library sets the FPU of the
;     task that opens it to round TOWARD ZERO (47.3 contains
;     "moveq #$10,d0 ; fmove.l d0,fpcr", and after opening it the FPU
;     truncates), matching its software arithmetic, which truncates
;     too. In a task where that has happened every JavaScript result
;     was truncated instead of rounded: 0.1+0.2 gave 0.3 and 1/1e10
;     gave 9.999999999999999e-11. That is any host program that opens
;     that library itself, and every run under the vamos emulator,
;     where our own OpenLibrary() in CustomLibInit runs on the
;     caller's context. (On AmigaOS a disk library is initialised by
;     another process, so a plain "qjs script.js" was probably not
;     affected there; this has not been checked on an Amiga.)
;
;  2. Rounding precision. With the reset default (extended) every
;     result is rounded to 64 bits in the register and again to 53 on
;     the way to memory; the two roundings together are sometimes one
;     unit off the correctly rounded double ECMAScript requires.
;
; So each library vector is redirected at start-up through a small
; thunk that saves the caller's FPCR, loads ours, calls the real
; function and restores the caller's FPCR before returning. The caller
; never sees its floating-point mode changed. What the caller can see:
; a host function the library calls back (a JSCFunction, a finaliser,
; the module loader) runs with the library's mode until it returns.
;
; Our mode (QJS_FPCR_MODE, given by the Makefile):
;   68040, 68060 variants  $80 = round to nearest, double precision.
;       Results are then correctly rounded doubles; these CPUs run at
;       the same speed in every precision (MC68040UM 9.4 "Computational
;       Accuracy", MC68060UM 6.3).
;   68020 variant          $00 = round to nearest, extended precision.
;       A 68881/68882 slows down "significantly" in single or double
;       precision (MC68881UM 2.2.2), so the rare double rounding is
;       accepted there.
; FPCR layout (MC68881UM 2.2.2, figure 2-3): bits 7-6 precision
; (00 extended, 01 single, 10 double), bits 5-4 rounding (00 nearest,
; 01 zero, 10 minus infinity, 11 plus infinity), bits 15-8 exception
; enables, which we clear: ECMAScript arithmetic never traps.
;
; The thunks are generated at run time, one per vector, by copying the
; template below, so a function added to LIBRARY_FUNCTIONS is covered
; without anybody remembering this file. They rely on the library
; functions taking their arguments in registers (true of every Amiga
; library vector): the thunk leaves all integer registers alone and
; only adds its own return address and the saved FPCR to the stack.
; FMOVE to and from the FPCR is native on the 6888x, 68040 and 68060.
;
; Processes the library starts itself (sharedlib_worker.c) begin with
; a reset FPU (round to nearest) and run no JavaScript; they are left
; alone.

	include	"exec/libraries.i"
	include	"exec/memory.i"
	include	"lvo/exec_lib.i"

	ifnd	QJS_FPCR_MODE
QJS_FPCR_MODE	equ	$80
	endc

	machine	68020
	section	code

; ------------------------------------------------------------
; The thunk template. The JSR target is patched per vector.
; ------------------------------------------------------------
thunk_start:
	fmove.l	fpcr,-(sp)		; the caller's mode
	fmove.l	#QJS_FPCR_MODE,fpcr	; ours
	dc.w	$4eb9			; jsr <absolute long>
thunk_target:
	dc.l	0
	fmove.l	(sp)+,fpcr		; touches neither d0/d1/a0/a1 nor fp0
	rts
thunk_end:
THUNK_SIZE	equ	thunk_end-thunk_start
THUNK_TARGET	equ	thunk_target-thunk_start

JMP_ABS_L	equ	$4ef9		; what MakeLibrary() writes in a vector

; ------------------------------------------------------------
; long qjs_fpu_thunks_install(struct Library *lib, struct ExecBase *sys)
;   C stack arguments. Returns 0 on success, 1 if there was no memory
;   (nothing is changed then). Call once, from CustomLibInit, before
;   the library is added to the system.
; ------------------------------------------------------------
	xdef	_qjs_fpu_thunks_install
_qjs_fpu_thunks_install:
	movem.l	d2-d3/a2-a3/a6,-(sp)	; 20 bytes: args now at 24(sp)
	move.l	24(sp),a2		; library base
	move.l	28(sp),a6		; SysBase
	moveq	#0,d2
	move.w	LIB_NEGSIZE(a2),d2
	divu.w	#LIB_VECTSIZE,d2	; number of vectors
	ext.l	d2
	subq.l	#LIB_RESERVED,d2	; less Open/Close/Expunge/Reserved
	ble.s	.ok			; no user functions
	move.l	d2,d0
	mulu.w	#THUNK_SIZE,d0
	move.l	d0,thunk_bytes
	move.l	#MEMF_PUBLIC,d1
	jsr	_LVOAllocMem(a6)
	move.l	d0,thunk_mem
	beq.s	.fail
	move.l	d0,a3			; next thunk
	lea	LIB_USERDEF(a2),a2	; first user vector; they go downward
.next:
	cmp.w	#JMP_ABS_L,(a2)
	bne.s	.skip			; not a plain vector: leave it
	lea	thunk_start(pc),a0
	move.l	a3,a1
	moveq	#THUNK_SIZE/2-1,d0
.copy:
	move.w	(a0)+,(a1)+
	dbf	d0,.copy
	move.l	2(a2),THUNK_TARGET(a3)	; call the real function
	move.l	a3,2(a2)		; and send the vector here
	lea	THUNK_SIZE(a3),a3
.skip:
	subq.l	#LIB_VECTSIZE,a2
	subq.l	#1,d2
	bne.s	.next
	; new code was written: flush the caches (68040/68060). The
	; function exists from exec V37.
	cmp.w	#37,LIB_VERSION(a6)
	bcs.s	.ok
	jsr	_LVOCacheClearU(a6)
.ok:
	moveq	#0,d0
	bra.s	.done
.fail:
	moveq	#1,d0
.done:
	movem.l	(sp)+,d2-d3/a2-a3/a6
	rts

; ------------------------------------------------------------
; void qjs_fpu_thunks_free(struct ExecBase *sys)
;   Releases the thunk memory. Only when the library is being
;   expunged: the vectors still point into it.
; ------------------------------------------------------------
	xdef	_qjs_fpu_thunks_free
_qjs_fpu_thunks_free:
	move.l	a6,-(sp)
	move.l	8(sp),a6		; SysBase
	move.l	thunk_mem,d0
	beq.s	.none
	move.l	d0,a1
	move.l	thunk_bytes,d0
	jsr	_LVOFreeMem(a6)
	clr.l	thunk_mem
.none:
	move.l	(sp)+,a6
	rts

	section	bss
thunk_mem:	ds.l	1		; the block of thunks, or 0
thunk_bytes:	ds.l	1		; its size
