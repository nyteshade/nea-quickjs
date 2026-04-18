/*
 * extended.js -- Amiga port extended features (Tier 1)
 *
 * Loaded at CLI startup unless --no-extensions (or -nox) is passed.
 * Default on Amiga: enabled.  Amiga users expect the full experience.
 *
 * Organized as a collection of feature modules, each with a manifest
 * object declaring its metadata and an install() function.  The
 * manifests are exposed via globalThis.qjs.modules for introspection.
 *
 * THIS IS A SINGLE-BUNDLE FILE.  Runtime-loaded third-party plugins
 * (from LIBS:quickjs/modules/, a future phase) follow a different,
 * richer contract using the ne-extension / ne-enumeration SDK in
 * quickjs-master/amiga/extended/builtin/ -- see qjs:modules and
 * qjs:extension.
 *
 * To modify a built-in feature: edit its section below, run
 *     qjsc -ss -m -N qjsc_extended \
 *          -o quickjs-master/gen/extended.c \
 *          quickjs-master/amiga/extended/extended.js
 * then rebuild the CLI (make -C library/vbcc -f Makefile.cli).
 */

import * as std from 'qjs:std';
import * as os  from 'qjs:os';

/* ==========================================================
 * LocalManifest -- lightweight manifest for built-ins.
 *
 * Third-party plugins use the richer Manifest class from
 * qjs:modules (when runtime plugin loading is wired up in
 * Phase C1).  For built-ins we just need the metadata +
 * install() hook; reversibility is unnecessary because
 * built-ins install once at startup and never unload.
 * ========================================================== */

class LocalManifest {
    constructor(opts) {
        this.name        = opts.name;
        this.tier        = opts.tier;
        this.provider    = opts.provider;
        this.version     = opts.version ?? '1.0.0';
        this.description = opts.description ?? '';
        this.requires    = opts.requires ?? [];
        this.globals     = opts.globals ?? [];
        this.exports     = opts.exports ?? [];
        this.standard    = opts.standard ?? false;
        this._install    = opts.install;
        this._applied    = false;
    }

    apply() {
        if (this._applied) return;
        if (this._install) this._install();
        this._applied = true;
    }

    toJSON() {
        return {
            name:        this.name,
            tier:        this.tier,
            provider:    this.provider,
            version:     this.version,
            description: this.description,
            requires:    this.requires,
            globals:     this.globals,
            exports:     this.exports,
            standard:    this.standard,
            applied:     this._applied,
        };
    }
}

const _manifests = [];

/* ==========================================================
 * Feature: console.* expansion
 * Tier: pure-js    Provider: nea-port    Standard: web
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'console-ext',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'console.error/warn/info/debug/assert/dir/table/time/timeEnd/group/groupEnd/trace',
    globals:     ['console.error', 'console.warn', 'console.info',
                  'console.debug', 'console.assert', 'console.dir',
                  'console.table', 'console.time', 'console.timeEnd',
                  'console.group', 'console.groupEnd', 'console.trace'],
    standard:    true,
    install() {
        const orig_log = globalThis.console.log;

        function write(stream, ...args) {
            for (let i = 0; i < args.length; i++) {
                if (i > 0) stream.puts(' ');
                const a = args[i];
                if (typeof a === 'string') { stream.puts(a); continue; }
                try { std.__printObject(a); }
                catch (e) { stream.puts(String(a)); }
            }
            stream.puts('\n');
            stream.flush();
        }

        globalThis.console.error = (...a) => write(std.err, ...a);
        globalThis.console.warn  = (...a) => write(std.err, ...a);
        globalThis.console.info  = (...a) => write(std.out, ...a);
        globalThis.console.debug = (...a) => write(std.out, ...a);

        globalThis.console.assert = (cond, ...msg) => {
            if (cond) return;
            std.err.puts('Assertion failed');
            if (msg.length) {
                std.err.puts(': ');
                for (let i = 0; i < msg.length; i++) {
                    if (i > 0) std.err.puts(' ');
                    std.err.puts(String(msg[i]));
                }
            }
            std.err.puts('\n');
            std.err.flush();
        };

        globalThis.console.dir = (obj) => {
            try { std.__printObject(obj); std.out.puts('\n'); std.out.flush(); }
            catch (e) { orig_log(obj); }
        };

        globalThis.console.table = (data) => {
            if (!Array.isArray(data) || data.length === 0) { orig_log(data); return; }
            const cols = new Set();
            for (const row of data) {
                if (row && typeof row === 'object') {
                    for (const k of Object.keys(row)) cols.add(k);
                }
            }
            const headers = ['(idx)', ...cols];
            const rows = data.map((r, i) => {
                const row = [String(i)];
                for (const c of cols) {
                    row.push(r && typeof r === 'object'
                             ? String(r[c] ?? '') : String(r));
                }
                return row;
            });
            const widths = headers.map((h, ci) => Math.max(h.length,
                ...rows.map(r => r[ci].length)));
            const fmt = (r) => '| ' + r.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |';
            const sep = '+-' + widths.map(w => '-'.repeat(w)).join('-+-') + '-+';
            std.out.puts(sep + '\n');
            std.out.puts(fmt(headers) + '\n');
            std.out.puts(sep + '\n');
            for (const r of rows) std.out.puts(fmt(r) + '\n');
            std.out.puts(sep + '\n');
            std.out.flush();
        };

        globalThis.console.group = (...args) => {
            if (args.length) write(std.out, ...args);
        };
        globalThis.console.groupEnd = () => {};

        const _timers = new Map();
        globalThis.console.time = (label = 'default') => {
            _timers.set(label, os.now());
        };
        globalThis.console.timeEnd = (label = 'default') => {
            const start = _timers.get(label);
            if (start === undefined) {
                globalThis.console.warn(`No such label: ${label}`);
                return;
            }
            const elapsed = (os.now() - start) / 1000;
            globalThis.console.log(`${label}: ${elapsed.toFixed(3)}ms`);
            _timers.delete(label);
        };

        globalThis.console.trace = (...args) => {
            write(std.err, 'Trace:', ...args);
            const stack = new Error().stack;
            if (stack) std.err.puts(stack + '\n');
        };

        /* console.timeLog(label, ...args) — non-destructive read of a running
         * timer. Prints `label: Xms args...` without deleting the timer.
         * Node-compatible. */
        globalThis.console.timeLog = (label = 'default', ...args) => {
            const start = _timers.get(label);
            if (start === undefined) {
                globalThis.console.warn(`No such label: ${label}`);
                return;
            }
            const elapsed = (os.now() - start) / 1000;
            const extra = args.length ? ' ' + args.map(String).join(' ') : '';
            globalThis.console.log(`${label}: ${elapsed.toFixed(3)}ms${extra}`);
        };

        /* console.count(label?) + console.countReset(label?) — tracks a per-
         * label call-count counter, prints `label: N` on each call. */
        const _counts = new Map();
        globalThis.console.count = (label = 'default') => {
            const n = (_counts.get(label) || 0) + 1;
            _counts.set(label, n);
            globalThis.console.log(`${label}: ${n}`);
        };
        globalThis.console.countReset = (label = 'default') => {
            if (!_counts.has(label)) {
                globalThis.console.warn(`Count for '${label}' does not exist`);
                return;
            }
            _counts.delete(label);
        };
    },
}));

/* ==========================================================
 * Feature: globalThis.process  (Node.js compatibility)
 * Tier: pure-js    Provider: nea-port
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'process',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node.js process global — argv, env, exit, platform, cwd, hrtime, nextTick, uptime, memoryUsage',
    globals:     ['process'],
    standard:    false,
    install() {
        const _startUs = os.now();
        globalThis.process = {
            argv: (globalThis.scriptArgs ? ['qjs', ...globalThis.scriptArgs] : ['qjs']),
            env: new Proxy({}, {
                get(_, name) {
                    if (typeof name !== 'string') return undefined;
                    return std.getenv(name);
                },
                set(_, name, value) {
                    if (typeof name !== 'string') return false;
                    std.setenv(name, String(value));
                    return true;
                },
                deleteProperty(_, name) {
                    if (typeof name !== 'string') return true;
                    std.unsetenv(name);
                    return true;
                },
                has(_, name) {
                    return typeof name === 'string' && std.getenv(name) !== undefined;
                },
            }),
            platform: 'amigaos',
            arch:     'm68k',
            version:  'v0.66',
            versions: { qjs: '0.66', quickjs: '0.12.1' },
            pid: 1, ppid: 0,
            exit(code) { std.exit(code ?? 0); },
            cwd() {
                const r = os.getcwd();
                const path = r[0], err = r[1];
                if (err) throw new Error(`getcwd: ${std.strerror(err)}`);
                return path;
            },
            chdir(path) {
                const err = os.chdir(path);
                if (err) throw new Error(`chdir: ${std.strerror(err)}`);
            },
            hrtime(prev) {
                const now = os.now();
                const sec  = Math.floor(now / 1000000);
                const nsec = (now % 1000000) * 1000;
                const t = [sec, nsec];
                if (prev && Array.isArray(prev)) {
                    let ds = t[0] - prev[0];
                    let dn = t[1] - prev[1];
                    if (dn < 0) { ds--; dn += 1e9; }
                    return [ds, dn];
                }
                return t;
            },
            nextTick(fn, ...args) { queueMicrotask(() => fn(...args)); },
            uptime() {
                /* Seconds since this process initialised globalThis.process. */
                return (os.now() - _startUs) / 1e6;
            },
            memoryUsage() {
                /* Shape matches Node.js. Classic AmigaOS doesn't give us the
                 * V8 heap telemetry Node exposes — we return the shape with
                 * zeros so scripts that call this don't crash. Wire to a
                 * native LVO (JS_ComputeMemoryUsage) when demand appears. */
                return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
            },
        };
        globalThis.process.memoryUsage.rss = () => 0;
    },
}));

/* ==========================================================
 * Feature: performance  (web High Resolution Time — Node ≥16 bundles this)
 * Tier: pure-js    Provider: nea-port    Standard: web
 *
 * `performance.now()` returns a DOMHighResTimeStamp — milliseconds
 * with sub-ms precision relative to `performance.timeOrigin`.
 * We use `os.now()` microseconds as the underlying clock, so
 * resolution is 1µs (same as Node on Linux).
 *
 * User marks / measures are stored in a single Map; .getEntries
 * family is supported for basic instrumentation. Resource timing
 * isn't meaningful on Amiga — getEntriesByType('resource') returns
 * an empty array.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'performance',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'performance.now / timeOrigin / mark / measure / getEntries* — web High Resolution Time',
    globals:     ['performance'],
    standard:    true,
    install() {
        const _originUs = os.now();
        const _timeOriginMs = Date.now() - _originUs / 1000;
        const _entries = [];

        function _now() { return (os.now() - _originUs) / 1000; }

        function _addEntry(entry) {
            _entries.push(entry);
        }

        globalThis.performance = {
            get timeOrigin() { return _timeOriginMs; },
            now() { return _now(); },
            mark(name, opts) {
                const startTime = (opts && typeof opts.startTime === 'number')
                    ? opts.startTime
                    : _now();
                const entry = {
                    name: String(name),
                    entryType: 'mark',
                    startTime,
                    duration: 0,
                    detail: (opts && opts.detail !== undefined) ? opts.detail : null,
                };
                _addEntry(entry);
                return entry;
            },
            measure(name, startOrOpts, endMark) {
                let startTime, duration, detail = null;
                if (typeof startOrOpts === 'object' && startOrOpts !== null) {
                    const o = startOrOpts;
                    const start = (o.start !== undefined) ? resolveMark(o.start) : 0;
                    const end = (o.end !== undefined) ? resolveMark(o.end) : _now();
                    startTime = start;
                    duration = end - start;
                    if (o.detail !== undefined) detail = o.detail;
                } else if (typeof startOrOpts === 'string') {
                    const start = resolveMark(startOrOpts);
                    const end = endMark !== undefined ? resolveMark(endMark) : _now();
                    startTime = start;
                    duration = end - start;
                } else {
                    startTime = 0;
                    duration = _now();
                }
                const entry = {
                    name: String(name),
                    entryType: 'measure',
                    startTime,
                    duration,
                    detail,
                };
                _addEntry(entry);
                return entry;
            },
            getEntries() { return _entries.slice(); },
            getEntriesByName(name, type) {
                return _entries.filter(e => e.name === name && (!type || e.entryType === type));
            },
            getEntriesByType(type) {
                return _entries.filter(e => e.entryType === type);
            },
            clearMarks(name) {
                for (let i = _entries.length - 1; i >= 0; i--) {
                    const e = _entries[i];
                    if (e.entryType === 'mark' && (!name || e.name === name))
                        _entries.splice(i, 1);
                }
            },
            clearMeasures(name) {
                for (let i = _entries.length - 1; i >= 0; i--) {
                    const e = _entries[i];
                    if (e.entryType === 'measure' && (!name || e.name === name))
                        _entries.splice(i, 1);
                }
            },
            clearResourceTimings() { /* no-op on Amiga */ },
            toJSON() { return { timeOrigin: _timeOriginMs }; },
        };

        function resolveMark(nameOrTime) {
            if (typeof nameOrTime === 'number') return nameOrTime;
            const mark = _entries.find(e => e.entryType === 'mark' && e.name === nameOrTime);
            if (!mark) throw new SyntaxError(`performance: mark '${nameOrTime}' not found`);
            return mark.startTime;
        }
    },
}));

