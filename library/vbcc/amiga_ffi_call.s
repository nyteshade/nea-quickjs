; amiga_ffi_call.s — Generic m68k trampoline for Amiga library calls
;
; Part of the Q1 FFI (library version 0.124). Powers the JS-visible
; `amiga.call(lib, lvo, regs)` function. One function, one trampoline,
; handles every Amiga library call regardless of register signature.
;
; Signature (VBCC aos68k cdecl, stack-passed args):
;
;   ULONG qjs_amiga_trampoline(APTR lib_base,     ; in A6 before JSR
;                              LONG lvo,          ; negative offset from lib
;                              struct AmigaRegs *regs);
;
; Stack frame after LINK A5,#0:
;    0(A5) = saved old A5
;    4(A5) = return address
;    8(A5) = arg 1 (lib_base)
;   12(A5) = arg 2 (lvo)
;   16(A5) = arg 3 (regs pointer)
;
; struct AmigaRegs layout (32 bytes):
;    0(regs) = d0
;    4(regs) = d1
;    8(regs) = d2
;   12(regs) = d3
;   16(regs) = a0
;   20(regs) = a1
;   24(regs) = a2
;   28(regs) = a3
;
; Registers:
;   D0           — loaded from regs, also holds return value from the call
;   D1, D2, D3   — loaded from regs
;   D4           — scratch for the LVO index used in JSR 0(A6, D4.L)
;   D5, D6, D7   — callee-saved, not touched after MOVEM
;   A0           — loaded from regs (last, because we used it as regs-ptr temp)
;   A1, A2, A3   — loaded from regs
;   A4           — callee-saved, not touched
;   A5           — local frame pointer
;   A6           — library base (overwrites VBCC's A6 frame-pointer register;
;                  we don't use A6 as frame pointer in this asm, so safe)
;
; Cache coherency: this code lives in the library's .text segment, linked
; statically. Exec handles I-cache when the library is first loaded. No
; CacheClearE needed (only runtime-generated code needs it).
;
; Valid on 68000, 68010, 68020, 68040, 68060. `jsr 0(a6, d4.l)` is brief-
; format indexed addressing (8-bit displacement + 32-bit index), which is
; in the base 68000 ISA.

	section code

	xdef	_qjs_amiga_trampoline

_qjs_amiga_trampoline:
	link	a5,#0
	movem.l	d2-d7/a2-a6,-(sp)	; save callee-saved (9 regs = 36 bytes)

	move.l	16(a5),a0		; a0 = regs ptr (used as temp)
	move.l	 0(a0),d0		; d0 = regs.d0
	move.l	 4(a0),d1		; d1 = regs.d1
	move.l	 8(a0),d2		; d2 = regs.d2
	move.l	12(a0),d3		; d3 = regs.d3
	movea.l	20(a0),a1		; a1 = regs.a1
	movea.l	24(a0),a2		; a2 = regs.a2
	movea.l	28(a0),a3		; a3 = regs.a3
	movea.l	16(a0),a0		; a0 = regs.a0 (load LAST — overwrites temp)

	movea.l	 8(a5),a6		; a6 = library base
	move.l	12(a5),d4		; d4 = LVO (signed 32-bit, typically negative)
	jsr	0(a6,d4.l)		; call library function at [a6 + d4]

					; D0 now holds the library function's return

	movem.l	(sp)+,d2-d7/a2-a6	; restore callee-saved
	unlk	a5
	rts

	end
