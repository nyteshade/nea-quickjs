#!/usr/bin/env python3
"""results.py: table of executed instructions (whole process, vamos/Musashi, lane B's hook)
and (benchmark - empty)/bytecodes.  Bytecode counts are lane B's exact dispatch counts for
the unmodified engine; the patch does not change the bytecode stream."""
import os
L='logs/'
benches=['empty','intloop','float','prop','array','call','intdiv','intops','strcat','alloc','regex']
bc={'intloop':4.20,'float':2.70,'prop':3.20,'array':3.41,'call':2.20,'strcat':2.12,'alloc':2.35}
rows=[('soft -O0 (shipped)','base_O0x'),('  + (b) int / and %','b_O0'),('  + (a1) helper macros','a1_O0'),('  + (a2) int fast paths','a2_O0'),('  + (a2)+(b)','ab_O0'),('  (c) only: pragma opt 1 on the loop','p_O0'),('  + (c)+(a2)+(b)','pab_O0'),
      ('soft -O1 (FPU-style flags)','base_O1x'),('  + (c) pragma opt 1 on the loop','c_O1'),('  + (c)+(a1)','ca1_O1'),('  + (c)+(a2)','ca2_O1'),('  + (c)+(a2)+(b)','cab_O1'),('  (a2)+(b) without (c)','ab_O1')]
def g(n,b):
    try: return int(open(L+'%s.%s.instr'%(n,b)).read().split()[2])
    except Exception: return None
print('Executed instructions, millions (whole process incl. start-up)\n')
print('| build | '+' | '.join(benches)+' |'); print('|---|'+'---|'*len(benches))
for lab,n in rows: print('| %s | '%lab+' | '.join('%.1f'%(g(n,b)/1e6) if g(n,b) else '-' for b in benches)+' |')
print('\nInstructions per bytecode = (benchmark - empty) / bytecodes dispatched\n')
bb=[b for b in benches if b in bc]
print('| build | '+' | '.join(bb)+' |'); print('|---|'+'---|'*len(bb))
for lab,n in rows: print('| %s | '%lab+' | '.join('%.0f'%((g(n,b)-g(n,'empty'))/1e6/bc[b]) for b in bb)+' |')
print('\nBenchmark-only instructions relative to the same configuration unpatched\n')
print('| build | '+' | '.join(benches[1:])+' |'); print('|---|'+'---|'*(len(benches)-1))
for lab,n in rows:
    ref='base_O0x' if n.endswith('O0') or n=='base_O0x' else 'base_O1x'
    print('| %s | '%lab+' | '.join('%.2f'%((g(n,b)-g(n,'empty'))/(g(ref,b)-g(ref,'empty'))) for b in benches[1:])+' |')
