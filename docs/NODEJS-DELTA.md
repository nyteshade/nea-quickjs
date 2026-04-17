# Node.js API Coverage Map

Per-module accounting of what Node.js stdlib provides vs what this Amiga port
(`nea-quickjs`) currently provides. Kept alongside `extended.js` so it stays
current as APIs land.

**Status legend**

| Symbol | Meaning |
|---|---|
| ✓ | Present, Node-compatible for the subset documented |
| ◐ | Partial — subset of the Node API, see per-module notes |
| ○ | Missing, but planned |
| ✗ | Intentionally skipped, see rationale |
| — | Not applicable to classic AmigaOS |

**Port goal:** useful Node compatibility for the *scripts people actually
write*, not 100% parity. Anything gated `✗` has a stated rationale below.

---

## Summary

| Node module | Status | Entry point |
|---|---|---|
| `assert` | ✓ | `globalThis.assert` — ok/equal/strictEqual/deepEqual/throws/rejects/match/etc. (0.101) |
| `async_hooks` | ✗ | Node-internal, no equivalent use-case on AmigaOS |
| `buffer` | ◐ | `globalThis.Buffer` (Tier 1 v1 — see below for omissions) |
| `child_process` | ◐ | `globalThis.child_process` — spawnSync/spawn/exec/execSync via `dos.library SystemTagList` (sync underneath) |
| `cluster` | — | no OS-level forking on classic Amiga |
| `console` | ◐ | extended beyond upstream qjs (log/error/warn/info/debug/assert/dir/table/time/timeEnd/group/groupEnd/trace) |
| `crypto` | ◐ | `globalThis.crypto.subtle.digest` + `getRandomValues` + `randomUUID` (E1 at 0.091 via AmiSSL) |
| `dgram` | ○ | possible via bsdsocket UDP — no demand yet |
| `dns` | ○ | `gethostbyname` already wired through fetch; expose as module when needed |
| `domain` | ✗ | deprecated upstream |
| `events` | ✓ | `globalThis.EventEmitter` (full Node API: on/once/off/emit + prepend/rawListeners/eventNames/listenerCount/removeAllListeners/setMaxListeners) |
| `fs` | ◐ | `fs.promises` subset via `globalThis.fs.promises` + `globalThis.fsPromises`; sync fs not yet exposed (use `qjs:std` / `qjs:os` directly) |
| `http` / `https` | ✗ | not a daemon platform — `fetch()` covers client needs |
| `http2` | ✗ | same |
| `inspector` | ✗ | no V8 inspector protocol |
| `module` | ◐ | ES modules via QuickJS-ng loader; CommonJS `require` is stubbed (`util` via `require('util')` works, broader require not planned) |
| `net` | ◐ | `qjs:net` module exposes TCP/TLS capability probe; no socket API yet |
| `os` | ◐ | `qjs:os` exposes FD I/O, timers, stat, exec, signals, cwd/chdir, platform; not the Node `os` shape |
| `path` | ✓ | `globalThis.path` (AmigaOS-aware: handles `Volume:` and `/`; subset of POSIX path) |
| `perf_hooks` | ○ | `process.hrtime()` available; full API not planned |
| `process` | ◐ | `globalThis.process` (argv, env, platform, arch, pid, ppid, exit, cwd, chdir, hrtime, nextTick) |
| `punycode` | ✗ | deprecated in Node |
| `querystring` | ✓ | `globalThis.querystring.parse/stringify/escape/unescape` (0.099) |
| `readline` | ○ | no demand — REPL covers interactive use |
| `repl` | — | qjs has its own REPL; programmatic API not exposed |
| `stream` | ◐ | `globalThis.stream.Readable/Writable/Transform/PassThrough` — push-based, no backpressure (v1) |
| `string_decoder` | ✓ | `globalThis.StringDecoder` — wraps TextDecoder with streaming semantics (0.099) |
| `sys` | ✗ | deprecated alias of `util` |
| `timers` | ◐ | `setTimeout` / `setInterval` / `clearTimeout` / `clearInterval` via `qjs:os`; `globalThis.timers.promises.setTimeout/setImmediate` at 0.101; AbortSignal honored |
| `tls` | ✗ | AmiSSL-backed HTTPS through fetch covers use-case |
| `trace_events` | ✗ | no upstream infra |
| `tty` | ◐ | `os.isatty` / `os.ttyGetWinSize` / `os.ttySetRaw` via `qjs:os` |
| `url` | ✓ | `globalThis.URL` + `globalThis.URLSearchParams` (WHATWG URL subset) |
| `util` | ◐ | `globalThis.util` — format / inspect / promisify / callbackify / inherits / types.* |
| `v8` | ✗ | different engine |
| `vm` | ○ | could wrap a new `JSContext`; no demand |
| `wasi` | ✗ | no WASI runtime |
| `worker_threads` | ✗ | `QJS_Worker*` LVO primitive serves `fetch` / planned `child_process`; JS-visible Worker API not planned |
| `zlib` | ○ | possible via xpk.library or bundled miniz; not planned v1 |

