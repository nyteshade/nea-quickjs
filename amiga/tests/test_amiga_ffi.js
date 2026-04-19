/*
 * test_amiga_ffi.js — Q1 Amiga FFI regression suite.
 *
 * Covers library 0.124 additions:
 *   globalThis.amiga.{openLibrary, closeLibrary, call, peek*, poke*,
 *                     peekString, pokeString, allocMem, freeMem,
 *                     makeTags, withTags, lvo, tags, MEMF_*, TAG_*}
 *
 * Each section runs in a run(title, async fn) wrapper with try/catch +
 * stdout flush so a crash or exception doesn't silently truncate the
 * log (pattern from test_node_overnight.js).
 *
 * SAFETY NOTE: These tests exercise real library calls. A bad LVO
 * number, a bad pointer, or a broken asm trampoline can crash the
 * Amiga. Start with the safe primitives (peek/poke over our own
 * allocations, openLibrary/closeLibrary round-trips) before any
 * generic `amiga.call` that reaches into exec.
 */

import * as std from 'qjs:std';
import * as os  from 'qjs:os';

let pass = 0, fail = 0;
function _flush() { try { std.out.flush(); } catch (_) {} }
function _hex(n, width) {
    if (n === undefined || n === null) return String(n);
    const s = (n >>> 0).toString(16).padStart(width || 8, '0');
    return '0x' + s.toUpperCase();
}
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
    _flush();
}
/* Like ok(), but on failure prints actual vs expected in hex + decimal. */
function eqHex(actual, expected, msg) {
    const a = actual, e = expected;
    const ok_ = a === e;
    if (ok_) { print("  PASS: " + msg); pass++; }
    else {
        print("  FAIL: " + msg + " (actual " + _hex(a) + "/" + a +
              ", expected " + _hex(e) + "/" + e + ")");
        fail++;
    }
    _flush();
}
function section(title) { print("\n-- " + title + " --"); _flush(); }
async function run(title, fn) {
    section(title);
    try { await fn(); }
    catch (e) {
        fail++;
        print("  FAIL: [section] threw: " + (e && e.message || e));
        if (e && e.stack) {
            const st = String(e.stack).split('\n').slice(0, 4).join('\n    ');
            print("    " + st);
        }
        _flush();
    }
}

