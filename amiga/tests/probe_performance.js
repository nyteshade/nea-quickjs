/* Minimal probe: identify why test_node_overnight.js dies at performance.mark */
import * as std from 'qjs:std';

print("=== Probe 1: performance shape ===");
print("typeof performance            = " + typeof performance);
print("typeof performance.now        = " + typeof performance.now);
print("typeof performance.timeOrigin = " + typeof performance.timeOrigin);
print("typeof performance.mark       = " + typeof performance.mark);
print("typeof performance.measure    = " + typeof performance.measure);
print("typeof performance.getEntries = " + typeof performance.getEntries);

print("\n=== Probe 2: call each with try-catch ===");
function tryIt(label, fn) {
    try { const r = fn(); print("  OK: " + label + " -> " + typeof r); }
    catch (e) { print("  THROW: " + label + " -> " + (e && e.message || e)); }
}
tryIt("performance.now()",             () => performance.now());
tryIt("performance.mark('a')",         () => performance.mark('a'));
tryIt("performance.mark('b')",         () => performance.mark('b'));
tryIt("performance.measure('x','a','b')", () => performance.measure('x', 'a', 'b'));
tryIt("performance.getEntries()",      () => performance.getEntries());
tryIt("performance.getEntriesByType('mark')", () => performance.getEntriesByType('mark'));
tryIt("performance.clearMarks()",      () => performance.clearMarks());

print("\n=== Probe 3: listing ===");
for (const k in performance) print("  key: " + k + " = " + typeof performance[k]);
print("\n=== Done ===");