/* ==========================================================
 * Feature: global timers — setTimeout/setInterval/clearTimeout/
 *          clearInterval as plain globals (Node/web convention)
 * Tier: pure-js    Provider: nea-port    Standard: web
 *
 * qjs:os exposes these under the os namespace. Node and browsers
 * make them globals; scripts assume it. Alias at the global
 * scope here so `setTimeout(fn, ms)` just works.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'global-timers',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'setTimeout/setInterval/clearTimeout/clearInterval at global scope',
    globals:     ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'],
    standard:    true,
    install() {
        if (typeof globalThis.setTimeout !== 'function')
            globalThis.setTimeout = os.setTimeout;
        if (typeof globalThis.setInterval !== 'function')
            globalThis.setInterval = os.setInterval;
        if (typeof globalThis.clearTimeout !== 'function')
            globalThis.clearTimeout = os.clearTimeout;
        if (typeof globalThis.clearInterval !== 'function')
            globalThis.clearInterval = os.clearInterval;
    },
}));

/* ==========================================================
 * Feature: queueMicrotask  (polyfill if missing)
 * Tier: pure-js    Provider: nea-port    Standard: web
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'queue-microtask',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'queueMicrotask() global polyfill',
    globals:     ['queueMicrotask'],
    standard:    true,
    install() {
        if (typeof globalThis.queueMicrotask === 'function') return;
        globalThis.queueMicrotask = (cb) => {
            Promise.resolve().then(() => {
                try { cb(); }
                catch (e) {
                    try { globalThis.console.error('queueMicrotask error:', e); }
                    catch (_) {}
                }
            });
        };
    },
}));

/* ==========================================================
 * Feature: TextEncoder / TextDecoder
 * Tier: pure-js    Provider: nea-port    Standard: web
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'text-encoding',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'TextEncoder + TextDecoder (UTF-8 + Latin-1)',
    globals:     ['TextEncoder', 'TextDecoder'],
    standard:    true,
    install() {
        class TextEncoder {
            get encoding() { return 'utf-8'; }
            encode(str = '') {
                str = String(str);
                const bytes = [];
                let i = 0;
                while (i < str.length) {
                    let c = str.charCodeAt(i++);
                    if (c >= 0xD800 && c <= 0xDBFF && i < str.length) {
                        const c2 = str.charCodeAt(i);
                        if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
                            c = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
                            i++;
                        }
                    }
                    if (c < 0x80) bytes.push(c);
                    else if (c < 0x800) bytes.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
                    else if (c < 0x10000) bytes.push(0xE0 | (c >> 12),
                                                     0x80 | ((c >> 6) & 0x3F),
                                                     0x80 | (c & 0x3F));
                    else bytes.push(0xF0 | (c >> 18),
                                    0x80 | ((c >> 12) & 0x3F),
                                    0x80 | ((c >> 6) & 0x3F),
                                    0x80 | (c & 0x3F));
                }
                return new Uint8Array(bytes);
            }
            encodeInto(str, dest) {
                const enc = this.encode(str);
                const n = Math.min(enc.length, dest.length);
                for (let i = 0; i < n; i++) dest[i] = enc[i];
                return { read: str.length, written: n };
            }
        }

        class TextDecoder {
            constructor(label = 'utf-8', options = {}) {
                const norm = String(label).toLowerCase();
                if (norm === 'utf-8' || norm === 'utf8') this._enc = 'utf-8';
                else if (norm === 'latin1' || norm === 'iso-8859-1' ||
                         norm === 'windows-1252') this._enc = 'latin1';
                else throw new RangeError(`Unsupported encoding: ${label}`);
                this._fatal = !!options.fatal;
                this._ignoreBOM = !!options.ignoreBOM;
            }
            get encoding() { return this._enc; }
            get fatal()    { return this._fatal; }
            get ignoreBOM() { return this._ignoreBOM; }
            decode(input) {
                if (!input) return '';
                let bytes;
                if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
                else if (ArrayBuffer.isView(input))
                    bytes = new Uint8Array(input.buffer, input.byteOffset,
                                           input.byteLength);
                else throw new TypeError('decode() requires a BufferSource');

                if (this._enc === 'latin1') {
                    let out = '';
                    for (let i = 0; i < bytes.length; i++)
                        out += String.fromCharCode(bytes[i]);
                    return out;
                }

                let out = '';
                let i = 0;
                if (!this._ignoreBOM && bytes.length >= 3 &&
                    bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
                    i = 3;
                }
                while (i < bytes.length) {
                    const b = bytes[i++];
                    let cp;
                    if (b < 0x80) cp = b;
                    else if ((b & 0xE0) === 0xC0) {
                        if (i >= bytes.length) {
                            if (this._fatal) throw new TypeError('truncated UTF-8');
                            cp = 0xFFFD; break;
                        }
                        cp = ((b & 0x1F) << 6) | (bytes[i++] & 0x3F);
                    } else if ((b & 0xF0) === 0xE0) {
                        if (i + 1 >= bytes.length) {
                            if (this._fatal) throw new TypeError('truncated UTF-8');
                            cp = 0xFFFD; break;
                        }
                        cp = ((b & 0x0F) << 12) | ((bytes[i++] & 0x3F) << 6)
                           | (bytes[i++] & 0x3F);
                    } else if ((b & 0xF8) === 0xF0) {
                        if (i + 2 >= bytes.length) {
                            if (this._fatal) throw new TypeError('truncated UTF-8');
                            cp = 0xFFFD; break;
                        }
                        cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3F) << 12)
                           | ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F);
                    } else {
                        if (this._fatal) throw new TypeError('invalid UTF-8');
                        cp = 0xFFFD;
                    }
                    if (cp < 0x10000) out += String.fromCharCode(cp);
                    else {
                        cp -= 0x10000;
                        out += String.fromCharCode(0xD800 | (cp >> 10),
                                                    0xDC00 | (cp & 0x3FF));
                    }
                }
                return out;
            }
        }

        globalThis.TextEncoder = TextEncoder;
        globalThis.TextDecoder = TextDecoder;
    },
}));

/* ==========================================================
 * Feature: URL and URLSearchParams  (WHATWG subset)
 * Tier: pure-js    Provider: nea-port    Standard: web
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'url',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'WHATWG URL + URLSearchParams (subset)',
    requires:    ['text-encoding'],
    globals:     ['URL', 'URLSearchParams'],
    standard:    true,
    install() {
        function _pctDecode(str) {
            let out = '';
            for (let i = 0; i < str.length; i++) {
                const c = str[i];
                if (c === '%' && i + 2 < str.length) {
                    const n = parseInt(str.substr(i + 1, 2), 16);
                    if (!Number.isNaN(n)) { out += String.fromCharCode(n); i += 2; continue; }
                }
                out += c;
            }
            return out;
        }
        function _pctEncode(str, unreserved) {
            let out = '';
            const enc = new globalThis.TextEncoder().encode(str);
            for (let i = 0; i < enc.length; i++) {
                const b = enc[i];
                if ((b >= 0x30 && b <= 0x39) ||
                    (b >= 0x41 && b <= 0x5A) ||
                    (b >= 0x61 && b <= 0x7A) ||
                    unreserved.indexOf(String.fromCharCode(b)) >= 0) {
                    out += String.fromCharCode(b);
                } else {
                    out += '%' + (b < 16 ? '0' : '') + b.toString(16).toUpperCase();
                }
            }
            return out;
        }

        class URLSearchParams {
            constructor(init) {
                this._list = [];
                if (init == null) return;
                if (typeof init === 'string') {
                    let s = init;
                    if (s.length && s[0] === '?') s = s.substring(1);
                    if (!s.length) return;
                    for (const pair of s.split('&')) {
                        if (!pair.length) continue;
                        const eq = pair.indexOf('=');
                        let name, value;
                        if (eq < 0) { name = pair; value = ''; }
                        else { name = pair.substring(0, eq); value = pair.substring(eq + 1); }
                        /* Plus-to-space done via split/join to avoid
                         * ANY regex compilation on Amiga — even trivial
                         * patterns like /\+/g are suspect given the
                         * broader char-class hang seen elsewhere. */
                        this._list.push([_pctDecode(name.split('+').join(' ')),
                                         _pctDecode(value.split('+').join(' '))]);
                    }
                } else if (Array.isArray(init)) {
                    for (const pair of init) {
                        if (pair.length !== 2) throw new TypeError('tuple must have length 2');
                        this._list.push([String(pair[0]), String(pair[1])]);
                    }
                } else if (typeof init === 'object') {
                    for (const [k, v] of Object.entries(init))
                        this._list.push([k, String(v)]);
                }
            }
            append(name, value) { this._list.push([String(name), String(value)]); this._notify(); }
            delete(name)  { name = String(name); this._list = this._list.filter(p => p[0] !== name); this._notify(); }
            get(name)     { name = String(name); const p = this._list.find(p => p[0] === name); return p ? p[1] : null; }
            getAll(name)  { name = String(name); return this._list.filter(p => p[0] === name).map(p => p[1]); }
            has(name)     { name = String(name); return this._list.some(p => p[0] === name); }
            set(name, value) {
                name = String(name); value = String(value);
                let found = false;
                this._list = this._list.flatMap(p => {
                    if (p[0] === name) {
                        if (found) return [];
                        found = true; return [[name, value]];
                    }
                    return [p];
                });
                if (!found) this._list.push([name, value]);
                this._notify();
            }
            sort() { this._list.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0); this._notify(); }
            get size() { return this._list.length; }
            forEach(cb, thisArg) { for (const [k, v] of this._list) cb.call(thisArg, v, k, this); }
            keys()    { return this._list.map(p => p[0])[Symbol.iterator](); }
            values()  { return this._list.map(p => p[1])[Symbol.iterator](); }
            entries() { return this._list.map(p => [p[0], p[1]])[Symbol.iterator](); }
            [Symbol.iterator]() { return this.entries(); }
            toString() {
                const unreserved = "-_.!~*'()";
                return this._list.map(([k, v]) =>
                    _pctEncode(k, unreserved).split('%20').join('+') + '=' +
                    _pctEncode(v, unreserved).split('%20').join('+')
                ).join('&');
            }
            _notify() { if (this._url) this._url._syncSearchFromParams(); }
        }

        /* Set the params._url back-link as a non-enumerable, non-
         * writable property so JS_PrintValue walking url._params
         * doesn't recurse back into the URL and blow out on
         * Amiga's cycle-unaware printer (which hangs the REPL). */
        function _setBackLink(params, url) {
            Object.defineProperty(params, '_url', {
                value: url,
                enumerable: false,
                writable: true,
                configurable: true,
            });
        }

        class URL {
            constructor(url, base) {
                const parsed = URL._parse(String(url), base ? String(base) : null);
                if (!parsed) throw new TypeError(`Invalid URL: ${url}`);
                this._scheme   = parsed.scheme;
                this._username = parsed.username;
                this._password = parsed.password;
                this._host     = parsed.host;
                this._port     = parsed.port;
                this._path     = parsed.path;
                this._query    = parsed.query;
                this._fragment = parsed.fragment;
                this._params   = new URLSearchParams(this._query);
                _setBackLink(this._params, this);
            }

            static _parse(str, base) {
                str = str.trim();
                const o = { scheme: '', username: '', password: '', host: '',
                            port: '', path: '', query: '', fragment: '' };
                let s = str;

                /* Plain-JS scheme extraction. The original regex
                 * `/^([a-zA-Z][a-zA-Z0-9+.\-]*):(.*)$/` hangs the Amiga
                 * QuickJS-ng regex compiler (same class of bug as the
                 * earlier `/[/?#]/` fix). Walk the string manually. */
                let schemeEnd = -1;
                if (s.length > 0) {
                    const c0 = s.charCodeAt(0);
                    const isAlpha0 = (c0 >= 0x41 && c0 <= 0x5A) ||
                                     (c0 >= 0x61 && c0 <= 0x7A);
                    if (isAlpha0) {
                        for (let k = 1, n = s.length; k < n; k++) {
                            const c = s.charCodeAt(k);
                            if (c === 0x3A) { schemeEnd = k; break; }
                            const isAlpha = (c >= 0x41 && c <= 0x5A) ||
                                            (c >= 0x61 && c <= 0x7A);
                            const isDigit = (c >= 0x30 && c <= 0x39);
                            const isSchemeCh = isAlpha || isDigit ||
                                c === 0x2B /* + */ ||
                                c === 0x2D /* - */ ||
                                c === 0x2E /* . */;
                            if (!isSchemeCh) break;
                        }
                    }
                }
                if (schemeEnd > 0) {
                    o.scheme = s.substring(0, schemeEnd).toLowerCase();
                    s = s.substring(schemeEnd + 1);
                }
                else if (base) {
                    const baseParsed = URL._parse(base, null);
                    if (!baseParsed) return null;
                    Object.assign(o, baseParsed);
                    if (s.startsWith('//')) { s = o.scheme + ':' + s; return URL._parse(s, null); }
                    else if (s.startsWith('/')) { o.path = s; o.query = ''; o.fragment = ''; s = ''; }
                    else if (s.startsWith('?')) { o.query = s.substring(1); o.fragment = ''; s = ''; }
                    else if (s.startsWith('#')) { o.fragment = s.substring(1); s = ''; }
                    else if (s.length > 0) {
                        const baseDir = o.path.lastIndexOf('/');
                        o.path = (baseDir >= 0 ? o.path.substring(0, baseDir + 1) : '/') + s;
                        o.query = ''; o.fragment = ''; s = '';
                    }
                    return o;
                } else return null;

                if (s.startsWith('//')) {
                    s = s.substring(2);
                    let authEnd = s.length;
                    /* Find the first /, ?, or # — plain scan, not a regex.
                     * `/[/?#]/` had the `/` inside a char class that hangs
                     * the Amiga QuickJS-ng regex compiler (same bug as the
                     * Buffer base64 and util identifier regexes). */
                    let pathIdx = -1;
                    for (let k = 0, n = s.length; k < n; k++) {
                        const ch = s.charAt(k);
                        if (ch === '/' || ch === '?' || ch === '#') {
                            pathIdx = k;
                            break;
                        }
                    }
                    if (pathIdx >= 0) authEnd = pathIdx;
                    const auth = s.substring(0, authEnd);
                    s = s.substring(authEnd);

                    let hostStr = auth;
                    const at = auth.lastIndexOf('@');
                    if (at >= 0) {
                        const userinfo = auth.substring(0, at);
                        hostStr = auth.substring(at + 1);
                        const colon = userinfo.indexOf(':');
                        if (colon >= 0) {
                            o.username = userinfo.substring(0, colon);
                            o.password = userinfo.substring(colon + 1);
                        } else o.username = userinfo;
                    }
                    const colon = hostStr.lastIndexOf(':');
                    const closeBr = hostStr.lastIndexOf(']');
                    if (colon >= 0 && colon > closeBr) {
                        o.host = hostStr.substring(0, colon);
                        o.port = hostStr.substring(colon + 1);
                    } else o.host = hostStr;
                    o.host = o.host.toLowerCase();
                }

                const hashIdx = s.indexOf('#');
                if (hashIdx >= 0) { o.fragment = s.substring(hashIdx + 1); s = s.substring(0, hashIdx); }
                const queryIdx = s.indexOf('?');
                if (queryIdx >= 0) { o.query = s.substring(queryIdx + 1); s = s.substring(0, queryIdx); }
                o.path = s || (o.host ? '/' : '');

                return o;
            }

            _syncSearchFromParams() { this._query = this._params.toString(); }

            get href() { return this.toString(); }
            set href(v) {
                const parsed = URL._parse(String(v), null);
                if (!parsed) throw new TypeError(`Invalid URL: ${v}`);
                Object.assign(this, {
                    _scheme: parsed.scheme, _username: parsed.username,
                    _password: parsed.password, _host: parsed.host,
                    _port: parsed.port, _path: parsed.path,
                    _query: parsed.query, _fragment: parsed.fragment,
                });
                this._params = new URLSearchParams(this._query);
                _setBackLink(this._params, this);
            }

            get protocol() { return this._scheme + ':'; }
            set protocol(v) {
                let s = String(v);
                if (s.length > 0 && s.charCodeAt(s.length - 1) === 0x3A)
                    s = s.substring(0, s.length - 1);
                this._scheme = s.toLowerCase();
            }
            get username() { return this._username; }
            set username(v) { this._username = String(v); }
            get password() { return this._password; }
            set password(v) { this._password = String(v); }
            get host()     { return this._port ? `${this._host}:${this._port}` : this._host; }
            set host(v) {
                const s = String(v); const c = s.lastIndexOf(':');
                if (c >= 0) { this._host = s.substring(0, c).toLowerCase(); this._port = s.substring(c + 1); }
                else { this._host = s.toLowerCase(); this._port = ''; }
            }
            get hostname() { return this._host; }
            set hostname(v) { this._host = String(v).toLowerCase(); }
            get port() { return this._port; }
            set port(v) { this._port = v === '' || v == null ? '' : String(v); }
            get pathname() { return this._path; }
            set pathname(v) { this._path = String(v); }
            get search() { return this._query ? '?' + this._query : ''; }
            set search(v) {
                let s = String(v);
                if (s.startsWith('?')) s = s.substring(1);
                this._query = s;
                this._params = new URLSearchParams(s);
                _setBackLink(this._params, this);
            }
            get searchParams() { return this._params; }
            get hash() { return this._fragment ? '#' + this._fragment : ''; }
            set hash(v) {
                let s = String(v);
                if (s.startsWith('#')) s = s.substring(1);
                this._fragment = s;
            }
            get origin() {
                if (this._scheme === 'http' || this._scheme === 'https' ||
                    this._scheme === 'ws'   || this._scheme === 'wss'   ||
                    this._scheme === 'ftp'  || this._scheme === 'file')
                    return this._scheme + '://' + this.host;
                return 'null';
            }

            toString() {
                let s = this._scheme + ':';
                if (this._host || this._scheme === 'file') {
                    s += '//';
                    if (this._username || this._password) {
                        s += this._username;
                        if (this._password) s += ':' + this._password;
                        s += '@';
                    }
                    s += this._host;
                    if (this._port) s += ':' + this._port;
                }
                s += this._path;
                if (this._params && this._params._list.length > 0)
                    s += '?' + this._params.toString();
                else if (this._query) s += '?' + this._query;
                if (this._fragment) s += '#' + this._fragment;
                return s;
            }
            toJSON() { return this.toString(); }
            static canParse(url, base) {
                try { new URL(url, base); return true; } catch { return false; }
            }
        }

        globalThis.URL = URL;
        globalThis.URLSearchParams = URLSearchParams;
    },
}));

