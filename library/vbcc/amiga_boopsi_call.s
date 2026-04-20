; amiga_boopsi_call.s — BOOPSI dispatcher trampoline
;
; IDoMethod on AmigaOS is an inline macro, not a library LVO. It
; reads the object's Class pointer from the 4 bytes immediately
; preceding the exposed object pointer, then calls that Class's
; dispatcher (a struct Hook) via the Hook calling convention:
;
;   A0 = struct Hook *
;   A2 = object pointer
;   A1 = message pointer
;   result in D0
;
; The dispatcher function pointer lives at offset +8 inside struct
; Hook (h_MinNode[8] + h_Entry[4] + h_SubEntry[4] + h_Data[4]).
;
; This stub hands off from VBCC's cdecl stack-args to the Hook
; convention. Called from js_amiga_doMethod in amiga_ffi.c.
;
; Part of Q2 FFI (library 0.137+). Sibling of amiga_ffi_call.s.

    section code

    xdef _qjs_boopsi_dispatch

; ULONG qjs_boopsi_dispatch(struct Hook *hook, APTR obj, APTR msg);
_qjs_boopsi_dispatch:
    link    a5,#0
    movem.l a2-a3,-(sp)         ; callee-saved regs we clobber

    movea.l  8(a5),a0            ; a0 = hook
    movea.l 12(a5),a2            ; a2 = obj
    movea.l 16(a5),a1            ; a1 = msg
    movea.l  8(a0),a3            ; a3 = hook->h_Entry
    jsr     (a3)                  ; dispatch; result stays in D0

    movem.l (sp)+,a2-a3
    unlk    a5
    rts

    end
