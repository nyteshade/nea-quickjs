; core_v8.s -- same handlers for a COMPACT 8-byte JSValue: +0 tag (32 bit), +4 payload
; (int32 / pointer; doubles NaN-boxed across both longs with 32-bit maths on the tag
; long only).  DESIGN SKETCH, assembles, not run.  Registers as in core_v16.s.
        machine 68020
NEXT    macro
        move.b  (a2)+,d7
        move.l  (a6,d7.w*4),a0
        jmp     (a0)
        endm
        section code
op_get_loc0:
        move.l  (a4),d0                 ; tag
        move.l  d0,(a3)+
        move.l  4(a4),(a3)+
        cmp.l   d5,d0
        bcc.s   dup_ref
        NEXT
dup_ref:
        move.l  -4(a3),a0
        addq.l  #1,(a0)
        NEXT
op_get_loc8:
        moveq   #0,d0
        move.b  (a2)+,d0
        lea     (a4,d0.w*8),a0
        move.l  (a0)+,d0
        move.l  d0,(a3)+
        move.l  (a0),(a3)+
        cmp.l   d5,d0
        bcc.s   dup_ref
        NEXT
op_put_loc8:
        moveq   #0,d0
        move.b  (a2)+,d0
        lea     (a4,d0.w*8),a0
        cmp.l   (a0),d5
        bls.s   put_slow
        move.l  -(a3),4(a0)
        move.l  -(a3),(a0)
        NEXT
put_slow:
        bra     fallback_rewind2
op_push_i32:
        clr.l   (a3)+
        move.l  (a2)+,(a3)+
        NEXT
op_add:
        move.l  -8(a3),d0
        or.l    -16(a3),d0
        bne.s   add_slow
        move.l  -12(a3),d0
        add.l   -4(a3),d0
        bvs.s   add_slow
        move.l  d0,-12(a3)
        subq.l  #8,a3
        NEXT
add_slow:
        bra     fallback_rewind1
op_lt_if_false8:
        move.l  -8(a3),d0
        or.l    -16(a3),d0
        bne.s   ltif_slow
        move.l  -(a3),d0                ; b
        subq.l  #8,a3
        cmp.l   -4(a3),d0               ; b - a
        subq.l  #4,a3                   ; (flags unaffected by subq to An)
        bgt.s   ltif_stay               ; a < b
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
do_poll:        bra     fallback
fallback_rewind2:
        subq.l  #1,a2
fallback_rewind1:
        subq.l  #1,a2
fallback:
        rts
