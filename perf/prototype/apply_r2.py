#!/usr/bin/env python3
"""apply_r2.py: regenerate tree/quickjs-master/quickjs.c from quickjs.c.orig with the
round-2 prototype edits.  All edits are guarded by R2_* macros; with none defined the
file compiles to the same object as the original (checked by cmp of the library).
  -DR2_TABLE_PRAGMA  (c) '#pragma opt 1' around JS_CallInternal (build must be -O1)
  -DR2_FAST=1        (a1) helper calls inside JS_CallInternal become macros
  -DR2_FAST=2        (a2) + field-wise int32 fast paths for the hot opcodes
  -DR2_DIV           (b) int32 fast paths for / and % (needs R2_FAST>=1 for macros only
                         in the sense that it uses none of them; independent)"""
import re,sys
src=open('quickjs.c.orig').read()
L=src.split('\n')
START=17402; END=20119          # 0-based: 'static JSValue JS_CallInternal(JSContext *caller_ctx' .. its closing '}'
assert L[START].startswith('static JSValue JS_CallInternal(JSContext *caller_ctx') and L[END]=='}'
body=L[START:END+1]
def find(pat,frm=0):
    for i in range(frm,len(body)):
        if body[i] is not None and pat in body[i]: return i
    raise SystemExit('pattern not found: '+pat)

# ---------- (a2) fast-path prefixes, inserted after the CASE label -------------------
def prefix(label, code):
    i=find('CASE(%s):'%label)
    body[i]=body[i]+'\n#if defined(R2_FAST) && R2_FAST >= 2\n'+code.rstrip('\n')+'\n#endif'
II='(((int32_t)sp[-2].tag | (int32_t)sp[-1].tag) == 0)'
prefix('OP_push_7','            if (1) { R2_PUSH_INT(opcode - OP_push_0); BREAK; }')
prefix('OP_push_i8','            if (1) { R2_PUSH_INT((int8_t)pc[0]); pc += 1; BREAK; }')
prefix('OP_push_i16','            if (1) { R2_PUSH_INT(*(const int16_t *)pc); pc += 2; BREAK; }')
prefix('OP_push_i32','            if (1) { R2_PUSH_INT(*(const int32_t *)pc); pc += 4; BREAK; }')
prefix('OP_dup','            if (1) { *sp = sp[-1]; if (R2_HASRC(sp)) R2_REF(sp)++; sp++; BREAK; }')
prefix('OP_push_const8','            if (1) { R2_PUSH_DUP(b->cpool[*pc++]); BREAK; }')
prefix('OP_drop','            if (1) { sp--; R2_FREE(sp); BREAK; }')
prefix('OP_add','''            if (likely(%s)) {
                r2y = (int32_t)((uint32_t)sp[-2].u.int32 + (uint32_t)sp[-1].u.int32);
                if (likely(((sp[-2].u.int32 ^ r2y) & (sp[-1].u.int32 ^ r2y)) >= 0)) {
                    sp[-2].u.int32 = r2y; sp--; BREAK;
                }
            }'''%II)
prefix('OP_sub','''            if (likely(%s)) {
                r2y = (int32_t)((uint32_t)sp[-2].u.int32 - (uint32_t)sp[-1].u.int32);
                if (likely(((sp[-2].u.int32 ^ sp[-1].u.int32) & (sp[-2].u.int32 ^ r2y)) >= 0)) {
                    sp[-2].u.int32 = r2y; sp--; BREAK;
                }
            }'''%II)
prefix('OP_mul','''            if (likely(%s)) {
                char r2ov;
                r2y = r2_mulv(sp[-2].u.int32, sp[-1].u.int32, &r2ov);
                /* overflow and the -0 result stay on the original path */
                if (likely(!r2ov && (r2y != 0 || (sp[-2].u.int32 | sp[-1].u.int32) >= 0))) {
                    sp[-2].u.int32 = r2y; sp--; BREAK;
                }
            }'''%II)
prefix('OP_add_loc','''            if (1) {
                r2p = &var_buf[pc[0]];
                if (likely(((int32_t)r2p->tag | (int32_t)sp[-1].tag) == 0)) {
                    r2y = (int32_t)((uint32_t)r2p->u.int32 + (uint32_t)sp[-1].u.int32);
                    if (likely(((r2p->u.int32 ^ r2y) & (sp[-1].u.int32 ^ r2y)) >= 0)) {
                        r2p->u.int32 = r2y; sp--; pc += 1; BREAK;
                    }
                }
            }''')
