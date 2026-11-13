; core_v16.s -- DESIGN SKETCH (assembles with vasm, NOT run): hand-written fast path
; for the bytecode interpreter using TODAY'S value layout:
;   JSValue = 16 bytes, big-endian:  +0 u.int32 / u.ptr (first long of the 8-byte union)
;                                    +4 second long of the union (low half of a double)
;                                    +8 tag high long   +12 tag low long
;   JS_TAG_INT=0 BOOL=1 NULL=2 UNDEFINED=3 ... FLOAT64=8 ; refcounted tags are >= -9 unsigned
;
; Register plan (all callee-saved in the vbcc ABI, so C helpers can be called freely):
;   a2 = pc   (bytecode pointer)          a3 = sp (JS value stack, grows upward)
;   a4 = var_buf                          a5 = arg_buf
;   a6 = handler table (256 longs)        d7 = opcode, bits 8-31 always 0
;   d6 = interrupt countdown (cached)     d5 = JS_TAG_FIRST (-9) for the refcount test
;   a7 = C stack; frame holds ctx, sf, b, var_refs for the C fallback
;
; Any case the asm does not handle exits to the C switch through `fallback`, which stores
; pc/sp back into the frame and re-enters the existing C loop for ONE opcode (or until
; the next hot opcode).  So correctness of rare paths stays with the upstream C.

        machine 68020

; ---- dispatch tail, replicated at the end of every handler (threaded) -------------
NEXT    macro
        move.b  (a2)+,d7                ; fetch opcode            1 read
        move.l  (a6,d7.w*4),a0          ; handler address         1 read
        jmp     (a0)
        endm
; 68060 variant of the tail (one instruction shorter, memory-indirect EA):
NEXT060 macro
        move.b  (a2)+,d7
        jmp     ([a6,d7.w*4])
        endm

        section code

; OP_get_loc0 : *sp++ = js_dup(var_buf[0])
op_get_loc0:
        move.l  a4,a0
copy_push:                              ; shared by get_loc1..3 / get_arg0..3 via lea n*16(aX),a0
        move.l  (a0)+,(a3)+
        move.l  (a0)+,(a3)+
        move.l  (a0)+,(a3)+
        move.l  (a0),d0                 ; tag low
        move.l  d0,(a3)+
        cmp.l   d5,d0                   ; refcounted?
        bcc.s   dup_ref
        NEXT
dup_ref:
        move.l  -16(a3),a0
        addq.l  #1,(a0)                 ; ref_count is the first field of the header
        NEXT

; OP_get_loc8 idx8
op_get_loc8:
        moveq   #0,d0
        move.b  (a2)+,d0
        lsl.w   #4,d0
        lea     (a4,d0.w),a0
        bra.s   copy_push               ; (or replicate the 9-instruction body)

; OP_put_loc8 idx8 : set_value(ctx, &var_buf[idx], sp[-1]); sp--
op_put_loc8:
        moveq   #0,d0
        move.b  (a2)+,d0
        lsl.w   #4,d0
        lea     (a4,d0.w),a0
        cmp.l   12(a0),d5               ; old value refcounted?
        bls.s   put_slow                ; yes -> C helper frees it (rare for numbers)
        lea     -16(a3),a3
        move.l  a3,a1
        move.l  (a1)+,(a0)+
        move.l  (a1)+,(a0)+
        move.l  (a1)+,(a0)+
        move.l  (a1),(a0)
        NEXT
put_slow:
        bra     fallback_rewind2        ; re-execute this opcode in C (pc -= 2)

; OP_push_i32 imm32
op_push_i32:
        move.l  (a2)+,(a3)+             ; bytecode is unaligned: fine on 68020+
        clr.l   (a3)+
        clr.l   (a3)+                   ; tag = JS_TAG_INT (0)
        clr.l   (a3)+
        NEXT

; OP_add : int + int, no overflow.  Everything else -> C.
op_add:
        move.l  -4(a3),d0               ; tag.lo(b)
        or.l    -20(a3),d0              ; | tag.lo(a)   (JS_TAG_INT == 0)
        bne.s   add_slow
        move.l  -32(a3),d0
        add.l   -16(a3),d0
        bvs.s   add_slow                ; overflow -> C makes a double
        move.l  d0,-32(a3)
        lea     -16(a3),a3
        NEXT
add_slow:
        bra     fallback_rewind1

; OP_lt : int < int -> bool
op_lt:
        move.l  -4(a3),d0
        or.l    -20(a3),d0
        bne.s   lt_slow
        lea     -16(a3),a3
        move.l  -16(a3),d0
        cmp.l   (a3),d0
        slt     d0
        neg.b   d0                      ; 0 / 1
        extb.l  d0
        move.l  d0,-16(a3)
        moveq   #1,d0                   ; JS_TAG_BOOL
        move.l  d0,-4(a3)
        NEXT
lt_slow:
        bra     fallback_rewind1

; OP_if_false8 rel8
op_if_false8:
        lea     -16(a3),a3
        moveq   #3,d0
        cmp.l   12(a3),d0               ; tag <= JS_TAG_UNDEFINED : value is its int32
        bcs.s   iff_slow
        tst.l   (a3)
        bne.s   iff_stay
        move.b  (a2),d0
        ext.w   d0
        add.w   d0,a2                   ; adda.w sign-extends: pc += (int8)pc[0]
        subq.l  #1,d6
        ble.s   do_poll
        NEXT
iff_stay:
        addq.l  #1,a2
        subq.l  #1,d6
        ble.s   do_poll
        NEXT
iff_slow:
        lea     16(a3),a3
        bra     fallback_rewind1

; SUPERINSTRUCTION  lt + if_false8 (new opcode OP_lt_if_false8 rel8, emitted by the
; bytecode peephole in resolve_labels): no boolean is materialised.
op_lt_if_false8:
        move.l  -4(a3),d0
        or.l    -20(a3),d0
        bne.s   ltif_slow
        lea     -32(a3),a3
        move.l  (a3),d0
        cmp.l   16(a3),d0
        blt.s   ltif_stay
        move.b  (a2),d0
        ext.w   d0
        add.w   d0,a2
        subq.l  #1,d6
        ble.s   do_poll
        NEXT
ltif_stay:
        addq.l  #1,a2
        NEXT
ltif_slow:
        bra     fallback_rewind1

; ---- exits to C --------------------------------------------------------------------
do_poll:        bra     fallback        ; C: __js_poll_interrupts, reload d6
fallback_rewind2:
        subq.l  #1,a2
fallback_rewind1:
        subq.l  #1,a2
fallback:
        ; store pc/sp into the frame, call the C single-step, reload, NEXT.
        rts
