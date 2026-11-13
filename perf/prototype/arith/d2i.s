	idnt	"d2i.c"
	machine	68020
	opt o+,ol+,op+,oc+,ot+,oj+,ob+,om+
	section	"CODE",code
	public	_d2i_bits
	cnop	0,4
_d2i_bits
	subq.w	#4,a7
	movem.l	l11,-(a7)
	moveq	#20,d6
	move.l	(8+l13,a7),a1
	move.l	(a1),d4
	move.l	(4,a1),(0+l13,a7)
	moveq	#20,d1
	move.l	d4,d0
	lsr.l	d1,d0
	and.l	#2047,d0
	move.l	d0,d2
	sub.l	#1023,d2
	bge	l4
	moveq	#0,d0
	bra	l1
l4
	move.l	#1048575,d0
	and.l	d4,d0
	move.l	#1048576,d5
	or.l	d0,d5
	cmp.l	d2,d6
	blt	l6
	move.l	d6,d0
	sub.l	d2,d0
	move.l	d5,d3
	lsr.l	d0,d3
	bra	l7
l6
	move.l	d2,d1
	sub.l	d6,d1
	move.l	d5,d0
	lsl.l	d1,d0
	move.l	d0,d1
	moveq	#52,d0
	sub.l	d2,d0
	move.l	(0+l13,a7),d7
	lsr.l	d0,d7
	move.l	d7,d0
	move.l	d0,d3
	or.l	d1,d3
l7
	tst.l	d4
	bge	l9
	move.l	d3,d0
	neg.l	d0
	bra	l10
l9
	move.l	d3,d0
l10
l1
l11	reg	d2/d3/d4/d5/d6/d7
	movem.l	(a7)+,d2/d3/d4/d5/d6/d7
l13	equ	24
	addq.w	#4,a7
	rts
; stacksize=28
	machine	68020
	opt o+,ol+,op+,oc+,ot+,oj+,ob+,om+
	public	_dbl_is_i32
	cnop	0,4
_dbl_is_i32
	movem.l	l36,-(a7)
	moveq	#20,d6
	move.l	(4+l38,a7),a2
	move.l	(8+l38,a7),a1
	move.l	(a2),d5
	move.l	(4,a2),d4
	moveq	#20,d1
	move.l	d5,d0
	lsr.l	d1,d0
	and.l	#2047,d0
	move.l	d0,d2
	sub.l	#1023,d2
	bge	l17
	move.l	d4,d0
	or.l	d5,d0
	bne	l19
	move.l	#0,(a1)
	moveq	#1,d0
	bra	l14
l19
	moveq	#0,d0
	bra	l14
l17
	moveq	#30,d1
	cmp.l	d2,d1
	bge	l21
	cmp.l	#3252682752,d5
	bne	l23
	tst.l	d4
	bne	l23
	move.l	#-2147483648,(a1)
	moveq	#1,d0
	bra	l14
l23
	moveq	#0,d0
	bra	l14
l21
	move.l	#1048575,d0
	and.l	d5,d0
	move.l	#1048576,d3
	or.l	d0,d3
	cmp.l	d2,d6
	blt	l26
	tst.l	d4
	bne	l27
	moveq	#12,d0
	add.l	d2,d0
	move.l	d3,d1
	lsl.l	d0,d1
	move.l	d1,d0
	beq	l28
l27
	moveq	#0,d0
	bra	l14
l28
	move.l	d6,d0
	sub.l	d2,d0
	lsr.l	d0,d3
	bra	l30
l26
	move.l	d2,d0
	sub.l	d6,d0
	move.l	d4,d1
	lsl.l	d0,d1
	move.l	d1,d0
	beq	l32
	moveq	#0,d0
	bra	l14
l32
	move.l	d2,d1
	sub.l	d6,d1
	move.l	d3,d0
	lsl.l	d1,d0
	move.l	d0,d1
	moveq	#52,d0
	sub.l	d2,d0
	move.l	d4,d7
	lsr.l	d0,d7
	move.l	d7,d0
	move.l	d0,d3
	or.l	d1,d3
l30
	tst.l	d5
	bge	l34
	move.l	d3,d0
	neg.l	d0
	bra	l35
l34
	move.l	d3,d0
l35
	move.l	d0,(a1)
	moveq	#1,d0
l14
l36	reg	a2/d2/d3/d4/d5/d6/d7
	movem.l	(a7)+,a2/d2/d3/d4/d5/d6/d7
l38	equ	28
	rts
; stacksize=28
