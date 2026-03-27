/* Diagnostic: extract IEEE 754 bits via DataView */
var buf = new ArrayBuffer(8);
var view = new DataView(buf);

/* Write Infinity to buffer */
view.setFloat64(0, Infinity);
var hi = view.getUint32(0);
var lo = view.getUint32(4);
print("Infinity bits: hi=" + hi.toString(16) + " lo=" + lo.toString(16));

/* Write NaN */
view.setFloat64(0, NaN);
hi = view.getUint32(0);
lo = view.getUint32(4);
print("NaN bits: hi=" + hi.toString(16) + " lo=" + lo.toString(16));

/* Write 1/0 */
view.setFloat64(0, 1/0);
hi = view.getUint32(0);
lo = view.getUint32(4);
print("1/0 bits: hi=" + hi.toString(16) + " lo=" + lo.toString(16));

/* Write 2.0 for comparison */
view.setFloat64(0, 2.0);
hi = view.getUint32(0);
lo = view.getUint32(4);
print("2.0 bits: hi=" + hi.toString(16) + " lo=" + lo.toString(16));

/* Write 3.14 */
view.setFloat64(0, 3.14);
hi = view.getUint32(0);
lo = view.getUint32(4);
print("3.14 bits: hi=" + hi.toString(16) + " lo=" + lo.toString(16));

/* Read back known infinity bits */
view.setUint32(0, 0x7FF00000);
view.setUint32(4, 0x00000000);
var inf_read = view.getFloat64(0);
print("Read 7FF00000/00000000 as float: " + inf_read);
print("isFinite: " + isFinite(inf_read));
print("isNaN: " + isNaN(inf_read));
