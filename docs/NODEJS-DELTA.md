# Node.js vs nea-quickjs API Delta

A survey of Node.js / web platform APIs not yet present in our Amiga port,
with recommendations for what's worth bringing over.

The goal isn't full Node compatibility — that's neither feasible nor
desirable on classic AmigaOS. We want the *useful 10%* of Node that
makes scripts dramatically easier to write, especially those interacting
with the modern web.

---

## Status today (v0.65)

What our `qjs` already provides beyond stock QuickJS-ng:

| Feature | Source |
|---|---|
| ES2020+ everything | upstream QuickJS-ng |
| `print()`, `console.log()` | std/os helpers |
| `Symbol.for('qjs.inspect')` for custom display | nea port |
| `fetch()`, `Response`, `Headers` (web-style HTTP) | nea port (CreateNewProc workers) |
| `std` module: file I/O, `urlGet`, env, exit, gc | std module |
| `os` module: exec, pipe, kill, timers, FDs, stat, etc. | os module |
| `bjson` module: binary JSON serialization | bjson module |
| `S:QJS-Startup.js`, `S:QJS-Config.txt` | nea port |
| AmiSSL-backed HTTPS | nea port |

---

## The `--extended` (`-x`) gate

All non-standard extensions described below should be **opt-in** via a
new CLI flag. Default mode keeps `qjs` close to stock quickjs-ng so
scripts written elsewhere run identically.

### Proposed mechanism

- New CLI flag `-x` / `--extended` enables *all* extended APIs at once.
- New `S:QJS-Config.txt` line `--extended` for permanent enable.
- Future scope-specific flags (`--extended=url`, `--extended=crypto`)
  could enable subsets; defer until we have enough APIs to justify it.

### Implementation sketch

In `qjs.c`:

```c
static int extended_mode = 0;

/* arg parsing: */
} else if (!strcmp(arg, "-x") || !strcmp(arg, "--extended")) {
    extended_mode = 1;
}
```

Pass `extended_mode` through to a new `qjs_init_extended(ctx)` called
from the existing init flow. That function registers the extended
modules / globals.

Detection from JS:
```js
if (globalThis.URL) { /* extended mode is active */ }
```

Or expose a more explicit flag:
```js
if (qjs.extended) { /* ... */ }
```

(Adding a `qjs` global namespace might also be useful for other
introspection — version, platform details, etc.)

### Why opt-in?

1. **Standards drift** — non-standard APIs change over time; gating
   them keeps the default stable.
2. **Memory** — every extra module adds to the library's resident size.
3. **Discoverability** — users running other people's scripts know
   immediately whether the script is using extended features (script
   author can document `qjs -x script.js`).
4. **Compatibility** — extended-off mode matches upstream qjs behavior
   exactly, so scripts ported from other quickjs-ng projects work.

---

## Tier 1: HIGH value, port soon

These would meaningfully help the most Amiga JS scripts.

### `URL` and `URLSearchParams` (WHATWG URL)

**Why:** Anyone touching HTTP needs URL parsing. Today we have to do
hand-rolled string slicing.

**Effort:** Medium. There are good single-file JS implementations of
WHATWG URL on GitHub we can adapt, or we can write a minimal C
implementation.

```js
const u = new URL('https://example.com/path?q=1#frag');
u.host;            // "example.com"
u.pathname;        // "/path"
u.searchParams.get('q'); // "1"
u.searchParams.set('q', '2');
u.toString();
```

**Recommendation:** Write a JS implementation, embed via qjsc bytecode.
~2000 lines of JS, well-tested.

### `TextEncoder` / `TextDecoder`

**Why:** Converting between strings and bytes is needed everywhere —
network protocols, file encoding sniffing, Latin-1/UTF-8 conversion.

**Effort:** Low. These are native classes wrapping our existing UTF-8
machinery. ~200 lines of C.

```js
new TextEncoder().encode('hello');           // Uint8Array
new TextDecoder().decode(uint8array);        // string
new TextDecoder('latin1').decode(bytes);     // for old Amiga text files
```

**Recommendation:** Add C-side classes. Critical for ISO-8859-1 (the
default Amiga text encoding).

### `path` module

**Why:** Path manipulation is universal. Currently scripts do crude
`split('/')` which breaks on Amiga's `Volume:Path` syntax.

**Effort:** Low. ~300 lines of JS, embedded as bytecode.

```js
import * as path from 'qjs:path';
path.join('RAM:', 'foo', 'bar.txt');     // "RAM:foo/bar.txt"
path.basename('Work:src/main.c');        // "main.c"
path.extname('image.png');               // ".png"
path.dirname('RAM:tmp/x.txt');           // "RAM:tmp"
path.parse('RAM:foo/bar.txt');           // {root, dir, base, name, ext}
path.resolve('foo', '../bar');           // resolves against cwd
path.sep;                                // "/" but / and : both separators
```