for op,cond,expr in (('OP_inc_loc','!= INT32_MAX','+ 1'),('OP_dec_loc','!= INT32_MIN','- 1')):
    prefix(op,'''            if (1) {
                r2p = &var_buf[pc[0]];
                if (likely((int32_t)r2p->tag == JS_TAG_INT && r2p->u.int32 %s)) {
                    r2p->u.int32 = r2p->u.int32 %s; pc += 1; BREAK;
                }
            }'''%(cond,expr))
for op,cond,expr in (('OP_inc','!= INT32_MAX','+ 1'),('OP_dec','!= INT32_MIN','- 1')):
    prefix(op,'''            if (likely((int32_t)sp[-1].tag == JS_TAG_INT && sp[-1].u.int32 %s)) {
                sp[-1].u.int32 = sp[-1].u.int32 %s; BREAK;
            }'''%(cond,expr))
for op,cond,expr in (('OP_post_inc','!= INT32_MAX','+ 1'),('OP_post_dec','!= INT32_MIN','- 1')):
    prefix(op,'''            if (likely((int32_t)sp[-1].tag == JS_TAG_INT && sp[-1].u.int32 %s)) {
                R2_PUSH_INT(sp[-1].u.int32 %s); BREAK;
            }'''%(cond,expr))
prefix('OP_neg','''            if (likely((int32_t)sp[-1].tag == JS_TAG_INT && sp[-1].u.int32 != 0 && sp[-1].u.int32 != INT32_MIN)) {
                sp[-1].u.int32 = -sp[-1].u.int32; BREAK;
            }''')
prefix('OP_shl','            if (likely(%s)) { sp[-2].u.int32 = (int32_t)((uint32_t)sp[-2].u.int32 << (sp[-1].u.int32 & 0x1f)); sp--; BREAK; }'%II)
prefix('OP_sar','            if (likely(%s)) { sp[-2].u.int32 = sp[-2].u.int32 >> (sp[-1].u.int32 & 0x1f); sp--; BREAK; }'%II)
for op,c in (('OP_and','&'),('OP_or','|'),('OP_xor','^')):
    prefix(op,'            if (likely(%s)) { sp[-2].u.int32 %s= sp[-1].u.int32; sp--; BREAK; }'%(II,c))
for op,neg,d in (('OP_if_true8','',1),('OP_if_false8','!',1)):
    prefix(op,'''            if (likely((uint32_t)(int32_t)sp[-1].tag <= JS_TAG_UNDEFINED)) {
                sp--;
                if (%ssp->u.int32) pc += (int8_t)pc[0]; else pc += 1;
                if (unlikely(js_poll_interrupts(ctx)))
                    goto exception;
                BREAK;
            }'''%neg)
for op in ('OP_get_loc_check',):
    prefix(op,'''            if (1) {
                r2p = &var_buf[*(const uint16_t *)pc];
                if (likely((int32_t)r2p->tag != JS_TAG_UNINITIALIZED)) {
                    pc += 2; *sp = *r2p; if (R2_HASRC(sp)) R2_REF(sp)++; sp++; BREAK;
                }
            }''')
prefix('OP_put_loc_check','''            if (1) {
                r2p = &var_buf[*(const uint16_t *)pc];
                if (likely((int32_t)r2p->tag != JS_TAG_UNINITIALIZED)) {
                    pc += 2; sp--;
                    if (R2_HASRC(r2p)) { JSValue r2o_ = *r2p; *r2p = *sp; if (--R2_REF(&r2o_) <= 0) js_free_value_rt(rt, r2o_); }
                    else *r2p = *sp;
                    BREAK;
                }
            }''')
# own-property hit / fast-array element: pointer based, no JSValue copies through locals
R2OBJFREE='if (unlikely(--((JSRefCountHeader *)r2o)->ref_count <= 0)) js_free_value_rt(rt, JS_MKPTR(JS_TAG_OBJECT, r2o));'
prefix('OP_get_field','''            if (likely((int32_t)sp[-1].tag == JS_TAG_OBJECT)) {
                JSObject *r2o = (JSObject *)sp[-1].u.ptr;
                JSProperty *r2pr;
                JSShapeProperty *r2prs = find_own_property(&r2pr, r2o, *(const uint32_t *)pc);
                if (likely(r2prs && !(r2prs->flags & JS_PROP_TMASK))) {
                    pc += 4;
                    r2p = &r2pr->u.value;
                    sp[-1] = *r2p;
                    if (R2_HASRC(r2p)) R2_REF(r2p)++;
                    %s
                    BREAK;
                }
            }'''%R2OBJFREE)
