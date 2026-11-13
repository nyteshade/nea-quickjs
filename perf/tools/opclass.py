#!/usr/bin/env python3
"""usage: opclass.py <prof> <funcs> <library file> [--base <empty prof>]
Classify executed instructions inside quickjs.library by opcode pattern, to
measure struct-copy traffic, and count interpreter dispatches (indirect jmp
executions inside JS_CallInternal)."""
import sys, json, struct, collections, bisect
args = sys.argv[1:]; base = None
if '--base' in args: i = args.index('--base'); base = args[i+1]; del args[i:i+2]
prof, funcs, libf = args
d = open(libf, 'rb').read()
w = struct.unpack('>%dI' % (len(d)//4), d[:len(d)//4*4])
assert w[0] == 0x3F3 and w[1] == 0
n = w[2]; p = 5 + n
assert w[p] & 0x3fffffff == 0x3E9
size = w[p+1] * 4; code = d[(p+2)*4:(p+2)*4+size]
F = []
for l in open(funcs):
    q = l.split()
    if q[0] == 'F': F.append((int(q[1], 16), q[2], q[3]))
F.sort(); fa = [a for a, _, _ in F]
# inline memcpy template: move.l a0,d0 / subq.l #4,d2 / bcs / move.l d0,d1 / lsr.l #1,d1 ... dbf d2
tmpl_start = bytes.fromhex('20085982')  # move.l a0,d0 ; subq.l #4,d2
tmpl = set()
i = code.find(tmpl_start)
while i >= 0:
    j = code.find(bytes.fromhex('51ca'), i, i + 80)   # dbf d2
    if j > 0:
        for a in range(i, j + 4, 2): tmpl.add(a)
    i = code.find(tmpl_start, i + 2)
def load(prof):
    segs = json.load(open(prof + '.segs'))
    lb = [s['addrs'][0] for s in segs if s['file'] == 'quickjs.library'][0]
    c = collections.Counter(); tot = 0; disp = collections.Counter()
    for l in open(prof):
        q = l.split()
        if q[0] == 'total': tot = int(q[1])
        if q[0] != 'P': continue
        pc = int(q[1], 16) - lb; k = int(q[2])
        if not (0 <= pc < size): c['outside library'] += k; continue
        op = (code[pc] << 8) | code[pc+1]
        ext = (code[pc+2] << 8) | code[pc+3] if pc + 3 < size else 0
        fn = F[bisect.bisect_right(fa, pc) - 1]
        if pc in tmpl: cls = 'inline memcpy template (byte/word/long loop)'
        elif (op & 0xF1F8) == 0x20D8: cls = 'move.l (An)+,(An)+  [struct copy]'
        elif (op & 0xFFF8) == 0x2F20: cls = 'move.l -(An),-(sp)  [struct pushed as argument]'
        elif (op & 0xFFC0) in (0x48C0, 0x4CC0) and ext == 0x0303: cls = 'movem.l d0/d1/a0/a1 <-> mem  [struct return/store]'
        elif (op & 0xFFC0) in (0x48C0, 0x4CC0) or (op & 0xFFC0) in (0x4880,0x4C80) and (op & 0x38): cls = 'other movem (register save/restore)'
        elif (op & 0xF000) == 0x2000 and (op & 0x38) >= 0x10 and ((op >> 6) & 7) >= 2: cls = 'other move.l mem->mem'
        elif (op & 0xFFC0) == 0x4E80 or (op & 0xFF00) == 0x6100: cls = 'jsr/bsr'
        elif op in (0x4E75, 0x4E74): cls = 'rts/rtd'
        elif (op & 0xFFC0) == 0x4EC0: cls = 'jmp'
        elif (op & 0xF000) == 0x6000 or (op & 0xF0F8) == 0x50C8: cls = 'bra/bcc/dbcc'
        elif (op & 0xF000) in (0x1000, 0x2000, 0x3000): cls = 'other move'
        elif (op & 0xF1C0) == 0x41C0 or (op & 0xFFC0) == 0x4840: cls = 'lea/pea'
        else: cls = 'everything else (arith, cmp, tst, ext, ...)'
        c[cls] += k
        if fn[1] == 'JS_CallInternal' and (op & 0xFFC0) == 0x4EC0 and (op & 0x3F) in (0x3B, 0x10, 0x11, 0x30, 0x31): disp[pc] += k
    return tot, c, disp
tot, c, disp = load(prof)
if base:
    bt, bc, bd = load(base); tot -= bt
    for k in bc: c[k] -= bc[k]
    for k in bd: disp[k] -= bd[k]
print('opclass: %s%s' % (prof.split('/')[-1], ' (minus empty)' if base else ''))
print('total %d' % tot)
for k, v in c.most_common(): print('%6.2f%% %12d  %s' % (100.0*v/tot, v, k))
dd = sum(disp.values())
print('indirect-jmp executions in JS_CallInternal (bytecode dispatches, upper bound): %d over %d sites' % (dd, len([1 for v in disp.values() if v])))
for pc, v in disp.most_common(8): print('   site +%x: %d' % (pc, v))
