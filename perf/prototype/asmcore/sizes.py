import re,sys
# per-handler: instructions and bytes from label to the first jmp (hot path incl. dispatch tail)
lines=open(sys.argv[1]).read().split('\n')
cur=None;res={};order=[]
src=open(sys.argv[2]).read().split('\n')
labline={}
for i,l in enumerate(src,1):
    m=re.match(r'(op_\w+):',l)
    if m: labline[i]=m.group(1)
done=set()
for l in lines:
    m=re.match(r'[0-9A-F]{2}:([0-9A-F]{8}) ([0-9A-F]+)\s+(\d+):\s*(.*)',l)
    if not m: continue
    addr=int(m.group(1),16);nbytes=len(m.group(2))//2;ln=int(m.group(3));txt=m.group(4)
    # find latest label line <= ln
    labs=[k for k in labline if k<=ln]
    if not labs: continue
    lab=labline[max(labs)]
    if lab in done: continue
    r=res.setdefault(lab,[0,0]);
    if lab not in order: order.append(lab)
    if re.match(r'\s*(move|jmp|lea|cmp|bcc|bls|bcs|bne|bvs|blt|bgt|ble|bra|add|sub|or|clr|tst|ext|slt|neg|moveq|lsl)',txt):
        r[0]+=1
    r[1]+=nbytes
    if 'jmp' in txt: done.add(lab)
for lab in order: print('%-18s straight-line to first NEXT: %2d instr, %3d bytes'%(lab,res[lab][0],res[lab][1]))