**Recommendation:** AmigaOS-aware variant of Node's path — treat both
`/` and `:` as separators. Drop functions that don't make sense
(`path.win32`).

### `crypto.subtle.digest` (hashing)

**Why:** SHA-1/SHA-256, MD5. Needed for downloads (checksum verify),
authentication, file deduplication. Today we'd have to shell out.

**Effort:** Medium. Either a bundled C implementation (~500-1000 lines
per algorithm) or use AmiSSL's already-loaded crypto routines via LVO.

```js
const crypto = await import('qjs:crypto');
const hash = await crypto.subtle.digest('SHA-256', bytes);
// returns ArrayBuffer
```

**Recommendation:** Wire to AmiSSL when available, soft-fall to
bundled C otherwise. Stub out `crypto.getRandomValues` using AmigaOS
EClock micros + DateStamp.

### `AbortController` + `AbortSignal`

**Why:** Cancelling fetches and timers. Without it, a fetch in
progress cannot be stopped — the user has to wait.

**Effort:** Low. ~200 lines C class. Then thread the signal through
fetch worker (worker periodically checks an atomic flag).

```js
const ac = new AbortController();
setTimeout(() => ac.abort(), 5000);
const r = await fetch(url, { signal: ac.signal });
```

**Recommendation:** High value once fetch matures.

### `console.error`, `.warn`, `.info`, `.debug`, `.assert`, `.table`, `.dir`

**Why:** Many scripts use these. Today only `console.log` exists; the
others crash with "not a function".

**Effort:** Trivial. Map to existing print machinery, error/warn go to
stderr.

```js
console.error("oops");        // -> stderr
console.warn("careful");      // -> stderr
console.info("FYI");          // -> stdout
console.debug("trace");       // -> stdout (suppressed unless -d)
console.assert(cond, msg);
console.dir(obj, { depth: 3 });
console.table([{a:1, b:2}]);  // ASCII table
```

**Recommendation:** Add unconditionally — these are de-facto standard
even outside Node.

### `globalThis.process` (subset)

**Why:** Many scripts assume `process.argv`, `process.env`,
`process.exit()`, `process.platform`. Maps cleanly to our std/os.

**Effort:** Low. ~50 lines of JS shim.

```js
process.argv;          // [exe, script, ...userArgs]
process.env.PATH;      // env variable
process.exit(0);       // exit
process.platform;      // "amigaos"
process.cwd();         // current directory
process.chdir(path);
```

**Recommendation:** Tier 1. Single biggest compatibility win for
ported Node code.

---

## Tier 2: MEDIUM value, port when convenient

### `Buffer` (or extended `Uint8Array` methods)

**Why:** Node code uses Buffer everywhere. We could either:
(a) Provide a Buffer class as a thin Uint8Array wrapper; or
(b) Add `Uint8Array.prototype.toString('utf-8')` and friends.

**Effort:** Low if we go (b), medium if we go (a) for full Node
compat.

**Recommendation:** Option (b) first for ergonomic boost. Provide
`Buffer` shim later only if there's demand.

### `EventEmitter`

**Why:** Pub/sub pattern used by tons of Node code. Would let us
implement other Node-compat APIs more easily.

**Effort:** Low. ~150 lines of JS.

```js
import { EventEmitter } from 'qjs:events';
const ee = new EventEmitter();
ee.on('data', d => print(d));
ee.emit('data', 'hello');
```

**Recommendation:** Bundle as JS, useful as building block.

### `util.promisify`, `util.inspect`, `util.format`

**Why:** `util.format` is what Node's console.log uses internally
(`%d`, `%s`, `%j`, `%o`). `util.promisify` converts callback APIs to
Promise APIs. `util.inspect` is what's behind `console.dir`.

**Effort:** Low. ~200 lines of JS.

**Recommendation:** Comes naturally with the console.* expansion.

### `queueMicrotask` global

**Why:** Standard scheduler primitive. Currently you have to use
`Promise.resolve().then(...)`.

**Effort:** Trivial. ~10 lines C.

```js
queueMicrotask(() => print('after current task'));
```

**Recommendation:** Add to globals when we add other web standards.

### `structuredClone`

**Why:** Standard deep-clone primitive. Replaces hand-rolled
`JSON.parse(JSON.stringify(...))` (which loses Maps, Dates, etc.).

**Effort:** Low. The `bjson.write/read` round-trip already does most
of this.

```js
const copy = structuredClone({ d: new Date(), m: new Map() });
```

**Recommendation:** Wrap bjson as a global.

### `Blob` and `File`