prefix('OP_put_field','''            if (likely((int32_t)sp[-2].tag == JS_TAG_OBJECT)) {
                JSObject *r2o = (JSObject *)sp[-2].u.ptr;
                JSProperty *r2pr;
                JSShapeProperty *r2prs = find_own_property(&r2pr, r2o, *(const uint32_t *)pc);
                if (likely(r2prs && (r2prs->flags & (JS_PROP_TMASK | JS_PROP_WRITABLE |
                                                     JS_PROP_LENGTH)) == JS_PROP_WRITABLE)) {
                    pc += 4;
                    R2_SET(&r2pr->u.value, sp - 1);
                    sp -= 2;
                    %s
                    BREAK;
                }
            }'''%R2OBJFREE)
prefix('OP_get_array_el','''            if (likely((int32_t)sp[-2].tag == JS_TAG_OBJECT && (int32_t)sp[-1].tag == JS_TAG_INT)) {
                JSObject *r2o = (JSObject *)sp[-2].u.ptr;
                /* same test as the fast path of OP_put_array_el below */
                if (likely(r2o->ob1.hflags.class_id == JS_CLASS_ARRAY &&
                           (uint32_t)sp[-1].u.int32 < (uint32_t)r2o->u.array.count)) {
                    r2p = &r2o->u.array.u.values[(uint32_t)sp[-1].u.int32];
                    sp--;
                    sp[-1] = *r2p;
                    if (R2_HASRC(r2p)) R2_REF(r2p)++;
                    %s
                    BREAK;
                }
            }'''%R2OBJFREE)
# OP_CMP macro: field-wise result, no operand copies
i=find('#define OP_CMP(opcode, binary_op, slow_call)')
j=find('            BREAK',i)
orig='\n'.join(body[i:j+1])
new='''#define OP_CMP(opcode, binary_op, slow_call)              \\
            CASE(opcode):                                 \\
                if (likely(%s)) {                         \\
                    sp[-2].u.int32 = (sp[-2].u.int32 binary_op sp[-1].u.int32); \\
                    sp[-2].tag = JS_TAG_BOOL;             \\
                    sp--;                                 \\
                } else {                                  \\
                    sf->cur_pc = pc;                      \\
                    if (slow_call)                        \\
                        goto exception;                   \\
                    sp--;                                 \\
                }                                         \\
            BREAK'''%II
body[i:j+1]=['#if defined(R2_FAST) && R2_FAST >= 2',new,'#else',orig,'#endif']

# ---------- (a2) one-line get/put/set families -> macros with original fallbacks -------
n1=n2=n3=0
for k,l in enumerate(body):
    m=re.match(r'(\s+CASE\(OP_\w+\): )\*sp\+\+ = js_dup\((.+)\); BREAK;$',l)
    if m: body[k]='%sR2_PUSH_DUP(%s); BREAK;'%(m.group(1),m.group(2)); n1+=1; continue
    m=re.match(r'(\s+CASE\(OP_\w+\): )set_value\(ctx, (.+), \*--sp\); BREAK;$',l)
    if m: body[k]='%sR2_SET_POP(%s); BREAK;'%(m.group(1),m.group(2)); n2+=1; continue
    m=re.match(r'(\s+CASE\(OP_\w+\): )set_value\(ctx, (.+), js_dup\(sp\[-1\]\)\); BREAK;$',l)
    if m: body[k]='%sR2_SET_DUP(%s); BREAK;'%(m.group(1),m.group(2)); n3+=1; continue
print('one-liners rewritten: push_dup %d, set_pop %d, set_dup %d'%(n1,n2,n3))
def blockform(op, pat, tail, mac):
    i=find('CASE(%s):'%op); j=find(pat,i); assert j-i<8
    m=re.match(r'(\s+)'+re.escape(pat)+r'(.+?)'+re.escape(tail)+'$',body[j]); assert m, body[j]
    nxt=body[j+1].strip() in ('sp++;','sp--;')
    orig=body[j]+('\n'+body[j+1] if nxt else '')
    body[j]='#ifdef R2_FAST\n%s%s(%s);\n#else\n%s\n#endif'%(m.group(1),mac,m.group(2),orig)
    if nxt: body[j+1]=None
