/*
 * boopsi_probe2.js — drives the BOOPSI JS wrappers one class at a
 * time to localize where react_hello Gurus.
 *
 * Run:  qjs examples/boopsi_probe2.js
 */

import * as std from 'qjs:std';

function hex(n) { return '0x' + ((n >>> 0).toString(16).padStart(8, '0')); }

const { Window, Layout, Button, Label } = amiga.boopsi;

print('=== A: new Label({text:"Hello"}) via BOOPSI wrapper ===');
let lbl = new Label({ text: 'Hello' });
print('    label.ptr = ' + hex(lbl.ptr));

print('=== B: new Button({id:1, text:"Quit"}) ===');
let btn = new Button({ id: 1, text: 'Quit' });
print('    button.ptr = ' + hex(btn.ptr));

print('=== C: new Layout({orientation:"vertical"}) — NO children ===');
let lay = new Layout({ orientation: 'vertical' });
print('    layout.ptr = ' + hex(lay.ptr));
lay.dispose();

print('=== D: new Layout({children:[label]}) — one child via _extraPairs ===');
let lbl2 = new Label({ text: 'child' });
print('    child.ptr = ' + hex(lbl2.ptr));
let lay2 = new Layout({
  orientation: 'vertical',
  children: [ lbl2 ],
});
print('    layout.ptr = ' + hex(lay2.ptr));
lay2.dispose();

print('=== E: new Layout({children:[label, button, button]}) — three children ===');
let lbl3 = new Label({ text: 'x' });
let btn3 = new Button({ id: 1, text: 'a' });
let btn4 = new Button({ id: 2, text: 'b' });
print('    label.ptr  = ' + hex(lbl3.ptr));
print('    button1.ptr= ' + hex(btn3.ptr));
print('    button2.ptr= ' + hex(btn4.ptr));
let lay3 = new Layout({
  orientation: 'vertical',
  innerSpacing: 4,
  children: [ lbl3, btn3, btn4 ],
});
print('    layout.ptr = ' + hex(lay3.ptr));
lay3.dispose();

print('=== F: new Window({title, innerWidth, innerHeight, layout}) — no open ===');
let lbl4 = new Label({ text: 'hi' });
let lay4 = new Layout({ orientation: 'vertical', children: [lbl4] });
let w = new Window({
  title: 'Probe',
  innerWidth: 200,
  innerHeight: 80,
  layout: lay4,
});
print('    window.ptr = ' + hex(w.ptr));
w.dispose();

print('=== G: construct + open window ===');
let lbl5 = new Label({ text: 'hi' });
let btn5 = new Button({ id: 1, text: 'OK' });
let lay5 = new Layout({ orientation: 'vertical', innerSpacing:4,
                         children: [lbl5, btn5] });
let w2 = new Window({
  title:        'Probe',
  innerWidth:   200,
  innerHeight:  80,
  closeGadget:  true,
  dragBar:      true,
  depthGadget:  true,
  activate:     true,
  idcmp:        0x00000200 | 0x00000004 | 0x40000000,
  layout:       lay5,
});
print('    window.ptr (unopened) = ' + hex(w2.ptr));
print('    about to call open()...');
w2.open();
print('    window opened; intuiWindow struct ptr = ' + hex(
  w2.intuiWindow ? w2.intuiWindow.ptr : 0));
print('    close via dispose()');
w2.dispose();

print('=== ALL STEPS PASSED ===');