Web-platform APIs we provide that Node doesn't bundle (still relevant to
Node-style scripts that expect browser globals): `URL`, `URLSearchParams`,
`TextEncoder`, `TextDecoder`, `AbortController`, `AbortSignal`, `Headers`,
`fetch`, `queueMicrotask`, `structuredClone`, `crypto.subtle.digest` (planned).

---

## Present modules — details

### `console` — extended

Implemented in `extended.js` (`console-ext` manifest). Upstream qjs provides
`console.log` only; the rest are from this port.

| API | Status | Notes |
|---|---|---|
| `console.log` | ✓ | upstream qjs |
| `console.error`, `.warn` | ✓ | routed to stderr |
| `console.info`, `.debug` | ✓ | routed to stdout |
| `console.assert(cond, ...msg)` | ✓ | no throw, prints `Assertion failed: ...` on false |
| `console.dir(obj)` | ✓ | via `std.__printObject` |
| `console.table(rows)` | ✓ | ASCII-art table with `+---+` borders |
| `console.group`, `.groupEnd` | ◐ | stub — no actual indentation |
| `console.time`, `.timeEnd` | ✓ | microsecond precision via `os.now()` |
| `console.trace(...)` | ✓ | prepends "Trace:" + Error().stack |
| `console.count` / `.countReset` | ✓ | per-label counter (0.099) |
| `console.timeLog` | ✓ | non-destructive read of running timer (0.099) |

### `process` — Node global

Implemented in `extended.js` (`process` manifest).

| API | Status | Notes |
|---|---|---|
| `process.argv` | ✓ | `['qjs', ...scriptArgs]` |
| `process.env` | ✓ | Proxy over `std.getenv/setenv/unsetenv` |
| `process.platform` | ✓ | `'amigaos'` (non-standard value) |
| `process.arch` | ✓ | `'m68k'` (non-standard value) |
| `process.version`, `.versions` | ✓ | engine version strings |
| `process.pid`, `.ppid` | ◐ | hard-coded `1` / `0` — no Amiga task-ID mapping yet |
| `process.exit(code)` | ✓ | via `std.exit` |
| `process.cwd()` | ✓ | fixed in 0.088 — returns string, throws on errno |
| `process.chdir(path)` | ✓ | fixed in 0.088 — throws on errno |
| `process.hrtime([prev])` | ✓ | `[sec, nsec]` via `os.now()` microseconds |
| `process.nextTick(fn, ...args)` | ✓ | via `queueMicrotask` |
| `process.stdout` / `.stderr` / `.stdin` | ◐ | Writable-like objects at 0.101 — `.write(chunk)`, `.end()`, columns/rows getters via `os.ttyGetWinSize`, `isTTY` true. Not full streams; no pipe/backpressure. |
| `process.kill(pid, sig)` | ○ | no Amiga task-kill wrapper yet |
| `process.uptime()` | ○ | |
| `process.memoryUsage()` | ○ | partially available via `std.dumpMemoryUsage()` |

### `events.EventEmitter`

Implemented in `extended.js` (`event-emitter` manifest) as `globalThis.EventEmitter`.

| API | Status | Notes |
|---|---|---|
| `new EventEmitter()` | ✓ | |
| `.on(ev, fn)` / `.addListener` | ✓ | |
| `.off(ev, fn)` / `.removeListener` | ✓ | |
| `.once(ev, fn)` | ✓ | |
| `.prependListener`, `.prependOnceListener` | ✓ | |
| `.emit(ev, ...args)` | ✓ | throws on unhandled `'error'` event per Node semantics |
| `.removeAllListeners([ev])` | ✓ | |
| `.setMaxListeners(n)`, `.getMaxListeners()` | ✓ | default 10; warning printed on exceed |
| `.listeners(ev)`, `.rawListeners(ev)` | ✓ | |
| `.listenerCount(ev)` | ✓ | |
| `.eventNames()` | ✓ | |
| meta-events (`newListener`, `removeListener`) | ✓ | |
| `EventEmitter.defaultMaxListeners` | ✓ | |
| `EventEmitter.once(emitter, ev)` (static) | ✓ | returns Promise resolving with emission args; rejects on 'error' (0.099) |
| `events.on(emitter, ev)` async iter | ○ | |
| `events.captureRejections` | ✗ | |