for op in ('OP_get_loc','OP_get_arg'): blockform(op,'sp[0] = js_dup(',');','R2_PUSH_DUP')
for op in ('OP_put_loc','OP_put_arg'): blockform(op,'set_value(ctx, ',', sp[-1]);','R2_SET_POP')
for op in ('OP_set_loc','OP_set_arg'): blockform(op,'set_value(ctx, ',', js_dup(sp[-1]));','R2_SET_DUP')
body=[x for x in body if x is not None]

# ---------- (b) integer / and % ---------------------------------------------------------
def prefix_b(label, code):
    i=find('CASE(%s):'%label)
    body[i]=body[i]+'\n#ifdef R2_DIV\n'+code+'\n#endif'
prefix_b('OP_div','''            /* two int32: exact quotient stays an int32.  Excluded (original path):
               divisor 0, INT32_MIN / -1, inexact results, and 0 / negative (= -0). */
            if (likely(%s)) {
                int32_t r2a = sp[-2].u.int32, r2b = sp[-1].u.int32;
                if (likely(r2b != 0 && !(r2b == -1 && r2a == INT32_MIN) &&
                           (r2a != 0 || r2b > 0))) {
                    int32_t r2q = r2a / r2b;
                    if (likely(r2q * r2b == r2a)) {
                        sp[-2].u.int32 = r2q; sp--; BREAK;
                    }
                }
            }'''%II)
prefix_b('OP_mod','''            /* two int32, any signs: C truncating remainder has the sign of the dividend
               like JS.  Excluded: divisor 0 and -1, and a zero result with a negative
               dividend (= -0). */
            if (likely(%s)) {
                int32_t r2a = sp[-2].u.int32, r2b = sp[-1].u.int32;
                if (likely(r2b != 0 && r2b != -1)) {
                    int32_t r2r = r2a %% r2b;
                    if (likely(r2r != 0 || r2a >= 0)) {
                        sp[-2].u.int32 = r2r; sp--; BREAK;
                    }
                }
            }'''%II)

# ---------- BREAK: 'break' leaves the switch and needs a second branch to the loop top ----
i=find('#define BREAK           break')
body[i]="""#if defined(R2_FAST) && R2_FAST >= 2
/* same target as break (nothing follows the switch inside for(;;)), one branch less */
#define BREAK           continue
#else
#define BREAK           break
#endif"""
# ---------- register priming (only matters under '#pragma opt 1') -------------------------
i=find(' restart:')
body[i]="""#ifdef R2_FAST
    /* vbcc -O=1 gives registers to the scalars with the highest use count, each use
       weighted 10x per enclosing loop.  These dead self-assignments in nested
       do/while(0) only raise the weight of opcode and the scratch variable (and var_buf) so that
       they are kept in d6/d7 (and an address register).  A few instructions per call. */
    do { do { do { do { R2_PRIME } while (0); } while (0); } while (0); } while (0);
#endif
"""+body[i]
# ---------- locals for the comma-expression helper macros --------------------------------
i=find('    size_t alloca_size;')
body[i]+="""
#ifdef R2_FAST
    /* in a struct on purpose: under "#pragma opt 1" registers go to the most-used
       scalars, and a scalar scratch pointer used by every js_dup() would take the
       register away from pc */
    struct { JSValue v; JSValue *p; } r2s;
    /* scalars on purpose: used by every fast path so that they win registers */
    JSValue *r2p;
    int32_t r2y;
#endif"""

