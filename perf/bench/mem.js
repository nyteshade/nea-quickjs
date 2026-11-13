/* Heap held by the runtime at three points: nothing touched, the core
 * FFI bundle loaded, the BOOPSI bundle loaded too. */
function show(label) {
  const e = process.memoryUsage().engine;
  print(label, 'malloc', e.mallocSize, 'allocs', e.mallocCount, 'objects', e.objects,
        'atoms', e.atoms, 'shapes', e.shapes, 'functions', e.functions, 'bytecode', e.bytecodeSize);
}
show('start ');
typeof Intuition;
show('core  ');
typeof amiga.boopsi;
show('boopsi');