/* ==========================================================
 * Feature: AbortController / AbortSignal
 * Tier: pure-js    Provider: nea-port    Standard: web
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'abort',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'AbortController + AbortSignal',
    globals:     ['AbortController', 'AbortSignal'],
    standard:    true,
    install() {
        class AbortSignal {
            constructor() {
                this._aborted = false;
                this._reason = undefined;
                this._listeners = [];
                this.onabort = null;
            }
            get aborted() { return this._aborted; }
            get reason()  { return this._reason; }
            throwIfAborted() { if (this._aborted) throw this._reason; }
            addEventListener(type, cb) {
                if (type === 'abort') this._listeners.push(cb);
            }
            removeEventListener(type, cb) {
                if (type === 'abort') this._listeners = this._listeners.filter(l => l !== cb);
            }
            static abort(reason) {
                const s = new AbortSignal();
                s._aborted = true;
                s._reason = reason ?? new DOMException('Aborted', 'AbortError');
                return s;
            }
            static timeout(ms) {
                const s = new AbortSignal();
                setTimeout(() => {
                    if (s._aborted) return;
                    s._aborted = true;
                    s._reason = new DOMException('Timed out', 'TimeoutError');
                    s._fire();
                }, ms);
                return s;
            }
            /* AbortSignal.any([...signals]) — Node 20.3+ / web spec.
             * Returns a new signal that aborts when any of the inputs
             * does. Subscribes to each; already-aborted inputs cause
             * immediate abort. */
            static any(signals) {
                const out = new AbortSignal();
                if (!signals || !signals[Symbol.iterator]) return out;
                for (const s of signals) {
                    if (!s) continue;
                    if (s._aborted) {
                        out._aborted = true;
                        out._reason = s._reason ?? new DOMException('Aborted', 'AbortError');
                        queueMicrotask(() => out._fire());
                        return out;
                    }
                }
                const onAbort = (src) => {
                    if (out._aborted) return;
                    out._aborted = true;
                    out._reason = src._reason ?? new DOMException('Aborted', 'AbortError');
                    out._fire();
                };
                for (const s of signals) {
                    if (s && typeof s.addEventListener === 'function') {
                        s.addEventListener('abort', () => onAbort(s));
                    }
                }
                return out;
            }
            _fire() {
                const ev = { type: 'abort', target: this };
                try { if (typeof this.onabort === 'function') this.onabort(ev); } catch (e) {}
                for (const l of this._listeners.slice()) {
                    try { l(ev); } catch (e) {}
                }
            }
        }

        class AbortController {
            constructor() { this.signal = new AbortSignal(); }
            abort(reason) {
                if (this.signal._aborted) return;
                this.signal._aborted = true;
                this.signal._reason = reason ?? new DOMException('Aborted', 'AbortError');
                this.signal._fire();
            }
        }

        globalThis.AbortSignal = AbortSignal;
        globalThis.AbortController = AbortController;
    },
}));

/* ==========================================================
 * Feature: fetch + AbortSignal integration
 * Tier: pure-js    Provider: nea-port    Standard: web (Node >=18)
 *
 * E3: wraps the native fetch to honor options.signal — when the
 * AbortSignal fires, the returned Promise rejects with a standard
 * AbortError DOMException. v1 is JS-level only: the background
 * worker continues until HTTP completion and its result is
 * discarded. True mid-flight socket close requires C changes to
 * sharedlib_fetch.c (poll an atomic flag in the recv loop) —
 * deferred until someone needs to cancel a slow multi-megabyte
 * transfer. For typical scripts the JS-level abort is enough:
 * the caller's await stops waiting, error propagates normally.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'fetch-abort',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'AbortSignal wiring for globalThis.fetch (JS-level abort)',
    globals:     ['fetch'],
    standard:    true,
    requires:    ['abort'],
    install() {
        const nativeFetch = globalThis.fetch;
        if (typeof nativeFetch !== 'function') return;

        globalThis.fetch = function (url, options) {
            const signal = options && options.signal;
            if (!signal || typeof signal.addEventListener !== 'function')
                return nativeFetch(url, options);

            if (signal.aborted) {
                return Promise.reject(
                    signal.reason || new DOMException('Aborted', 'AbortError'));
            }

            return new Promise((resolve, reject) => {
                let settled = false;
                const onAbort = () => {
                    if (settled) return;
                    settled = true;
                    /* Propagate to C-level so the worker winds down
                     * early (frees socket/bandwidth instead of letting
                     * it run to HTTP completion). Guarded: library
                     * versions < 0.109 don't install the native. */
                    if (typeof globalThis.__qjs_fetchAbort === 'function') {
                        try { globalThis.__qjs_fetchAbort(); } catch (_) {}
                    }
                    reject(signal.reason || new DOMException('Aborted', 'AbortError'));
                };
                signal.addEventListener('abort', onAbort);

                nativeFetch(url, options).then(
                    (response) => {
                        if (settled) return;
                        settled = true;
                        try { signal.removeEventListener('abort', onAbort); } catch (_) {}
                        resolve(response);
                    },
                    (err) => {
                        if (settled) return;
                        settled = true;
                        try { signal.removeEventListener('abort', onAbort); } catch (_) {}
                        reject(err);
                    }
                );
            });
        };
    },
}));

/* ==========================================================
 * Feature: structuredClone
 * Tier: pure-js    Provider: nea-port    Standard: web
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'structured-clone',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'structuredClone() deep-clone primitive (JSON round-trip for now)',
    globals:     ['structuredClone'],
    standard:    true,
    install() {
        /* Simple JSON-based clone.  Loses Dates, Maps, Sets, typed
         * arrays, undefined values.  Future: swap to qjs:bjson round-
         * trip for fidelity (bjson handles all JS types natively) but
         * that requires async-aware apply() — defer to Phase D util. */
        globalThis.structuredClone = (v) => JSON.parse(JSON.stringify(v));
    },
}));

