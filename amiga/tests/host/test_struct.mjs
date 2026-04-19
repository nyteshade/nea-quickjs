/* Mock amiga.* with an in-memory backing map. */
let memMap = new Map();
let nextAddr = 0x100000;
let allocations = [];

globalThis.amiga = {
  allocMem(size) {
    let addr = nextAddr;
    nextAddr += (size + 3) & ~3;
    allocations.push({ addr, size, freed: false });
    for (let i = 0; i < size; i++) memMap.set(addr + i, 0);
    return addr;
  },
  freeMem(ptr, size) {
    let a = allocations.find(x => x.addr === ptr && !x.freed);
    if (a) a.freed = true;
  },
  peek8(addr)  { return memMap.get(addr) || 0; },
  peek16(addr) { return ((memMap.get(addr) || 0) << 8) | (memMap.get(addr+1) || 0); },
  peek32(addr) {
    return (((memMap.get(addr)   || 0) << 24) >>> 0 |
            ((memMap.get(addr+1) || 0) << 16) |
            ((memMap.get(addr+2) || 0) <<  8) |
             (memMap.get(addr+3) || 0)) >>> 0;
  },
  poke8(addr, v)  { memMap.set(addr, v & 0xff); },
  poke16(addr, v) { memMap.set(addr, (v >> 8) & 0xff); memMap.set(addr+1, v & 0xff); },
  poke32(addr, v) {
    memMap.set(addr,   (v >>> 24) & 0xff);
    memMap.set(addr+1, (v >>> 16) & 0xff);
    memMap.set(addr+2, (v >>>  8) & 0xff);
    memMap.set(addr+3,  v         & 0xff);
  },
};

const { Struct } = await import('../../../quickjs-master/amiga/ffi/structs/Struct.js');

let pass = 0, fail = 0;
function ok(c, m) {
  if (c) { pass++; console.log('PASS', m); }
  else   { fail++; console.log('FAIL', m); }
}

class Demo extends Struct {
  static SIZE = 8;
}

let d = new Demo();
ok(d.ptr !== 0,            'allocates a non-zero ptr');
ok(allocations[0].size === 8, 'allocates SIZE bytes');

d.write16(0, 0x1234);
ok(d.read16(0) === 0x1234, 'read/write 16');

d.write32(4, 0xDEADBEEF);
ok(d.read32(4) === 0xDEADBEEF, 'read/write 32');

d.free();
ok(d.ptr === 0,             'free zeroes ptr');
ok(allocations[0].freed,    'free released the alloc');

d.free();
ok(true, 'second free does not throw');

let wrapped = new Demo(0xABCD);
ok(wrapped.ptr === 0xABCD,  'constructor with ptr wraps');
ok(allocations.length === 1, 'wrapping does not allocate');

console.log(`Results: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