(async () => {

/* Short-circuit the whole suite if the native isn't installed — no
 * point running 100 FAILs. */
if (typeof globalThis.amiga !== 'object' ||
    typeof globalThis.amiga.openLibrary !== 'function') {
    print("FATAL: globalThis.amiga not installed — library version < 0.124?");
    std.exit(2);
}

await run("module surface (0.124)", async () => {
    const fns = ['openLibrary','closeLibrary','call',
                 'peek8','peek16','peek32','poke8','poke16','poke32',
                 'peekString','pokeString',
                 'allocMem','freeMem','makeTags','withTags'];
    for (const fn of fns) {
        ok(typeof amiga[fn] === 'function', 'amiga.' + fn + ' is function');
    }
    ok(amiga.TAG_DONE === 0, 'amiga.TAG_DONE is 0');
    ok(amiga.TAG_USER === 0x80000000, 'amiga.TAG_USER is 0x80000000');
});

await run("namespace structure (0.125)", async () => {
    /* Per-library namespaces — each holds .lvo + library-specific constants. */
    for (const name of ['exec', 'dos', 'intuition', 'graphics', 'gadtools']) {
        ok(typeof amiga[name] === 'object', 'amiga.' + name + ' is object');
        ok(typeof amiga[name].lvo === 'object', 'amiga.' + name + '.lvo is object');
    }
    /* Library-scoped constants — spot check one per namespace. */
    ok(amiga.exec.MEMF_PUBLIC === 0x1, 'exec.MEMF_PUBLIC');
    ok(amiga.exec.MEMF_CLEAR === 0x10000, 'exec.MEMF_CLEAR');
    ok(amiga.dos.MODE_NEWFILE === 1006, 'dos.MODE_NEWFILE');
    ok(amiga.intuition.WA_Left === 0x80000064, 'intuition.WA_Left');
    ok(amiga.intuition.IDCMP_CLOSEWINDOW === 0x200, 'intuition.IDCMP_CLOSEWINDOW');
    ok(amiga.graphics.JAM1 === 0, 'graphics.JAM1');
    ok(amiga.gadtools.BUTTON_KIND === 1, 'gadtools.BUTTON_KIND');
    /* Universal constants that stay flat. */
    ok(amiga.TAG_DONE === 0, 'amiga.TAG_DONE universal');
    ok(amiga.TAG_USER === 0x80000000, 'amiga.TAG_USER universal');
});

await run("LVO table integrity (0.125)", async () => {
    const libs = ['exec', 'dos', 'intuition', 'graphics', 'gadtools'];
    for (const libName of libs) {
        const tbl = amiga[libName].lvo;
        /* Every entry MUST be a negative even number. */
        let badCount = 0;
        let checked = 0;
        for (const key in tbl) {
            const lvo = tbl[key];
            checked++;
            if (typeof lvo !== 'number' || lvo >= 0 || (lvo & 1)) {
                badCount++;
                print('      BAD LVO: ' + libName + '.' + key + ' = ' + lvo);
            }
        }
        ok(checked > 0, libName + ' has LVOs (' + checked + ')');
        ok(badCount === 0, libName + ' all LVOs negative and even');
    }

    /* Critical well-known LVOs — wrong values here means the FD parse broke. */
    ok(amiga.exec.lvo.OpenLibrary === -552,  'exec.lvo.OpenLibrary = -552');
    ok(amiga.exec.lvo.CloseLibrary === -414, 'exec.lvo.CloseLibrary = -414');
    ok(amiga.exec.lvo.AllocMem === -198,     'exec.lvo.AllocMem = -198');
    ok(amiga.exec.lvo.FreeMem === -210,      'exec.lvo.FreeMem = -210');
    ok(amiga.dos.lvo.Output === -60,         'dos.lvo.Output = -60');
    ok(amiga.dos.lvo.Read === -42,           'dos.lvo.Read = -42');
    ok(amiga.dos.lvo.Write === -48,          'dos.lvo.Write = -48');
    ok(amiga.intuition.lvo.OpenWindow === -204,   'intuition.lvo.OpenWindow');
    ok(amiga.graphics.lvo.SetAPen === -342,       'graphics.lvo.SetAPen');
    ok(amiga.gadtools.lvo.CreateContext === -114, 'gadtools.lvo.CreateContext');
});

await run("memory round-trip — peek8/16/32, poke8/16/32, allocMem/freeMem", async () => {
    const ptr = amiga.allocMem(32, amiga.exec.MEMF_PUBLIC | amiga.exec.MEMF_CLEAR);
    ok(ptr !== 0, 'allocMem(32) returned non-zero');
    if (ptr === 0) return;

    /* All 32 bytes cleared at alloc time? */
    let allZero = true;
    for (let i = 0; i < 32; i++) {
        if (amiga.peek8(ptr + i) !== 0) { allZero = false; break; }
    }
    ok(allZero, 'MEMF_CLEAR zeroed the buffer');

    /* Byte round-trip. */
    amiga.poke8(ptr + 0, 0xAB);
    amiga.poke8(ptr + 1, 0xCD);
    ok(amiga.peek8(ptr + 0) === 0xAB, 'peek8(0) after poke8(0xAB)');
    ok(amiga.peek8(ptr + 1) === 0xCD, 'peek8(1) after poke8(0xCD)');

    /* Word (big-endian on m68k) round-trip. */
    amiga.poke16(ptr + 4, 0x1234);
    ok(amiga.peek16(ptr + 4) === 0x1234, 'peek16 after poke16(0x1234)');
    ok(amiga.peek8(ptr + 4) === 0x12, 'big-endian byte 0 after poke16');
    ok(amiga.peek8(ptr + 5) === 0x34, 'big-endian byte 1 after poke16');

    /* Long round-trip. */
    amiga.poke32(ptr + 8, 0xDEADBEEF);
    ok(amiga.peek32(ptr + 8) === 0xDEADBEEF, 'peek32 after poke32(0xDEADBEEF)');
    ok(amiga.peek16(ptr + 8) === 0xDEAD, 'peek16 byte 0-1 after poke32');
    ok(amiga.peek16(ptr + 10) === 0xBEEF, 'peek16 byte 2-3 after poke32');

    amiga.freeMem(ptr, 32);
    /* Don't verify anything after freeMem — the memory may be recycled. */
});

await run("string round-trip — pokeString / peekString", async () => {
    const ptr = amiga.allocMem(64);
    ok(ptr !== 0, 'allocMem(64)');
    if (ptr === 0) return;

    const written = amiga.pokeString(ptr, 'hello, world');
    ok(written === 13, 'pokeString returned byte count (12 + NUL)');

    const got = amiga.peekString(ptr, 64);
    ok(got === 'hello, world', 'peekString round-trip');

    /* maxLen stops short — we should get 'hello' back. */
    const short = amiga.peekString(ptr, 5);
    ok(short === 'hello', 'peekString respects maxLen');

    /* Empty string. */
    amiga.pokeString(ptr, '');
    ok(amiga.peekString(ptr, 64) === '', 'empty string round-trip');

    amiga.freeMem(ptr, 64);
});

await run("OpenLibrary / CloseLibrary round-trip", async () => {
    /* dos.library is always resident, so this MUST succeed. */
    const doslib = amiga.openLibrary('dos.library', 0);
    ok(doslib !== 0, 'openLibrary("dos.library", 0) returned non-zero');

    if (doslib) {
        /* Check the Library's lib_Node->ln_Name field — it should point
         * back to the name "dos.library". Library struct:
         *   +0  ln_Succ (LN_NEXT)
         *   +4  ln_Pred
         *   +8  ln_Type (UBYTE)
         *   +9  ln_Pri  (BYTE)
         * +10  ln_Name (STRPTR) — pointer to null-terminated name
         */
        const namePtr = amiga.peek32(doslib + 10);
        ok(namePtr !== 0, 'library Node ln_Name pointer non-zero');
        const name = amiga.peekString(namePtr, 64);
        ok(name === 'dos.library', 'library Node name matches ("' + name + '")');

        /* lib_Version at offset 20 */
        const libVer = amiga.peek16(doslib + 20);
        ok(libVer >= 33, 'dos.library lib_Version >= 33 (got ' + libVer + ')');

        amiga.closeLibrary(doslib);
    }

    /* Non-existent library returns 0 (documented exec behavior). */
    const bogus = amiga.openLibrary('bogus.library', 0);
    ok(bogus === 0, 'openLibrary on non-existent returns 0');
});

await run("generic trampoline — exec AllocMem/FreeMem via amiga.call", async () => {
    /* This is the critical trampoline test: open exec.library, then
     * call AllocMem and FreeMem through `amiga.call` rather than the
     * direct wrappers. If this works, the asm trampoline + register
     * passing is correct for every other library call too. */

    /* SysBase is always at absolute address 4. */
    const SysBase = amiga.peek32(4);
    ok(SysBase !== 0, 'SysBase @ 0x00000004 is non-zero');
    if (SysBase === 0) return;

    /* AllocMem via trampoline: d0 = size, d1 = flags, returns ptr in d0. */
    const mem = amiga.call(SysBase, amiga.exec.lvo.AllocMem, {
        d0: 64, d1: amiga.exec.MEMF_PUBLIC | amiga.exec.MEMF_CLEAR,
    });
    ok(mem !== 0, 'AllocMem via trampoline returned non-zero');

    if (mem) {
        /* Write a pattern, verify, free. */
        amiga.poke32(mem, 0x13572468);
        ok(amiga.peek32(mem) === 0x13572468, 'trampoline-allocated memory is usable');

        amiga.call(SysBase, amiga.exec.lvo.FreeMem, {
            a1: mem, d0: 64,
        });
        /* Can't verify FreeMem — memory may be recycled — but if we
         * got here without crashing, it worked. */
        ok(true, 'FreeMem via trampoline did not crash');
    }
});

await run("generic trampoline — dos.Output()", async () => {
    const doslib = amiga.openLibrary('dos.library', 0);
    ok(doslib !== 0, 'openLibrary("dos.library")');
    if (doslib === 0) return;

    /* dos.Output() takes no args and returns a BPTR (BCPL pointer) to
     * the current task's standard output. It must be non-zero when
     * called from the CLI with stdout redirected (which is how
     * runtests invokes us). */
    const out = amiga.call(doslib, amiga.dos.lvo.Output, {});
    ok(out !== 0, 'dos.Output() returned non-zero BPTR (got ' + out.toString(16) + ')');

    /* Also sanity check dos.Input() — same convention. */
    const inp = amiga.call(doslib, amiga.dos.lvo.Input, {});
    ok(inp !== 0, 'dos.Input() returned non-zero BPTR (got ' + inp.toString(16) + ')');

    amiga.closeLibrary(doslib);
});

await run("per-library reachability — exec/dos/intuition/graphics", async () => {
    /* For each library we have LVOs for, open it and call one
     * side-effect-free function that proves we reach the code. */

    /* exec: already reached via SysBase + AllocMem/FreeMem test above.
     * Just do a quick Disable/Enable pair as belt-and-suspenders. */
    const SysBase = amiga.peek32(4);
    ok(SysBase !== 0, 'SysBase present');
    /* Skip Disable/Enable in tests — they'd disable multitasking which
     * is scary. Reachability is already proven. */

    /* dos — AmigaOS-ubiquitous */
    const doslib = amiga.openLibrary('dos.library', 0);
    ok(doslib !== 0, 'dos.library opens');
    if (doslib) amiga.closeLibrary(doslib);

    /* intuition */
    const ilib = amiga.openLibrary('intuition.library', 0);
    ok(ilib !== 0, 'intuition.library opens');
    if (ilib) {
        /* LockIBase(0) + UnlockIBase — takes d0, returns ULONG. Safe
         * round-trip that doesn't allocate or modify state. */
        const lock = amiga.call(ilib, amiga.intuition.lvo.LockIBase, { d0: 0 });
        ok(true, 'intuition.LockIBase did not crash');
        amiga.call(ilib, amiga.intuition.lvo.UnlockIBase, { a0: lock });
        ok(true, 'intuition.UnlockIBase did not crash');
        amiga.closeLibrary(ilib);
    }

    /* graphics */
    const gfxlib = amiga.openLibrary('graphics.library', 0);
    ok(gfxlib !== 0, 'graphics.library opens');
    if (gfxlib) {
        /* Just verify reachability by reading gfx lib_Version. */
        const ver = amiga.peek16(gfxlib + 20);
        ok(ver >= 36, 'graphics.library lib_Version >= 36 (got ' + ver + ')');
        amiga.closeLibrary(gfxlib);
    }

    /* gadtools — opens on demand, may need higher version */
    const gtlib = amiga.openLibrary('gadtools.library', 0);
    ok(gtlib !== 0, 'gadtools.library opens');
    if (gtlib) {
        /* CreateContext takes a0 = GList** and returns an invisible
         * context gadget. Pass NULL to get a fresh context we can
         * immediately free via FreeGadgets.
         *
         * CreateContext signature: CreateContext(glist)(a0)
         * FreeGadgets signature:   FreeGadgets(gad)(a0) */
        const ctxPtr = amiga.allocMem(4);  /* GList* storage */
        if (ctxPtr) {
            amiga.poke32(ctxPtr, 0);
            const ctxGad = amiga.call(gtlib, amiga.gadtools.lvo.CreateContext,
                { a0: ctxPtr });
            ok(true, 'gadtools.CreateContext did not crash');
            if (ctxGad) {
                amiga.call(gtlib, amiga.gadtools.lvo.FreeGadgets, { a0: ctxGad });
                ok(true, 'gadtools.FreeGadgets did not crash');
            }
            amiga.freeMem(ctxPtr, 4);
        }
        amiga.closeLibrary(gtlib);
    }
});

await run("makeTags — TagItem array construction", async () => {
    const tags = amiga.makeTags([
        [amiga.intuition.WA_Left,   50],
        [amiga.intuition.WA_Top,    40],
        [amiga.intuition.WA_Width,  320],
        [amiga.intuition.WA_Height, 200],
    ]);
    ok(tags !== 0, 'makeTags returned non-zero pointer');
    if (tags === 0) return;

    /* Diagnostic: print the first 40 bytes of the tag array as longs so
     * we can see exactly what was written even if the assertions fail. */
    print("    makeTags buffer dump:");
    for (let o = 0; o < 40; o += 4) {
        print("      [+"+ o.toString().padStart(2, '0') + "] = " +
              _hex(amiga.peek32(tags + o)));
    }

    /* Verify layout: 4 pairs + 1 terminator = 5 * 8 = 40 bytes.
     * TagItem is ULONG ti_Tag, ULONG ti_Data (big-endian on m68k).
     * Using eqHex so failures print actual vs expected. */
    eqHex(amiga.peek32(tags +  0), 0x80000064, 'pair[0].tag = WA_Left');
    eqHex(amiga.peek32(tags +  4), 50,         'pair[0].data = 50');
    eqHex(amiga.peek32(tags +  8), 0x80000065, 'pair[1].tag = WA_Top');
    eqHex(amiga.peek32(tags + 12), 40,         'pair[1].data = 40');
    eqHex(amiga.peek32(tags + 16), 0x80000066, 'pair[2].tag = WA_Width');
    eqHex(amiga.peek32(tags + 20), 320,        'pair[2].data = 320');
    eqHex(amiga.peek32(tags + 24), 0x80000067, 'pair[3].tag = WA_Height');
    eqHex(amiga.peek32(tags + 28), 200,        'pair[3].data = 200');
    eqHex(amiga.peek32(tags + 32), 0,          'terminator tag = TAG_DONE (0)');
    eqHex(amiga.peek32(tags + 36), 0,          'terminator data = 0');

    /* Each pair is 8 bytes; total = (4+1) * 8 = 40. */
    amiga.freeMem(tags, 40);
});

await run("withTags — scoped tag allocation", async () => {
    let captured = 0;
    const result = amiga.withTags(
        [[amiga.intuition.WA_Width, 100], [amiga.intuition.WA_Height, 50]],
        (ptr) => {
            captured = ptr;
            ok(ptr !== 0, 'withTags callback received non-zero pointer');
            eqHex(amiga.peek32(ptr),     0x80000066, 'withTags pair[0].tag');
            eqHex(amiga.peek32(ptr + 4), 100,        'withTags pair[0].data');
            return 42;  /* return value should come back from withTags */
        },
    );
    ok(result === 42, 'withTags passes fn return value through');
    /* After withTags returns, the memory should have been freed.
     * We can't prove it was freed without leaking internal state, but
     * we can at least check we returned cleanly. */
    ok(captured !== 0, 'withTags did run the callback');
});

print("");
print("=== Results: " + pass + " passed, " + fail + " failed ===");
_flush();
if (fail > 0) std.exit(1);
})();