/* ==========================================================
 * Feature: path module (AmigaOS-aware)
 * Tier: pure-js    Provider: nea-port
 * Exposed as globalThis.path.  Module registration
 * (import * as path from 'qjs:path') is future work
 * in Phase C1.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'path',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'AmigaOS-aware path manipulation (handles Volume: and /)',
    globals:     ['path'],
    exports:     ['join', 'resolve', 'basename', 'dirname', 'extname',
                  'normalize', 'relative', 'parse', 'format',
                  'isAbsolute', 'sep', 'delimiter'],
    standard:    false,
    install() {
        function isAbsolute(p) {
            if (typeof p !== 'string' || p.length === 0) return false;
            if (p.indexOf(':') >= 0) return true;
            if (p.charCodeAt(0) === 47) return true;
            return false;
        }

        function _split(p) {
            let volume = '', rest = p;
            const colon = rest.indexOf(':');
            if (colon >= 0) { volume = rest.substring(0, colon + 1); rest = rest.substring(colon + 1); }
            const parts = rest.length > 0 ? rest.split('/') : [];
            return { volume, parts };
        }

        function _join(volume, parts) { return volume + parts.join('/'); }

        function basename(p, ext) {
            p = String(p);
            if (!p.length) return '';
            while (p.length > 1 && p[p.length - 1] === '/') p = p.substring(0, p.length - 1);
            let start = 0;
            for (let i = p.length - 1; i >= 0; i--) {
                if (p[i] === '/' || p[i] === ':') { start = i + 1; break; }
            }
            let base = p.substring(start);
            if (ext && base.length > ext.length && base.endsWith(ext))
                base = base.substring(0, base.length - ext.length);
            return base;
        }

        function dirname(p) {
            p = String(p);
            if (!p.length) return '.';
            while (p.length > 1 && p[p.length - 1] === '/') p = p.substring(0, p.length - 1);
            for (let i = p.length - 1; i >= 0; i--) {
                if (p[i] === '/') return p.substring(0, i) || '/';
                if (p[i] === ':') return p.substring(0, i + 1);
            }
            return '.';
        }

        function extname(p) {
            const base = basename(p);
            const dot = base.lastIndexOf('.');
            if (dot <= 0) return '';
            return base.substring(dot);
        }

        function _normalize(parts) {
            const out = [];
            for (const p of parts) {
                if (p === '.' || p === '') continue;
                if (p === '..') {
                    if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
                    else out.push('..');
                } else out.push(p);
            }
            return out;
        }

        function join(...segments) {
            if (!segments.length) return '.';
            let volume = '', parts = [];
            for (let i = 0; i < segments.length; i++) {
                const seg = String(segments[i]);
                if (!seg.length) continue;
                const split = _split(seg);
                if (split.volume) {
                    volume = split.volume;
                    parts = split.parts.filter(x => x.length > 0);
                } else if (seg[0] === '/') {
                    if (!volume) volume = '';
                    parts = split.parts.filter(x => x.length > 0);
                } else {
                    for (const p of split.parts) if (p.length > 0) parts.push(p);
                }
            }
            parts = _normalize(parts);
            const result = _join(volume, parts);
            if (result === '') return '.';
            return result;
        }

        function normalize(p) {
            p = String(p);
            if (!p.length) return '.';
            const split = _split(p);
            const parts = _normalize(split.parts.filter(x => x.length > 0 || x === ''));
            const result = _join(split.volume, parts);
            if (result === '' || result === ':') return '.';
            return result;
        }

        function resolve(...segments) {
            let resolved = '', resolvedAbs = false;
            for (let i = segments.length - 1; i >= 0 && !resolvedAbs; i--) {
                const p = String(segments[i] || '');
                if (!p.length) continue;
                resolved = p + (resolved ? '/' + resolved : '');
                resolvedAbs = isAbsolute(p);
            }
            if (!resolvedAbs) {
                try {
                    const cwd = (globalThis.os && globalThis.os.getcwd)
                                ? globalThis.os.getcwd() : '';
                    resolved = (cwd || '.') + '/' + resolved;
                } catch (e) {}
            }
            return normalize(resolved) || '.';
        }

        function relative(from, to) {
            from = resolve(from); to = resolve(to);
            if (from === to) return '';
            const fs = _split(from), ts = _split(to);
            if (fs.volume !== ts.volume) return to;
            const fp = fs.parts.filter(x => x.length > 0);
            const tp = ts.parts.filter(x => x.length > 0);
            let i = 0;
            while (i < fp.length && i < tp.length && fp[i] === tp[i]) i++;
            const up = Array(fp.length - i).fill('..');
            return [...up, ...tp.slice(i)].join('/') || '.';
        }

        function parse(p) {
            p = String(p);
            const split = _split(p);
            const root = split.volume || (p.startsWith('/') ? '/' : '');
            let dir = dirname(p);
            if (dir === p) dir = root;
            const base = basename(p);
            const ext = extname(base);
            const name = ext ? base.substring(0, base.length - ext.length) : base;
            return { root, dir, base, ext, name };
        }

        function format(obj) {
            const dir = obj.dir || obj.root || '';
            const base = obj.base || ((obj.name || '') + (obj.ext || ''));
            if (!dir) return base;
            if (dir[dir.length - 1] === '/' || dir[dir.length - 1] === ':') return dir + base;
            return dir + '/' + base;
        }

        globalThis.path = {
            sep: '/',
            delimiter: ';',
            isAbsolute, basename, dirname, extname,
            join, normalize, resolve, relative, parse, format,
        };
    },
}));

/* ==========================================================
 * Feature: Buffer  (Node.js subset)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * Buffer extends Uint8Array so indexed access, .length, .buffer,
 * .byteOffset, and all TypedArray methods work unchanged. Node-
 * style methods are layered on top.
 *
 * Encodings supported: utf-8 / utf8 (default), ascii, latin1 /
 * binary, base64, hex. Any unknown encoding throws TypeError
 * matching Node's behavior.
 *
 * Intentionally omitted from v1 (follow-up work):
 *   * Float / Double read & write (softfloat cost on no-FPU)
 *   * BigInt64 / BigUInt64 read & write (slow on 68k)
 *   * swap16 / swap32 / swap64
 *   * utf-16le encoding (rare in practice)
 *
 * Allocator strategy: Buffer.alloc zeros memory; Buffer.allocUnsafe
 * does not (matches Node). Both share the runtime's pool allocator
 * so they land in exec pool memory on AmigaOS.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'buffer',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node.js Buffer (subset: utf-8/ascii/latin1/base64/hex, int reads/writes)',
    globals:     ['Buffer'],
    standard:    false,
    install() {
        const HEX_MAP = '0123456789abcdef';
        const B64_ALPHA =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        /* Decoding table for base64 — built once, indexed by char code. */
        const B64_DEC = new Int8Array(128);
        B64_DEC.fill(-1);
        for (let i = 0; i < 64; i++) B64_DEC[B64_ALPHA.charCodeAt(i)] = i;

        function normalizeEncoding(enc) {
            if (enc === undefined || enc === null) return 'utf8';
            const s = String(enc).toLowerCase();
            switch (s) {
                case 'utf8': case 'utf-8':              return 'utf8';
                case 'ascii':                            return 'ascii';
                case 'latin1': case 'binary':            return 'latin1';
                case 'base64':                           return 'base64';
                case 'hex':                              return 'hex';
                default:
                    throw new TypeError(`Unknown encoding: ${enc}`);
            }
        }

        /* ---- string ↔ bytes ---------------------------------- */

        function utf8ByteLength(str) {
            let n = 0;
            for (let i = 0, len = str.length; i < len; i++) {
                let c = str.charCodeAt(i);
                if (c >= 0xD800 && c <= 0xDBFF && i + 1 < len) {
                    const c2 = str.charCodeAt(i + 1);
                    if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
                        c = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
                        i++;
                    }
                }
                if      (c < 0x80)    n += 1;
                else if (c < 0x800)   n += 2;
                else if (c < 0x10000) n += 3;
                else                  n += 4;
            }
            return n;
        }

        function writeUtf8(str, dst, off, max) {
            const start = off;
            const end = off + max;
            for (let i = 0, len = str.length; i < len && off < end; i++) {
                let c = str.charCodeAt(i);
                if (c >= 0xD800 && c <= 0xDBFF && i + 1 < len) {
                    const c2 = str.charCodeAt(i + 1);
                    if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
                        c = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
                        i++;
                    }
                }
                if (c < 0x80) {
                    if (off >= end) break;
                    dst[off++] = c;
                } else if (c < 0x800) {
                    if (off + 1 >= end) break;
                    dst[off++] = 0xC0 | (c >> 6);
                    dst[off++] = 0x80 | (c & 0x3F);
                } else if (c < 0x10000) {
                    if (off + 2 >= end) break;
                    dst[off++] = 0xE0 | (c >> 12);
                    dst[off++] = 0x80 | ((c >> 6) & 0x3F);
                    dst[off++] = 0x80 | (c & 0x3F);
                } else {
                    if (off + 3 >= end) break;
                    dst[off++] = 0xF0 | (c >> 18);
                    dst[off++] = 0x80 | ((c >> 12) & 0x3F);
                    dst[off++] = 0x80 | ((c >> 6) & 0x3F);
                    dst[off++] = 0x80 | (c & 0x3F);
                }
            }
            return off - start;
        }

        function readUtf8(src, start, end) {
            let out = '';
            let i = start;
            while (i < end) {
                const b = src[i++];
                let cp;
                if (b < 0x80) {
                    cp = b;
                } else if ((b & 0xE0) === 0xC0) {
                    if (i >= end) { cp = 0xFFFD; }
                    else cp = ((b & 0x1F) << 6) | (src[i++] & 0x3F);
                } else if ((b & 0xF0) === 0xE0) {
                    if (i + 1 >= end) { cp = 0xFFFD; }
                    else cp = ((b & 0x0F) << 12)
                           | ((src[i++] & 0x3F) << 6)
                           | (src[i++] & 0x3F);
                } else if ((b & 0xF8) === 0xF0) {
                    if (i + 2 >= end) { cp = 0xFFFD; }
                    else cp = ((b & 0x07) << 18)
                           | ((src[i++] & 0x3F) << 12)
                           | ((src[i++] & 0x3F) << 6)
                           | (src[i++] & 0x3F);
                } else {
                    cp = 0xFFFD;
                }
                if (cp < 0x10000) out += String.fromCharCode(cp);
                else {
                    cp -= 0x10000;
                    out += String.fromCharCode(0xD800 | (cp >> 10),
                                               0xDC00 | (cp & 0x3FF));
                }
            }
            return out;
        }

        function writeAscii(str, dst, off, max) {
            const n = Math.min(str.length, max);
            for (let i = 0; i < n; i++) dst[off + i] = str.charCodeAt(i) & 0x7F;
            return n;
        }
        function writeLatin1(str, dst, off, max) {
            const n = Math.min(str.length, max);
            for (let i = 0; i < n; i++) dst[off + i] = str.charCodeAt(i) & 0xFF;
            return n;
        }
        function readAscii(src, s, e) {
            let out = '';
            for (let i = s; i < e; i++) out += String.fromCharCode(src[i] & 0x7F);
            return out;
        }
        function readLatin1(src, s, e) {
            let out = '';
            for (let i = s; i < e; i++) out += String.fromCharCode(src[i]);
            return out;
        }
        function writeHex(str, dst, off, max) {
            str = String(str);
            const pairs = Math.min(Math.floor(str.length / 2), max);
            for (let i = 0; i < pairs; i++) {
                const h = parseInt(str.substr(i * 2, 2), 16);
                if (isNaN(h)) return i;
                dst[off + i] = h;
            }
            return pairs;
        }
        function readHex(src, s, e) {
            let out = '';
            for (let i = s; i < e; i++) {
                const b = src[i];
                out += HEX_MAP[b >> 4] + HEX_MAP[b & 0x0F];
            }
            return out;
        }
        /* Character class filter implemented without a regex literal —
         * `/[^A-Za-z0-9+/=]/g` exists, but an unescaped `/` inside the
         * character class trips some regex compilers (observed: Amiga
         * build hangs here; host qjs doesn't). Plain-JS filter is ~5
         * lines and works everywhere. */
        function base64Clean(str) {
            let out = '';
            for (let i = 0, n = str.length; i < n; i++) {
                const c = str.charCodeAt(i);
                if ((c >= 0x41 && c <= 0x5A) ||     /* A-Z */
                    (c >= 0x61 && c <= 0x7A) ||     /* a-z */
                    (c >= 0x30 && c <= 0x39) ||     /* 0-9 */
                    c === 0x2B || c === 0x2F ||     /* + / */
                    c === 0x3D) {                   /* = */
                    out += str.charAt(i);
                }
            }
            return out;
        }

        function writeBase64(str, dst, off, max) {
            /* Preserve '=' padding so short final groups (e.g.
             * 'aGVsbG8=' = "hello") decode correctly. Padding decodes
             * to -1 via B64_DEC and is treated as "skip this byte". */
            const clean = base64Clean(String(str));
            let w = 0;
            for (let i = 0; i + 3 < clean.length && w < max; i += 4) {
                const a = B64_DEC[clean.charCodeAt(i)];
                const b = B64_DEC[clean.charCodeAt(i + 1)];
                const c = B64_DEC[clean.charCodeAt(i + 2)];
                const d = B64_DEC[clean.charCodeAt(i + 3)];
                if (a < 0 || b < 0) break;
                if (w < max) dst[off + w++] = ((a << 2) | (b >> 4)) & 0xFF;
                if (c >= 0 && w < max)
                    dst[off + w++] = ((b << 4) | (c >> 2)) & 0xFF;
                if (d >= 0 && c >= 0 && w < max)
                    dst[off + w++] = ((c << 6) | d) & 0xFF;
            }
            return w;
        }
        function readBase64(src, s, e) {
            let out = '';
            let i = s;
            while (i + 2 < e) {
                const a = src[i++], b = src[i++], c = src[i++];
                out += B64_ALPHA[a >> 2]
                     + B64_ALPHA[((a & 0x03) << 4) | (b >> 4)]
                     + B64_ALPHA[((b & 0x0F) << 2) | (c >> 6)]
                     + B64_ALPHA[c & 0x3F];
            }
            const rem = e - i;
            if (rem === 1) {
                const a = src[i];
                out += B64_ALPHA[a >> 2]
                     + B64_ALPHA[(a & 0x03) << 4]
                     + '==';
            } else if (rem === 2) {
                const a = src[i], b = src[i + 1];
                out += B64_ALPHA[a >> 2]
                     + B64_ALPHA[((a & 0x03) << 4) | (b >> 4)]
                     + B64_ALPHA[(b & 0x0F) << 2]
                     + '=';
            }
            return out;
        }

        /* Central dispatcher for encoding-aware writes. Returns bytes written. */
        function encodeInto(enc, str, dst, off, max) {
            switch (enc) {
                case 'utf8':   return writeUtf8(str, dst, off, max);
                case 'ascii':  return writeAscii(str, dst, off, max);
                case 'latin1': return writeLatin1(str, dst, off, max);
                case 'hex':    return writeHex(str, dst, off, max);
                case 'base64': return writeBase64(str, dst, off, max);
            }
            throw new TypeError(`Unknown encoding: ${enc}`);
        }
        function decodeSlice(enc, src, start, end) {
            switch (enc) {
                case 'utf8':   return readUtf8(src, start, end);
                case 'ascii':  return readAscii(src, start, end);
                case 'latin1': return readLatin1(src, start, end);
                case 'hex':    return readHex(src, start, end);
                case 'base64': return readBase64(src, start, end);
            }
            throw new TypeError(`Unknown encoding: ${enc}`);
        }

        /* ---- Buffer class ------------------------------------ */

        class Buffer extends Uint8Array {
            constructor(arg, offOrEnc, lenOrEncArg) {
                /* Node's `new Buffer(...)` is deprecated; route to static
                 * constructors so behavior matches regardless of caller. */
                if (typeof arg === 'number') {
                    super(arg);
                } else if (typeof arg === 'string') {
                    const enc = normalizeEncoding(offOrEnc);
                    const bytes = stringToBytes(arg, enc);
                    super(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                } else if (arg instanceof ArrayBuffer) {
                    super(arg,
                          offOrEnc | 0,
                          lenOrEncArg === undefined
                            ? arg.byteLength - (offOrEnc | 0)
                            : lenOrEncArg | 0);
                } else if (ArrayBuffer.isView(arg) || Array.isArray(arg)) {
                    super(arg);
                } else {
                    super(arg || 0);
                }
            }

            /* --- static constructors ------------------------- */

            static alloc(size, fill, encoding) {
                const b = new Buffer(size | 0);
                if (fill !== undefined && fill !== 0) b.fill(fill, 0, b.length, encoding);
                return b;
            }
            static allocUnsafe(size) {
                return new Buffer(size | 0);
            }
            static allocUnsafeSlow(size) {
                return new Buffer(size | 0);
            }
            static from(arg, offOrEnc, lenOrEnc) {
                /* Whatever Buffer's constructor accepts, delegate. */
                if (arg instanceof ArrayBuffer) {
                    return new Buffer(arg, offOrEnc, lenOrEnc);
                }
                if (typeof arg === 'string') {
                    const enc = normalizeEncoding(offOrEnc);
                    const bytes = stringToBytes(arg, enc);
                    const b = new Buffer(bytes.byteLength);
                    b.set(bytes);
                    return b;
                }
                if (Array.isArray(arg)) {
                    const b = new Buffer(arg.length);
                    for (let i = 0; i < arg.length; i++) b[i] = arg[i] & 0xFF;
                    return b;
                }
                if (ArrayBuffer.isView(arg)) {
                    /* Includes other Buffers, Uint8Arrays, DataViews, etc.
                     * Node copies by default for Buffer.from(Uint8Array). */
                    const b = new Buffer(arg.byteLength);
                    b.set(new Uint8Array(arg.buffer, arg.byteOffset, arg.byteLength));
                    return b;
                }
                throw new TypeError('Buffer.from: unsupported argument type');
            }
            static isBuffer(obj) {
                return obj instanceof Buffer;
            }
            static byteLength(str, encoding) {
                if (ArrayBuffer.isView(str)) return str.byteLength;
                if (str instanceof ArrayBuffer) return str.byteLength;
                const enc = normalizeEncoding(encoding);
                str = String(str);
                switch (enc) {
                    case 'utf8':   return utf8ByteLength(str);
                    case 'ascii':
                    case 'latin1': return str.length;
                    case 'hex':    return (str.length / 2) | 0;
                    case 'base64': {
                        const clean = base64Clean(str);
                        let pad = 0;
                        for (let i = clean.length - 1;
                             i >= 0 && clean.charCodeAt(i) === 0x3D; i--) pad++;
                        return ((clean.length * 3) >> 2) - pad;
                    }
                }
                throw new TypeError(`Unknown encoding: ${encoding}`);
            }
            static concat(list, totalLength) {
                if (!Array.isArray(list)) throw new TypeError('Buffer.concat: list required');
                if (totalLength === undefined) {
                    totalLength = 0;
                    for (const b of list) totalLength += b.length;
                }
                const out = new Buffer(totalLength);
                let off = 0;
                for (const b of list) {
                    const n = Math.min(b.length, totalLength - off);
                    if (n <= 0) break;
                    for (let i = 0; i < n; i++) out[off + i] = b[i];
                    off += n;
                }
                return out;
            }
            static compare(a, b) {
                const la = a.length, lb = b.length;
                const n = Math.min(la, lb);
                for (let i = 0; i < n; i++) {
                    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
                }
                return la === lb ? 0 : la < lb ? -1 : 1;
            }

            /* --- string conversion ------------------------- */

            toString(encoding, start, end) {
                const enc = normalizeEncoding(encoding);
                start = start === undefined ? 0 : Math.max(0, start | 0);
                end   = end   === undefined ? this.length
                                            : Math.min(this.length, end | 0);
                if (end <= start) return '';
                return decodeSlice(enc, this, start, end);
            }
            write(str, offset, length, encoding) {
                /* Node allows (str), (str, enc), (str, offset, enc),
                 * (str, offset, length, enc). Disambiguate by type. */
                if (typeof offset === 'string') { encoding = offset; offset = 0; length = this.length; }
                else if (typeof length === 'string') { encoding = length; length = this.length - (offset | 0); }
                offset = offset | 0;
                length = length === undefined ? this.length - offset : length | 0;
                const enc = normalizeEncoding(encoding);
                if (offset < 0 || offset > this.length)
                    throw new RangeError('Buffer.write: offset out of range');
                const max = Math.min(length, this.length - offset);
                return encodeInto(enc, String(str), this, offset, max);
            }
            toJSON() {
                return { type: 'Buffer', data: Array.from(this) };
            }

            /* --- comparison & search ----------------------- */

            equals(other) {
                if (!(other instanceof Uint8Array)) return false;
                if (this.length !== other.length) return false;
                for (let i = 0; i < this.length; i++)
                    if (this[i] !== other[i]) return false;
                return true;
            }
            compare(other, tStart, tEnd, sStart, sEnd) {
                tStart = tStart === undefined ? 0 : tStart | 0;
                tEnd   = tEnd   === undefined ? other.length : tEnd | 0;
                sStart = sStart === undefined ? 0 : sStart | 0;
                sEnd   = sEnd   === undefined ? this.length  : sEnd | 0;
                const sLen = sEnd - sStart, tLen = tEnd - tStart;
                const n = Math.min(sLen, tLen);
                for (let i = 0; i < n; i++) {
                    const a = this[sStart + i], b = other[tStart + i];
                    if (a !== b) return a < b ? -1 : 1;
                }
                return sLen === tLen ? 0 : sLen < tLen ? -1 : 1;
            }
            indexOf(value, byteOffset, encoding) {
                /* Accept (byte | string | Buffer, byteOffset?, encoding?) */
                if (typeof byteOffset === 'string') { encoding = byteOffset; byteOffset = 0; }
                byteOffset = byteOffset === undefined ? 0 : byteOffset | 0;
                if (byteOffset < 0) byteOffset = Math.max(0, this.length + byteOffset);

                if (typeof value === 'number') {
                    const v = value & 0xFF;
                    for (let i = byteOffset; i < this.length; i++)
                        if (this[i] === v) return i;
                    return -1;
                }
                let needle;
                if (typeof value === 'string') {
                    const enc = normalizeEncoding(encoding);
                    needle = Buffer.from(value, enc);
                } else if (value instanceof Uint8Array) {
                    needle = value;
                } else {
                    throw new TypeError('Buffer.indexOf: unsupported value type');
                }
                if (needle.length === 0) return byteOffset;
                const limit = this.length - needle.length;
                outer: for (let i = byteOffset; i <= limit; i++) {
                    for (let j = 0; j < needle.length; j++)
                        if (this[i + j] !== needle[j]) continue outer;
                    return i;
                }
                return -1;
            }
            includes(value, byteOffset, encoding) {
                return this.indexOf(value, byteOffset, encoding) !== -1;
            }

            /* --- fill & copy ------------------------------- */

            fill(value, start, end, encoding) {
                start = start === undefined ? 0 : start | 0;
                end   = end   === undefined ? this.length : end | 0;
                if (start < 0) start = 0;
                if (end > this.length) end = this.length;
                if (end <= start) return this;
                if (typeof value === 'number') {
                    const v = value & 0xFF;
                    for (let i = start; i < end; i++) this[i] = v;
                    return this;
                }
                if (typeof value === 'string') {
                    const enc = normalizeEncoding(encoding);
                    const bytes = stringToBytes(value, enc);
                    if (bytes.length === 0) return this;
                    for (let i = start; i < end; i++) this[i] = bytes[(i - start) % bytes.length];
                    return this;
                }
                if (value instanceof Uint8Array) {
                    if (value.length === 0) return this;
                    for (let i = start; i < end; i++) this[i] = value[(i - start) % value.length];
                    return this;
                }
                throw new TypeError('Buffer.fill: unsupported value type');
            }
            copy(target, tStart, sStart, sEnd) {
                tStart = tStart === undefined ? 0 : tStart | 0;
                sStart = sStart === undefined ? 0 : sStart | 0;
                sEnd   = sEnd   === undefined ? this.length : sEnd | 0;
                if (tStart >= target.length || sEnd <= sStart) return 0;
                const n = Math.min(sEnd - sStart, target.length - tStart);
                for (let i = 0; i < n; i++) target[tStart + i] = this[sStart + i];
                return n;
            }

            /* --- subarray / slice -------------------------- */

            subarray(start, end) {
                start = start === undefined ? 0 : start | 0;
                end   = end   === undefined ? this.length : end | 0;
                if (start < 0) start = Math.max(0, this.length + start);
                if (end   < 0) end   = Math.max(0, this.length + end);
                start = Math.min(start, this.length);
                end   = Math.min(Math.max(end, start), this.length);
                /* Share the underlying ArrayBuffer (Node semantics) */
                return new Buffer(this.buffer, this.byteOffset + start, end - start);
            }
            /* slice() aliased to subarray for Node compatibility. */

            /* --- integer reads (LE / BE) ------------------- */

            readUInt8(off)       { return this[off | 0]; }
            readInt8(off)        { const v = this[off | 0]; return v & 0x80 ? v - 0x100 : v; }
            readUInt16LE(off)    { off |= 0; return this[off] | (this[off + 1] << 8); }
            readUInt16BE(off)    { off |= 0; return (this[off] << 8) | this[off + 1]; }
            readInt16LE(off)     { const v = this.readUInt16LE(off); return v & 0x8000 ? v - 0x10000 : v; }
            readInt16BE(off)     { const v = this.readUInt16BE(off); return v & 0x8000 ? v - 0x10000 : v; }
            readUInt32LE(off)    {
                off |= 0;
                /* >>> 0 gives unsigned interpretation of the result. */
                return (this[off]
                      | (this[off + 1] << 8)
                      | (this[off + 2] << 16)
                      | (this[off + 3] * 0x1000000)) >>> 0;
            }
            readUInt32BE(off)    {
                off |= 0;
                return (this[off] * 0x1000000
                      | (this[off + 1] << 16)
                      | (this[off + 2] << 8)
                      | this[off + 3]) >>> 0;
            }
            readInt32LE(off)     {
                off |= 0;
                return this[off]
                     | (this[off + 1] << 8)
                     | (this[off + 2] << 16)
                     | (this[off + 3] << 24);
            }
            readInt32BE(off)     {
                off |= 0;
                return (this[off] << 24)
                     | (this[off + 1] << 16)
                     | (this[off + 2] << 8)
                     | this[off + 3];
            }

            /* --- integer writes (LE / BE) ------------------ */

            writeUInt8(v, off)    { this[off | 0] = v & 0xFF; return (off | 0) + 1; }
            writeInt8(v, off)     { this[off | 0] = v & 0xFF; return (off | 0) + 1; }
            writeUInt16LE(v, off) { off |= 0; this[off] = v & 0xFF; this[off + 1] = (v >>> 8) & 0xFF; return off + 2; }
            writeUInt16BE(v, off) { off |= 0; this[off] = (v >>> 8) & 0xFF; this[off + 1] = v & 0xFF; return off + 2; }
            writeInt16LE(v, off)  { return this.writeUInt16LE(v & 0xFFFF, off); }
            writeInt16BE(v, off)  { return this.writeUInt16BE(v & 0xFFFF, off); }
            writeUInt32LE(v, off) {
                off |= 0;
                this[off]     = v & 0xFF;
                this[off + 1] = (v >>> 8) & 0xFF;
                this[off + 2] = (v >>> 16) & 0xFF;
                this[off + 3] = (v >>> 24) & 0xFF;
                return off + 4;
            }
            writeUInt32BE(v, off) {
                off |= 0;
                this[off]     = (v >>> 24) & 0xFF;
                this[off + 1] = (v >>> 16) & 0xFF;
                this[off + 2] = (v >>> 8) & 0xFF;
                this[off + 3] = v & 0xFF;
                return off + 4;
            }
            writeInt32LE(v, off)  { return this.writeUInt32LE(v >>> 0, off); }
            writeInt32BE(v, off)  { return this.writeUInt32BE(v >>> 0, off); }

            /* swap16 / swap32 / swap64 — in-place byte-order swap on 2/4/8
             * byte aligned chunks. Node semantics: throw if buffer length
             * isn't a multiple. Returns the buffer for chaining. */
            swap16() {
                if (this.length & 1)
                    throw new RangeError('Buffer size for swap16 must be a multiple of 2');
                for (let i = 0; i < this.length; i += 2) {
                    const t = this[i]; this[i] = this[i+1]; this[i+1] = t;
                }
                return this;
            }
            swap32() {
                if (this.length & 3)
                    throw new RangeError('Buffer size for swap32 must be a multiple of 4');
                for (let i = 0; i < this.length; i += 4) {
                    const a = this[i], b = this[i+1];
                    this[i]   = this[i+3];
                    this[i+1] = this[i+2];
                    this[i+2] = b;
                    this[i+3] = a;
                }
                return this;
            }
            swap64() {
                if (this.length & 7)
                    throw new RangeError('Buffer size for swap64 must be a multiple of 8');
                for (let i = 0; i < this.length; i += 8) {
                    for (let k = 0; k < 4; k++) {
                        const t = this[i+k]; this[i+k] = this[i+7-k]; this[i+7-k] = t;
                    }
                }
                return this;
            }

            /* Float32/Float64 read/write — via a shared DataView over the
             * same ArrayBuffer. Works on both FPU and softfloat builds;
             * on softfloat the floats go through VBCC's softfloat helpers
             * (the library already links them). */
            readFloatLE(off)  { return this._dv().getFloat32(off | 0, true); }
            readFloatBE(off)  { return this._dv().getFloat32(off | 0, false); }
            readDoubleLE(off) { return this._dv().getFloat64(off | 0, true); }
            readDoubleBE(off) { return this._dv().getFloat64(off | 0, false); }
            writeFloatLE(v, off)  { this._dv().setFloat32(off | 0, +v, true);  return (off | 0) + 4; }
            writeFloatBE(v, off)  { this._dv().setFloat32(off | 0, +v, false); return (off | 0) + 4; }
            writeDoubleLE(v, off) { this._dv().setFloat64(off | 0, +v, true);  return (off | 0) + 8; }
            writeDoubleBE(v, off) { this._dv().setFloat64(off | 0, +v, false); return (off | 0) + 8; }

            /* Lazy DataView cache — built once per buffer, reused per call. */
            _dv() {
                if (!this._cachedDV)
                    this._cachedDV = new DataView(this.buffer, this.byteOffset, this.byteLength);
                return this._cachedDV;
            }
        }

        /* slice is an alias for subarray to match Node semantics. */
        Buffer.prototype.slice = Buffer.prototype.subarray;

        /* Helper used by the constructor and fill(). Returns a Uint8Array
         * of the encoded bytes. Kept outside the class so the constructor
         * can reach it without `this`. */
        function stringToBytes(str, enc) {
            str = String(str);
            switch (enc) {
                case 'utf8': {
                    const out = new Uint8Array(utf8ByteLength(str));
                    writeUtf8(str, out, 0, out.length);
                    return out;
                }
                case 'ascii': {
                    const out = new Uint8Array(str.length);
                    writeAscii(str, out, 0, out.length);
                    return out;
                }
                case 'latin1': {
                    const out = new Uint8Array(str.length);
                    writeLatin1(str, out, 0, out.length);
                    return out;
                }
                case 'hex': {
                    const pairs = (str.length / 2) | 0;
                    const out = new Uint8Array(pairs);
                    writeHex(str, out, 0, pairs);
                    return out;
                }
                case 'base64': {
                    const size = Buffer.byteLength(str, 'base64');
                    const out = new Uint8Array(size);
                    writeBase64(str, out, 0, size);
                    return out;
                }
            }
            throw new TypeError(`Unknown encoding: ${enc}`);
        }

        globalThis.Buffer = Buffer;
    },
}));

