#!/opt/homebrew/opt/python@3.9/bin/python3.9
"""vamos wrapper: PC histogram + call-tree profile of m68k code.
env: PROF_OUT=<file> (omit => no hook, plain timing run)
     PROF_FUNCS=<funcs file from mkfuncs.py> (entries for quickjs.library code hunk)
Prints 'PROF wall=<s> instr=<n>' on stderr. All other args go to vamos."""
import os, sys, time, ctypes, json
here = os.path.dirname(os.path.abspath(__file__))
out = os.environ.get('PROF_OUT'); funcs = os.environ.get('PROF_FUNCS')
import musashi.emu as emu
from amitools.vamos.loader import segload
from amitools.vamos.machine import machine as mach
from amitools.vamos.main import main as vmain
segs = []
hook = None
if out:
    lib = ctypes.CDLL(emu.__file__)
    hook = ctypes.CDLL(os.path.join(here, 'hook.dylib'))
    hook.prof_total.restype = ctypes.c_uint64
    hook.prof_init(ctypes.cast(lib.m68k_get_reg, ctypes.c_void_p), ctypes.cast(lib.m68k_read_memory_32, ctypes.c_void_p))
    offs = []
    if funcs:
        for l in open(funcs):
            p = l.split()
            if p[0] == 'F': offs.append(int(p[1], 16))
    orig_load = segload.SegmentLoader.int_load_sys_seglist
    def my_load(self, path):
        info = orig_load(self, path)
        if info:
            addrs = info.seglist.get_all_addrs()
            sizes = [s.size for s in info.seglist] if hasattr(info.seglist, '__iter__') else []
            segs.append({'file': os.path.basename(path), 'addrs': addrs})
            if os.path.basename(path) == 'quickjs.library' and offs:
                arr = (ctypes.c_uint32 * len(offs))(*[addrs[0] + o for o in offs])
                hook.prof_add_entries(arr, len(offs))
        return info
    segload.SegmentLoader.int_load_sys_seglist = my_load
    orig_init = mach.Machine.__init__
    def my_init(self, *a, **k):
        orig_init(self, *a, **k)
        lib.m68k_set_instr_hook_callback(ctypes.cast(hook.prof_hook, ctypes.c_void_p))
    mach.Machine.__init__ = my_init
    # vamos cleanup resets the hook to None at the end; fine.
t0 = time.perf_counter()
rc = vmain(None, args=sys.argv[1:]) if False else vmain(args=sys.argv[1:])
wall = time.perf_counter() - t0
n = 0
if hook:
    n = hook.prof_total()
    hook.prof_dump(out.encode())
    json.dump(segs, open(out + '.segs', 'w'))
sys.stderr.write('PROF wall=%.3f instr=%d\n' % (wall, n))
sys.exit(rc)
