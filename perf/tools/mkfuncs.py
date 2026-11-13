#!/usr/bin/env python3
"""Build a function table (code-hunk offset -> name, source file) for a linked
quickjs.library from its vlink map plus per-source `vc -S` and `vc -S -g`
listings (static functions are anonymous lN labels; -g gives their line).
usage: mkfuncs.py <map> <asmdir> <treeroot> <out>
asmdir holds <base>.s and <base>.g.s for each C source."""
import sys, re, os, bisect
mapf, asmdir, tree, out = sys.argv[1:5]

# ---- parse map
files = []   # (start, end, path)
syms = []    # (addr, name)
insyms = False
for line in open(mapf, errors='replace'):
    m = re.match(r'\s+([0-9a-f]{8}) - ([0-9a-f]{8}) (\S+)\((CODE|code)\)', line)
    if m and not insyms:
        files.append((int(m.group(1), 16), int(m.group(2), 16), m.group(3)))
        continue
    if line.startswith('Symbols of CODE'):
        insyms = True; continue
    if line.startswith('Symbols of'):
        insyms = False; continue
    if insyms:
        m = re.match(r'\s+0x([0-9a-f]+) (\S+): (\w+)', line)
        if m: syms.append((int(m.group(1), 16), m.group(2), m.group(3)))
files.sort()
def file_of(addr):
    for s, e, p in files:
        if s <= addr < e: return p
    return None

def parse_s(path):
    """return ordered list of function entry labels in code section"""
    ents = []
    lines = open(path, errors='replace').read().split('\n')
    sect = 'code'; cursrc = None
    i = 0
    n = len(lines)
    while i < n:
        l = lines[i]
        m = re.match(r'\s+section\s+"(\w+)"', l)
        if m: sect = m.group(1).lower()
        if sect == 'code' and re.match(r'\s+cnop\s+0,4', l):
            j = i + 1
            if j < n and re.match(r'^[A-Za-z_]\w*:?\s*$', lines[j]):
                lab = lines[j].strip().rstrip(':')
                # next non-label line must be an instruction, not data
                k = j + 1
                while k < n and (re.match(r'^[A-Za-z_]\w*:?\s*$', lines[k]) or re.match(r'\s+(dsource|debug|symdebug)', lines[k])): k += 1
                if k < n and not re.match(r'\s+(dc\.|ds\.|dcb|cnop|section|public)', lines[k]):
                    # find first debug line number after entry (for -g listing)
                    dbg = None
                    for q in range(j, min(n, j + 40)):
                        mm = re.match(r'\s+dsource\s+"(.*)"', lines[q])
                        if mm: cursrc = mm.group(1)
                        mm = re.match(r'\s+debug\s+(\d+)', lines[q])
                        if mm: dbg = (cursrc, int(mm.group(1))); break
                        if q > j and re.match(r'\s+cnop\s+0,4', lines[q]): break
                    ents.append((lab, dbg))
        i += 1
    return ents

_srccache = {}
def name_at(_unused, dbg):
    path, line = dbg
    sp = os.path.normpath(os.path.join(tree, 'library/vbcc', path)) if not os.path.isabs(path) else path
    if sp not in _srccache:
        _srccache[sp] = open(sp, errors='replace').read().split('\n') if os.path.exists(sp) else None
    srclines = _srccache[sp]
    if srclines is None: return None
    i = min(line, len(srclines)) - 1
    while i >= 0 and not (srclines[i].startswith('{') or re.match(r'^[A-Za-z_].*\{\s*$', srclines[i])): i -= 1
    j = i if not srclines[i].startswith('{') else i - 1
    hdr = ''
    while j >= 0 and i - j < 12:
        hdr = srclines[j] + ' ' + hdr
        if re.match(r'^[A-Za-z_]', srclines[j]) and '(' in hdr: break
        j -= 1
    m = re.search(r'([A-Za-z_]\w*)\s*\(', hdr)
    return m.group(1) if m else None

res = []  # (addr, name, file)
bad = []
stats = []
for s, e, p in files:
    base = os.path.basename(p)
    stem = base.rsplit('.', 1)[0]
    fs = [(a, nm, k) for a, nm, k in syms if s <= a < e]
    lab2addr = {}
    for a, nm, k in fs: lab2addr.setdefault(nm, a)
    plain = os.path.join(asmdir, stem + '.s'); dbg = os.path.join(asmdir, stem + '.g.s')
    if base.endswith('.c') and os.path.exists(plain):
        ents = parse_s(plain)
        gents = parse_s(dbg) if os.path.exists(dbg) else []
        src = None
        sp = os.path.normpath(os.path.join(tree, 'library/vbcc', p))
        if os.path.exists(sp): src = open(sp, errors='replace').read().split('\n')
        ok = len(ents) == len(gents)
        nglob = nchk = nbad = nmiss = 0
        prev = -1; mono = True
        for idx, (lab, _) in enumerate(ents):
            a = lab2addr.get(lab)
            if a is None: nmiss += 1; continue
            if a <= prev: mono = False
            prev = a
            if lab.startswith('_') :
                name = lab[1:]; nglob += 1
                if ok and src and gents[idx][1]:
                    g = name_at(src, gents[idx][1]); nchk += 1
                    if g != name: nbad += 1; bad.append((name, g, gents[idx][1]))
            else:
                name = None
                if ok and src and gents[idx][1]: name = name_at(src, gents[idx][1])
                if not name: name = '%s:%s' % (stem, lab)
            res.append((a, name, base))
        stats.append('%s: %d funcs (%d global), g-match=%s, name-check %d/%d bad, missing=%d, monotonic=%s' % (base, len(ents), nglob, ok, nbad, nchk, nmiss, mono))
    else:
        # asm source or no listing: use global symbols
        for a, nm, k in fs:
            if k == 'global': res.append((a, nm.lstrip('_'), base))
        stats.append('%s: globals only' % base)
res.sort()
with open(out, 'w') as f:
    for s, e, p in files: f.write('S %x %x %s\n' % (s, e, os.path.basename(p)))
    for a, nm, b in res: f.write('F %x %s %s\n' % (a, nm, b))
print('\n'.join(stats)); print(bad[:40]); print('total funcs', len(res))