/* ==========================================================
 * Feature: EventEmitter  (Node.js API subset)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * Classic Node EventEmitter. on/once/off/emit plus the usual
 * helpers. Listeners fire synchronously in insertion order.
 * Error events with no listener throw, matching Node behavior.
 *
 * Note on mutation during emit: we snapshot the listener array
 * before iterating, so listeners added or removed inside a
 * handler don't affect the current emit (Node semantics).
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'event-emitter',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node.js EventEmitter (on/once/off/emit + helpers)',
    globals:     ['EventEmitter'],
    standard:    false,
    install() {
        class EventEmitter {
            constructor() {
                this._events = {};
                this._maxListeners = 10;
            }
            setMaxListeners(n) {
                this._maxListeners = n | 0;
                return this;
            }
            getMaxListeners() {
                return this._maxListeners;
            }
            _add(ev, fn, prepend) {
                if (typeof fn !== 'function')
                    throw new TypeError('listener must be a function');
                const list = this._events[ev] || (this._events[ev] = []);
                if (prepend) list.unshift(fn); else list.push(fn);
                if (this._maxListeners > 0 && list.length > this._maxListeners) {
                    try {
                        std.err.puts(`(qjs) MaxListenersExceededWarning: ` +
                            `${list.length} '${ev}' listeners on EventEmitter, ` +
                            `limit is ${this._maxListeners}\n`);
                    } catch (_) {}
                }
                this.emit('newListener', ev, fn._origFn || fn);
                return this;
            }
            on(ev, fn)          { return this._add(ev, fn, false); }
            addListener(ev, fn) { return this._add(ev, fn, false); }
            prependListener(ev, fn) { return this._add(ev, fn, true); }
            once(ev, fn) {
                const self = this;
                const wrap = function (...args) {
                    self.off(ev, wrap);
                    fn.apply(this, args);
                };
                wrap._origFn = fn;
                return this._add(ev, wrap, false);
            }
            prependOnceListener(ev, fn) {
                const self = this;
                const wrap = function (...args) {
                    self.off(ev, wrap);
                    fn.apply(this, args);
                };
                wrap._origFn = fn;
                return this._add(ev, wrap, true);
            }
            off(ev, fn) {
                const list = this._events[ev];
                if (!list) return this;
                for (let i = list.length - 1; i >= 0; i--) {
                    if (list[i] === fn || list[i]._origFn === fn) {
                        list.splice(i, 1);
                        this.emit('removeListener', ev, fn);
                        break;
                    }
                }
                if (list.length === 0) delete this._events[ev];
                return this;
            }
            removeListener(ev, fn) { return this.off(ev, fn); }
            removeAllListeners(ev) {
                if (ev === undefined) { this._events = {}; return this; }
                delete this._events[ev];
                return this;
            }
            emit(ev, ...args) {
                const list = this._events[ev];
                if (!list || list.length === 0) {
                    if (ev === 'error') {
                        const err = args[0];
                        throw (err instanceof Error) ? err :
                            new Error('Unhandled "error" event: ' + String(err));
                    }
                    return false;
                }
                /* Snapshot so mutation during emit doesn't shift indices. */
                const snap = list.slice();
                for (const fn of snap) {
                    try { fn.apply(this, args); }
                    catch (e) {
                        try { std.err.puts(`(qjs) EventEmitter listener threw: ${e && e.message || e}\n`); }
                        catch (_) {}
                    }
                }
                return true;
            }
            listeners(ev) {
                const list = this._events[ev];
                return list ? list.map(fn => fn._origFn || fn) : [];
            }
            rawListeners(ev) {
                const list = this._events[ev];
                return list ? list.slice() : [];
            }
            listenerCount(ev) {
                const list = this._events[ev];
                return list ? list.length : 0;
            }
            eventNames() {
                return Object.keys(this._events);
            }
        }
        EventEmitter.defaultMaxListeners = 10;

        /* Static helper — events.once(emitter, name) returns a Promise that
         * resolves with the args from the first emission of that event, or
         * rejects if 'error' fires first. Pattern used by stream.pipeline
         * and async iterator adapters. */
        EventEmitter.once = function (emitter, name) {
            return new Promise((resolve, reject) => {
                const onEvt = (...args) => {
                    emitter.removeListener && emitter.removeListener('error', onErr);
                    resolve(args);
                };
                const onErr = (err) => {
                    emitter.removeListener && emitter.removeListener(name, onEvt);
                    reject(err);
                };
                if (typeof emitter.once === 'function') {
                    emitter.once(name, onEvt);
                    emitter.once('error', onErr);
                } else {
                    emitter.addEventListener && emitter.addEventListener(name, onEvt);
                    emitter.addEventListener && emitter.addEventListener('error', onErr);
                }
            });
        };

        globalThis.EventEmitter = EventEmitter;
    },
}));

/* ==========================================================
 * Feature: util  (Node.js subset: format, inspect, promisify, types)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * Deliberate subset. util.inspect uses the engine's JS_PrintValue
 * for accurate rendering (via print(...)-compatible formatting)
 * but degrades gracefully if print isn't available.
 *
 * Exposed as `globalThis.util` plus `globalThis.require('util')`
 * (a hand-rolled stub registry that just returns the same object).
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'util',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node.js util (format, inspect, promisify, types.*)',
    globals:     ['util'],
    standard:    false,
    install() {
        function format(fmt, ...args) {
            if (typeof fmt !== 'string') {
                return [fmt, ...args].map(inspect).join(' ');
            }
            let i = 0;
            let out = '';
            for (let p = 0; p < fmt.length; p++) {
                const c = fmt.charAt(p);
                if (c !== '%' || p + 1 >= fmt.length) { out += c; continue; }
                const spec = fmt.charAt(++p);
                if (spec === '%') { out += '%'; continue; }
                if (i >= args.length) { out += '%' + spec; continue; }
                const a = args[i++];
                switch (spec) {
                    case 's': out += String(a); break;
                    case 'd':
                    case 'i': out += String(parseInt(a, 10)); break;
                    case 'f': out += String(Number(a)); break;
                    case 'j': try { out += JSON.stringify(a); }
                              catch (_) { out += '[Circular]'; } break;
                    case 'o':
                    case 'O': out += inspect(a); break;
                    default:  out += '%' + spec; i--; break;
                }
            }
            /* Extra args get space-joined and appended like Node:
             * primitives go through String(), objects through inspect(). */
            while (i < args.length) {
                const a = args[i++];
                const s = (a !== null && typeof a === 'object')
                    ? inspect(a) : String(a);
                out += ' ' + s;
            }
            return out;
        }

        function inspect(v, _depth) {
            if (v === null) return 'null';
            if (v === undefined) return 'undefined';
            const t = typeof v;
            if (t === 'string') {
                /* Manual escape — avoids three regex replace() calls
                 * in inspect's hot path (Amiga QuickJS-ng has regex
                 * quirks, see isSafeIdent comment). */
                let s = "'";
                for (let k = 0; k < v.length; k++) {
                    const ch = v.charAt(k);
                    if (ch === '\\') s += '\\\\';
                    else if (ch === "'") s += "\\'";
                    else if (ch === '\n') s += '\\n';
                    else s += ch;
                }
                return s + "'";
            }
            if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v);
            if (t === 'function')
                return '[Function' + (v.name ? ': ' + v.name : ' (anonymous)') + ']';
            if (t === 'symbol') return v.toString();
            /* object branch */
            const depth = _depth || 0;
            if (depth > 4) return '[...]';
            if (Array.isArray(v)) {
                if (v.length === 0) return '[]';
                return '[ ' + v.map(x => inspect(x, depth + 1)).join(', ') + ' ]';
            }
            if (v instanceof Date) return v.toISOString();
            if (v instanceof RegExp) return v.toString();
            if (v instanceof Error) return v.stack || (v.name + ': ' + v.message);
            if (ArrayBuffer.isView(v)) {
                const arr = Array.from(v);
                return (v.constructor.name || 'TypedArray') + '(' + arr.length + ') [ ' +
                    arr.slice(0, 10).join(', ') +
                    (arr.length > 10 ? ', ...' : '') + ' ]';
            }
            /* plain object */
            const keys = Object.keys(v);
            if (keys.length === 0) return '{}';
            const parts = keys.slice(0, 20).map(k => {
                const ks = isSafeIdent(k) ? k : JSON.stringify(k);
                return ks + ': ' + inspect(v[k], depth + 1);
            });
            if (keys.length > 20) parts.push('...');
            return '{ ' + parts.join(', ') + ' }';
        }

        /* Identifier check without a regex. The regex literal
         * `/^[A-Za-z_$][A-Za-z0-9_$]*$/` hangs the Amiga QuickJS-ng
         * regex compiler (same family as the Buffer base64 regex bug
         * with `/` inside a char class — `$` inside a char class
         * appears to trip the same codepath). Plain JS is faster
         * anyway for short keys. */
        function isSafeIdent(k) {
            if (!k || typeof k !== 'string') return false;
            const c0 = k.charCodeAt(0);
            if (!((c0 >= 0x41 && c0 <= 0x5A) ||     /* A-Z */
                  (c0 >= 0x61 && c0 <= 0x7A) ||     /* a-z */
                  c0 === 0x5F || c0 === 0x24))      /* _ $ */
                return false;
            for (let i = 1, n = k.length; i < n; i++) {
                const c = k.charCodeAt(i);
                if (!((c >= 0x41 && c <= 0x5A) ||
                      (c >= 0x61 && c <= 0x7A) ||
                      (c >= 0x30 && c <= 0x39) ||   /* 0-9 */
                      c === 0x5F || c === 0x24))
                    return false;
            }
            return true;
        }

        function promisify(fn) {
            return function (...args) {
                return new Promise((resolve, reject) => {
                    args.push(function (err, ...rest) {
                        if (err) return reject(err);
                        if (rest.length <= 1) resolve(rest[0]);
                        else resolve(rest);
                    });
                    try { fn.apply(this, args); }
                    catch (e) { reject(e); }
                });
            };
        }

        function callbackify(fn) {
            return function (...args) {
                const cb = args.pop();
                if (typeof cb !== 'function')
                    throw new TypeError('last argument must be a function');
                Promise.resolve()
                    .then(() => fn.apply(this, args))
                    .then(v => cb(null, v), e => cb(e));
            };
        }

        const types = {
            isArray: Array.isArray,
            isDate: v => v instanceof Date,
            isRegExp: v => v instanceof RegExp,
            isError: v => v instanceof Error,
            isPromise: v => v && typeof v.then === 'function',
            isMap: v => v instanceof Map,
            isSet: v => v instanceof Set,
            isWeakMap: v => v instanceof WeakMap,
            isWeakSet: v => v instanceof WeakSet,
            isArrayBuffer: v => v instanceof ArrayBuffer,
            isTypedArray: v => ArrayBuffer.isView(v) && !(v instanceof DataView),
            isUint8Array: v => v instanceof Uint8Array,
            isFunction: v => typeof v === 'function',
        };

        /* util.parseArgs — Node 18.3+ argv parser subset.
         * Supports options={type:'string'|'boolean', short, multiple, default}. */
        function parseArgs(config) {
            const args = (config && config.args) || [];
            const opts = (config && config.options) || {};
            const allowPositionals = config && config.allowPositionals;
            const values = {};
            const positionals = [];

            /* Pre-populate defaults */
            for (const k of Object.keys(opts)) {
                if ('default' in opts[k]) values[k] = opts[k].default;
            }

            /* Build short-name lookup */
            const shorts = {};
            for (const k of Object.keys(opts)) {
                if (opts[k].short) shorts[opts[k].short] = k;
            }

            for (let i = 0; i < args.length; i++) {
                const a = args[i];
                if (a === '--') {
                    if (allowPositionals) for (i = i + 1; i < args.length; i++) positionals.push(args[i]);
                    break;
                }
                if (a.startsWith('--')) {
                    const eq = a.indexOf('=');
                    let name, val;
                    if (eq >= 0) { name = a.substring(2, eq); val = a.substring(eq + 1); }
                    else         { name = a.substring(2); val = null; }
                    const o = opts[name];
                    if (!o) continue;
                    if (o.type === 'boolean') {
                        values[name] = (val === null || val === '' || val === 'true');
                    } else {
                        if (val === null) { i++; val = args[i]; }
                        if (o.multiple) {
                            if (!Array.isArray(values[name])) values[name] = [];
                            values[name].push(val);
                        } else values[name] = val;
                    }
                } else if (a.startsWith('-') && a.length > 1) {
                    const sh = a.substring(1);
                    const name = shorts[sh];
                    if (!name) continue;
                    const o = opts[name];
                    if (o.type === 'boolean') values[name] = true;
                    else                     { i++; values[name] = args[i]; }
                } else if (allowPositionals) {
                    positionals.push(a);
                }
            }
            return { values, positionals };
        }

        /* util.deprecate — wraps fn to print a deprecation warning on first call. */
        function deprecate(fn, msg) {
            let warned = false;
            return function (...args) {
                if (!warned) {
                    warned = true;
                    try { std.err.puts('(qjs) DeprecationWarning: ' + msg + '\n'); } catch (_) {}
                }
                return fn.apply(this, args);
            };
        }

        /* util.debuglog — returns a logger controlled by NODE_DEBUG env var.
         * If section is present in comma-separated NODE_DEBUG, logs to stderr. */
        function debuglog(section) {
            let enabled = null;
            return function (fmt, ...args) {
                if (enabled === null) {
                    const env = (std && std.getenv) ? std.getenv('NODE_DEBUG') : '';
                    if (!env) { enabled = false; }
                    else {
                        const parts = String(env).split(',');
                        enabled = parts.indexOf(section) >= 0 ||
                                  parts.indexOf('*') >= 0;
                    }
                }
                if (!enabled) return;
                try {
                    std.err.puts(section.toUpperCase() + ' ' + format(fmt, ...args) + '\n');
                } catch (_) {}
            };
        }

        globalThis.util = {
            format, inspect, promisify, callbackify, types,
            parseArgs, deprecate, debuglog,
            inherits(ctor, superCtor) {
                /* Old Node util.inherits. Here mainly so code that
                 * imports it doesn't error. */
                Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
            },
        };
    },
}));