### `util`

Implemented in `extended.js` (`util` manifest) as `globalThis.util`.

| API | Status | Notes |
|---|---|---|
| `util.format(fmt, ...args)` | ✓ | `%s %d %i %f %j %o %O %%` + trailing inspect |
| `util.inspect(v, opts)` | ◐ | basic: primitives, arrays, objects, circular detection; no `depth`/`colors`/custom inspector hook |
| `util.promisify(fn)` | ✓ | last-arg-callback → Promise |
| `util.callbackify(fn)` | ✓ | inverse |
| `util.inherits(ctor, super)` | ✓ | legacy Node API, shim |
| `util.types.isArray/isDate/isRegExp/isError/isPromise/isMap/isSet/isWeakMap/isWeakSet/isArrayBuffer/isTypedArray/isUint8Array/isFunction` | ✓ | |
| `util.types.isNativeError`, `.isAnyArrayBuffer`, etc. | ○ | long tail |
| `util.deprecate(fn, msg)` | ✓ | first-call warning on stderr (0.099) |
| `util.debuglog(section)` | ✓ | `NODE_DEBUG=section`-gated logger to stderr (0.099) |
| `util.parseArgs({args, options, allowPositionals})` | ✓ | supports `--key`, `--key=val`, `-shortAlias`, boolean/string/multiple types (0.099) |
| `util.styleText` | ○ | |

### `path`

Implemented in `extended.js` (`path` manifest) as `globalThis.path`.
AmigaOS-aware — treats both `/` and `:` as separators.

| API | Status | Notes |
|---|---|---|
| `path.sep` | ✓ | `'/'` |
| `path.delimiter` | ✓ | `';'` |
| `path.isAbsolute(p)` | ✓ | detects `Volume:` or leading `/` |
| `path.basename(p, ext?)` | ✓ | |
| `path.dirname(p)` | ✓ | |
| `path.extname(p)` | ✓ | |
| `path.join(...segs)` | ✓ | |
| `path.normalize(p)` | ✓ | handles `.` and `..` |
| `path.resolve(...segs)` | ✓ | uses `os.getcwd()` for relative base |
| `path.relative(from, to)` | ✓ | |
| `path.parse(p)` | ✓ | `{ root, dir, base, ext, name }` |
| `path.format(obj)` | ✓ | inverse of parse |
| `path.posix`, `path.win32` | ◐ | Alias to `path` at 0.101 — Node code that imports `path.posix` gets AmigaOS-aware behavior rather than erroring. |
| `path.toNamespacedPath` | — | Windows-only |

### `url` — WHATWG URL (web + Node alias)

Implemented in `extended.js` (`url` manifest) as `globalThis.URL` and
`globalThis.URLSearchParams`. Node's `url` module re-exports the same.
**Contains zero regex literals as of 0.087** due to Amiga regex-compiler bug —
any future edits must stay regex-free (see Fina `gotcha,regex,amiga`).

| API | Status | Notes |
|---|---|---|
| `new URL(str, base?)` | ✓ | scheme / userinfo / host / port / path / query / fragment |
| `url.protocol`, `.username`, `.password`, `.host`, `.hostname`, `.port`, `.pathname`, `.search`, `.hash`, `.origin` | ✓ | getters + setters |
| `url.searchParams` | ✓ | back-linked USP |
| `url.href`, `.toString()`, `.toJSON()` | ✓ | |
| `URL.canParse(str, base?)` | ✓ | |
| `URL.createObjectURL` / `revokeObjectURL` | ✗ | browser API, no Blob store |
| `new URLSearchParams(init)` | ✓ | string / array / object init |
| USP `.get/.getAll/.set/.append/.delete/.has/.sort/.size/.forEach/.keys/.values/.entries/.toString/[Symbol.iterator]` | ✓ | |

### `crypto` (WebCrypto subset)

Implemented in `extended.js` (`crypto` manifest). **Works without AmiSSL** —
SHA-1 / SHA-256 / MD5 are pure-JS implementations in the bundle. AmiSSL
is used as an optional fast-path when available (faster for large inputs)
but isn't required. SHA-384 / SHA-512 require AmiSSL (64-bit arithmetic
too slow in pure-JS on 68k).