**Why:** Used by File API and modern fetch. Useful for binary data.

**Effort:** Medium. Wraps ArrayBuffer with metadata + slicing.

**Recommendation:** Add only when fetch grows multipart upload
support. Not urgent.

### `fs.promises` async wrapper

**Why:** Modern Node code is `await fs.readFile(path)`-style. Today
we only have synchronous std.loadFile/std.writeFile.

**Effort:** Low (JS shim that wraps the existing sync APIs in
already-resolved Promises) or medium (use CreateNewProc workers like
fetch does, for true async I/O).

**Recommendation:** Sync-wrapped-in-Promise version first. The
`CreateNewProc` infrastructure built for fetch could later be reused
here if benchmarks justify it.

### `child_process.exec` / `spawn` (Promise-based)

**Why:** `os.exec` is synchronous. Need async to keep REPL responsive
while compiling, etc.

**Effort:** Medium. Same `CreateNewProc` pattern as fetch.

**Recommendation:** After fetch shakes out, generalize the worker
machinery and reuse here.

---

## Tier 3: LOW value or doesn't fit

These are common in Node but don't make sense (or are too expensive)
on classic AmigaOS:

| API | Why not |
|-----|---------|
| `worker_threads` | No threads on classic AmigaOS. Use `CreateNewProc` directly. |
| `cluster` | Same. |
| `http`/`https` server | We're a script-runner, not a daemon platform. Possible but low priority. |
| `net` low-level sockets | Available via bsdsocket directly; fetch covers HTTP needs. |
| `tls` low-level | AmiSSL covers this; fetch handles HTTPS. |
| `dgram` UDP | Possible but niche. |
| `dns` resolver | Wraps `gethostbyname` which we already have. |
| `os.type/release/uptime` | Trivial wrappers but limited utility. |
| `v8` | N/A — different engine. |
| `vm` (script in sandbox) | Use a separate `JSContext` from C; not common in JS code. |
| `repl` (programmatic REPL) | Niche. |
| `readline` | Possible but the std file APIs cover most use cases. |

---

## Recommended sequence

If we attack this in order, each step builds on the last:

1. **`console.*` expansion + `globalThis.process`** — tiny, instant
   compat win for any ported code.
2. **`path` module** — small, universally needed.
3. **`URL` + `URLSearchParams`** — pairs naturally with fetch.
4. **`TextEncoder`/`TextDecoder`** — small, unblocks proper UTF-8/
   Latin-1 handling.
5. **Add the `-x`/`--extended` flag** when (1)-(4) are ready;
   gate them all behind it. Document the flag in autodocs.
6. **`AbortController`** — makes fetch cancellable.
7. **`crypto.subtle.digest`** — standalone, useful by itself.
8. **`util.format`/`util.promisify`/`util.inspect`** — supports
   console.dir/table.
9. **`structuredClone` + `queueMicrotask`** — small additions.
10. **`fs.promises` shim** — easy compat win.
11. **`Buffer` shim or extended Uint8Array methods** — depends on
    user demand.
12. **`EventEmitter`** — building block, port when something else
    needs it.
13. **Worker-based async `child_process`** — generalize the fetch
    worker infrastructure.

Stop at #6 or so for a meaningful first release of "qjs extended
mode". Iterate based on what scripts people actually write.

---

## Scripts to validate against

Once enough APIs land, test against:
- A simple package-manager-style script (URL parse, fetch, hash
  verify, write to disk, exec install hook).
- A directory walker that reports stats (path, fs.promises, util.
  format).
- A REST API client (fetch with AbortController, JSON, URLSearchParams).
- A static file server replacement using std/os file APIs (probably
  needs `http` server though, which is Tier 3).

If those work cleanly, the extended mode is genuinely useful.

---

## Open questions

- **Should `qjs` (no flag) be 100% upstream-compatible**, or are
  Amiga-specific additions like `Symbol.for('qjs.inspect')` and our
  fetch already crossing that line? Currently we already ship
  non-standard features unconditionally — if we're going to gate
  things behind `-x`, those should arguably move too. But that would
  break existing scripts. Decide before flipping the switch.

- **`fetch` and Response/Headers** are already shipped without a
  flag. Should they require `-x` going forward? Probably not —
  fetch is now WHATWG standard and shipped in Node since v18 by
  default. Keep it ungated.

- **AmigaOS-specific extensions** (custom inspect symbol, S:QJS-*
  files) — keep ungated since they're harmless and useful.

- **The `-x` flag's real purpose**: gate APIs that *don't yet exist
  in stock quickjs-ng* but are widely-used Node/web standards we're
  adding. That's a clean rule: if upstream qjs has it, no flag
  needed; if we invented or borrowed it, gate it.
