#!/usr/bin/env python3
"""Compact tables for all benchmarks/configs (runs report.py and opclass.py)."""
import subprocess, re, os, sys
L = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = [('soft-O0 native-math', 'softN', '68020', 'nat', 'soft020_O0.funcs'),
       ('soft-O1 native-math', 'softO1', '68020', 'nat', 'soft020_O1.funcs'),
       ('020fpu on 68040', 'fpu', '68040', 'fpu', 'fpu020.funcs')]
B = ['intloop', 'float', 'prop', 'array', 'call', 'strcat', 'alloc', 'regex']
ROWS = [('JS_CallInternal self', ['interp: JS_CallInternal (self)']), ('call glue', ['interp: call glue']),
        ('property/shape/object', ['property/shape lookup']), ('allocator', ['alloc (js_malloc..pool)']),
        ('GC & free', ['GC & free']), ('atoms & strings', ['atoms & strings']),
        ('number helpers', ['number conv/arith helpers']), ('own libc', ['own libc (sharedlib_*.c)']),
        ('int64 helpers', ['int64 helpers']), ('float glue (sharedlib_math)', ['float glue (sharedlib_math*)']),
        ('mathieeedoubbas (68k)', ['mathieeedoubbas.library (native 68k)']), ('regexp engine', ['regexp engine (libregexp.c)']),
        ('other quickjs.c (small helpers)', ['other quickjs.c']), ('OS traps', ['OS traps / vamos stubs'])]
COPY = ['move.l (An)+,(An)+  [struct copy]', 'move.l -(An),-(sp)  [struct pushed as argument]',
        'movem.l d0/d1/a0/a1 <-> mem  [struct return/store]', 'inline memcpy template (byte/word/long loop)']
for name, vm, cpu, tag, fn in CFG:
    print('\n### %s' % name)
    res = {}
    for b in B:
        p = '%s/prof/%s.%s.%s.%s.prof' % (L, vm, cpu, b, tag); e = '%s/prof/%s.%s.empty.%s.prof' % (L, vm, cpu, tag)
        o = subprocess.run(['python3', L+'/tools/report.py', p, L+'/map/'+fn, '--base', e, '--top', '1'], capture_output=True, text=True).stdout
        tot = int(re.search(r'total instructions: (\d+)', o).group(1))
        cats = {m.group(2).strip(): int(m.group(1)) for m in re.finditer(r'%\s+(-?\d+)  (.+)', o.split('-- top')[0])}
        o2 = subprocess.run(['python3', L+'/tools/opclass.py', p, L+'/map/'+fn, '%s/vms/%s/libs/quickjs.library' % (L, vm), '--base', e], capture_output=True, text=True).stdout
        oc = {m.group(2).strip(): int(m.group(1)) for m in re.finditer(r'%\s+(-?\d+)  (.+)', o2)}
        res[b] = (tot, cats, oc)
    print('| | ' + ' | '.join(B) + ' |'); print('|---' * (len(B)+1) + '|')
    print('| instructions (M, minus empty) | ' + ' | '.join('%.1f' % (res[b][0]/1e6) for b in B) + ' |')
    for rn, keys in ROWS:
        print('| %s %% | ' % rn + ' | '.join('%.1f' % (100.0*sum(res[b][1].get(k, 0) for k in keys)/res[b][0]) for b in B) + ' |')
    known = [k for _, ks in ROWS for k in ks]
    print('| everything else % | ' + ' | '.join('%.1f' % (100.0*sum(v for k, v in res[b][1].items() if k not in known)/res[b][0]) for b in B) + ' |')
    for k in COPY:
        print('| opcode: %s %% | ' % k + ' | '.join('%.1f' % (100.0*res[b][2].get(k, 0)/res[b][0]) for b in B) + ' |')
    print('| opcode: sum of the four copy patterns % | ' + ' | '.join('%.1f' % (100.0*sum(res[b][2].get(k, 0) for k in COPY)/res[b][0]) for b in B) + ' |')
    print('| opcode: jsr/bsr + rts % | ' + ' | '.join('%.1f' % (100.0*(res[b][2].get('jsr/bsr', 0)+res[b][2].get('rts/rtd', 0))/res[b][0]) for b in B) + ' |')
