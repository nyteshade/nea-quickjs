/*
 * test_timing.js — diagnose setTimeout / gettimeofday on AmigaOS
 *
 * Run: qjs tests/test_timing.js
 *
 * Prints raw values so we can see WHAT broke, not just that something did.
 */
import * as os from "qjs:os";

print("=== AmigaOS timing diagnostics ===");

/* ---- 1. os.now() raw value ---- */
{
    const t0 = os.now();
    print("os.now() raw           =", t0);
    print("typeof os.now()        =", typeof t0);
    print("os.now() > 0           =", t0 > 0);
    print("os.now() / 1e6 (sec)   =", (t0 / 1e6));
    /* Sanity: Apr 9 2026 ≈ 1.776e15 µs */
    if (t0 < 1.7e15 || t0 > 2.0e15) {
        print("  *** os.now() OUTSIDE expected range (~1.776e15) ***");
    } else {
        print("  OK: os.now() in plausible range");
    }
}

/* ---- 2. Date.now() raw value ---- */
{
    const d0 = Date.now();
    print("\nDate.now() raw         =", d0);
    print("typeof Date.now()      =", typeof d0);
    print("Date.now() > 0         =", d0 > 0);
    if (d0 < 1.7e12 || d0 > 2.0e12) {
        print("  *** Date.now() OUTSIDE expected range (~1.776e12) ***");
    } else {
        print("  OK: Date.now() in plausible range");
    }
}

/* ---- 2b. new Date(0) round-trip ---- */
{
    print("\n--- new Date(0) round-trip ---");
    const d = new Date(0);
    print("new Date(0).getTime()  =", d.getTime());
    /* toISOString may throw or return wrong value */
    try {
        const iso = d.toISOString();
        print("new Date(0).toISOString() =", iso);
        print("  matches '1970-01-01T00:00:00.000Z':",
              iso === '1970-01-01T00:00:00.000Z');
    } catch (e) {
        print("  toISOString THREW:", e.message);
    }
}

/* ---- 2c. Math.pow / ** sanity ---- */
{
    print("\n--- Math.pow sanity ---");
    print("Math.pow(2, 10)        =", Math.pow(2, 10), "(expected 1024)");
    print("Math.pow(3, 4)         =", Math.pow(3, 4),  "(expected 81)");
    print("Math.pow(10, 3)        =", Math.pow(10, 3), "(expected 1000)");
    print("2 ** 10                =", 2 ** 10,         "(expected 1024)");
    print("Math.log(Math.E)       =", Math.log(Math.E),"(expected 1)");
    print("Math.sqrt(144)         =", Math.sqrt(144),  "(expected 12)");
}

/* ---- 2c2. Math.exp DEEP DIVE — multiple inputs to find pattern ---- */
{
    print("\n--- Math.exp deep dive ---");
    print("Math.exp(0)            =", Math.exp(0),    "(expected 1)");
    print("Math.exp(1)            =", Math.exp(1),    "(expected 2.71828...)");
    print("Math.exp(2)            =", Math.exp(2),    "(expected 7.389...)");
    print("Math.exp(-1)           =", Math.exp(-1),   "(expected 0.36788...)");
    print("Math.exp(0.5)          =", Math.exp(0.5),  "(expected 1.6487...)");
    print("Math.exp(10)           =", Math.exp(10),   "(expected 22026.4...)");
    /* Cross-check via log: exp(log(x)) should == x */
    print("Math.exp(Math.log(7))  =", Math.exp(Math.log(7)), "(expected 7)");
    /* Cross-check via pow: pow(e, x) === exp(x) */
    print("Math.pow(Math.E, 1)    =", Math.pow(Math.E, 1),   "(expected 2.71828...)");
    print("Math.pow(Math.E, 2)    =", Math.pow(Math.E, 2),   "(expected 7.389...)");
}

/* ---- 2c2b. IEEE bit pattern inspection — what EXACTLY is exp returning? ---- */
{
    print("\n--- Math.exp(1) bit pattern inspection ---");
    function bits(d) {
        const buf = new ArrayBuffer(8);
        const dv = new DataView(buf);
        dv.setFloat64(0, d, false); /* big-endian */
        const hi = dv.getUint32(0, false).toString(16).padStart(8, '0');
        const lo = dv.getUint32(4, false).toString(16).padStart(8, '0');
        return hi + " " + lo;
    }
    print("bits of 1.0            =", bits(1.0),           "(expected 3ff00000 00000000)");
    print("bits of 2.71828...     =", bits(2.718281828),   "(expected 4005bf09 95aaf790)");
    print("bits of Math.exp(1)    =", bits(Math.exp(1)),   "(should == bits of 2.71828...)");
    print("bits of Math.exp(0)    =", bits(Math.exp(0)),   "(expected 3ff00000 00000000)");
    print("bits of Math.E         =", bits(Math.E),        "(expected 4005bf0a 8b145769)");
    print("bits of Math.pow(E,1)  =", bits(Math.pow(Math.E, 1)));
}

/* ---- 2c3. Other transcendentals — verify which are broken ---- */
{
    print("\n--- transcendentals ---");
    print("Math.sin(0)            =", Math.sin(0),    "(expected 0)");
    print("Math.cos(0)            =", Math.cos(0),    "(expected 1)");
    print("Math.sin(Math.PI/2)    =", Math.sin(Math.PI / 2), "(expected 1)");
    print("Math.atan(1)           =", Math.atan(1),   "(expected 0.7854...)");
    print("Math.sinh(1)           =", Math.sinh(1),   "(expected 1.1752...)");
    print("Math.cosh(1)           =", Math.cosh(1),   "(expected 1.5430...)");
    print("Math.tanh(1)           =", Math.tanh(1),   "(expected 0.7615...)");
    print("Math.asin(1)           =", Math.asin(1),   "(expected 1.5707...)");
    print("Math.acos(1)           =", Math.acos(1),   "(expected 0)");
}

/* ---- 2d. os.sleep elapsed measurement ---- */
{
    print("\n--- os.sleep(50) elapsed ---");
    const t1 = os.now();
    os.sleep(50); /* 50ms */
    const t2 = os.now();
    print("  before:", t1);
    print("  after :", t2);
    print("  delta :", (t2 - t1), "µs (expected ≈ 50000)");
    if (t2 === t1) {
        print("  *** os.now() didn't advance — gettimeofday is frozen? ***");
    } else if (t2 < t1) {
        print("  *** time went BACKWARDS — int64 overflow? ***");
    }
}

/* ---- 3. os.now() granularity — bounded call count, no busy loop ---- */
{
    print("\n--- os.now() granularity (10 rapid samples) ---");
    const samples = [];
    for (let i = 0; i < 10; i++) samples.push(os.now());
    for (let i = 0; i < 10; i++) {
        const delta = i > 0 ? samples[i] - samples[i-1] : 0;
        print("  sample", i, "=", samples[i], "delta=", delta, "µs");
    }
}

/* ---- 4. os.now() advances after os.sleep — bounded, NOT a busy loop ---- */
{
    print("\n--- os.now() before/after os.sleep(100) ---");
    const before = os.now();
    os.sleep(100); /* 100ms */
    const after = os.now();
    print("  before =", before);
    print("  after  =", after);
    print("  delta  =", (after - before), "µs (expected ≈ 100000)");
}

print("\n=== done ===");