/* ==========================================================
 * Feature: fs.promises  (Node.js subset over qjs:os)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * Wraps the synchronous qjs:os file primitives in Promises so
 * Node-style `import fs from 'node:fs/promises'` style code can
 * run without change. All I/O is still synchronous under the
 * hood — we don't have async file I/O on AmigaOS yet.
 *
 * Exposed as globalThis.fs.promises and mirrored at
 * globalThis.fsPromises for ergonomics.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'fs-promises',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node fs.promises subset over qjs:os (synchronous underneath)',
    globals:     ['fs', 'fsPromises'],
    standard:    false,
    requires:    ['buffer'],
    install() {
        /* qjs:os functions we lean on: read, readFile, writeFile, remove,
         * rename, stat, lstat, realpath, mkdir, readdir (via readdir()
         * or equivalent), open, close. Availability varies; each wrapper
         * falls back gracefully where possible. */

        function pError(err, path) {
            const e = new Error(err + (path ? ": " + path : ''));
            e.code = err;
            if (path !== undefined) e.path = path;
            return e;
        }

        function toBuffer(arg, enc) {
            if (arg instanceof Uint8Array) return arg;
            if (typeof arg === 'string') {
                return globalThis.Buffer
                    ? globalThis.Buffer.from(arg, enc || 'utf8')
                    : new TextEncoder().encode(arg);
            }
            throw new TypeError('expected string or Buffer');
        }

        const fsp = {
            readFile(path, options) {
                return new Promise((resolve, reject) => {
                    try {
                        /* std.open uses AmigaOS-native MODE_* under the hood
                         * on the Amiga build; POSIX mode strings work on host.
                         * Avoids guessing POSIX open() flag values. */
                        const f = std.open(path, 'rb');
                        if (!f) return reject(pError('ENOENT', path));
                        const parts = [];
                        const buf = new Uint8Array(8192);
                        let n;
                        do {
                            n = f.read(buf.buffer, 0, buf.length) | 0;
                            if (n > 0) parts.push(buf.slice(0, n));
                        } while (n > 0);
                        f.close();
                        let total = 0;
                        for (const p of parts) total += p.length;
                        const data = new Uint8Array(total);
                        let off = 0;
                        for (const p of parts) { data.set(p, off); off += p.length; }
                        const encArg = (typeof options === 'string')
                            ? options
                            : (options && options.encoding);
                        if (encArg) {
                            resolve(globalThis.Buffer
                                ? globalThis.Buffer.from(data).toString(encArg)
                                : new TextDecoder(encArg).decode(data));
                        } else {
                            resolve(globalThis.Buffer
                                ? globalThis.Buffer.from(data)
                                : data);
                        }
                    } catch (e) { reject(e); }
                });
            },
            writeFile(path, data, options) {
                return new Promise((resolve, reject) => {
                    try {
                        const enc = (typeof options === 'string') ? options
                                  : (options && options.encoding) || 'utf8';
                        const bytes = toBuffer(data, enc);
                        const f = std.open(path, 'wb');
                        if (!f) return reject(pError('EACCES', path));
                        f.write(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                        f.close();
                        resolve(undefined);
                    } catch (e) { reject(e); }
                });
            },
            appendFile(path, data, options) {
                return new Promise((resolve, reject) => {
                    try {
                        const enc = (typeof options === 'string') ? options
                                  : (options && options.encoding) || 'utf8';
                        const bytes = toBuffer(data, enc);
                        const f = std.open(path, 'ab');
                        if (!f) return reject(pError('EACCES', path));
                        f.write(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                        f.close();
                        resolve(undefined);
                    } catch (e) { reject(e); }
                });
            },
            stat(path) {
                return new Promise((resolve, reject) => {
                    const [st, err] = os.stat(path);
                    if (err) return reject(pError('ENOENT', path));
                    /* Node's stat returns isFile()/isDirectory() helpers. */
                    const S_IFMT = 0xF000;
                    const S_IFDIR = 0x4000;
                    const S_IFREG = 0x8000;
                    st.isFile      = () => (st.mode & S_IFMT) === S_IFREG;
                    st.isDirectory = () => (st.mode & S_IFMT) === S_IFDIR;
                    st.isSymbolicLink = () => false;
                    resolve(st);
                });
            },
            lstat(path) { return fsp.stat(path); },
            unlink(path) {
                return new Promise((resolve, reject) => {
                    const e = os.remove(path);
                    if (e) reject(pError('EIO', path));
                    else resolve(undefined);
                });
            },
            rename(oldPath, newPath) {
                return new Promise((resolve, reject) => {
                    const e = os.rename(oldPath, newPath);
                    if (e) reject(pError('EIO', oldPath));
                    else resolve(undefined);
                });
            },
            mkdir(path, options) {
                return new Promise((resolve, reject) => {
                    const mode = (options && options.mode) || 0o777;
                    const e = os.mkdir ? os.mkdir(path, mode) : -1;
                    if (e) reject(pError('EIO', path));
                    else resolve(undefined);
                });
            },
            readdir(path) {
                return new Promise((resolve, reject) => {
                    if (!os.readdir) return reject(pError('ENOSYS', path));
                    const [list, err] = os.readdir(path);
                    if (err) reject(pError('ENOENT', path));
                    /* Node filters out '.' and '..' by default; match that. */
                    else resolve(list.filter(n => n !== '.' && n !== '..'));
                });
            },
            access(path, mode) {
                /* Node: resolves if accessible, rejects with ENOENT otherwise.
                 * We don't enforce mode (R_OK/W_OK/X_OK) — AmigaOS doesn't
                 * have POSIX access semantics per-bit. Existence check via
                 * os.stat is the practical proxy. */
                return new Promise((resolve, reject) => {
                    const [, err] = os.stat(path);
                    if (err) reject(pError('ENOENT', path));
                    else resolve(undefined);
                });
            },
            copyFile(src, dest) {
                return new Promise((resolve, reject) => {
                    try {
                        const f = std.open(src, 'rb');
                        if (!f) return reject(pError('ENOENT', src));
                        const parts = [];
                        const buf = new Uint8Array(8192);
                        let n;
                        do {
                            n = f.read(buf.buffer, 0, buf.length) | 0;
                            if (n > 0) parts.push(buf.slice(0, n));
                        } while (n > 0);
                        f.close();
                        let total = 0;
                        for (const p of parts) total += p.length;
                        const data = new Uint8Array(total);
                        let off = 0;
                        for (const p of parts) { data.set(p, off); off += p.length; }

                        const out = std.open(dest, 'wb');
                        if (!out) return reject(pError('EACCES', dest));
                        if (total > 0) out.write(data.buffer, 0, total);
                        out.close();
                        resolve(undefined);
                    } catch (e) { reject(e); }
                });
            },
            truncate(path, len) {
                /* No native truncate on qjs:os. Read-truncate-write approach:
                 * read the first `len` bytes, rewrite. Destructive but
                 * matches Node semantics for the common case. */
                return new Promise((resolve, reject) => {
                    try {
                        const size = len | 0;
                        if (size < 0) return reject(pError('EINVAL', path));
                        const f = std.open(path, 'rb');
                        if (!f) return reject(pError('ENOENT', path));
                        const buf = new Uint8Array(size);
                        if (size > 0) f.read(buf.buffer, 0, size);
                        f.close();
                        const out = std.open(path, 'wb');
                        if (!out) return reject(pError('EACCES', path));
                        if (size > 0) out.write(buf.buffer, 0, size);
                        out.close();
                        resolve(undefined);
                    } catch (e) { reject(e); }
                });
            },
            utimes(path, atime, mtime) {
                /* AmigaOS has SetFileDate but qjs:os doesn't expose it yet.
                 * Stub: resolves without actually updating times. Node code
                 * that needs this is rare on Amiga. */
                return new Promise((resolve, reject) => {
                    const [, err] = os.stat(path);
                    if (err) reject(pError('ENOENT', path));
                    else resolve(undefined);
                });
            },
        };

        /* Node constants on fs — some code pulls these directly. */
        const fsConstants = {
            F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1,
            O_RDONLY: 0, O_WRONLY: 1, O_RDWR: 2,
            O_CREAT: 0x200, O_EXCL: 0x800, O_TRUNC: 0x400, O_APPEND: 8,
        };

        globalThis.fs = globalThis.fs || {};
        globalThis.fs.promises = fsp;
        globalThis.fs.constants = fsConstants;
        globalThis.fsPromises = fsp;
    },
}));

