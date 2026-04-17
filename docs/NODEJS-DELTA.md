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
| `assert` | ○ | planned — Tier 2 |
| `async_hooks` | ✗ | Node-internal, no equivalent use-case on AmigaOS |
| `buffer` | ◐ | `globalThis.Buffer` (Tier 1 v1 — see below for omissions) |
| `child_process` | ○ | planned — needs Worker LVO (D5) |
| `cluster` | — | no OS-level forking on classic Amiga |
| `console` | ◐ | extended beyond upstream qjs (log/error/warn/info/debug/assert/dir/table/time/timeEnd/group/groupEnd/trace) |
| `crypto` | ○ | planned — AmiSSL-backed `crypto.subtle.digest`, `getRandomValues` (E1-E3) |
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
| `querystring` | ○ | use `URLSearchParams` instead (already present) |
| `readline` | ○ | no demand — REPL covers interactive use |
| `repl` | — | qjs has its own REPL; programmatic API not exposed |
| `stream` | ○ | substantial work; not planned v1 |
| `string_decoder` | ○ | `TextDecoder` covers modern use; add shim if demand appears |
| `sys` | ✗ | deprecated alias of `util` |
| `timers` | ◐ | `setTimeout` / `setInterval` / `clearTimeout` / `clearInterval` via `qjs:os`; `setImmediate` missing |
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
| `console.count` / `.countReset` | ○ | |
| `console.timeLog` | ○ | |

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
| `process.stdout` / `.stderr` / `.stdin` | ○ | use `std.out` / `std.err` / `std.in` directly |
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
| `events.once(emitter, ev)` (static) | ○ | not wrapped |
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
| `util.deprecate` | ○ | |
| `util.debuglog` | ○ | |
| `util.parseArgs` | ○ | useful; port if demand |
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
| `path.posix`, `path.win32` | ✗ | AmigaOS semantics only |
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
| `fs.promises.copyFile`, `.cp`, `.symlink`, `.chmod`, `.chown`, `.utimes`, `.truncate`, `.open` (FileHandle) | ○ | add as demand appears |
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
| `swap16`, `swap32`, `swap64` | ○ | |
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

### D5 — `child_process`

Second real Worker consumer. Will stress-test the `QJS_Worker*` LVO primitive's
generality. Needs:
- New C LVO that spawns a system command from a worker, captures stdout+stderr,
  returns exit code.
- JS API: `spawn(cmd, args, opts)` returning `{ stdout, stderr, exitCode }`
  Promise. Possibly also `exec(cmd)` and `execFile`.
- Test: `test_child_process.js`.

### E1-E3 — Crypto bridges

- E1 `crypto.subtle.digest('SHA-256' | 'SHA-1' | 'MD5', bytes)` via AmiSSL.
- E2 `crypto.getRandomValues(buf)` via EClock micros XOR'd with DateStamp
  (not cryptographic-grade on 3.x — document the caveat).
- E3 Thread `AbortSignal` into fetch so `.signal` actually cancels.

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
