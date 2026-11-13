/* Behaviour of the load-on-first-use FFI accessors. */
function kind(object, key) {
  const d = Object.getOwnPropertyDescriptor(object, key);
  return d === undefined ? 'absent' : (d.get ? 'accessor' : 'value');
}
print('before:', kind(globalThis, 'Intuition'), kind(globalThis, 'BOOPSIBase'), kind(amiga, 'boopsi'), kind(amiga.intuition, 'Window'), kind(globalThis, '__qjs_loadBundle'));
print('scoped:', Object.keys(globalThis).includes('Intuition'), 'Button' in globalThis, typeof Button, typeof OM, '__qjs_ffiShared' in globalThis);
print('core:', typeof Intuition, Number(Intuition.consts.WA_Left).toString(16), typeof TextAttr, typeof amiga.Exec, amiga.graphics.RastPort === RastPort);
print('mid:', kind(globalThis, 'Intuition'), kind(globalThis, 'BOOPSIBase'), kind(amiga, 'boopsi'));
print('boopsi:', typeof amiga.boopsi.Button, typeof amiga.boopsi.OM, typeof Button, typeof CEnumeration.lazy, '__qjs_ffiShared' in globalThis);
print('after:', kind(globalThis, 'BOOPSIBase'), kind(amiga, 'boopsi'), typeof amiga.boopsi.Window, typeof EventKind);
globalThis.Zzz = 1;
let t = new TextAttr(); t.ySize = 11; print('struct:', t.ySize); t.free();