| API | Status | Notes |
|---|---|---|
| `crypto.subtle.digest('SHA-1'\|'SHA-256'\|'MD5', data)` | ✓ | Pure-JS primary path; AmiSSL fast-path tried first when available. Returns `Promise<ArrayBuffer>`. |
| `crypto.subtle.digest('SHA-384'\|'SHA-512', data)` | ◐ | AmiSSL-only. Clean rejection with actionable error if AmiSSL absent. |
| `crypto.subtle.has(algo)` | ✓ | Returns `true` if the algorithm will work in this build. Use before calling `digest()` to avoid exceptions. |
| `crypto.getRandomValues(view)` | ◐ | Fills an integer TypedArray. **NOT cryptographic-grade** — DateStamp-seeded LCG (native) or `Math.random` (fallback). Fine for UUIDs/session IDs, unsafe for key material. |
| `crypto.randomUUID()` | ✓ | RFC 4122 v4 UUID built on `getRandomValues`. |
| `crypto.subtle.encrypt / decrypt / sign / verify` | ○ | planned if demand |
| `crypto.subtle.generateKey / importKey` | ○ | |
| HMAC / HKDF / PBKDF2 | ○ | AmiSSL has the primitives, no JS wrapper yet |

No graceful-degradation gotchas: `digest()` works on Amigas without AmiSSL and/or without bsdsocket, for the three most commonly needed algorithms. Users who want SHA-384/SHA-512 on non-AmiSSL systems can check `crypto.subtle.has('SHA-512')` first.

### `stream` (v1)

Implemented in `extended.js` (`stream` manifest) as `globalThis.stream`.
Push-based, no backpressure — enough to wrap fs/child_process producers
and pipe them to sinks without blocking the event loop on large inputs.

| API | Status | Notes |
|---|---|---|
| `stream.Readable` | ✓ | `new Readable({ read })`, `.push(chunk)`, `.push(null)`, `.on('data'\|'end'\|'error')`, `.pipe(dest)` |
| `Readable.from(iterable)` | ✓ | Drains iterable into a Readable via microtask |
| `stream.Writable` | ✓ | `new Writable({ write(chunk, cb) })`, `.write()`, `.end()`, `.on('finish'\|'error')` |
| `stream.Transform` | ✓ | `new Transform({ transform(chunk, enc, cb) })` — default is pass-through |
| `stream.PassThrough` | ✓ | alias of Transform with no override |
| backpressure (`write()` returns false) | ✗ | v1 always returns true — callers must not flood |
| object mode | ✗ | all chunks pass through as-is |
| `highWaterMark` | ✗ | no buffering limit |
| `Readable.read(n)` pull mode | ○ | push-mode only in v1 |
| Duplex | ○ | |
| `stream.pipeline(...streams, cb?)` | ✓ | wires chain via .pipe, resolves on finish, rejects on any error (0.099) |

The no-backpressure limitation is acceptable for Amiga use cases (file
copies, child_process output capture, short HTTP bodies) where producer
and consumer run in the same event loop and the producer doesn't
outpace the consumer by orders of magnitude.

### `child_process`

Implemented in `extended.js` (`child-process` manifest) as `globalThis.child_process`,
backed by native `__qjs_spawnSync` installed from the library (LVO
`QJS_InstallChildProcessGlobal`). Uses `dos.library SystemTagList` with
`SYS_Output`/`SYS_Error` captured to `T:qjs-cp-<task>-{out,err}` temp files.

| API | Status | Notes |
|---|---|---|
| `spawnSync(cmd, args, opts)` | ✓ | returns `{ stdout, stderr, exitCode, signal: null }` |
| `spawn(cmd, args, opts)` | ◐ | returns `Promise<{stdout, stderr, exitCode}>` — truly async via `QJS_Worker` at 0.100+. Still not Node-accurate (Node returns ChildProcess EventEmitter with stream stdin/out/err); functionally like Node's `execFile` with `utf8` encoding. Needs stream-backed stdout/stderr to fully match Node. Single-concurrent spawn slot. |
| `exec(cmd, opts)` | ◐ | Promise-wrapped single-string — Amiga shell resolves the cmdline |
| `execSync(cmd, opts)` | ✓ | sync single-string shell-style |
| `fork` | ✗ | no fork semantics on Amiga |
| `execFile` | ○ | identical to `spawn` on Amiga — alias if demand appears |
| true async spawn | ○ | would wrap `__qjs_spawnSync` in a `QJS_Worker` — deferred |
| streaming stdio, ChildProcess events | ○ | |
| `SIGINT`/signal delivery | ○ | no signal model on classic Amiga |

