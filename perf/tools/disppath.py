#!/usr/bin/env python3
"""usage: disppath.py <prof> <funcs> <empty prof>
Per-PC counts inside JS_CallInternal minus the empty-script run; lists how many
instructions are executed once per bytecode dispatch (count == dispatch count)
and the buckets of the rest."""
import sys, json, collections, bisect
prof, funcs, base = sys.argv[1:4]
F = sorted((int(q[1],16), q[2]) for q in (l.split() for l in open(funcs)) if q[0]=='F')
i = [n for _, n in F].index('JS_CallInternal'); lo, hi = F[i][0], F[i+1][0]
def load(p):
    lb = [s['addrs'][0] for s in json.load(open(p+'.segs')) if s['file']=='quickjs.library'][0]
    c = {}
    for l in open(p):
        q = l.split()
        if q[0]=='P':
            pc = int(q[1],16)-lb
            if lo <= pc < hi: c[pc] = int(q[2])
    return c
c = load(prof); b = load(base)
for k in b: c[k] = c.get(k,0)-b[k]
tot = sum(c.values()); mx = max(c.values())
print('JS_CallInternal self (bench only): %d ; max per-PC count: %d' % (tot, mx))
per = [k for k,v in c.items() if v >= mx*0.999]
print('instructions executed on EVERY dispatch (count == max): %d  -> %d instr (%.1f%% of self)' % (len(per), len(per)*mx, 100.0*len(per)*mx/tot))
print('  address span of those: +%x .. +%x' % (min(per), max(per)))
bk = collections.Counter()
for k,v in c.items():
    if v>0: bk[round(v/mx, 2)] += v
print('instr by per-PC count as fraction of dispatch count (top):')
for f, v in sorted(bk.items(), key=lambda x:-x[1])[:10]: print('   x%.2f: %d instr (%.1f%%)' % (f, v, 100.0*v/tot))