pre='''#ifdef R2_TABLE_PRAGMA
/* r2(c): compile only the interpreter loop without the optimizer pass that splits the
   opcode switch into five range tables.  #pragma lines are not macro-expanded. */
#pragma opt 1
#endif
#ifdef R2_FAST
/* r2(a): inside JS_CallInternal the tiny helpers are macros.  Statement macros use
   'if (1) {...} else (void)0', not do/while: vbcc's -O=1 register allocator weights
   every use by 10 per enclosing loop, do/while(0) included, and the macro temporaries
   then take the address registers away from pc.  vbcc -O0/-O1 does not
   inline, and every by-value JSValue argument costs a 16-byte byte-loop push. */
static int32_t r2_mulv(__reg("d0") int32_t a, __reg("d1") int32_t b, __reg("a0") char *ov) =
    "\\tmuls.l\\td1,d0\\n\\tsvs\\t(a0)\\n";
#ifdef R2_PRIME_VARBUF
#define R2_PRIME opcode = 0; r2y = opcode; opcode = r2y; r2y = opcode; var_buf = var_buf;
#else
#define R2_PRIME opcode = 0; r2y = opcode; opcode = r2y; r2y = opcode;
#endif
#define R2_HASRC(pv) ((uint32_t)(int32_t)(pv)->tag >= (uint32_t)JS_TAG_FIRST)
#define R2_REF(pv)   (((JSRefCountHeader *)(pv)->u.ptr)->ref_count)
#define R2_FREE(pv)  if (1) { if (R2_HASRC(pv) && --R2_REF(pv) <= 0) js_free_value_rt(rt, *(pv)); } else (void)0
#define R2_PUSH_INT(x) if (1) { sp->u.int32 = (x); sp->tag = JS_TAG_INT; sp++; } else (void)0
#define R2_PUSH_DUP(src) if (1) { r2p = (JSValue *)&(src); *sp = *r2p; if (R2_HASRC(sp)) R2_REF(sp)++; sp++; } else (void)0
#define R2_SET(dst, srcp) if (1) { r2p = (dst); \\
        if (R2_HASRC(r2p)) { JSValue r2o_ = *r2p; *r2p = *(srcp); if (--R2_REF(&r2o_) <= 0) js_free_value_rt(rt, r2o_); } \\
        else *r2p = *(srcp); } else (void)0
#define R2_SET_POP(dst) if (1) { sp--; R2_SET(dst, sp); } else (void)0
#define R2_SET_DUP(dst) if (1) { if (R2_HASRC(sp - 1)) R2_REF(sp - 1)++; R2_SET(dst, sp - 1); } else (void)0
#define get_u16(p) (*(const uint16_t *)(p))
#define get_i16(p) (*(const int16_t *)(p))
#define get_u32(p) (*(const uint32_t *)(p))
#define js_poll_interrupts(c) (unlikely(--(c)->interrupt_counter <= 0) && __js_poll_interrupts(c))
#define JS_IsException(v)     (JS_VALUE_GET_TAG(v) == JS_TAG_EXCEPTION)
#define JS_IsUninitialized(v) (JS_VALUE_GET_TAG(v) == JS_TAG_UNINITIALIZED)
#define JS_IsUndefined(v)     (JS_VALUE_GET_TAG(v) == JS_TAG_UNDEFINED)
#define JS_IsNull(v)          (JS_VALUE_GET_TAG(v) == JS_TAG_NULL)
#define JS_IsObject(v)        (JS_VALUE_GET_TAG(v) == JS_TAG_OBJECT)
#define js_int32(x) (r2s.v.u.int32 = (x), r2s.v.tag = JS_TAG_INT, r2s.v)
#define js_bool(x)  (r2s.v.u.int32 = ((x) != 0), r2s.v.tag = JS_TAG_BOOL, r2s.v)
#define js_dup(v)   (r2s.p = (JSValue *)&(v), (void)(R2_HASRC(r2s.p) ? R2_REF(r2s.p)++ : 0), *r2s.p)
#define JS_FreeValue(ctx, v) if (1) { r2p = (JSValue *)&(v); R2_FREE(r2p); } else (void)0
#define set_value(ctx, pval, nv) if (1) { JSValue r2so_; r2p = (pval); r2so_ = *r2p; *r2p = (nv); R2_FREE(&r2so_); } else (void)0
#else
#define R2_PUSH_DUP(src) (*sp++ = js_dup(src))
#define R2_SET_POP(dst)  set_value(ctx, dst, *--sp)
#define R2_SET_DUP(dst)  set_value(ctx, dst, js_dup(sp[-1]))
#endif'''
post='''#undef R2_PUSH_DUP
#undef R2_SET_POP
#undef R2_SET_DUP
#ifdef R2_FAST
#undef get_u16
#undef get_i16
#undef get_u32
#undef js_poll_interrupts
#undef JS_IsException
#undef JS_IsUninitialized
#undef JS_IsUndefined
#undef JS_IsNull
#undef JS_IsObject
#undef js_int32
#undef js_bool
#undef js_dup
#undef JS_FreeValue
#undef set_value
#endif
#ifdef R2_TABLE_PRAGMA
#if R2_TABLE_PRAGMA == 0
/* file built with -O0: back to -O=0 */
#pragma opt 0
#else
/* back to what "vc -O1" passes (-O=991) */
#pragma opt 991
#endif
#endif'''
out=L[:START]+[pre]+body+[post]+L[END+1:]
open('tree/quickjs-master/quickjs.c','w').write('\n'.join(out))