`SYS_Error` tag is V50+. On Kickstart V47 (3.2.2) `stderr` falls through
to the console instead of our temp file — `result.stderr` will be empty
but `stdout` and `exitCode` still work.

### `fs.promises`

Implemented in `extended.js` (`fs-promises` manifest) as `globalThis.fs.promises`
and `globalThis.fsPromises`. Wraps sync `qjs:os` primitives — I/O is
synchronous under the hood.

| API | Status | Notes |
|---|---|---|
| `fs.promises.readFile(path, opts)` | ✓ | returns Buffer or string per encoding |
| `fs.promises.writeFile(path, data, opts)` | ✓ | |
| `fs.promises.appendFile(path, data, opts)` | ✓ | |
| `fs.promises.stat(path)` | ✓ | `isFile()`, `isDirectory()` methods; `isSymbolicLink()` always false |
| `fs.promises.lstat(path)` | ◐ | aliased to `stat` (no symlinks on classic Amiga) |
| `fs.promises.unlink(path)` | ✓ | |
| `fs.promises.rename(old, new)` | ✓ | |
| `fs.promises.mkdir(path, opts)` | ✓ | `mode` accepted, not enforced on Amiga |
| `fs.promises.readdir(path)` | ✓ | filters `.`/`..` per Node |
| `fs.promises.access(path)` | ✓ | |
| `fs.promises.copyFile(src, dst)` | ✓ | read-then-write via std.open; no flags (0.099) |
| `fs.promises.truncate(path, len)` | ✓ | read-truncate-write approach (0.099) |
| `fs.promises.utimes(path, atime, mtime)` | ◐ | stub — resolves without actually updating times (no qjs:os API yet) |
| `fs.constants` | ✓ | F_OK/R_OK/W_OK/X_OK + O_* flags (0.099) |
| `fs.promises.cp / symlink / chmod / chown / open (FileHandle)` | ○ | add as demand appears |
| `fs` (sync namespace) | ○ | use `qjs:std` / `qjs:os` directly for now |
| `fs.createReadStream/WriteStream` | ○ | streams not yet supported |

### `buffer.Buffer`

Implemented in `extended.js` (`buffer` manifest) as `globalThis.Buffer`.
Extends `Uint8Array` so all TypedArray methods work alongside Node methods.

| API | Status | Notes |
|---|---|---|
| `Buffer.alloc(n, fill?, enc?)` | ✓ | zeroed |
| `Buffer.allocUnsafe(n)`, `.allocUnsafeSlow(n)` | ✓ | |
| `Buffer.from(arg, enc?)` | ✓ | string/array/ArrayBuffer/TypedArray/Buffer |
| `Buffer.isBuffer(obj)` | ✓ | |
| `Buffer.byteLength(str, enc?)` | ✓ | utf-8/ascii/latin1/hex/base64 |
| `Buffer.concat(list, total?)` | ✓ | |
| `Buffer.compare(a, b)` | ✓ | |
| `.toString(enc?, start?, end?)` | ✓ | utf-8/ascii/latin1/hex/base64 |
| `.write(str, off?, len?, enc?)` | ✓ | |
| `.equals`, `.compare`, `.indexOf`, `.includes`, `.fill`, `.copy` | ✓ | |
| `.subarray` / `.slice` | ✓ | Node semantics (shares memory) |
| `readUInt8/Int8` + 16/32 LE+BE (6 of each width) | ✓ | |
| `writeUInt8/Int8` + 16/32 LE+BE | ✓ | |
| `.toJSON()` | ✓ | |
| Float / Double / BigInt64 read & write | ✗ | softfloat cost on no-FPU; add for FPU-only builds if demand |
| `swap16`, `swap32`, `swap64` | ✓ | in-place byte-order swap; throw on unaligned length (0.099) |
| `Float32/Float64` read/write (LE+BE) | ✓ | DataView-backed; FPU builds native, softfloat builds slow-but-correct (0.099) |
| `utf-16le` encoding | ○ | rare in practice |
| `Buffer.poolSize`, pooling | ✗ | no pool — allocations go through runtime allocator |

