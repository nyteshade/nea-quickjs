/* Lists every name the FFI bundles publish, with its type. The output
 * must be the same whether the bundles are loaded at start-up (0.226)
 * or on first use (0.227+). */
function describe(label, object) {
  const out = [];
  for (const key of Object.getOwnPropertyNames(object).sort()) {
    let value;
    try { value = object[key]; } catch (error) { value = error; }
    out.push(key + ':' + (value === null ? 'null' : typeof value));
  }
  print(label + ' ' + out.length + ' ' + out.join(' '));
}
/* touch both groups first, so lazy accessors have been replaced */
const touched = [typeof Intuition, typeof amiga.boopsi];
describe('amiga', amiga);
for (const lib of ['intuition', 'graphics', 'exec', 'dos', 'devices']) describe('amiga.' + lib, amiga[lib]);
describe('boopsi', amiga.boopsi);
describe('boopsi.gadgets', amiga.boopsi.gadgets);
describe('boopsi.images', amiga.boopsi.images);
describe('boopsi.classes', amiga.boopsi.classes);
describe('globalThis', globalThis);