/* ==========================================================
 * Feature: assert  (Node assert module — tiny subset)
 * Tier: pure-js    Provider: nea-port    Standard: node
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'assert',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node assert (ok/equal/notEqual/deepEqual/strictEqual/throws/rejects/fail)',
    globals:     ['assert'],
    standard:    false,
    install() {
        function fail(msg) {
            const e = new Error(msg || 'Assertion failed');
            e.name = 'AssertionError';
            throw e;
        }
        function ok(v, msg) {
            if (!v) fail(msg || `ok(${v})`);
        }
        function equal(a, b, msg) {
            /* Node assert.equal is ==; strictEqual is === */
            if (a != b) fail(msg || `${a} == ${b}`);
        }
        function notEqual(a, b, msg) {
            if (a == b) fail(msg || `${a} != ${b}`);
        }
        function strictEqual(a, b, msg) {
            if (a !== b) fail(msg || `${JSON.stringify(a)} === ${JSON.stringify(b)}`);
        }
        function notStrictEqual(a, b, msg) {
            if (a === b) fail(msg || `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
        }
        function deepEqualImpl(a, b, strict) {
            if (strict ? a === b : a == b) return true;
            if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object')
                return false;
            if (Array.isArray(a) !== Array.isArray(b)) return false;
            const ka = Object.keys(a), kb = Object.keys(b);
            if (ka.length !== kb.length) return false;
            for (const k of ka) {
                if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
                if (!deepEqualImpl(a[k], b[k], strict)) return false;
            }
            return true;
        }
        function deepEqual(a, b, msg) {
            if (!deepEqualImpl(a, b, false)) fail(msg || 'deepEqual');
        }
        function deepStrictEqual(a, b, msg) {
            if (!deepEqualImpl(a, b, true)) fail(msg || 'deepStrictEqual');
        }
        function throws(fn, expected, msg) {
            let caught = null;
            try { fn(); } catch (e) { caught = e; }
            if (!caught) fail(msg || 'expected function to throw');
            if (expected && typeof expected === 'function') {
                if (!(caught instanceof expected))
                    fail(msg || `throw not instanceof ${expected.name}`);
            }
        }
        function doesNotThrow(fn, msg) {
            try { fn(); }
            catch (e) { fail(msg || `unexpected throw: ${e && e.message || e}`); }
        }
        async function rejects(promiseOrFn, expected, msg) {
            const p = (typeof promiseOrFn === 'function') ? promiseOrFn() : promiseOrFn;
            let caught = null;
            try { await p; } catch (e) { caught = e; }
            if (!caught) fail(msg || 'expected Promise to reject');
            if (expected && typeof expected === 'function') {
                if (!(caught instanceof expected))
                    fail(msg || `reject not instanceof ${expected.name}`);
            }
        }
        async function doesNotReject(promiseOrFn, msg) {
            const p = (typeof promiseOrFn === 'function') ? promiseOrFn() : promiseOrFn;
            try { await p; }
            catch (e) { fail(msg || `unexpected reject: ${e && e.message || e}`); }
        }
        function match(str, regex, msg) {
            if (!regex.test(String(str))) fail(msg || `${str} does not match ${regex}`);
        }
        function doesNotMatch(str, regex, msg) {
            if (regex.test(String(str))) fail(msg || `${str} matches ${regex}`);
        }

        /* Bare call: assert(value, msg) === assert.ok(value, msg) */
        const assertFn = function (v, msg) { ok(v, msg); };
        assertFn.ok                = ok;
        assertFn.equal             = equal;
        assertFn.notEqual          = notEqual;
        assertFn.strictEqual       = strictEqual;
        assertFn.notStrictEqual    = notStrictEqual;
        assertFn.deepEqual         = deepEqual;
        assertFn.deepStrictEqual   = deepStrictEqual;
        assertFn.notDeepEqual      = (a, b, m) => { if (deepEqualImpl(a, b, false)) fail(m || 'notDeepEqual'); };
        assertFn.notDeepStrictEqual = (a, b, m) => { if (deepEqualImpl(a, b, true)) fail(m || 'notDeepStrictEqual'); };
        assertFn.throws            = throws;
        assertFn.doesNotThrow      = doesNotThrow;
        assertFn.rejects           = rejects;
        assertFn.doesNotReject     = doesNotReject;
        assertFn.match             = match;
        assertFn.doesNotMatch      = doesNotMatch;
        assertFn.fail              = fail;
        /* Aliases */
        assertFn.strict = assertFn;
        assertFn.AssertionError = class AssertionError extends Error {
            constructor(opts) {
                super((opts && opts.message) || 'Assertion failed');
                this.name = 'AssertionError';
                if (opts) {
                    this.actual = opts.actual;
                    this.expected = opts.expected;
                    this.operator = opts.operator;
                }
            }
        };

        globalThis.assert = assertFn;
    },
}));

/* ==========================================================
 * Feature: timers.promises  (Node modern async sleep API)
 * Tier: pure-js    Provider: nea-port    Standard: node
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'timers-promises',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node timers/promises (setTimeout/setInterval/setImmediate as Promises)',
    globals:     ['timers'],
    standard:    false,
    install() {
        const timersP = {
            setTimeout(ms, value, opts) {
                return new Promise((resolve, reject) => {
                    const signal = opts && opts.signal;
                    if (signal && signal.aborted) {
                        reject(signal.reason || new DOMException('Aborted', 'AbortError'));
                        return;
                    }
                    const id = setTimeout(() => resolve(value), ms | 0);
                    if (signal) {
                        signal.addEventListener('abort', () => {
                            clearTimeout(id);
                            reject(signal.reason || new DOMException('Aborted', 'AbortError'));
                        });
                    }
                });
            },
            setImmediate(value, opts) {
                return new Promise((resolve) => {
                    queueMicrotask(() => resolve(value));
                });
            },
            /* setInterval would need an async iterator; defer */
        };
        globalThis.timers = { promises: timersP };
    },
}));

/* ==========================================================
 * Feature: process.stdout / stderr / stdin (Writables + Readable)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * Wraps std.out/std.err/std.in (qjs:std FILE handles) in stream-
 * compatible objects so Node-style `process.stdout.write(str)`
 * works. These are NOT full streams (no .pipe target on stdin, no
 * backpressure); they expose .write/.end and basic event emitter
 * shape for compat.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'process-stdio',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'process.stdout / stderr as Writable-like objects',
    requires:    ['process'],
    standard:    false,
    install() {
        if (!globalThis.process) return;

        const makeStdio = (fh) => ({
            write(chunk, enc, cb) {
                try {
                    if (chunk instanceof Uint8Array) {
                        fh.write(chunk.buffer, chunk.byteOffset, chunk.byteLength);
                    } else {
                        fh.puts(String(chunk));
                    }
                    fh.flush();
                    if (cb) cb(null);
                    return true;
                } catch (e) { if (cb) cb(e); return false; }
            },
            end(chunk) {
                if (chunk !== undefined && chunk !== null) this.write(chunk);
                /* don't actually close std.out/std.err */
            },
            /* on() / once() / emit() stubs — code that treats stdout as an
             * EventEmitter gets a no-op instead of a crash. */
            on() { return this; },
            once() { return this; },
            emit() { return false; },
            /* Columns/rows queried lazily from os.ttyGetWinSize where available */
            get columns() {
                try {
                    const r = os.ttyGetWinSize && os.ttyGetWinSize(1);
                    return r ? r[0] : 80;
                } catch (_) { return 80; }
            },
            get rows() {
                try {
                    const r = os.ttyGetWinSize && os.ttyGetWinSize(1);
                    return r ? r[1] : 24;
                } catch (_) { return 24; }
            },
            isTTY: true,
        });

        globalThis.process.stdout = makeStdio(std.out);
        globalThis.process.stderr = makeStdio(std.err);
        /* stdin is readable — basic shape only. Full support would need
         * the stream tier + async read loop. */
        globalThis.process.stdin = {
            on() { return this; }, once() { return this; }, emit() { return false; },
            isTTY: true,
            /* Node stdin has a .resume() that kicks off reading — no-op
             * here since we don't run a stdin read loop. */
            resume() {},
            pause() {},
        };
    },
}));

/* ==========================================================
 * Feature: path.posix / path.win32 aliases (Node compat)
 * Tier: pure-js    Provider: nea-port
 *
 * Amiga path handling is unique — `:` is a separator, `/` too.
 * Node code that explicitly imports `path.posix` or `path.win32`
 * is usually doing platform-agnostic path manipulation and wants
 * consistent behavior. We alias both to the same AmigaOS-aware
 * `path` object — good enough for join/dirname/basename/extname
 * which are the 95% case.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'path-aliases',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'path.posix / path.win32 alias to globalThis.path',
    requires:    ['path'],
    standard:    false,
    install() {
        if (globalThis.path) {
            globalThis.path.posix = globalThis.path;
            globalThis.path.win32 = globalThis.path;
        }
    },
}));

/* ==========================================================
 * Feature: querystring  (Node legacy query-string parser)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * Node v0 qs API — deprecated in favor of URLSearchParams but still
 * used in lots of Node code. Implementation just wraps URLSearchParams
 * for parse(); stringify() matches Node's historical output (%20 as +
 * in value component, = for empty value).
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'querystring',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node querystring (parse/stringify/escape/unescape)',
    globals:     ['querystring'],
    standard:    false,
    requires:    ['url'],
    install() {
        function parse(str, sep, eq) {
            sep = sep || '&';
            eq  = eq  || '=';
            const out = {};
            if (!str || typeof str !== 'string') return out;
            for (const pair of str.split(sep)) {
                if (!pair.length) continue;
                const idx = pair.indexOf(eq);
                let k, v;
                if (idx < 0) { k = pair; v = ''; }
                else         { k = pair.substring(0, idx); v = pair.substring(idx + 1); }
                k = decodeURIComponent(k.split('+').join(' '));
                v = decodeURIComponent(v.split('+').join(' '));
                if (k in out) {
                    if (Array.isArray(out[k])) out[k].push(v);
                    else out[k] = [out[k], v];
                } else out[k] = v;
            }
            return out;
        }

        function stringify(obj, sep, eq) {
            sep = sep || '&';
            eq  = eq  || '=';
            if (!obj || typeof obj !== 'object') return '';
            const parts = [];
            const enc = (s) => encodeURIComponent(String(s)).split('%20').join('+');
            for (const k of Object.keys(obj)) {
                const ek = enc(k);
                const v = obj[k];
                if (Array.isArray(v)) {
                    for (const item of v) parts.push(ek + eq + enc(item));
                } else if (v === null || v === undefined) {
                    parts.push(ek + eq);
                } else {
                    parts.push(ek + eq + enc(v));
                }
            }
            return parts.join(sep);
        }

        globalThis.querystring = {
            parse, stringify,
            escape: encodeURIComponent,
            unescape: decodeURIComponent,
            /* Node aliases */
            decode: parse,
            encode: stringify,
        };
    },
}));

/* ==========================================================
 * Feature: string_decoder  (Node incremental UTF-8 decoder)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * Thin wrapper over TextDecoder with streaming semantics: write()
 * decodes as much as it can, end() flushes any trailing bytes.
 * Used by readline, fs streams, net protocols. Tiny surface.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'string-decoder',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node string_decoder (StringDecoder class over TextDecoder)',
    globals:     ['StringDecoder'],
    requires:    ['text-encoding'],
    standard:    false,
    install() {
        /* UTF-8 continuation byte check: 10xxxxxx */
        function isCont(b) { return (b & 0xC0) === 0x80; }

        /* Count how many bytes are needed to complete a UTF-8 sequence
         * that starts at index `start`. Returns the TOTAL byte count
         * (2, 3, or 4) or 0 for single-byte ASCII / invalid leads. */
        function expectedBytes(leadByte) {
            if (leadByte < 0x80) return 1;
            if ((leadByte & 0xE0) === 0xC0) return 2;
            if ((leadByte & 0xF0) === 0xE0) return 3;
            if ((leadByte & 0xF8) === 0xF0) return 4;
            return 1;  /* invalid lead; let TextDecoder emit 0xFFFD */
        }

        class StringDecoder {
            constructor(encoding) {
                this._enc = (encoding || 'utf-8').toLowerCase();
                this._dec = new globalThis.TextDecoder(this._enc, { fatal: false });
                this._partial = null;   /* leftover bytes from prior write */
            }
            /* write(buffer) — returns decoded string. Buffers trailing
             * bytes of any incomplete UTF-8 sequence so the next write
             * can complete it. */
            write(buf) {
                if (typeof buf === 'string') return buf;
                if (!(buf instanceof Uint8Array)) {
                    if (buf instanceof ArrayBuffer) buf = new Uint8Array(buf);
                    else if (ArrayBuffer.isView(buf))
                        buf = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
                    else return '';
                }

                /* Prepend any pending partial bytes from the last write. */
                let bytes = buf;
                if (this._partial && this._partial.length > 0) {
                    const merged = new Uint8Array(this._partial.length + buf.length);
                    merged.set(this._partial, 0);
                    merged.set(buf, this._partial.length);
                    bytes = merged;
                    this._partial = null;
                }

                /* Scan back from the end to find the start of any
                 * incomplete trailing sequence. At most 3 bytes of tail
                 * can be incomplete (SHA-4's max leading + 0-3 conts). */
                let cut = bytes.length;
                for (let back = 1; back <= 3 && back <= bytes.length; back++) {
                    const idx = bytes.length - back;
                    const b = bytes[idx];
                    if (isCont(b)) continue;   /* continuation — look further left */
                    const need = expectedBytes(b);
                    if (need > back) {
                        /* Incomplete sequence starting at idx */
                        cut = idx;
                    }
                    break;
                }

                if (cut < bytes.length) {
                    this._partial = bytes.slice(cut);
                    bytes = bytes.subarray(0, cut);
                }

                return bytes.length > 0 ? this._dec.decode(bytes) : '';
            }
            end(buf) {
                let out = '';
                if (buf !== undefined) out += this.write(buf);
                /* Flush whatever's left — will emit replacement chars
                 * if the trailing sequence was truly incomplete. */
                if (this._partial && this._partial.length > 0) {
                    out += this._dec.decode(this._partial);
                    this._partial = null;
                }
                return out;
            }
        }
        globalThis.StringDecoder = StringDecoder;
    },
}));

/* ==========================================================
 * Feature: stream  (Node.js subset — Readable, Writable)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * Minimal v1: push-based Readable, synchronous Writable, .pipe(),
 * Readable.from(iterable). No backpressure, no highWaterMark, no
 * object mode, no duplex/transform. Enough to:
 *   - build streaming producers (fs.createReadStream, child_process
 *     stdout) that emit 'data' and 'end'
 *   - consume via on('data') or pipe()
 *   - wrap arrays/iterables with Readable.from()
 *
 * Node surface approximated; full Streams3 backpressure semantics
 * deferred. Extending EventEmitter comes for free (we require it).
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'stream',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node.js stream (Readable + Writable subset; push-based, no backpressure)',
    globals:     ['stream'],
    standard:    false,
    requires:    ['event-emitter'],
    install() {
        const EE = globalThis.EventEmitter;

        class Readable extends EE {
            constructor(opts) {
                super();
                this._ended = false;
                this._reading = false;
                const src = opts || {};
                if (typeof src.read === 'function') this._read = src.read;
            }
            _read() { /* subclass or option override */ }

            /* Called by the producer (either user code or our _read) to
             * deliver a chunk. null signals end-of-stream. */
            push(chunk) {
                if (this._ended) return false;
                if (chunk === null) {
                    this._ended = true;
                    /* Defer to the microtask queue so any listener attached
                     * on the same tick after construction still fires. */
                    queueMicrotask(() => this.emit('end'));
                    return false;
                }
                queueMicrotask(() => this.emit('data', chunk));
                return true;
            }

            pipe(dest, opts) {
                const end = !opts || opts.end !== false;
                this.on('data', (chunk) => { dest.write(chunk); });
                this.on('end',  () => { if (end) dest.end(); });
                this.on('error', (e) => dest.emit('error', e));
                return dest;
            }

            /* Node-compatible helper. Drains an iterable into a Readable. */
            static from(iterable, opts) {
                const r = new Readable(opts);
                queueMicrotask(() => {
                    try {
                        for (const item of iterable) r.push(item);
                        r.push(null);
                    } catch (e) { r.emit('error', e); }
                });
                return r;
            }
        }

        class Writable extends EE {
            constructor(opts) {
                super();
                this._ended = false;
                this._finished = false;
                const src = opts || {};
                if (typeof src.write === 'function') this._writeFn = src.write;
            }
            _writeFn(chunk, cb) { cb(); }

            write(chunk, cb) {
                if (this._ended) {
                    const err = new Error('write after end');
                    /* Node semantics: emit 'error' AND call cb with error.
                     * Callers may attach either or both; we fire both so
                     * detection works for listeners and callbacks. */
                    queueMicrotask(() => this.emit('error', err));
                    if (cb) queueMicrotask(() => cb(err));
                    return false;
                }
                /* Invoke synchronous write. Callback (if any) called once
                 * the write "settles" — for us, same tick. */
                try {
                    this._writeFn.call(this, chunk, (err) => {
                        if (err) this.emit('error', err);
                        if (cb)  cb(err || null);
                    });
                } catch (e) {
                    this.emit('error', e);
                    if (cb) cb(e);
                    return false;
                }
                return true;
            }

            end(chunk, cb) {
                if (chunk !== undefined && chunk !== null) this.write(chunk);
                if (this._ended) return;
                this._ended = true;
                queueMicrotask(() => {
                    if (!this._finished) {
                        this._finished = true;
                        this.emit('finish');
                        if (cb) cb();
                    }
                });
            }
        }

        /* Minimal Transform — for completeness, same API as Node: the
         * user provides a transform(chunk, enc, cb) method. Not
         * optimized (two EE chains) but works for simple use. */
        class Transform extends Readable {
            constructor(opts) {
                super(opts);
                const src = opts || {};
                if (typeof src.transform === 'function') this._transform = src.transform;
            }
            _transform(chunk, enc, cb) { this.push(chunk); cb(); }
            write(chunk) {
                this._transform(chunk, null, (err, out) => {
                    if (err) { this.emit('error', err); return; }
                    if (out !== undefined && out !== null) this.push(out);
                });
                return true;
            }
            end() { this.push(null); }
        }

        /* stream.pipeline(...streams, [cb]) — wires a chain via .pipe and
         * resolves/rejects when the last stream finishes or any stream
         * errors. Callback form mirrors Node exactly. */
        function pipeline(...args) {
            let cb = null;
            if (typeof args[args.length - 1] === 'function') cb = args.pop();
            const streams = args;
            if (streams.length < 2)
                throw new TypeError('pipeline requires at least 2 streams');

            return new Promise((resolve, reject) => {
                let settled = false;
                const finish = (err) => {
                    if (settled) return;
                    settled = true;
                    if (cb) { try { cb(err); } catch (_) {} }
                    if (err) reject(err); else resolve();
                };
                for (const s of streams) {
                    if (s && typeof s.on === 'function')
                        s.on('error', finish);
                }
                /* Wire the chain */
                for (let i = 0; i < streams.length - 1; i++) {
                    streams[i].pipe(streams[i + 1]);
                }
                /* Last stream's 'finish' or 'end' signals completion */
                const last = streams[streams.length - 1];
                if (last && typeof last.on === 'function') {
                    last.on('finish', () => finish());
                    last.on('end',    () => finish());
                }
            });
        }

        globalThis.stream = {
            Readable, Writable, Transform,
            pipeline,
            /* Node aliases */
            PassThrough: class PassThrough extends Transform {
                constructor(opts) { super(opts); }
            },
        };
    },
}));

/* ==========================================================
 * Feature: child_process  (Node.js subset over qjs:child_process)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * v1: synchronous spawnSync via dos.library SystemTagList with
 * SYS_Output/SYS_Error captured to T: temp files. Returns
 * { stdout, stderr, exitCode, signal } matching Node.
 *
 * spawn() wraps spawnSync in a Promise for API shape — it does
 * NOT actually run the child asynchronously on Amiga yet.
 * True async would need a Worker-task wrapper; deferred until
 * there's demand. For most Amiga use cases (run a build, get
 * exit code + output) the sync path is what users want anyway.
 *
 * exec(cmd) is aliased to spawn(cmd) — on Amiga, dos.library
 * commands already resolve through the shell's path, so there's
 * no practical difference.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'child-process',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node.js child_process subset (spawnSync via dos.library SystemTagList)',
    globals:     ['child_process'],
    standard:    false,
    install() {
        /* The CLI installs globalThis.__qjs_spawnSync at startup under
         * QJS_USE_LIBRARY. Missing on upstream qjs; detect and noop. */
        const nativeSync  = globalThis.__qjs_spawnSync;
        const nativeAsync = globalThis.__qjs_spawnAsync;
        if (typeof nativeSync !== 'function') return;

        function _cmdline(cmd, args) {
            let s = String(cmd);
            if (Array.isArray(args)) {
                for (const a of args) s += ' ' + String(a);
            }
            return s;
        }

        globalThis.child_process = {
            spawnSync(cmd, args, opts) {
                return nativeSync(_cmdline(cmd, args));
            },
            spawn(cmd, args, opts) {
                /* Prefer true async via QJS_Worker (0.100+); fall back
                 * to sync-wrapped-in-Promise if the native is absent. */
                if (nativeAsync) return nativeAsync(_cmdline(cmd, args));
                return new Promise((resolve, reject) => {
                    try { resolve(nativeSync(_cmdline(cmd, args))); }
                    catch (e) { reject(e); }
                });
            },
            exec(cmd, opts) {
                if (nativeAsync) return nativeAsync(String(cmd));
                return new Promise((resolve, reject) => {
                    try { resolve(nativeSync(String(cmd))); }
                    catch (e) { reject(e); }
                });
            },
            execSync(cmd, opts) { return nativeSync(String(cmd)); },
        };
    },
}));

/* ==========================================================
 * Feature: crypto.subtle.digest + getRandomValues (WebCrypto subset)
 * Tier: pure-js    Provider: nea-port    Standard: web (Node >=19)
 *
 * Primary path is pure-JS SHA-1 / SHA-256 / MD5 — works on any
 * Amiga, no AmiSSL or bsdsocket required.  Native AmiSSL fast-path
 * via globalThis.__qjs_cryptoDigest is tried first when installed
 * (library 0.090+); falls back to pure-JS on failure.
 *
 * SHA-384 / SHA-512 require 64-bit arithmetic and are only
 * supported via the AmiSSL native path.  Requesting them without
 * AmiSSL rejects with a clear error; use SHA-256 instead.
 *
 * getRandomValues uses DateStamp-seeded LCG (native) or Math.random
 * (fallback) — NOT cryptographic-quality in either case.  Adequate
 * for IDs, session tokens, nonces.  Document in NODEJS-DELTA.md.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'crypto',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'crypto.subtle.digest (pure-JS + AmiSSL fast-path) + getRandomValues',
    globals:     ['crypto'],
    standard:    true,
    install() {
        const nativeDigest = globalThis.__qjs_cryptoDigest;
        const nativeRandom = globalThis.__qjs_cryptoRandom;

        /* -------- pure-JS primitives ---------- */

        /* Rotate-right 32-bit */
        function rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }
        /* Rotate-left 32-bit */
        function rotl(x, n) { return ((x << n) | (x >>> (32 - n))) >>> 0; }

        function toBytes(data) {
            if (data instanceof Uint8Array) return data;
            if (data instanceof ArrayBuffer) return new Uint8Array(data);
            if (ArrayBuffer.isView(data))
                return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            if (typeof data === 'string') return new TextEncoder().encode(data);
            throw new TypeError('crypto.digest: data must be ArrayBuffer, TypedArray, or string');
        }

        /* ---- SHA-256 ---- */
        const SHA256_K = new Uint32Array([
            0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
            0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
            0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
            0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
            0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
            0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
            0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
            0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
        ]);
        function sha256(bytes) {
            const len = bytes.length;
            const bitLen = len * 8;
            const padLen = (len + 9 + 63) & ~63;
            const msg = new Uint8Array(padLen);
            msg.set(bytes);
            msg[len] = 0x80;
            /* Big-endian 64-bit bit-length in last 8 bytes */
            msg[padLen - 4] = (bitLen >>> 24) & 0xFF;
            msg[padLen - 3] = (bitLen >>> 16) & 0xFF;
            msg[padLen - 2] = (bitLen >>> 8)  & 0xFF;
            msg[padLen - 1] =  bitLen         & 0xFF;

            let h0=0x6a09e667, h1=0xbb67ae85, h2=0x3c6ef372, h3=0xa54ff53a,
                h4=0x510e527f, h5=0x9b05688c, h6=0x1f83d9ab, h7=0x5be0cd19;
            const w = new Uint32Array(64);

            for (let off = 0; off < padLen; off += 64) {
                for (let i = 0; i < 16; i++) {
                    w[i] = (msg[off+4*i]<<24) | (msg[off+4*i+1]<<16) |
                           (msg[off+4*i+2]<<8) | msg[off+4*i+3];
                    w[i] >>>= 0;
                }
                for (let i = 16; i < 64; i++) {
                    const s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3);
                    const s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19)  ^ (w[i-2] >>> 10);
                    w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
                }
                let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,hh=h7;
                for (let i = 0; i < 64; i++) {
                    const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
                    const ch = (e & f) ^ (~e & g);
                    const t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
                    const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
                    const mj = (a & b) ^ (a & c) ^ (b & c);
                    const t2 = (S0 + mj) >>> 0;
                    hh = g; g = f; f = e; e = (d + t1) >>> 0;
                    d = c; c = b; b = a; a = (t1 + t2) >>> 0;
                }
                h0 = (h0+a)>>>0; h1 = (h1+b)>>>0; h2 = (h2+c)>>>0; h3 = (h3+d)>>>0;
                h4 = (h4+e)>>>0; h5 = (h5+f)>>>0; h6 = (h6+g)>>>0; h7 = (h7+hh)>>>0;
            }
            const out = new Uint8Array(32);
            const hs = [h0,h1,h2,h3,h4,h5,h6,h7];
            for (let i = 0; i < 8; i++) {
                out[i*4]   = (hs[i]>>>24) & 0xFF;
                out[i*4+1] = (hs[i]>>>16) & 0xFF;
                out[i*4+2] = (hs[i]>>>8)  & 0xFF;
                out[i*4+3] =  hs[i]       & 0xFF;
            }
            return out.buffer;
        }

        /* ---- SHA-1 ---- */
        function sha1(bytes) {
            const len = bytes.length;
            const bitLen = len * 8;
            const padLen = (len + 9 + 63) & ~63;
            const msg = new Uint8Array(padLen);
            msg.set(bytes);
            msg[len] = 0x80;
            msg[padLen - 4] = (bitLen >>> 24) & 0xFF;
            msg[padLen - 3] = (bitLen >>> 16) & 0xFF;
            msg[padLen - 2] = (bitLen >>> 8)  & 0xFF;
            msg[padLen - 1] =  bitLen         & 0xFF;

            let h0=0x67452301, h1=0xEFCDAB89, h2=0x98BADCFE, h3=0x10325476, h4=0xC3D2E1F0;
            const w = new Uint32Array(80);

            for (let off = 0; off < padLen; off += 64) {
                for (let i = 0; i < 16; i++) {
                    w[i] = ((msg[off+4*i]<<24) | (msg[off+4*i+1]<<16) |
                            (msg[off+4*i+2]<<8) | msg[off+4*i+3]) >>> 0;
                }
                for (let i = 16; i < 80; i++) {
                    w[i] = rotl((w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16]) >>> 0, 1);
                }
                let a=h0,b=h1,c=h2,d=h3,e=h4;
                for (let i = 0; i < 80; i++) {
                    let f, k;
                    if (i < 20)      { f = (b & c) | (~b & d);          k = 0x5A827999; }
                    else if (i < 40) { f = b ^ c ^ d;                    k = 0x6ED9EBA1; }
                    else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
                    else             { f = b ^ c ^ d;                    k = 0xCA62C1D6; }
                    const t = (rotl(a,5) + f + e + k + w[i]) >>> 0;
                    e = d; d = c; c = rotl(b,30); b = a; a = t;
                }
                h0=(h0+a)>>>0; h1=(h1+b)>>>0; h2=(h2+c)>>>0; h3=(h3+d)>>>0; h4=(h4+e)>>>0;
            }
            const out = new Uint8Array(20);
            const hs = [h0,h1,h2,h3,h4];
            for (let i = 0; i < 5; i++) {
                out[i*4]   = (hs[i]>>>24) & 0xFF;
                out[i*4+1] = (hs[i]>>>16) & 0xFF;
                out[i*4+2] = (hs[i]>>>8)  & 0xFF;
                out[i*4+3] =  hs[i]       & 0xFF;
            }
            return out.buffer;
        }

        /* ---- MD5 ---- */
        const MD5_S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
                       5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
                       4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
                       6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
        const MD5_K = new Uint32Array([
            0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
            0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
            0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
            0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
            0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
            0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
            0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
            0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391
        ]);
        function md5(bytes) {
            const len = bytes.length;
            const bitLen = len * 8;
            const padLen = (len + 9 + 63) & ~63;
            const msg = new Uint8Array(padLen);
            msg.set(bytes);
            msg[len] = 0x80;
            /* MD5 uses little-endian bit length */
            msg[padLen - 8] =  bitLen        & 0xFF;
            msg[padLen - 7] = (bitLen >>> 8) & 0xFF;
            msg[padLen - 6] = (bitLen >>> 16)& 0xFF;
            msg[padLen - 5] = (bitLen >>> 24)& 0xFF;

            let a0=0x67452301, b0=0xefcdab89, c0=0x98badcfe, d0=0x10325476;
            const m = new Uint32Array(16);

            for (let off = 0; off < padLen; off += 64) {
                for (let i = 0; i < 16; i++) {
                    m[i] = (msg[off+4*i] | (msg[off+4*i+1]<<8) |
                            (msg[off+4*i+2]<<16) | (msg[off+4*i+3]<<24)) >>> 0;
                }
                let A=a0,B=b0,C=c0,D=d0;
                for (let i = 0; i < 64; i++) {
                    let f, g;
                    if (i < 16)      { f = (B & C) | (~B & D); g = i; }
                    else if (i < 32) { f = (D & B) | (~D & C); g = (5*i + 1) & 15; }
                    else if (i < 48) { f = B ^ C ^ D;          g = (3*i + 5) & 15; }
                    else             { f = C ^ (B | ~D);       g = (7*i) & 15; }
                    const t = (D + 0) >>> 0;
                    D = C;
                    C = B;
                    const sum = (A + f + MD5_K[i] + m[g]) >>> 0;
                    B = (B + rotl(sum, MD5_S[i])) >>> 0;
                    A = t;
                }
                a0 = (a0+A)>>>0; b0 = (b0+B)>>>0; c0 = (c0+C)>>>0; d0 = (d0+D)>>>0;
            }
            const out = new Uint8Array(16);
            const hs = [a0,b0,c0,d0];
            for (let i = 0; i < 4; i++) {
                out[i*4]   =  hs[i]        & 0xFF;
                out[i*4+1] = (hs[i] >>> 8) & 0xFF;
                out[i*4+2] = (hs[i] >>> 16)& 0xFF;
                out[i*4+3] = (hs[i] >>> 24)& 0xFF;
            }
            return out.buffer;
        }

        /* -------- algorithm normalization ---------- */

        function normalizeAlg(alg) {
            const raw = (alg && typeof alg === 'object') ? alg.name : alg;
            if (typeof raw !== 'string') return null;
            const u = raw.toUpperCase();
            if (u === 'SHA-1'   || u === 'SHA1')   return 'SHA-1';
            if (u === 'SHA-256' || u === 'SHA256') return 'SHA-256';
            if (u === 'SHA-384' || u === 'SHA384') return 'SHA-384';
            if (u === 'SHA-512' || u === 'SHA512') return 'SHA-512';
            if (u === 'SHA-224' || u === 'SHA224') return 'SHA-224';
            if (u === 'MD5') return 'MD5';
            return null;
        }

        /* -------- digest dispatch ---------- */

        function pureJSDigest(alg, bytes) {
            switch (alg) {
                case 'SHA-256': return sha256(bytes);
                case 'SHA-1':   return sha1(bytes);
                case 'MD5':     return md5(bytes);
                default: return null;  /* SHA-224/384/512 require native */
            }
        }

        const subtle = {
            digest(algo, data) {
                return new Promise((resolve, reject) => {
                    try {
                        const alg = normalizeAlg(algo);
                        if (!alg) {
                            reject(new Error(
                                `crypto.subtle.digest: unsupported algorithm '${algo && algo.name || algo}'. ` +
                                `Expected SHA-1, SHA-256, SHA-384, SHA-512, SHA-224, or MD5.`
                            ));
                            return;
                        }
                        const bytes = toBytes(data);

                        /* 1. Try AmiSSL fast-path (faster for large inputs
                         *    once it works; currently may fail on main task
                         *    per open-issue, but attempt anyway and fall
                         *    through to pure-JS on any failure). */
                        if (nativeDigest) {
                            try {
                                const ab = nativeDigest(alg, bytes);
                                if (ab && ab.byteLength > 0) { resolve(ab); return; }
                            } catch (_) { /* fall through */ }
                        }

                        /* 2. Pure-JS for the algorithms we support. */
                        const result = pureJSDigest(alg, bytes);
                        if (result) { resolve(result); return; }

                        /* 3. Algorithm recognized but pure-JS doesn't
                         *    implement it and native didn't succeed. */
                        reject(new Error(
                            `crypto.subtle.digest: ${alg} requires AmiSSL (amisslmaster.library + an ` +
                            `amissl_v*.library). Install AmiSSL or use SHA-1, SHA-256, or MD5 instead ` +
                            `(those work without AmiSSL).`
                        ));
                    } catch (e) { reject(e); }
                });
            },
            has(algo) {
                const alg = normalizeAlg(algo);
                if (!alg) return false;
                /* SHA-1, SHA-256, MD5 always work via pure-JS. */
                if (alg === 'SHA-1' || alg === 'SHA-256' || alg === 'MD5') return true;
                /* SHA-224/384/512 only work if native path is present AND
                 * actually functional — we can't easily test without a
                 * call, so report based on native presence. */
                return typeof nativeDigest === 'function';
            },
        };

        globalThis.crypto = globalThis.crypto || {};
        globalThis.crypto.subtle = subtle;

        /* getRandomValues: prefer native (DateStamp-seeded), fall back
         * to Math.random. Neither is CSPRNG-grade; documented. */
        globalThis.crypto.getRandomValues = function (view) {
            if (!view || !ArrayBuffer.isView(view))
                throw new TypeError('getRandomValues: integer TypedArray required');
            if (nativeRandom) {
                try { return nativeRandom(view); }
                catch (_) { /* fall through */ }
            }
            /* Math.random fallback. */
            const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
            for (let i = 0; i < bytes.length; i++)
                bytes[i] = (Math.random() * 256) & 0xFF;
            return view;
        };

        globalThis.crypto.randomUUID = function () {
            const b = new Uint8Array(16);
            globalThis.crypto.getRandomValues(b);
            b[6] = (b[6] & 0x0F) | 0x40;   /* version 4 */
            b[8] = (b[8] & 0x3F) | 0x80;   /* variant 10 */
            const hex = '0123456789abcdef';
            let s = '';
            for (let i = 0; i < 16; i++) {
                s += hex[(b[i] >> 4) & 0xF] + hex[b[i] & 0xF];
                if (i === 3 || i === 5 || i === 7 || i === 9) s += '-';
            }
            return s;
        };
    },
}));

/* ==========================================================
 * Apply all features in dependency order, expose registry
 * ========================================================== */

(function topoApply() {
    const applied = new Set();
    function apply(m) {
        if (applied.has(m.name)) return;
        for (const req of m.requires || []) {
            const dep = _manifests.find(x => x.name === req);
            if (!dep) throw new Error(`extended.js: missing dep '${req}' for '${m.name}'`);
            apply(dep);
        }
        m.apply();
        applied.add(m.name);
    }
    for (const m of _manifests) {
        try { apply(m); }
        catch (e) {
            try { std.err.puts(`extended.js: failed to apply '${m.name}': ${e.message}\n`); }
            catch (_) {}
        }
    }
})();

/* Introspection registry */
globalThis.qjs = globalThis.qjs || {};
globalThis.qjs.extended = true;
globalThis.qjs.version  = '0.66';
globalThis.qjs.modules  = {
    list: () => _manifests.map(m => m.toJSON()),
    get:  (name) => {
        const m = _manifests.find(m => m.name === name);
        return m ? m.toJSON() : undefined;
    },
    has:  (name) => _manifests.some(m => m.name === name),
};