### Global web-platform APIs (Node ≥18 bundles these too)

| API | Status | Manifest |
|---|---|---|
| `fetch(url, opts?)` | ✓ | built-in (quickjs-libc) — HTTP / HTTPS, Response, Headers, arrayBuffer/json/text |
| `Headers`, `Response` | ✓ | built-in |
| `URL`, `URLSearchParams` | ✓ | `url` manifest |
| `TextEncoder`, `TextDecoder` | ✓ | `text-encoding` manifest — utf-8 + latin1 |
| `AbortController`, `AbortSignal` | ✓ | `abort` manifest — not yet wired into fetch |
| `queueMicrotask(fn)` | ✓ | `queue-microtask` manifest |
| `structuredClone(v)` | ◐ | `structured-clone` manifest — JSON round-trip (loses Date/Map/Set) |
| `crypto.subtle.digest`, `crypto.getRandomValues` | ○ | planned — E-tier via AmiSSL |
| `Blob`, `File` | ○ | add with fetch multipart |
| `FormData` | ○ | |
| `performance.now`, `.timeOrigin` | ◐ | `os.now()` covers functionality; no `globalThis.performance` object yet |

---

## Planned (tier-ordered)

Rough sequence — can reorder based on demand. Each tier depends on the
previous for at most boilerplate, not critical path.

### C — mid-flight fetch cancel

JS-level `fetch(url, {signal})` ships at 0.096: when the signal fires, the
returned Promise rejects with an `AbortError` DOMException. Good enough for
most use cases — caller's `await` stops waiting, error propagates normally.

What's *not* there: the underlying HTTP worker keeps running to completion
and its result is silently discarded. For large-payload transfers where the
user wants to free the socket/bandwidth immediately, the worker needs to
poll an atomic abort flag in the `recv` loop and close the socket early.
That's ~30 lines of C in `sharedlib_fetch.c` — deferred until demand.

### F — `assert`

Small JS module. `assert.equal / deepEqual / strictEqual / throws / rejects / match`.

### G — `stream` subset

Even `Readable.from(iterable)` + `pipeline()` would unblock a lot of ported code.
Full Streams2/3 API is out of scope.

### H — `timers` completion

`setImmediate`, `timers.promises.setTimeout`, etc.

---

## Skipped — rationale

| Module | Reason |
|---|---|
| `worker_threads` | `QJS_Worker*` LVO already serves fetch/child_process; exposing it as a JS-visible `Worker` would need a second `JSRuntime` per worker and cross-runtime message serialization. Too much cost for a single-user platform. |
| `cluster` | No OS-level forking on classic AmigaOS. Tasks (our `QJS_Worker`) are not a drop-in substitute because they share address space. |
| `http` / `http2` server | We're a script runner, not a daemon platform. Not precluded — just not a goal. |
| `tls` low-level | AmiSSL-backed HTTPS through `fetch` covers the 95% case. Exposing raw TLS handshake API would duplicate work. |
| `domain`, `sys`, `punycode` | Deprecated upstream. |
| `inspector`, `v8`, `trace_events` | V8-specific. Different engine. |
| `wasi` | No WASI runtime on 68k. |
| `path.posix` / `path.win32` | Our `path` is AmigaOS-native (`/` and `:` both separators). Supporting other flavors would confuse users on-platform. |

---

## Non-Node features we add

Won't find these in Node but useful enough to ship:

- `globalThis.qjs` — `qjs.extended`, `qjs.version`, `qjs.modules.list/get/has` for introspecting what was installed.
- `Symbol.for('qjs.inspect')` — method protocol for custom console/REPL rendering.
- `qjs:net` module — `Networking.hasTCP / hasTLS / status / reprobe` capability probe.
- `qjs:std` — file I/O, `getenv/setenv`, `exit`, `loadScript`, `printObject` etc. (from upstream qjs, used under the hood).
- `qjs:os` — FD I/O, timers, process, stat, signals (from upstream qjs).
- `qjs:bjson` — binary JSON with Map/Set/Date fidelity.

---

## Keeping this document current

This is a *living* accounting. Update it in the same commit that lands or
removes a module. `MORNING_CHECKLIST.md` references this file when auditing
releases.

Section-edit rules:
- Add a new row to the summary table and a detail section when a manifest lands.
- Move items from "Planned" to "Present modules" when they ship.
- Add rationale to "Skipped" if we decide against implementing something.
- Update the "Status" symbols (✓/◐/○/✗) as coverage evolves within a module.
