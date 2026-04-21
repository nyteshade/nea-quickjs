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
            static parse(url, base) {
                /* Node 22 / modern-web API — returns null instead of throwing. */
                try { return new URL(url, base); } catch { return null; }
            }
        }

        globalThis.URL = URL;
        globalThis.URLSearchParams = URLSearchParams;
    },
}));

/* ==========================================================
 * Feature: node url module (globalThis.url)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * Node's `url` module exposes the WHATWG URL constructor plus a
 * legacy `url.format(obj)` function and two file:// URL helpers:
 * `url.fileURLToPath(u)` and `url.pathToFileURL(p)`. Code that
 * imports `node:url` expects these. We provide an AmigaOS-aware
 * implementation of the file:// helpers — on Amiga, file URLs
 * look like `file:///Volume:path/to/file` (three slashes after
 * the scheme, then the device name with a colon per AmigaOS path
 * convention).
 *
 * We expose the module as `globalThis.url`. Node's `URL` class
 * itself is re-exported as a property so `url.URL` also works.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'node-url-module',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'node url module — URL, format, fileURLToPath, pathToFileURL',
    requires:    ['url'],
    globals:     ['url'],
    standard:    false,
    install() {
        function format(urlObject) {
            if (urlObject == null) throw new TypeError('url.format: urlObject required');
            if (urlObject instanceof globalThis.URL) return urlObject.toString();

            let s = '';
            const o = urlObject;
            const proto = o.protocol || o.scheme;
            if (proto) {
                s += proto;
                if (!proto.endsWith(':')) s += ':';
                /* Only add '//' if slashes explicitly requested OR host is present. */
                if (o.slashes || o.host || o.hostname) s += '//';
            } else if (o.slashes) {
                s += '//';
            }

            /* auth / userinfo */
            if (o.auth !== undefined && o.auth !== null) {
                s += String(o.auth) + '@';
            } else if (o.username || o.password) {
                if (o.username) s += String(o.username);
                if (o.password) s += ':' + String(o.password);
                s += '@';
            }

            if (o.host) {
                s += String(o.host);
            } else if (o.hostname) {
                s += String(o.hostname);
                if (o.port) s += ':' + String(o.port);
            }

            if (o.pathname) s += String(o.pathname);
            else if (o.path) s += String(o.path);

            if (o.search !== undefined && o.search !== null && o.search !== '') {
                const q = String(o.search);
                s += q.startsWith('?') ? q : ('?' + q);
            } else if (o.query !== undefined && o.query !== null && o.query !== '') {
                if (typeof o.query === 'string') {
                    s += '?' + o.query;
                } else {
                    const usp = new globalThis.URLSearchParams(o.query);
                    const qs = usp.toString();
                    if (qs.length) s += '?' + qs;
                }
            }

            if (o.hash !== undefined && o.hash !== null && o.hash !== '') {
                const h = String(o.hash);
                s += h.startsWith('#') ? h : ('#' + h);
            }
            return s;
        }

        function fileURLToPath(u) {
            /* Accept string or URL. */
            const url = (typeof u === 'string') ? new globalThis.URL(u) : u;
            if (!url || url.protocol !== 'file:') {
                throw new TypeError('url.fileURLToPath: must be file: URL');
            }
            /* Percent-decode pathname. On Amiga, `file:///DH0:foo/bar` should
             * yield `DH0:foo/bar` — strip the leading slash but preserve the
             * device-colon in the path. If the first segment contains a colon
             * we assume AmigaOS volume form. */
            let p = url.pathname || '';
            try { p = decodeURIComponent(p); } catch (_) {}
            if (p.length && p[0] === '/') {
                const rest = p.substring(1);
                /* Amiga volume form: first char isn't a '/' and first segment
                 * contains a ':' before any '/'. Return without leading slash. */
                const slash = rest.indexOf('/');
                const firstSeg = slash < 0 ? rest : rest.substring(0, slash);
                if (firstSeg.indexOf(':') >= 0) return rest;
                /* POSIX-style absolute path — preserve leading slash. */
                return p;
            }
            return p;
        }

        function pathToFileURL(p) {
            if (typeof p !== 'string') throw new TypeError('url.pathToFileURL: path must be a string');
            /* AmigaOS volume form `DH0:foo/bar` → `file:///DH0:foo/bar`.
             * POSIX absolute `/foo/bar`        → `file:///foo/bar`.
             * Relative `foo/bar`               → prefix cwd from os.getcwd(). */
            let path = p;
            const colon = path.indexOf(':');
            const slash = path.indexOf('/');
            const hasVolume = colon > 0 && (slash < 0 || colon < slash);
            if (!hasVolume && (path.length === 0 || path[0] !== '/')) {
                const r = os.getcwd();
                const cwd = r && r[0];
                if (cwd) {
                    const sep = cwd.endsWith('/') || cwd.endsWith(':') ? '' : '/';
                    path = cwd + sep + path;
                }
            }
            /* Build the URL. Percent-encode everything but unreserved chars
             * and the colon (needed for Amiga volume names). */
            let out = 'file:///';
            if (hasVolume || (path.length && path[0] !== '/')) {
                /* no extra leading slash — keep as-is */
            } else if (path.length && path[0] === '/') {
                path = path.substring(1);
            }
            const unreserved = "-._~:/+@";
            for (let i = 0; i < path.length; i++) {
                const c = path[i];
                const code = c.charCodeAt(0);
                if ((code >= 0x30 && code <= 0x39) ||
                    (code >= 0x41 && code <= 0x5A) ||
                    (code >= 0x61 && code <= 0x7A) ||
                    unreserved.indexOf(c) >= 0) {
                    out += c;
                } else {
                    out += '%' + (code < 16 ? '0' : '') + code.toString(16).toUpperCase();
                }
            }
            return new globalThis.URL(out);
        }

        globalThis.url = {
            URL:               globalThis.URL,
            URLSearchParams:   globalThis.URLSearchParams,
            format,
            fileURLToPath,
            pathToFileURL,
            /* Legacy Node url.parse() — returns a plain object, not a URL instance.
             * Only a minimal subset of fields is populated. */
            parse(urlString, parseQueryString, slashesDenoteHost) {
                const u = new globalThis.URL(urlString);
                const out = {
                    protocol: u.protocol || null,
                    slashes:  true,
                    auth:     (u.username || u.password)
                                ? (u.username + (u.password ? (':' + u.password) : ''))
                                : null,
                    host:     u.host || null,
                    port:     u.port || null,
                    hostname: u.hostname || null,
                    hash:     u.hash || null,
                    search:   u.search || null,
                    query:    parseQueryString
                                ? Object.fromEntries(u.searchParams.entries())
                                : (u.search ? u.search.substring(1) : null),
                    pathname: u.pathname || null,
                    path:     (u.pathname || '') + (u.search || ''),
                    href:     u.href,
                };
                return out;
            },
            /* url.resolve(from, to) is deprecated — mimic via new URL(). */
            resolve(from, to) {
                return new globalThis.URL(to, from).toString();
            },
            /* url.domainToASCII/domainToUnicode — Node API.
             * AmigaOS-domain chars are all ASCII by default; pass through. */
            domainToASCII(domain)   { return String(domain).toLowerCase(); },
            domainToUnicode(domain) { return String(domain); },
        };
    },
}));

/* ==========================================================
 * Feature: EventTarget + Event (WHATWG — Node ≥14.5)
 * Tier: pure-js    Provider: nea-port    Standard: web
 *
 * Minimal EventTarget + Event implementation. Covers the 95% of
 * DOM/Node usage: addEventListener/removeEventListener/dispatchEvent
 * with {once, signal} listener options. No capture-phase / bubble
 * hierarchy — we don't have a DOM tree to walk — `capture` / `passive`
 * are accepted and ignored per spec leniency.
 *
 * AbortSignal (earlier in this file) is NOT refactored to extend
 * EventTarget — keeps the working fetch/abort plumbing intact.
 * Its addEventListener shape is already compatible with user code.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'event-target',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'WHATWG EventTarget + Event base classes',
    globals:     ['EventTarget', 'Event', 'CustomEvent'],
    standard:    true,
    install() {
        class Event {
            constructor(type, init) {
                this.type = String(type);
                this.bubbles = !!(init && init.bubbles);
                this.cancelable = !!(init && init.cancelable);
                this.composed = !!(init && init.composed);
                this.defaultPrevented = false;
                this.cancelBubble = false;
                this.target = null;
                this.currentTarget = null;
                this.eventPhase = 0;
                this.isTrusted = false;
                this.timeStamp = (typeof performance !== 'undefined')
                    ? performance.now() : Date.now();
                /* Internal flag — dispatchEvent resets to AT_TARGET */
                this._stopImmediate = false;
            }
            preventDefault() {
                if (this.cancelable) this.defaultPrevented = true;
            }
            stopPropagation() { this.cancelBubble = true; }
            stopImmediatePropagation() { this._stopImmediate = true; this.cancelBubble = true; }
            /* Legacy no-ops */
            initEvent(type, bubbles, cancelable) {
                this.type = String(type);
                this.bubbles = !!bubbles;
                this.cancelable = !!cancelable;
            }
        }
        /* Event phase constants — match DOM. */
        Event.NONE           = 0;
        Event.CAPTURING_PHASE = 1;
        Event.AT_TARGET      = 2;
        Event.BUBBLING_PHASE = 3;

        class CustomEvent extends Event {
            constructor(type, init) {
                super(type, init);
                this.detail = (init && 'detail' in init) ? init.detail : null;
            }
        }

        class EventTarget {
            constructor() {
                /* { [type]: [{listener, once, signal}] } */
                this._listeners = {};
            }
            addEventListener(type, listener, options) {
                if (typeof listener !== 'function'
                    && !(listener && typeof listener.handleEvent === 'function')) {
                    return;
                }
                const t = String(type);
                const bucket = this._listeners[t] || (this._listeners[t] = []);
                const once = !!(options && options.once);
                const signal = options && options.signal;
                /* Dedupe: same listener+type is a no-op in DOM semantics. */
                for (const e of bucket) if (e.listener === listener) return;
                const entry = { listener, once, signal };
                bucket.push(entry);
                if (signal) {
                    if (signal.aborted) {
                        /* Already aborted — don't add. */
                        bucket.pop();
                        return;
                    }
                    if (signal.addEventListener) {
                        const onAbort = () => {
                            this.removeEventListener(t, listener);
                        };
                        signal.addEventListener('abort', onAbort, { once: true });
                    }
                }
            }
            removeEventListener(type, listener) {
                const t = String(type);
                const bucket = this._listeners[t];
                if (!bucket) return;
                for (let i = 0; i < bucket.length; i++) {
                    if (bucket[i].listener === listener) {
                        bucket.splice(i, 1);
                        if (bucket.length === 0) delete this._listeners[t];
                        return;
                    }
                }
            }
            dispatchEvent(event) {
                if (!(event instanceof Event)) {
                    throw new TypeError('dispatchEvent: argument must be an Event');
                }
                event.target = this;
                event.currentTarget = this;
                event.eventPhase = Event.AT_TARGET;
                const bucket = this._listeners[event.type];
                if (bucket) {
                    const snap = bucket.slice();
                    for (const entry of snap) {
                        if (event._stopImmediate) break;
                        try {
                            if (typeof entry.listener === 'function') {
                                entry.listener.call(this, event);
                            } else {
                                entry.listener.handleEvent(event);
                            }
                        } catch (e) {
                            try { std.err.puts('(qjs) EventTarget listener threw: '
                                + (e && e.message || e) + '\n'); } catch (_) {}
                        }
                        if (entry.once) this.removeEventListener(event.type, entry.listener);
                    }
                }
                event.eventPhase = Event.NONE;
                event.currentTarget = null;
                return !event.defaultPrevented;
            }
        }

        globalThis.EventTarget = EventTarget;
        globalThis.Event = Event;
        globalThis.CustomEvent = CustomEvent;
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
 * Feature: Blob + File (WHATWG — Node ≥18 bundles these too)
 * Tier: pure-js    Provider: nea-port    Standard: web
 *
 * Pure-JS Blob/File stored as a single Uint8Array buffer. Supports
 * mixed input (strings, ArrayBuffers, TypedArrays, Blobs); text
 * parts are UTF-8 encoded. `.stream()` is intentionally not
 * implemented — we don't have WHATWG streams, and callers that
 * need chunked reads can `.arrayBuffer()` + slice manually.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'blob',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'WHATWG Blob + File — pure-JS Uint8Array-backed',
    requires:    ['buffer', 'text-encoding'],
    globals:     ['Blob', 'File'],
    standard:    true,
    install() {
        function _materialize(parts) {
            if (!Array.isArray(parts)) throw new TypeError('Blob: first arg must be iterable');
            let total = 0;
            const chunks = [];
            for (const p of parts) {
                if (p instanceof Blob) {
                    chunks.push(p._bytes); total += p._bytes.length;
                } else if (p instanceof ArrayBuffer) {
                    const u = new Uint8Array(p);
                    chunks.push(u); total += u.length;
                } else if (ArrayBuffer.isView(p)) {
                    const u = new Uint8Array(p.buffer, p.byteOffset, p.byteLength);
                    /* Copy so we own the memory and subsequent mutation to
                     * the source view doesn't corrupt the Blob. */
                    const copy = new Uint8Array(u.length);
                    copy.set(u);
                    chunks.push(copy); total += copy.length;
                } else if (typeof p === 'string') {
                    const enc = new globalThis.TextEncoder().encode(p);
                    chunks.push(enc); total += enc.length;
                } else {
                    /* Per spec, other values should be coerced to string. */
                    const enc = new globalThis.TextEncoder().encode(String(p));
                    chunks.push(enc); total += enc.length;
                }
            }
            const out = new Uint8Array(total);
            let off = 0;
            for (const c of chunks) { out.set(c, off); off += c.length; }
            return out;
        }

        class Blob {
            constructor(parts, options) {
                parts = parts || [];
                this._bytes = _materialize(parts);
                const type = options && options.type;
                this._type = type ? String(type).toLowerCase() : '';
                /* endings option — Node/browsers accept 'transparent' or 'native'.
                 * We treat both as transparent (no newline rewrite). */
            }
            get size() { return this._bytes.length; }
            get type() { return this._type; }
            arrayBuffer() {
                /* Copy so consumer can't mutate our internal buffer. */
                const copy = new Uint8Array(this._bytes.length);
                copy.set(this._bytes);
                return Promise.resolve(copy.buffer);
            }
            bytes() {
                const copy = new Uint8Array(this._bytes.length);
                copy.set(this._bytes);
                return Promise.resolve(copy);
            }
            text() {
                try {
                    return Promise.resolve(new globalThis.TextDecoder().decode(this._bytes));
                } catch (e) { return Promise.reject(e); }
            }
            slice(start, end, contentType) {
                const len = this._bytes.length;
                let s = (start === undefined) ? 0 : (start | 0);
                let e = (end === undefined) ? len : (end | 0);
                if (s < 0) s = Math.max(0, len + s);
                if (e < 0) e = Math.max(0, len + e);
                if (s > len) s = len;
                if (e > len) e = len;
                if (e < s) e = s;
                const sub = new Uint8Array(this._bytes.buffer, this._bytes.byteOffset + s, e - s);
                /* Build new Blob without re-copying via _materialize. */
                const out = Object.create(Blob.prototype);
                const copy = new Uint8Array(sub.length);
                copy.set(sub);
                out._bytes = copy;
                out._type = contentType ? String(contentType).toLowerCase() : '';
                return out;
            }
            /* .stream() is intentionally absent — no WHATWG ReadableStream. */
        }

        class File extends Blob {
            constructor(parts, name, options) {
                super(parts, options);
                if (name === undefined) {
                    throw new TypeError('File: name argument required');
                }
                /* Per WHATWG File spec, NUL bytes in name are stripped.
                 * Implemented via split/join (not regex) — extended.js
                 * defaults to regex-free; see Fina gotcha,regex,amiga and
                 * the url manifest comment for context. */
                this._name = String(name).split('\u0000').join('');
                this._lastModified = (options && typeof options.lastModified === 'number')
                    ? options.lastModified
                    : Date.now();
            }
            get name() { return this._name; }
            get lastModified() { return this._lastModified; }
            get webkitRelativePath() { return ''; }
        }

        globalThis.Blob = Blob;
        globalThis.File = File;
    },
}));

/* ==========================================================
 * Feature: FormData (WHATWG — Node ≥18 bundles this too)
 * Tier: pure-js    Provider: nea-port    Standard: web
 *
 * Ordered list of (name, value) pairs. value is string for form
 * field inputs, File for file inputs. Pure-JS; no network wire
 * format (that's fetch's multipart/form-data encoder's job).
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'form-data',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'WHATWG FormData — ordered (name, value) pairs',
    requires:    ['blob'],
    globals:     ['FormData'],
    standard:    true,
    install() {
        function _coerceValue(value, filename) {
            /* Per WHATWG FormData spec:
             *   - string stays string
             *   - Blob/File promoted to File with name=filename || existing || 'blob'
             *   - anything else coerced to string
             */
            if (value instanceof globalThis.File) {
                if (filename !== undefined) {
                    /* Rename by creating a new File. */
                    return new globalThis.File([value._bytes], filename, { type: value.type, lastModified: value.lastModified });
                }
                return value;
            }
            if (value instanceof globalThis.Blob) {
                const fname = (filename === undefined) ? 'blob' : String(filename);
                return new globalThis.File([value._bytes], fname, { type: value.type });
            }
            return String(value);
        }

        class FormData {
            constructor(form) {
                /* Node/deno ignore `form` arg (no DOM). Browsers would
                 * read <form> inputs here. */
                this._entries = [];
                void form;
            }
            append(name, value, filename) {
                this._entries.push([String(name), _coerceValue(value, filename)]);
            }
            set(name, value, filename) {
                const n = String(name);
                const coerced = _coerceValue(value, filename);
                /* Remove all existing entries with this name, then push once. */
                let replaced = false;
                for (let i = this._entries.length - 1; i >= 0; i--) {
                    if (this._entries[i][0] === n) {
                        if (!replaced) {
                            this._entries[i] = [n, coerced];
                            replaced = true;
                        } else {
                            this._entries.splice(i, 1);
                        }
                    }
                }
                if (!replaced) this._entries.push([n, coerced]);
            }
            delete(name) {
                const n = String(name);
                for (let i = this._entries.length - 1; i >= 0; i--) {
                    if (this._entries[i][0] === n) this._entries.splice(i, 1);
                }
            }
            get(name) {
                const n = String(name);
                for (const [k, v] of this._entries) if (k === n) return v;
                return null;
            }
            getAll(name) {
                const n = String(name);
                const out = [];
                for (const [k, v] of this._entries) if (k === n) out.push(v);
                return out;
            }
            has(name) {
                const n = String(name);
                for (const [k] of this._entries) if (k === n) return true;
                return false;
            }
            /* Iteration — order of insertion preserved per spec. */
            * entries() { for (const e of this._entries) yield e.slice(); }
            * keys()    { for (const [k]    of this._entries) yield k; }
            * values()  { for (const [, v]  of this._entries) yield v; }
            [Symbol.iterator]() { return this.entries(); }
            forEach(cb, thisArg) {
                for (const [k, v] of this._entries) cb.call(thisArg, v, k, this);
            }
        }

        globalThis.FormData = FormData;
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

        /* EventEmitter.on / events.on — async iterator over emissions.
         *
         *   for await (const [...args] of EventEmitter.on(emitter, 'data')) { ... }
         *
         * Queues emissions between awaits so fast producers don't lose
         * events. Rejects on 'error' emission or AbortSignal abort.
         * The returned object has .return() so `break` in for-await cleans up. */
        EventEmitter.on = function (emitter, name, options) {
            const queue = [];        /* pending emissions */
            const waiting = [];      /* pending Promise resolvers */
            let rejectReason = null;
            let ended = false;
            const signal = options && options.signal;

            function onEvt(...args) {
                if (ended) return;
                if (waiting.length > 0) {
                    const w = waiting.shift();
                    w.resolve({ value: args, done: false });
                } else {
                    queue.push(args);
                }
            }
            function onErr(err) {
                cleanup();
                rejectReason = err;
                while (waiting.length > 0) {
                    const w = waiting.shift();
                    w.reject(err);
                }
            }
            function cleanup() {
                if (ended) return;
                ended = true;
                if (emitter.removeListener) {
                    emitter.removeListener(name, onEvt);
                    emitter.removeListener('error', onErr);
                } else if (emitter.removeEventListener) {
                    emitter.removeEventListener(name, onEvt);
                    emitter.removeEventListener('error', onErr);
                }
                if (signal && onAbort) {
                    /* EventTarget uses removeEventListener; our AbortSignal
                     * also exposes this. */
                    if (signal.removeEventListener) signal.removeEventListener('abort', onAbort);
                    if (signal._onabortCallbacks) {
                        /* Defensive — not all implementations expose a removal
                         * hook; the guard in onAbort below covers the no-remove
                         * path as well. */
                    }
                }
            }
            function onAbort() {
                const err = (signal && signal.reason)
                    || new DOMException('Aborted', 'AbortError');
                cleanup();
                rejectReason = err;
                while (waiting.length > 0) {
                    const w = waiting.shift();
                    w.reject(err);
                }
            }

            if (signal) {
                if (signal.aborted) {
                    const err = signal.reason || new DOMException('Aborted', 'AbortError');
                    rejectReason = err;
                    ended = true;
                } else if (signal.addEventListener) {
                    signal.addEventListener('abort', onAbort);
                }
            }

            if (!ended) {
                if (typeof emitter.on === 'function') {
                    emitter.on(name, onEvt);
                    emitter.on('error', onErr);
                } else if (emitter.addEventListener) {
                    emitter.addEventListener(name, onEvt);
                    emitter.addEventListener('error', onErr);
                }
            }

            const iter = {
                next() {
                    if (rejectReason) return Promise.reject(rejectReason);
                    if (queue.length > 0) {
                        return Promise.resolve({ value: queue.shift(), done: false });
                    }
                    if (ended) return Promise.resolve({ value: undefined, done: true });
                    return new Promise((resolve, reject) => {
                        waiting.push({ resolve, reject });
                    });
                },
                return(value) {
                    cleanup();
                    /* Resolve any pending next()s with done=true so consumers
                     * don't hang forever. */
                    while (waiting.length > 0) {
                        const w = waiting.shift();
                        w.resolve({ value: undefined, done: true });
                    }
                    return Promise.resolve({ value, done: true });
                },
                throw(err) {
                    cleanup();
                    rejectReason = err;
                    while (waiting.length > 0) {
                        const w = waiting.shift();
                        w.reject(err);
                    }
                    return Promise.reject(err);
                },
                [Symbol.asyncIterator]() { return this; },
            };
            return iter;
        };

        globalThis.EventEmitter = EventEmitter;
        /* Node also exposes these as globalThis.events.on / events.once
         * via `node:events` import. Expose a thin module-shaped global
         * so `import events from 'events'` style code finds what it wants. */
        globalThis.events = {
            EventEmitter,
            once: EventEmitter.once,
            on:   EventEmitter.on,
            getEventListeners(emitter, name) {
                if (typeof emitter.listeners === 'function') return emitter.listeners(name);
                return [];
            },
            setMaxListeners(n /*, ...emitters */) {
                EventEmitter.defaultMaxListeners = n | 0;
            },
        };
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
            isNativeError: v => v instanceof Error,
            isPromise: v => v && typeof v.then === 'function',
            isMap: v => v instanceof Map,
            isSet: v => v instanceof Set,
            isMapIterator: v => {
                if (!v || typeof v !== 'object') return false;
                const s = Object.prototype.toString.call(v);
                return s === '[object Map Iterator]';
            },
            isSetIterator: v => {
                if (!v || typeof v !== 'object') return false;
                const s = Object.prototype.toString.call(v);
                return s === '[object Set Iterator]';
            },
            isWeakMap: v => v instanceof WeakMap,
            isWeakSet: v => v instanceof WeakSet,
            isArrayBuffer: v => v instanceof ArrayBuffer,
            isSharedArrayBuffer: v => typeof SharedArrayBuffer !== 'undefined'
                                        && v instanceof SharedArrayBuffer,
            isAnyArrayBuffer: v => v instanceof ArrayBuffer
                                    || (typeof SharedArrayBuffer !== 'undefined'
                                        && v instanceof SharedArrayBuffer),
            isDataView: v => v instanceof DataView,
            isTypedArray: v => ArrayBuffer.isView(v) && !(v instanceof DataView),
            isUint8Array: v => v instanceof Uint8Array,
            isUint8ClampedArray: v => v instanceof Uint8ClampedArray,
            isUint16Array: v => v instanceof Uint16Array,
            isUint32Array: v => v instanceof Uint32Array,
            isInt8Array:   v => v instanceof Int8Array,
            isInt16Array:  v => v instanceof Int16Array,
            isInt32Array:  v => v instanceof Int32Array,
            isFloat32Array: v => v instanceof Float32Array,
            isFloat64Array: v => v instanceof Float64Array,
            isBigInt64Array: v => typeof BigInt64Array !== 'undefined'
                                    && v instanceof BigInt64Array,
            isBigUint64Array: v => typeof BigUint64Array !== 'undefined'
                                    && v instanceof BigUint64Array,
            isBooleanObject: v => v instanceof Boolean,
            isNumberObject:  v => v instanceof Number,
            isStringObject:  v => v instanceof String,
            isSymbolObject:  v => typeof v === 'object'
                                    && Object.prototype.toString.call(v) === '[object Symbol]',
            isBoxedPrimitive: v => v instanceof Boolean || v instanceof Number
                                    || v instanceof String
                                    || Object.prototype.toString.call(v) === '[object Symbol]',
            isAsyncFunction: v => typeof v === 'function'
                                    && v.constructor && v.constructor.name === 'AsyncFunction',
            isGeneratorFunction: v => typeof v === 'function'
                                    && v.constructor && v.constructor.name === 'GeneratorFunction',
            isGeneratorObject: v => {
                if (!v || typeof v !== 'object') return false;
                return typeof v.next === 'function'
                    && typeof v.throw === 'function'
                    && typeof v.return === 'function'
                    && typeof v[Symbol.iterator] === 'function';
            },
            isProxy: () => false, /* no runtime Proxy-detection hook */
            isModuleNamespaceObject: v =>
                v != null && typeof v === 'object'
                    && v[Symbol.toStringTag] === 'Module',
            isFunction: v => typeof v === 'function',
        };

        /* ANSI style helper — util.styleText(style, text).
         * Supports a single style name or an array of styles. Honors
         * NO_COLOR env var (returns text unchanged). */
        const _ansiStyles = {
            reset: [0, 0], bold: [1, 22], dim: [2, 22], italic: [3, 23],
            underline: [4, 24], inverse: [7, 27], hidden: [8, 28], strikethrough: [9, 29],
            black: [30, 39], red: [31, 39], green: [32, 39], yellow: [33, 39],
            blue: [34, 39], magenta: [35, 39], cyan: [36, 39], white: [37, 39],
            gray: [90, 39], grey: [90, 39],
            bgBlack: [40, 49], bgRed: [41, 49], bgGreen: [42, 49], bgYellow: [43, 49],
            bgBlue: [44, 49], bgMagenta: [45, 49], bgCyan: [46, 49], bgWhite: [47, 49],
        };
        function styleText(style, text, opts) {
            const styles = Array.isArray(style) ? style : [style];
            const validateOnly = opts && opts.validateStream === false;
            for (const s of styles) {
                if (!(s in _ansiStyles)) {
                    throw new TypeError(`util.styleText: unknown style '${s}'`);
                }
            }
            if (!validateOnly) {
                try {
                    if (std.getenv && std.getenv('NO_COLOR')) return String(text);
                } catch (_) {}
            }
            let open = '', close = '';
            for (const s of styles) {
                const [o, c] = _ansiStyles[s];
                open += '\x1b[' + o + 'm';
                close = '\x1b[' + c + 'm' + close;
            }
            return open + String(text) + close;
        }

        /* Strip CSI/SGR VT control sequences from a string — Node API. */
        function stripVTControlCharacters(str) {
            let out = '';
            const s = String(str);
            for (let i = 0; i < s.length; i++) {
                if (s.charCodeAt(i) === 0x1b && s[i + 1] === '[') {
                    i += 2;
                    while (i < s.length) {
                        const c = s.charCodeAt(i);
                        /* CSI terminator is in the 0x40..0x7e range. */
                        if (c >= 0x40 && c <= 0x7e) break;
                        i++;
                    }
                    continue;
                }
                out += s[i];
            }
            return out;
        }

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
            styleText, stripVTControlCharacters,
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
 * Feature: fs sync namespace (readFileSync / writeFileSync / ...)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * Node's top-level fs module exposes sync primitives that return/
 * throw directly. We wrap the same qjs:std / qjs:os calls used by
 * fs.promises but without the Promise wrapper. All paths are
 * AmigaOS-native (volume: and / both accepted).
 *
 * I/O under the hood is already synchronous — the Promise wrappers
 * in fs.promises exist for API-shape compatibility, not real async.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'fs-sync',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node fs sync surface (readFileSync/writeFileSync/stat/unlink/...)',
    requires:    ['fs-promises'],
    standard:    false,
    install() {
        function _err(code, path) {
            const e = new Error(code + (path ? ": " + path : ''));
            e.code = code;
            if (path !== undefined) e.path = path;
            return e;
        }
        function _toBytes(data, enc) {
            if (data instanceof Uint8Array) return data;
            if (typeof data === 'string') {
                return globalThis.Buffer
                    ? globalThis.Buffer.from(data, enc || 'utf8')
                    : new globalThis.TextEncoder().encode(data);
            }
            throw new TypeError('expected string or Buffer');
        }

        function readFileSync(path, options) {
            const f = std.open(path, 'rb');
            if (!f) throw _err('ENOENT', path);
            try {
                const parts = [];
                const buf = new Uint8Array(8192);
                let n;
                do {
                    n = f.read(buf.buffer, 0, buf.length) | 0;
                    if (n > 0) parts.push(buf.slice(0, n));
                } while (n > 0);
                let total = 0;
                for (const p of parts) total += p.length;
                const data = new Uint8Array(total);
                let off = 0;
                for (const p of parts) { data.set(p, off); off += p.length; }
                const encArg = (typeof options === 'string') ? options
                             : (options && options.encoding);
                if (encArg) {
                    return globalThis.Buffer
                        ? globalThis.Buffer.from(data).toString(encArg)
                        : new globalThis.TextDecoder(encArg).decode(data);
                }
                return globalThis.Buffer ? globalThis.Buffer.from(data) : data;
            } finally {
                try { f.close(); } catch (_) {}
            }
        }

        function writeFileSync(path, data, options) {
            const enc = (typeof options === 'string') ? options
                      : (options && options.encoding) || 'utf8';
            const bytes = _toBytes(data, enc);
            const f = std.open(path, 'wb');
            if (!f) throw _err('EACCES', path);
            try {
                f.write(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            } finally {
                try { f.close(); } catch (_) {}
            }
        }

        function appendFileSync(path, data, options) {
            const enc = (typeof options === 'string') ? options
                      : (options && options.encoding) || 'utf8';
            const bytes = _toBytes(data, enc);
            const f = std.open(path, 'ab');
            if (!f) throw _err('EACCES', path);
            try {
                f.write(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            } finally {
                try { f.close(); } catch (_) {}
            }
        }

        function existsSync(path) {
            /* Node existsSync NEVER throws — returns bool. */
            try {
                const r = os.stat(path);
                return !r[1];
            } catch (_) { return false; }
        }

        function statSync(path) {
            const r = os.stat(path);
            const st = r[0], err = r[1];
            if (err) throw _err('ENOENT', path);
            const S_IFMT  = 0xF000;
            const S_IFDIR = 0x4000;
            const S_IFREG = 0x8000;
            st.isFile         = () => (st.mode & S_IFMT) === S_IFREG;
            st.isDirectory    = () => (st.mode & S_IFMT) === S_IFDIR;
            st.isSymbolicLink = () => false;
            st.isBlockDevice  = () => false;
            st.isCharacterDevice = () => false;
            st.isFIFO         = () => false;
            st.isSocket       = () => false;
            return st;
        }

        function lstatSync(path) { return statSync(path); }

        function unlinkSync(path) {
            const e = os.remove(path);
            if (e) throw _err('EIO', path);
        }

        function renameSync(oldPath, newPath) {
            const e = os.rename(oldPath, newPath);
            if (e) throw _err('EIO', oldPath);
        }

        function mkdirSync(path, options) {
            const mode = (options && options.mode) !== undefined ? options.mode : 0o777;
            if (!os.mkdir) throw _err('ENOSYS', path);
            const e = os.mkdir(path, mode);
            if (e) throw _err('EEXIST', path);
        }

        function readdirSync(path, options) {
            if (!os.readdir) throw _err('ENOSYS', path);
            const r = os.readdir(path);
            const list = r[0], err = r[1];
            if (err) throw _err('ENOENT', path);
            const filtered = list.filter(n => n !== '.' && n !== '..');
            if (options && options.withFileTypes) {
                return filtered.map(n => ({
                    name: n,
                    isFile:         () => { try { return statSync(_join(path, n)).isFile(); } catch (_) { return false; } },
                    isDirectory:    () => { try { return statSync(_join(path, n)).isDirectory(); } catch (_) { return false; } },
                    isSymbolicLink: () => false,
                }));
            }
            return filtered;
        }

        function _join(a, b) {
            if (!a) return b;
            const last = a[a.length - 1];
            if (last === '/' || last === ':') return a + b;
            return a + '/' + b;
        }

        function accessSync(path /*, mode */) {
            /* Node reports success/failure; on Amiga we just stat the path. */
            const r = os.stat(path);
            if (r[1]) throw _err('ENOENT', path);
        }

        function copyFileSync(src, dst /*, mode */) {
            /* Straight read-then-write. */
            const data = readFileSync(src);
            writeFileSync(dst, data);
        }

        function truncateSync(path, len) {
            const n = (len === undefined) ? 0 : (len | 0);
            let existing;
            try { existing = readFileSync(path); }
            catch (_) { existing = new Uint8Array(0); }
            const u8 = (existing instanceof Uint8Array) ? existing : new Uint8Array(existing);
            let out;
            if (n <= u8.length) {
                out = u8.slice(0, n);
            } else {
                out = new Uint8Array(n);
                out.set(u8);
            }
            writeFileSync(path, out);
        }

        function realpathSync(path) {
            /* os.realpath may be absent; fall back to the path itself. */
            if (os.realpath) {
                const r = os.realpath(path);
                if (!r[1]) return r[0];
            }
            return path;
        }

        globalThis.fs = globalThis.fs || {};
        Object.assign(globalThis.fs, {
            readFileSync, writeFileSync, appendFileSync, existsSync,
            statSync, lstatSync, unlinkSync, renameSync, mkdirSync,
            readdirSync, accessSync, copyFileSync, truncateSync,
            realpathSync,
        });
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
        class AssertionError extends Error {
            constructor(opts) {
                if (typeof opts === 'string') opts = { message: opts };
                super((opts && opts.message) || 'Assertion failed');
                this.name = 'AssertionError';
                this.code = 'ERR_ASSERTION';
                if (opts) {
                    if ('actual' in opts)   this.actual   = opts.actual;
                    if ('expected' in opts) this.expected = opts.expected;
                    if ('operator' in opts) this.operator = opts.operator;
                }
            }
        }
        function fail(actual, expected, message, operator) {
            /* Node assert.fail(actual, expected, message, operator) 4-arg form,
             * plus the common 1-arg assert.fail(msg) shortcut. */
            if (arguments.length <= 1) {
                throw new AssertionError(actual || 'Failed');
            }
            throw new AssertionError({
                message: message || String(actual) + ' ' + (operator || 'fail') + ' ' + String(expected),
                actual, expected, operator: operator || 'fail',
            });
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
        assertFn.ifError           = function ifError(err) {
            /* Node semantics: throw if err is truthy, otherwise no-op. */
            if (err === null || err === undefined) return;
            if (err instanceof Error) throw err;
            throw new AssertionError({
                message: 'ifError got unwanted exception: ' + String(err),
                actual: err, expected: null, operator: 'ifError',
            });
        };
        /* Aliases */
        assertFn.strict = assertFn;
        assertFn.AssertionError = AssertionError;

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
 * Feature: Node os module (globalThis.nodeOs)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * AmigaOS-specific shim for the Node os module. Exposed as
 * `globalThis.nodeOs` (not `globalThis.os` — that name is reserved
 * for qjs:os users). Also registered in the require() stub so
 * `require('os')` / `require('node:os')` returns it.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'node-os',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node os module (platform/arch/hostname/tmpdir/homedir/cpus/...)',
    requires:    ['process'],
    globals:     ['nodeOs'],
    standard:    false,
    install() {
        function _getenv(name, dflt) {
            try {
                const v = std.getenv && std.getenv(name);
                return (v == null || v === '') ? dflt : v;
            } catch (_) { return dflt; }
        }
        const _startUs = os.now();

        globalThis.nodeOs = {
            EOL: '\n',
            /* Identity */
            platform()  { return 'amigaos'; },
            arch()      { return 'm68k'; },
            type()      { return 'AmigaOS'; },
            release()   { return _getenv('Kickstart', '3.2.x'); },
            version()   { return 'AmigaOS 3.x'; },
            endianness() { return 'BE'; },
            machine()   { return 'm68k'; },
            hostname()  { return _getenv('HOST', 'amiga'); },
            /* File-system locations */
            tmpdir()    { return _getenv('T', 'T:'); },
            homedir()   { return _getenv('HOME', _getenv('SYS', 'SYS:')); },
            userInfo(opts) {
                const u = _getenv('USER', _getenv('USERNAME', 'user'));
                return {
                    username: u,
                    uid: -1, gid: -1,
                    shell: null,
                    homedir: globalThis.nodeOs.homedir(),
                };
            },
            /* CPU / memory — we don't have meaningful telemetry; return
             * a single stubbed entry per Node contract (non-empty array). */
            cpus() {
                return [{
                    model: 'm68k',
                    speed: 0,
                    times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
                }];
            },
            totalmem() { return 0; },
            freemem()  { return 0; },
            loadavg()  { return [0, 0, 0]; },
            uptime()   { return (os.now() - _startUs) / 1e6; },
            networkInterfaces() { return {}; },
            /* Constants — subset. Signals are meaningless on classic Amiga
             * but some Node code references os.constants.signals.SIGINT. */
            constants: {
                signals: {
                    SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGILL: 4, SIGTRAP: 5,
                    SIGABRT: 6, SIGKILL: 9, SIGUSR1: 10, SIGSEGV: 11, SIGTERM: 15,
                },
                errno: { EACCES: 13, EEXIST: 17, ENOENT: 2, EIO: 5 },
                UV_UDP_REUSEADDR: 4,
            },
            /* priority is a no-op — no task prio mapping in v1 */
            getPriority() { return 0; },
            setPriority() { /* no-op */ },
        };
    },
}));

/* ==========================================================
 * Feature: require stub (Node CommonJS — built-ins only)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * Ships a `globalThis.require(id)` that returns the matching
 * built-in module global when a known id is requested. Handles
 * both bare ids and `node:` prefix. Not a full CommonJS loader
 * — no file resolution, no .js evaluation — just enough that
 * ported Node code `const fs = require('fs')` works without a
 * bundler.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'node-require',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'CommonJS-style require() stub for built-in modules',
    globals:     ['require'],
    standard:    false,
    install() {
        function _resolve(id) {
            let name = String(id);
            if (name.startsWith('node:')) name = name.substring(5);
            switch (name) {
                case 'assert':           return globalThis.assert;
                case 'buffer':           return { Buffer: globalThis.Buffer, Blob: globalThis.Blob, File: globalThis.File };
                case 'child_process':    return globalThis.child_process;
                case 'crypto':           return globalThis.crypto;
                case 'events':           return globalThis.events;
                case 'fs':               return globalThis.fs;
                case 'fs/promises':      return globalThis.fs && globalThis.fs.promises;
                case 'os':               return globalThis.nodeOs;
                case 'path':             return globalThis.path;
                case 'path/posix':       return globalThis.path && globalThis.path.posix;
                case 'path/win32':       return globalThis.path && globalThis.path.win32;
                case 'process':          return globalThis.process;
                case 'querystring':      return globalThis.querystring;
                case 'readline':         return globalThis.readline;
                case 'readline/promises': return globalThis.readline && globalThis.readline.promises;
                case 'stream':           return globalThis.stream;
                case 'string_decoder':   return { StringDecoder: globalThis.StringDecoder };
                case 'timers':           return globalThis.timers;
                case 'timers/promises':  return globalThis.timers && globalThis.timers.promises;
                case 'url':              return globalThis.url;
                case 'util':             return globalThis.util;
                case 'util/types':       return globalThis.util && globalThis.util.types;
                default: return null;
            }
        }
        function require(id) {
            const mod = _resolve(id);
            if (mod === null || mod === undefined) {
                const err = new Error("Cannot find module '" + id + "'");
                err.code = 'MODULE_NOT_FOUND';
                throw err;
            }
            return mod;
        }
        require.resolve = function (id) {
            const mod = _resolve(id);
            if (!mod) {
                const err = new Error("Cannot find module '" + id + "'");
                err.code = 'MODULE_NOT_FOUND';
                throw err;
            }
            return id;
        };
        require.cache = Object.create(null);
        /* `require.extensions` is legacy and mostly unused — stub for completeness. */
        require.extensions = Object.create(null);
        globalThis.require = require;
    },
}));

/* ==========================================================
 * Feature: readline  (Node readline + readline/promises subset)
 * Tier: pure-js    Provider: nea-port    Standard: node
 *
 * Line-oriented I/O around `std.in.getline()`. Synchronous under
 * the hood — the promise-based question() resolves on the next
 * microtask with the read line. For interactive scripts that need
 * a prompt/read/prompt loop this is "good enough"; for a real
 * non-blocking 'line' event stream you'd want a setReadHandler-
 * driven reader, which is future work.
 *
 * Also exposes the classic callback form
 *     rl.question('name? ', answer => ...)
 * and a readline.createInterface(input, output, ...) 4-arg legacy
 * signature from old Node.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'readline',
    tier:        'pure-js',
    provider:    'nea-port',
    description: 'Node readline module (createInterface, question, close)',
    requires:    ['event-emitter'],
    globals:     ['readline'],
    standard:    false,
    install() {
        class Interface extends globalThis.EventEmitter {
            constructor(opts) {
                super();
                /* opts: { input, output, terminal, prompt, historySize } */
                this._input  = (opts && opts.input)  || { getline: () => {
                    /* Default: read from std.in. */
                    const line = std.in.getline();
                    return (line === null) ? null : line;
                }};
                this._output = (opts && opts.output) || (globalThis.process && globalThis.process.stdout);
                this._prompt = (opts && typeof opts.prompt === 'string') ? opts.prompt : '> ';
                this._closed = false;
                this._historySize = (opts && opts.historySize) || 30;
                this.history = [];
                this.terminal = !!(opts && opts.terminal);
                this.line = '';
                this.cursor = 0;
            }
            _readLine() {
                /* Input may be our default object, a qjs:std FILE, or any
                 * object exposing getline(). */
                if (this._closed) return null;
                let line;
                if (this._input && typeof this._input.getline === 'function') {
                    line = this._input.getline();
                } else if (this._input === std.in) {
                    line = std.in.getline();
                } else {
                    line = null;
                }
                if (line === null || line === undefined) {
                    this._closed = true;
                    this.emit('close');
                    return null;
                }
                if (line.length > 0 && this.history.length < this._historySize
                    && (this.history.length === 0 || this.history[0] !== line)) {
                    this.history.unshift(line);
                }
                return line;
            }
            setPrompt(p) { this._prompt = String(p); }
            getPrompt() { return this._prompt; }
            prompt(/* preserveCursor */) {
                if (this._closed) return;
                if (this._output && typeof this._output.write === 'function') {
                    this._output.write(this._prompt);
                }
            }
            /* Classic callback form: question(query, callback).
             * query written to output, answer read from input. */
            question(query, options, callback) {
                if (typeof options === 'function') { callback = options; options = undefined; }
                if (this._closed) {
                    if (callback) callback(null);
                    return;
                }
                if (this._output && typeof this._output.write === 'function') {
                    this._output.write(query);
                }
                const signal = options && options.signal;
                if (signal && signal.aborted) {
                    const err = signal.reason || new DOMException('Aborted', 'AbortError');
                    if (callback) queueMicrotask(() => callback(null, err));
                    return;
                }
                const line = this._readLine();
                /* Fire on microtask for Node-matching async semantics. */
                if (callback) queueMicrotask(() => callback(line));
            }
            close() {
                if (this._closed) return;
                this._closed = true;
                this.emit('close');
            }
            write(data /*, key */) {
                if (this._output && typeof this._output.write === 'function') {
                    this._output.write(String(data));
                }
            }
            pause()  { /* input is not resumable in v1 — no-op */ }
            resume() { /* same */ }
            /* Lazy async iterator for `for await (const line of rl)` — reads
             * lines until EOF. */
            [Symbol.asyncIterator]() {
                const self = this;
                return {
                    next() {
                        if (self._closed) return Promise.resolve({ value: undefined, done: true });
                        const line = self._readLine();
                        if (line === null) return Promise.resolve({ value: undefined, done: true });
                        return Promise.resolve({ value: line, done: false });
                    },
                    return() { self.close(); return Promise.resolve({ value: undefined, done: true }); },
                    [Symbol.asyncIterator]() { return this; },
                };
            }
        }

        /* readline/promises-flavored Interface — question returns a Promise. */
        class PromisesInterface extends Interface {
            question(query, options) {
                return new Promise((resolve, reject) => {
                    const signal = options && options.signal;
                    if (signal && signal.aborted) {
                        reject(signal.reason || new DOMException('Aborted', 'AbortError'));
                        return;
                    }
                    Interface.prototype.question.call(this, query, options, (answer, err) => {
                        if (err) reject(err);
                        else resolve(answer);
                    });
                });
            }
        }

        function createInterface(inputOrOptions /* , output, completer, terminal */) {
            let opts;
            if (inputOrOptions && typeof inputOrOptions === 'object'
                && !('getline' in inputOrOptions) && !('fileno' in inputOrOptions)) {
                opts = inputOrOptions;
            } else {
                /* Classic 4-arg signature: (input, output, completer, terminal). */
                opts = {
                    input: arguments[0],
                    output: arguments[1],
                    completer: arguments[2],
                    terminal: arguments[3],
                };
            }
            return new Interface(opts);
        }

        function createPromisesInterface(opts) {
            return new PromisesInterface(opts || {});
        }

        globalThis.readline = {
            createInterface,
            Interface,
            /* clearScreenDown / moveCursor / cursorTo — ANSI helpers.
             * No-ops if output has no .write. */
            clearLine(stream, dir, cb) {
                /* dir: -1 left-of-cursor, 0 whole, 1 right-of-cursor */
                if (stream && typeof stream.write === 'function') {
                    const seq = dir === -1 ? '\x1b[1K' : dir === 1 ? '\x1b[K' : '\x1b[2K';
                    stream.write(seq);
                }
                if (cb) queueMicrotask(cb);
                return true;
            },
            clearScreenDown(stream, cb) {
                if (stream && typeof stream.write === 'function') stream.write('\x1b[J');
                if (cb) queueMicrotask(cb);
                return true;
            },
            cursorTo(stream, x, y, cb) {
                if (typeof y === 'function') { cb = y; y = undefined; }
                if (stream && typeof stream.write === 'function') {
                    if (y === undefined) stream.write('\x1b[' + ((x | 0) + 1) + 'G');
                    else stream.write('\x1b[' + ((y | 0) + 1) + ';' + ((x | 0) + 1) + 'H');
                }
                if (cb) queueMicrotask(cb);
                return true;
            },
            moveCursor(stream, dx, dy, cb) {
                if (stream && typeof stream.write === 'function') {
                    if (dx > 0) stream.write('\x1b[' + dx + 'C');
                    else if (dx < 0) stream.write('\x1b[' + (-dx) + 'D');
                    if (dy > 0) stream.write('\x1b[' + dy + 'B');
                    else if (dy < 0) stream.write('\x1b[' + (-dy) + 'A');
                }
                if (cb) queueMicrotask(cb);
                return true;
            },
            /* readline/promises sub-module — mirrors readline.createInterface
             * but returns an Interface whose question() is a Promise. */
            promises: {
                createInterface: createPromisesInterface,
                Interface: PromisesInterface,
            },
        };
    },
}));

/* ==========================================================
 * Feature: Q1 Amiga FFI (globalThis.amiga)
 * Tier: pure-js + native    Provider: nea-port    Standard: amiga
 *
 * Raw access to AmigaOS libraries from JS. Wraps the natives
 * installed by QJS_InstallAmigaFFIGlobal (C side in amiga_ffi.c +
 * m68k trampoline in amiga_ffi_call.s). 150+ LVO constants across
 * exec / dos / intuition / graphics / gadtools extracted from NDK
 * 3.2 FD files.
 *
 * USE WITH CARE: direct memory access and LVO dispatch can crash
 * the machine on bad input. This is explicit power-user territory;
 * see docs/superpowers/specs/2026-04-19-q1-amiga-ffi-design.md for
 * context.
 *
 * The manifest refuses to install if any native is missing — the
 * feature is off entirely when running against an older library.
 * ========================================================== */

_manifests.push(new LocalManifest({
    name:        'amiga-ffi',
    tier:        'native-backed',
    provider:    'nea-port',
    description: 'Raw AmigaOS FFI — openLibrary / call / peek / poke / allocMem / makeTags + 150 LVOs',
    globals:     ['amiga'],
    standard:    false,
    install() {
        /* Feature gate: if the library didn't install our natives, skip. */
        const N = globalThis;
        if (typeof N.__qjs_amiga_openLibrary !== 'function' ||
            typeof N.__qjs_amiga_call        !== 'function') {
            return;
        }

        /* Auto-generated from NDK 3.2R4 FD files by fd2lvo_all.py. */
        /* DO NOT EDIT BY HAND — run the generator and paste the result. */
        /* Libraries: 76; total LVOs: 1177. */
        const LVOS = {
            amigaguide: {
                LockAmigaGuideBase: -36, UnlockAmigaGuideBase: -42, OpenAmigaGuideA: -54,
                OpenAmigaGuideAsyncA: -60, CloseAmigaGuide: -66, AmigaGuideSignal: -72,
                GetAmigaGuideMsg: -78, ReplyAmigaGuideMsg: -84, SetAmigaGuideContextA: -90,
                SendAmigaGuideContextA: -96, SendAmigaGuideCmdA: -102, SetAmigaGuideAttrsA: -108,
                GetAmigaGuideAttr: -114, LoadXRef: -126, ExpungeXRef: -132,
                AddAmigaGuideHostA: -138, RemoveAmigaGuideHostA: -144, GetAmigaGuideString: -210,
            },
            arexx: {
                AREXX_GetClass: -30,
            },
            asl: {
                AllocFileRequest: -30, FreeFileRequest: -36, RequestFile: -42,
                AllocAslRequest: -48, FreeAslRequest: -54, AslRequest: -60, AbortAslRequest: -78,
                ActivateAslRequest: -84,
            },
            battclock: {
                ResetBattClock: -6, ReadBattClock: -12, WriteBattClock: -18,
            },
            battmem: {
                ObtainBattSemaphore: -6, ReleaseBattSemaphore: -12, ReadBattMem: -18,
                WriteBattMem: -24,
            },
            bevel: {
                BEVEL_GetClass: -30,
            },
            bitmap: {
                BITMAP_GetClass: -30,
            },
            bullet: {
                OpenEngine: -30, CloseEngine: -36, SetInfoA: -42, ObtainInfoA: -48,
                ReleaseInfoA: -54,
            },
            button: {
                BUTTON_GetClass: -30,
            },
            cardres: {
                OwnCard: -6, ReleaseCard: -12, GetCardMap: -18, BeginCardAccess: -24,
                EndCardAccess: -30, ReadCardStatus: -36, CardResetRemove: -42,
                CardMiscControl: -48, CardAccessSpeed: -54, CardProgramVoltage: -60,
                CardResetCard: -66, CopyTuple: -72, DeviceTuple: -78, IfAmigaXIP: -84,
                CardForceChange: -90, CardChangeCount: -96, CardInterface: -102,
            },
            checkbox: {
                CHECKBOX_GetClass: -30,
            },
            chooser: {
                CHOOSER_GetClass: -30, AllocChooserNodeA: -36, FreeChooserNode: -42,
                SetChooserNodeAttrsA: -48, GetChooserNodeAttrsA: -54, ShowChooser: -60,
                HideChooser: -66,
            },
            cia: {
                AddICRVector: -6, RemICRVector: -12, AbleICR: -18, SetICR: -24,
            },
            clicktab: {
                CLICKTAB_GetClass: -30, AllocClickTabNodeA: -36, FreeClickTabNode: -42,
                SetClickTabNodeAttrsA: -48, GetClickTabNodeAttrsA: -54,
            },
            colorwheel: {
                ConvertHSBToRGB: -30, ConvertRGBToHSB: -36,
            },
            commodities: {
                CreateCxObj: -30, CxBroker: -36, ActivateCxObj: -42, DeleteCxObj: -48,
                DeleteCxObjAll: -54, CxObjType: -60, CxObjError: -66, ClearCxObjError: -72,
                SetCxObjPri: -78, AttachCxObj: -84, EnqueueCxObj: -90, InsertCxObj: -96,
                RemoveCxObj: -102, SetTranslate: -114, SetFilter: -120, SetFilterIX: -126,
                ParseIX: -132, CxMsgType: -138, CxMsgData: -144, CxMsgID: -150,
                DivertCxMsg: -156, RouteCxMsg: -162, DisposeCxMsg: -168, InvertKeyMap: -174,
                AddIEvents: -180, MatchIX: -204,
            },
            console: {
                CDInputHandler: -42, RawKeyConvert: -48,
            },
            datatypes: {
                ObtainDataTypeA: -36, ReleaseDataType: -42, NewDTObjectA: -48,
                DisposeDTObject: -54, SetDTAttrsA: -60, GetDTAttrsA: -66, AddDTObject: -72,
                RefreshDTObjectA: -78, DoAsyncLayout: -84, DoDTMethodA: -90, RemoveDTObject: -96,
                GetDTMethods: -102, GetDTTriggerMethods: -108, PrintDTObjectA: -114,
                GetDTString: -138, FindMethod: -258, FindTriggerMethod: -264,
                CopyDTMethods: -270, CopyDTTriggerMethods: -276, FreeDTMethods: -282,
                GetDTTriggerMethodDataFlags: -288, SaveDTObjectA: -294, StartDragSelect: -300,
            },
            datebrowser: {
                DATEBROWSER_GetClass: -30, JulianWeekDay: -36, JulianMonthDays: -42,
                JulianLeapYear: -48,
            },
            disk: {
                AllocUnit: -6, FreeUnit: -12, GetUnit: -18, GiveUnit: -24, GetUnitID: -30,
                ReadUnitID: -36,
            },
            diskfont: {
                OpenDiskFont: -30, AvailFonts: -36, NewFontContents: -42,
                DisposeFontContents: -48, NewScaledDiskFont: -54, GetDiskFontCtrl: -60,
                SetDiskFontCtrlA: -66, EOpenEngine: -72, ECloseEngine: -78, ESetInfoA: -84,
                EObtainInfoA: -90, EReleaseInfoA: -96, OpenOutlineFont: -102,
                CloseOutlineFont: -108, WriteFontContents: -114, WriteDiskFontHeaderA: -120,
                ObtainCharsetInfo: -126,
            },
            dos: {
                Open: -30, Close: -36, Read: -42, Write: -48, Input: -54, Output: -60, Seek: -66,
                DeleteFile: -72, Rename: -78, Lock: -84, UnLock: -90, DupLock: -96,
                Examine: -102, ExNext: -108, Info: -114, CreateDir: -120, CurrentDir: -126,
                IoErr: -132, CreateProc: -138, Exit: -144, LoadSeg: -150, UnLoadSeg: -156,
                DeviceProc: -174, SetComment: -180, SetProtection: -186, DateStamp: -192,
                Delay: -198, WaitForChar: -204, ParentDir: -210, IsInteractive: -216,
                Execute: -222, AllocDosObject: -228, FreeDosObject: -234, DoPkt: -240,
                SendPkt: -246, WaitPkt: -252, ReplyPkt: -258, AbortPkt: -264, LockRecord: -270,
                LockRecords: -276, UnLockRecord: -282, UnLockRecords: -288, SelectInput: -294,
                SelectOutput: -300, FGetC: -306, FPutC: -312, UnGetC: -318, FRead: -324,
                FWrite: -330, FGets: -336, FPuts: -342, VFWritef: -348, VFPrintf: -354,
                Flush: -360, SetVBuf: -366, DupLockFromFH: -372, OpenFromLock: -378,
                ParentOfFH: -384, ExamineFH: -390, SetFileDate: -396, NameFromLock: -402,
                NameFromFH: -408, SplitName: -414, SameLock: -420, SetMode: -426, ExAll: -432,
                ReadLink: -438, MakeLink: -444, ChangeMode: -450, SetFileSize: -456,
                SetIoErr: -462, Fault: -468, PrintFault: -474, ErrorReport: -480, Cli: -492,
                CreateNewProc: -498, RunCommand: -504, GetConsoleTask: -510,
                SetConsoleTask: -516, GetFileSysTask: -522, SetFileSysTask: -528,
                GetArgStr: -534, SetArgStr: -540, FindCliProc: -546, MaxCli: -552,
                SetCurrentDirName: -558, GetCurrentDirName: -564, SetProgramName: -570,
                GetProgramName: -576, SetPrompt: -582, GetPrompt: -588, SetProgramDir: -594,
                GetProgramDir: -600, SystemTagList: -606, AssignLock: -612, AssignLate: -618,
                AssignPath: -624, AssignAdd: -630, RemAssignList: -636, GetDeviceProc: -642,
                FreeDeviceProc: -648, LockDosList: -654, UnLockDosList: -660,
                AttemptLockDosList: -666, RemDosEntry: -672, AddDosEntry: -678,
                FindDosEntry: -684, NextDosEntry: -690, MakeDosEntry: -696, FreeDosEntry: -702,
                IsFileSystem: -708, Format: -714, Relabel: -720, Inhibit: -726, AddBuffers: -732,
                CompareDates: -738, DateToStr: -744, StrToDate: -750, InternalLoadSeg: -756,
                InternalUnLoadSeg: -762, NewLoadSeg: -768, AddSegment: -774, FindSegment: -780,
                RemSegment: -786, CheckSignal: -792, ReadArgs: -798, FindArg: -804,
                ReadItem: -810, StrToLong: -816, MatchFirst: -822, MatchNext: -828,
                MatchEnd: -834, ParsePattern: -840, MatchPattern: -846, FreeArgs: -858,
                FilePart: -870, PathPart: -876, AddPart: -882, StartNotify: -888,
                EndNotify: -894, SetVar: -900, GetVar: -906, DeleteVar: -912, FindVar: -918,
                CliInitNewcli: -930, CliInitRun: -936, WriteChars: -942, PutStr: -948,
                VPrintf: -954, ParsePatternNoCase: -966, MatchPatternNoCase: -972,
                SameDevice: -984, ExAllEnd: -990, SetOwner: -996, VolumeRequestHook: -1014,
                GetCurrentDir: -1026, PutErrStr: -1128, ErrorOutput: -1134, SelectError: -1140,
                DoShellMethodTagList: -1152, ScanStackToken: -1158,
            },
            drawlist: {
                DRAWLIST_GetClass: -30,
            },
            dtclass: {
                ObtainEngine: -30,
            },
            exec: {
                Supervisor: -30, InitCode: -72, InitStruct: -78, MakeLibrary: -84,
                MakeFunctions: -90, FindResident: -96, InitResident: -102, Alert: -108,
                Debug: -114, Disable: -120, Enable: -126, Forbid: -132, Permit: -138,
                SetSR: -144, SuperState: -150, UserState: -156, SetIntVector: -162,
                AddIntServer: -168, RemIntServer: -174, Cause: -180, Allocate: -186,
                Deallocate: -192, AllocMem: -198, AllocAbs: -204, FreeMem: -210, AvailMem: -216,
                AllocEntry: -222, FreeEntry: -228, Insert: -234, AddHead: -240, AddTail: -246,
                Remove: -252, RemHead: -258, RemTail: -264, Enqueue: -270, FindName: -276,
                AddTask: -282, RemTask: -288, FindTask: -294, SetTaskPri: -300, SetSignal: -306,
                SetExcept: -312, Wait: -318, Signal: -324, AllocSignal: -330, FreeSignal: -336,
                AllocTrap: -342, FreeTrap: -348, AddPort: -354, RemPort: -360, PutMsg: -366,
                GetMsg: -372, ReplyMsg: -378, WaitPort: -384, FindPort: -390, AddLibrary: -396,
                RemLibrary: -402, OldOpenLibrary: -408, CloseLibrary: -414, SetFunction: -420,
                SumLibrary: -426, AddDevice: -432, RemDevice: -438, OpenDevice: -444,
                CloseDevice: -450, DoIO: -456, SendIO: -462, CheckIO: -468, WaitIO: -474,
                AbortIO: -480, AddResource: -486, RemResource: -492, OpenResource: -498,
                RawDoFmt: -522, GetCC: -528, TypeOfMem: -534, Procure: -540, Vacate: -546,
                OpenLibrary: -552, InitSemaphore: -558, ObtainSemaphore: -564,
                ReleaseSemaphore: -570, AttemptSemaphore: -576, ObtainSemaphoreList: -582,
                ReleaseSemaphoreList: -588, FindSemaphore: -594, AddSemaphore: -600,
                RemSemaphore: -606, SumKickData: -612, AddMemList: -618, CopyMem: -624,
                CopyMemQuick: -630, CacheClearU: -636, CacheClearE: -642, CacheControl: -648,
                CreateIORequest: -654, DeleteIORequest: -660, CreateMsgPort: -666,
                DeleteMsgPort: -672, ObtainSemaphoreShared: -678, AllocVec: -684, FreeVec: -690,
                CreatePool: -696, DeletePool: -702, AllocPooled: -708, FreePooled: -714,
                AttemptSemaphoreShared: -720, ColdReboot: -726, StackSwap: -732,
                CachePreDMA: -762, CachePostDMA: -768, AddMemHandler: -774, RemMemHandler: -780,
                ObtainQuickVector: -786, NewMinList: -828,
            },
            expansion: {
                AddConfigDev: -30, AddBootNode: -36, AllocBoardMem: -42, AllocConfigDev: -48,
                AllocExpansionMem: -54, ConfigBoard: -60, ConfigChain: -66, FindConfigDev: -72,
                FreeBoardMem: -78, FreeConfigDev: -84, FreeExpansionMem: -90,
                ReadExpansionByte: -96, ReadExpansionRom: -102, RemConfigDev: -108,
                WriteExpansionByte: -114, ObtainConfigBinding: -120, ReleaseConfigBinding: -126,
                SetCurrentBinding: -132, GetCurrentBinding: -138, MakeDosNode: -144,
                AddDosNode: -150,
            },
            fuelgauge: {
                FUELGAUGE_GetClass: -30,
            },
            gadtools: {
                CreateGadgetA: -30, FreeGadgets: -36, GT_SetGadgetAttrsA: -42, CreateMenusA: -48,
                FreeMenus: -54, LayoutMenuItemsA: -60, LayoutMenusA: -66, GT_GetIMsg: -72,
                GT_ReplyIMsg: -78, GT_RefreshWindow: -84, GT_BeginRefresh: -90,
                GT_EndRefresh: -96, GT_FilterIMsg: -102, GT_PostFilterIMsg: -108,
                CreateContext: -114, DrawBevelBoxA: -120, GetVisualInfoA: -126,
                FreeVisualInfo: -132, SetDesignFontA: -138, ScaleGadgetRectA: -144,
                GT_GetGadgetAttrsA: -174,
            },
            getcolor: {
                GETCOLOR_GetClass: -30,
            },
            getfile: {
                GETFILE_GetClass: -30,
            },
            getfont: {
                GETFONT_GetClass: -30,
            },
            getscreenmode: {
                GETSCREENMODE_GetClass: -30,
            },
            glyph: {
                GLYPH_GetClass: -30,
            },
            graphics: {
                BltBitMap: -30, BltTemplate: -36, ClearEOL: -42, ClearScreen: -48,
                TextLength: -54, Text: -60, SetFont: -66, OpenFont: -72, CloseFont: -78,
                AskSoftStyle: -84, SetSoftStyle: -90, AddBob: -96, AddVSprite: -102,
                DoCollision: -108, DrawGList: -114, InitGels: -120, InitMasks: -126,
                RemIBob: -132, RemVSprite: -138, SetCollision: -144, SortGList: -150,
                AddAnimOb: -156, Animate: -162, GetGBuffers: -168, InitGMasks: -174,
                DrawEllipse: -180, AreaEllipse: -186, LoadRGB4: -192, InitRastPort: -198,
                InitVPort: -204, MrgCop: -210, MakeVPort: -216, LoadView: -222, WaitBlit: -228,
                SetRast: -234, Move: -240, Draw: -246, AreaMove: -252, AreaDraw: -258,
                AreaEnd: -264, WaitTOF: -270, QBlit: -276, InitArea: -282, SetRGB4: -288,
                QBSBlit: -294, BltClear: -300, RectFill: -306, BltPattern: -312, ReadPixel: -318,
                WritePixel: -324, Flood: -330, PolyDraw: -336, SetAPen: -342, SetBPen: -348,
                SetDrMd: -354, InitView: -360, CBump: -366, CMove: -372, CWait: -378,
                VBeamPos: -384, InitBitMap: -390, ScrollRaster: -396, WaitBOVP: -402,
                GetSprite: -408, FreeSprite: -414, ChangeSprite: -420, MoveSprite: -426,
                LockLayerRom: -432, UnlockLayerRom: -438, SyncSBitMap: -444, CopySBitMap: -450,
                OwnBlitter: -456, DisownBlitter: -462, InitTmpRas: -468, AskFont: -474,
                AddFont: -480, RemFont: -486, AllocRaster: -492, FreeRaster: -498,
                AndRectRegion: -504, OrRectRegion: -510, NewRegion: -516, ClearRectRegion: -522,
                ClearRegion: -528, DisposeRegion: -534, FreeVPortCopLists: -540,
                FreeCopList: -546, ClipBlit: -552, XorRectRegion: -558, FreeCprList: -564,
                GetColorMap: -570, FreeColorMap: -576, GetRGB4: -582, ScrollVPort: -588,
                UCopperListInit: -594, FreeGBuffers: -600, BltBitMapRastPort: -606,
                OrRegionRegion: -612, XorRegionRegion: -618, AndRegionRegion: -624,
                SetRGB4CM: -630, BltMaskBitMapRastPort: -636, AttemptLockLayerRom: -654,
                GfxNew: -660, GfxFree: -666, GfxAssociate: -672, BitMapScale: -678,
                ScalerDiv: -684, TextExtent: -690, TextFit: -696, GfxLookUp: -702,
                VideoControl: -708, OpenMonitor: -714, CloseMonitor: -720, FindDisplayInfo: -726,
                NextDisplayInfo: -732, GetDisplayInfoData: -756, FontExtent: -762,
                ReadPixelLine8: -768, WritePixelLine8: -774, ReadPixelArray8: -780,
                WritePixelArray8: -786, GetVPModeID: -792, ModeNotAvailable: -798,
                WeighTAMatch: -804, EraseRect: -810, ExtendFont: -816, StripFont: -822,
                CalcIVG: -828, AttachPalExtra: -834, ObtainBestPenA: -840, SetRGB32: -852,
                GetAPen: -858, GetBPen: -864, GetDrMd: -870, GetOutlinePen: -876,
                LoadRGB32: -882, SetChipRev: -888, SetABPenDrMd: -894, GetRGB32: -900,
                AllocBitMap: -918, FreeBitMap: -924, GetExtSpriteA: -930, CoerceMode: -936,
                ChangeVPBitMap: -942, ReleasePen: -948, ObtainPen: -954, GetBitMapAttr: -960,
                AllocDBufInfo: -966, FreeDBufInfo: -972, SetOutlinePen: -978, SetWriteMask: -984,
                SetMaxPen: -990, SetRGB32CM: -996, ScrollRasterBF: -1002, FindColor: -1008,
                AllocSpriteDataA: -1020, ChangeExtSpriteA: -1026, FreeSpriteData: -1032,
                SetRPAttrsA: -1038, GetRPAttrsA: -1044, BestModeIDA: -1050,
                WriteChunkyPixels: -1056,
            },
            icon: {
                iconPrivate1: -30, iconPrivate2: -36, iconPrivate3: -42, iconPrivate4: -48,
                FreeFreeList: -54, AddFreeList: -72, GetDiskObject: -78, PutDiskObject: -84,
                FreeDiskObject: -90, FindToolType: -96, MatchToolValue: -102, BumpRevision: -108,
                FreeAlloc: -114, GetDefDiskObject: -120, PutDefDiskObject: -126,
                GetDiskObjectNew: -132, DeleteDiskObject: -138, FreeFree: -144,
                DupDiskObjectA: -150, IconControlA: -156, DrawIconStateA: -162,
                GetIconRectangleA: -168, NewDiskObject: -174, GetIconTagList: -180,
                PutIconTagList: -186, LayoutIconA: -192, ChangeToSelectedIconColor: -198,
                BumpRevisionLength: -204,
            },
            iffparse: {
                AllocIFF: -30, OpenIFF: -36, ParseIFF: -42, CloseIFF: -48, FreeIFF: -54,
                ReadChunkBytes: -60, WriteChunkBytes: -66, ReadChunkRecords: -72,
                WriteChunkRecords: -78, PushChunk: -84, PopChunk: -90, EntryHandler: -102,
                ExitHandler: -108, PropChunk: -114, PropChunks: -120, StopChunk: -126,
                StopChunks: -132, CollectionChunk: -138, CollectionChunks: -144,
                StopOnExit: -150, FindProp: -156, FindCollection: -162, FindPropContext: -168,
                CurrentChunk: -174, ParentChunk: -180, AllocLocalItem: -186, LocalItemData: -192,
                SetLocalItemPurge: -198, FreeLocalItem: -204, FindLocalItem: -210,
                StoreLocalItem: -216, StoreItemInContext: -222, InitIFF: -228,
                InitIFFasDOS: -234, InitIFFasClip: -240, OpenClipboard: -246,
                CloseClipboard: -252, GoodID: -258, GoodType: -264, IDtoStr: -270,
            },
            input: {
                PeekQualifier: -42,
            },
            integer: {
                INTEGER_GetClass: -30,
            },
            intuition: {
                OpenIntuition: -30, Intuition: -36, AddGadget: -42, ClearDMRequest: -48,
                ClearMenuStrip: -54, ClearPointer: -60, CloseScreen: -66, CloseWindow: -72,
                CloseWorkBench: -78, CurrentTime: -84, DisplayAlert: -90, DisplayBeep: -96,
                DoubleClick: -102, DrawBorder: -108, DrawImage: -114, EndRequest: -120,
                GetDefPrefs: -126, GetPrefs: -132, InitRequester: -138, ItemAddress: -144,
                ModifyIDCMP: -150, ModifyProp: -156, MoveScreen: -162, MoveWindow: -168,
                OffGadget: -174, OffMenu: -180, OnGadget: -186, OnMenu: -192, OpenScreen: -198,
                OpenWindow: -204, OpenWorkBench: -210, PrintIText: -216, RefreshGadgets: -222,
                RemoveGadget: -228, ReportMouse: -234, Request: -240, ScreenToBack: -246,
                ScreenToFront: -252, SetDMRequest: -258, SetMenuStrip: -264, SetPointer: -270,
                SetWindowTitles: -276, ShowTitle: -282, SizeWindow: -288, ViewAddress: -294,
                ViewPortAddress: -300, WindowToBack: -306, WindowToFront: -312,
                WindowLimits: -318, SetPrefs: -324, IntuiTextLength: -330, WBenchToBack: -336,
                WBenchToFront: -342, AutoRequest: -348, BeginRefresh: -354,
                BuildSysRequest: -360, EndRefresh: -366, FreeSysRequest: -372, MakeScreen: -378,
                RemakeDisplay: -384, RethinkDisplay: -390, AllocRemember: -396,
                AlohaWorkbench: -402, FreeRemember: -408, LockIBase: -414, UnlockIBase: -420,
                GetScreenData: -426, RefreshGList: -432, AddGList: -438, RemoveGList: -444,
                ActivateWindow: -450, RefreshWindowFrame: -456, ActivateGadget: -462,
                NewModifyProp: -468, QueryOverscan: -474, MoveWindowInFrontOf: -480,
                ChangeWindowBox: -486, SetEditHook: -492, SetMouseQueue: -498, ZipWindow: -504,
                LockPubScreen: -510, UnlockPubScreen: -516, LockPubScreenList: -522,
                UnlockPubScreenList: -528, NextPubScreen: -534, SetDefaultPubScreen: -540,
                SetPubScreenModes: -546, PubScreenStatus: -552, ObtainGIRPort: -558,
                ReleaseGIRPort: -564, GadgetMouse: -570, GetDefaultPubScreen: -582,
                EasyRequestArgs: -588, BuildEasyRequestArgs: -594, SysReqHandler: -600,
                OpenWindowTagList: -606, OpenScreenTagList: -612, DrawImageState: -618,
                PointInImage: -624, EraseImage: -630, NewObjectA: -636, DisposeObject: -642,
                SetAttrsA: -648, GetAttr: -654, SetGadgetAttrsA: -660, NextObject: -666,
                MakeClass: -678, AddClass: -684, GetScreenDrawInfo: -690,
                FreeScreenDrawInfo: -696, ResetMenuStrip: -702, RemoveClass: -708,
                FreeClass: -714, AllocScreenBuffer: -768, FreeScreenBuffer: -774,
                ChangeScreenBuffer: -780, ScreenDepth: -786, ScreenPosition: -792,
                ScrollWindowRaster: -798, LendMenus: -804, DoGadgetMethodA: -810,
                SetWindowPointerA: -816, TimedDisplayAlert: -822, HelpControl: -828,
                ShowWindow: -834, HideWindow: -840, IntuitionControlA: -1212,
            },
            keymap: {
                SetKeyMapDefault: -30, AskKeyMapDefault: -36, MapRawKey: -42, MapANSI: -48,
            },
            label: {
                LABEL_GetClass: -30,
            },
            layers: {
                InitLayers: -30, CreateUpfrontLayer: -36, CreateBehindLayer: -42,
                UpfrontLayer: -48, BehindLayer: -54, MoveLayer: -60, SizeLayer: -66,
                ScrollLayer: -72, BeginUpdate: -78, EndUpdate: -84, DeleteLayer: -90,
                LockLayer: -96, UnlockLayer: -102, LockLayers: -108, UnlockLayers: -114,
                LockLayerInfo: -120, SwapBitsRastPortClipRect: -126, WhichLayer: -132,
                UnlockLayerInfo: -138, NewLayerInfo: -144, DisposeLayerInfo: -150,
                FattenLayerInfo: -156, ThinLayerInfo: -162, MoveLayerInFrontOf: -168,
                InstallClipRegion: -174, MoveSizeLayer: -180, CreateUpfrontHookLayer: -186,
                CreateBehindHookLayer: -192, InstallLayerHook: -198, InstallLayerInfoHook: -204,
                SortLayerCR: -210, DoHookClipRects: -216, LayerOccluded: -222, HideLayer: -228,
                ShowLayer: -234, SetLayerInfoBounds: -240,
            },
            layout: {
                LAYOUT_GetClass: -30, ActivateLayoutGadget: -36, FlushLayoutDomainCache: -42,
                RethinkLayout: -48, LayoutLimits: -54, PAGE_GetClass: -60,
                SetPageGadgetAttrsA: -66, RefreshPageGadget: -72,
            },
            listbrowser: {
                LISTBROWSER_GetClass: -30, AllocListBrowserNodeA: -36, FreeListBrowserNode: -42,
                SetListBrowserNodeAttrsA: -48, GetListBrowserNodeAttrsA: -54,
                ListBrowserSelectAll: -60, ShowListBrowserNodeChildren: -66,
                HideListBrowserNodeChildren: -72, ShowAllListBrowserChildren: -78,
                HideAllListBrowserChildren: -84, FreeListBrowserList: -90,
                AllocLBColumnInfoA: -96, SetLBColumnInfoAttrsA: -102,
                GetLBColumnInfoAttrsA: -108, FreeLBColumnInfo: -114, ListBrowserClearAll: -120,
            },
            locale: {
                CloseCatalog: -36, CloseLocale: -42, ConvToLower: -48, ConvToUpper: -54,
                FormatDate: -60, FormatString: -66, GetCatalogStr: -72, GetLocaleStr: -78,
                IsAlNum: -84, IsAlpha: -90, IsCntrl: -96, IsDigit: -102, IsGraph: -108,
                IsLower: -114, IsPrint: -120, IsPunct: -126, IsSpace: -132, IsUpper: -138,
                IsXDigit: -144, OpenCatalogA: -150, OpenLocale: -156, ParseDate: -162,
                StrConvert: -174, StrnCmp: -180,
            },
            lowlevel: {
                ReadJoyPort: -30, GetLanguageSelection: -36, GetKey: -48, QueryKeys: -54,
                AddKBInt: -60, RemKBInt: -66, SystemControlA: -72, AddTimerInt: -78,
                RemTimerInt: -84, StopTimerInt: -90, StartTimerInt: -96, ElapsedTime: -102,
                AddVBlankInt: -108, RemVBlankInt: -114, SetJoyPortAttrsA: -132,
            },
            mathffp: {
                SPFix: -30, SPFlt: -36, SPCmp: -42, SPTst: -48, SPAbs: -54, SPNeg: -60,
                SPAdd: -66, SPSub: -72, SPMul: -78, SPDiv: -84, SPFloor: -90, SPCeil: -96,
            },
            mathieeedoubbas: {
                IEEEDPFix: -30, IEEEDPFlt: -36, IEEEDPCmp: -42, IEEEDPTst: -48, IEEEDPAbs: -54,
                IEEEDPNeg: -60, IEEEDPAdd: -66, IEEEDPSub: -72, IEEEDPMul: -78, IEEEDPDiv: -84,
                IEEEDPFloor: -90, IEEEDPCeil: -96,
            },
            mathieeedoubtrans: {
                IEEEDPAtan: -30, IEEEDPSin: -36, IEEEDPCos: -42, IEEEDPTan: -48,
                IEEEDPSincos: -54, IEEEDPSinh: -60, IEEEDPCosh: -66, IEEEDPTanh: -72,
                IEEEDPExp: -78, IEEEDPLog: -84, IEEEDPPow: -90, IEEEDPSqrt: -96,
                IEEEDPTieee: -102, IEEEDPFieee: -108, IEEEDPAsin: -114, IEEEDPAcos: -120,
                IEEEDPLog10: -126,
            },
            mathieeesingbas: {
                IEEESPFix: -30, IEEESPFlt: -36, IEEESPCmp: -42, IEEESPTst: -48, IEEESPAbs: -54,
                IEEESPNeg: -60, IEEESPAdd: -66, IEEESPSub: -72, IEEESPMul: -78, IEEESPDiv: -84,
                IEEESPFloor: -90, IEEESPCeil: -96,
            },
            mathieeesingtrans: {
                IEEESPAtan: -30, IEEESPSin: -36, IEEESPCos: -42, IEEESPTan: -48,
                IEEESPSincos: -54, IEEESPSinh: -60, IEEESPCosh: -66, IEEESPTanh: -72,
                IEEESPExp: -78, IEEESPLog: -84, IEEESPPow: -90, IEEESPSqrt: -96,
                IEEESPTieee: -102, IEEESPFieee: -108, IEEESPAsin: -114, IEEESPAcos: -120,
                IEEESPLog10: -126,
            },
            mathtrans: {
                SPAtan: -30, SPSin: -36, SPCos: -42, SPTan: -48, SPSincos: -54, SPSinh: -60,
                SPCosh: -66, SPTanh: -72, SPExp: -78, SPLog: -84, SPPow: -90, SPSqrt: -96,
                SPTieee: -102, SPFieee: -108, SPAsin: -114, SPAcos: -120, SPLog10: -126,
            },
            misc: {
                AllocMiscResource: -6, FreeMiscResource: -12,
            },
            nonvolatile: {
                GetCopyNV: -30, FreeNVData: -36, StoreNV: -42, DeleteNV: -48, GetNVInfo: -54,
                GetNVList: -60, SetNVProtection: -66,
            },
            palette: {
                PALETTE_GetClass: -30,
            },
            penmap: {
                PENMAP_GetClass: -30,
            },
            potgo: {
                AllocPotBits: -6, FreePotBits: -12, WritePotgo: -18,
            },
            radiobutton: {
                RADIOBUTTON_GetClass: -30, AllocRadioButtonNodeA: -36, FreeRadioButtonNode: -42,
                SetRadioButtonNodeAttrsA: -48, GetRadioButtonNodeAttrsA: -54,
            },
            ramdrive: {
                KillRAD0: -42, KillRAD: -48,
            },
            realtime: {
                LockRealTime: -30, UnlockRealTime: -36, CreatePlayerA: -42, DeletePlayer: -48,
                SetPlayerAttrsA: -54, SetConductorState: -60, ExternalSync: -66,
                NextConductor: -72, FindConductor: -78, GetPlayerAttrsA: -84,
            },
            requester: {
                REQUESTER_GetClass: -30,
            },
            rexxsyslib: {
                CreateArgstring: -126, DeleteArgstring: -132, LengthArgstring: -138,
                CreateRexxMsg: -144, DeleteRexxMsg: -150, ClearRexxMsg: -156, FillRexxMsg: -162,
                IsRexxMsg: -168, LockRexxBase: -450, UnlockRexxBase: -456,
                CreateRexxHostPort: -480, DeleteRexxHostPort: -486, GetRexxVarFromMsg: -492,
                SetRexxVarFromMsg: -498, LaunchRexxScript: -504, FreeRexxMsg: -510,
                GetRexxBufferFromMsg: -516,
            },
            scroller: {
                SCROLLER_GetClass: -30,
            },
            sketchboard: {
                SKETCHBOARD_GetClass: -30,
            },
            slider: {
                SLIDER_GetClass: -30,
            },
            space: {
                SPACE_GetClass: -30,
            },
            speedbar: {
                SPEEDBAR_GetClass: -30, AllocSpeedButtonNodeA: -36, FreeSpeedButtonNode: -42,
                SetSpeedButtonNodeAttrsA: -48, GetSpeedButtonNodeAttrsA: -54,
            },
            string: {
                STRING_GetClass: -30,
            },
            texteditor: {
                TEXTEDITOR_GetClass: -30, HighlightSetFormat: -36,
            },
            timer: {
                AddTime: -42, SubTime: -48, CmpTime: -54, ReadEClock: -60, GetSysTime: -66,
            },
            trackfile: {
                trackfilePrivate1: -6, trackfilePrivate2: -12, trackfilePrivate3: -18,
                trackfilePrivate4: -24, trackfilePrivate5: -30, trackfilePrivate6: -36,
                TFStartUnitTagList: -42, TFStopUnitTagList: -48, TFInsertMediaTagList: -54,
                TFEjectMediaTagList: -60, TFGetUnitData: -66, TFFreeUnitData: -72,
                TFChangeUnitTagList: -78, TFExamineFileSize: -84,
            },
            translator: {
                Translate: -30,
            },
            utility: {
                FindTagItem: -30, GetTagData: -36, PackBoolTags: -42, NextTagItem: -48,
                FilterTagChanges: -54, MapTags: -60, AllocateTagItems: -66, CloneTagItems: -72,
                FreeTagItems: -78, RefreshTagItemClones: -84, TagInArray: -90,
                FilterTagItems: -96, CallHookPkt: -102, Amiga2Date: -120, Date2Amiga: -126,
                CheckDate: -132, SMult32: -138, UMult32: -144, SDivMod32: -150, UDivMod32: -156,
                Stricmp: -162, Strnicmp: -168, ToUpper: -174, ToLower: -180,
                ApplyTagChanges: -186, SMult64: -198, UMult64: -204, PackStructureTags: -210,
                UnpackStructureTags: -216, AddNamedObject: -222, AllocNamedObjectA: -228,
                AttemptRemNamedObject: -234, FindNamedObject: -240, FreeNamedObject: -246,
                NamedObjectName: -252, ReleaseNamedObject: -258, RemNamedObject: -264,
                GetUniqueID: -270, VSNPrintf: -312, Strncpy: -438, Strncat: -444,
                SDivMod64: -450, UDivMod64: -456,
            },
            virtual: {
                VIRTUAL_GetClass: -30, RefreshVirtualGadget: -36, RethinkVirtualSize: -42,
            },
            wb: {
                UpdateWorkbench: -30, AddAppWindowA: -48, RemoveAppWindow: -54, AddAppIconA: -60,
                RemoveAppIcon: -66, AddAppMenuItemA: -72, RemoveAppMenuItem: -78, WBInfo: -90,
                OpenWorkbenchObjectA: -96, CloseWorkbenchObjectA: -102, WorkbenchControlA: -108,
                AddAppWindowDropZoneA: -114, RemoveAppWindowDropZone: -120,
                ChangeWorkbenchSelectionA: -126, MakeWorkbenchObjectVisibleA: -132,
                WhichWorkbenchObjectA: -138,
            },
            window: {
                WINDOW_GetClass: -30,
            },
        };

        /* ---------- FFI primitives (thin wrappers) ---------- */
        const amiga = {
            /* --- libraries --- */
            openLibrary(name, version) {
                if (typeof name !== 'string') {
                    throw new TypeError('amiga.openLibrary: name must be a string');
                }
                return N.__qjs_amiga_openLibrary(name, (version | 0) || 0);
            },
            closeLibrary(lib) {
                if (!lib) return;
                N.__qjs_amiga_closeLibrary(lib);
            },

            /* --- generic library call --- */
            call(lib, lvo, regs) {
                if (!lib) throw new TypeError('amiga.call: lib pointer is 0');
                return N.__qjs_amiga_call(lib, lvo | 0, regs || {});
            },

            /* --- direct memory access --- */
            peek8(addr)        { return N.__qjs_amiga_peek8(addr); },
            peek16(addr)       { return N.__qjs_amiga_peek16(addr); },
            peek32(addr)       { return N.__qjs_amiga_peek32(addr); },
            poke8(addr, val)   { N.__qjs_amiga_poke8(addr, val | 0); },
            poke16(addr, val)  { N.__qjs_amiga_poke16(addr, val | 0); },
            poke32(addr, val)  { N.__qjs_amiga_poke32(addr, val | 0); },
            peekString(addr, maxLen) {
                return N.__qjs_amiga_peekString(addr, maxLen === undefined ? 4096 : (maxLen | 0));
            },
            pokeString(addr, str) {
                return N.__qjs_amiga_pokeString(addr, String(str));
            },

            /* --- memory allocation --- */
            allocMem(size, flags) {
                if (flags === undefined) flags = amiga.exec.MEMF_PUBLIC | amiga.exec.MEMF_CLEAR;
                return N.__qjs_amiga_allocMem(size | 0, flags | 0);
            },
            freeMem(ptr, size) {
                if (!ptr || !size) return;
                N.__qjs_amiga_freeMem(ptr, size | 0);
            },

            /* --- BOOPSI method dispatch --- */
            /* Expands the IDoMethod macro: reads obj's Class ptr
             * from (obj - 4) and dispatches through the class's
             * cl_Dispatcher Hook. `msg` must be a pointer to a
             * method message struct whose first ULONG is the
             * MethodID. */
            doMethod(obj, msg) {
                if (typeof N.__qjs_amiga_doMethod !== 'function') {
                    throw new Error('amiga.doMethod: native not installed — library < 0.137?');
                }
                if (obj === null || obj === undefined) return 0;
                return N.__qjs_amiga_doMethod(obj | 0, (msg | 0) || 0);
            },

            /* --- TagItem helpers ---
             *
             * Accepted input shapes (all three normalize to the same
             * native pair-array the C side consumes):
             *
             *   // 1. Pair array (original):
             *   amiga.makeTags([[WA_Title, 'foo'], [WA_Width, 200]])
             *
             *   // 2. Flat array — adjacent tag/data slots. Optional
             *   //    trailing TAG_END=0 terminator is tolerated.
             *   amiga.makeTags([WA_Title, 'foo', WA_Width, 200])
             *   amiga.makeTags([WA_Title, 'foo', WA_Width, 200, 0, 0])
             *
             *   // 3. Variadic — adjacent tag/data args. The common case
             *   //    for hand-written code; no array punctuation.
             *   amiga.makeTags(WA_Title, 'foo', WA_Width, 200)
             *
             * Detection rule: if the first arg is not an array, every
             * arg is treated as a flat sequence. If the first arg IS
             * an array and its first element is itself an array, it's
             * pair-array mode; otherwise flat-array.
             */
            _normalizeTagInput(args) {
                if (args.length === 0) return [];

                /* Variadic form */
                if (!Array.isArray(args[0])) {
                    if (args.length & 1) {
                        throw new TypeError(
                            'amiga.makeTags: variadic call needs an even ' +
                            'number of args (pairs of tag, data)');
                    }
                    const out = [];
                    for (let i = 0; i + 1 < args.length; i += 2) {
                        if (args[i] === 0) break;   /* TAG_END */
                        out.push([args[i], args[i + 1]]);
                    }
                    return out;
                }

                /* args.length > 0 and first arg is an array.
                 * If that array's first element is itself an array →
                 * pair-array mode.  Otherwise flat-array mode. */
                const a = args[0];
                if (a.length === 0) return [];

                if (Array.isArray(a[0])) {
                    return a;   /* already pair-array */
                }

                if (a.length & 1) {
                    throw new TypeError(
                        'amiga.makeTags: flat array needs an even number ' +
                        'of elements (pairs of tag, data)');
                }

                const out = [];
                for (let i = 0; i + 1 < a.length; i += 2) {
                    if (a[i] === 0) break;   /* TAG_END terminator */
                    out.push([a[i], a[i + 1]]);
                }
                return out;
            },

            makeTags(...input) {
                const pairs = amiga._normalizeTagInput(input);
                return N.__qjs_amiga_makeTags(pairs);
            },

            /* ergonomic — allocates tags, runs fn(ptr), always frees. */
            withTags(...input) {
                /* Last arg must be the callback. */
                const fn = input.pop();
                if (typeof fn !== 'function') {
                    throw new TypeError(
                        'amiga.withTags: last argument must be a callback');
                }
                const pairs = amiga._normalizeTagInput(input);
                const ptr = N.__qjs_amiga_makeTags(pairs);
                if (!ptr) throw new Error('amiga.withTags: allocation failed');
                const size = (pairs.length + 1) * 8;
                try { return fn(ptr); }
                finally { amiga.freeMem(ptr, size); }
            },

            /* ---------- Truly universal (cross-library) TagItem terminators ---------- */
            TAG_DONE:   0,
            TAG_END:    0,
            TAG_IGNORE: 1,
            TAG_MORE:   2,
            TAG_SKIP:   3,
            TAG_USER:   0x80000000,

            /* ---------- Helpers for passing arrays to BOOPSI/Reaction ---------- */

            /**
             * Build a NULL-terminated STRPTR array suitable for tags like
             * RADIOBUTTON_Strings / CHOOSER_LabelArray. Returns
             * { ptr, free() } — call free() to release the strings + array.
             *
             * @param {string[]} arr
             * @returns {{ptr:number, free:Function}}
             */
            makeStringArray(arr) {
                if (!Array.isArray(arr)) {
                    throw new TypeError('amiga.makeStringArray: array required');
                }
                const strs = [];
                for (let s of arr) {
                    const b = (s == null ? '' : String(s)).length + 1;
                    const p = amiga.allocMem(b);
                    if (!p) {
                        for (let [sp, sb] of strs) amiga.freeMem(sp, sb);
                        throw new Error('makeStringArray: allocMem failed');
                    }
                    amiga.pokeString(p, String(s));
                    strs.push([p, b]);
                }
                const arrBytes = (arr.length + 1) * 4;
                const ptr = amiga.allocMem(arrBytes);
                if (!ptr) {
                    for (let [sp, sb] of strs) amiga.freeMem(sp, sb);
                    throw new Error('makeStringArray: allocMem failed');
                }
                for (let i = 0; i < arr.length; i++) {
                    amiga.poke32(ptr + i * 4, strs[i][0]);
                }
                amiga.poke32(ptr + arr.length * 4, 0);

                return {
                    ptr,
                    free() {
                        for (let [sp, sb] of strs) amiga.freeMem(sp, sb);
                        amiga.freeMem(ptr, arrBytes);
                    },
                };
            },

            /**
             * Ergonomic: allocate a STRPTR array, run fn(ptr), always free.
             *
             * @param {string[]} arr
             * @param {Function} fn
             */
            withStringArray(arr, fn) {
                const h = amiga.makeStringArray(arr);
                try { return fn(h.ptr); } finally { h.free(); }
            },

            /* NOTE on Reaction "Labels" lists (Chooser, ListBrowser,
             * SpeedBar, RadioButton via `labels`): each class library
             * provides its own AllocXXXNode() function (chooser_lib
             * AllocChooserNode, listbrowser_lib AllocListBrowserNode,
             * etc) plus a matching FreeXXXNode(). The node's tag list
             * is passed to the allocator, which returns a pre-wired
             * struct Node whose payload the class understands. We
             * don't synthesize those nodes here because the layout
             * varies per class and requires calling that class-
             * specific allocator. For the simpler STRPTR-array case
             * (RADIOBUTTON_Strings, CHOOSER_LabelArray on OS4+) use
             * amiga.makeStringArray above. */

            /* ======================================================
             * Per-library namespaces. Each holds:
             *   .lvo.*  — the library's jump-table offsets (NDK 3.2 FD)
             *   library-specific flags and tag constants
             * Q1 is data-only; Q2 will add wrapper methods like
             * `amiga.exec.allocMem(size, flags)` here as sugar over
             * `amiga.call(exec.base, exec.lvo.AllocMem, {...})`.
             * ====================================================== */

            /* ---------- exec ---------- */
            exec: {
                /* MemF_* flags for AllocMem/AllocVec */
                MEMF_ANY:        0x00000000,
                MEMF_PUBLIC:     0x00000001,
                MEMF_CHIP:       0x00000002,
                MEMF_FAST:       0x00000004,
                MEMF_LOCAL:      0x00000100,
                MEMF_24BITDMA:   0x00000200,
                MEMF_KICK:       0x00000400,
                MEMF_CLEAR:      0x00010000,
                MEMF_LARGEST:    0x00020000,
                MEMF_REVERSE:    0x00080000,
                MEMF_TOTAL:      0x00040000,
                MEMF_NO_EXPUNGE: 0x80000000,

                lvo: LVOS.exec,
            },

            /* ---------- dos ---------- */
            dos: {
                /* Mode flags for Open() */
                MODE_OLDFILE: 1005,
                MODE_NEWFILE: 1006,
                MODE_READWRITE: 1004,
                /* Seek origins */
                OFFSET_BEGINNING: -1,
                OFFSET_CURRENT:   0,
                OFFSET_END:       1,

                lvo: LVOS.dos,
            },

            /* ---------- intuition ---------- */
            intuition: {
                /* Window Attributes — WA_Dummy = TAG_USER + 99 = 0x80000063 */
                WA_Left:         0x80000064, WA_Top:           0x80000065,
                WA_Width:        0x80000066, WA_Height:        0x80000067,
                WA_DetailPen:    0x80000068, WA_BlockPen:      0x80000069,
                WA_IDCMP:        0x8000006A, WA_Flags:         0x8000006B,
                WA_Gadgets:      0x8000006C, WA_Checkmark:     0x8000006D,
                WA_Title:        0x8000006E, WA_ScreenTitle:   0x8000006F,
                WA_CustomScreen: 0x80000070, WA_MinWidth:      0x80000072,
                WA_MinHeight:    0x80000073, WA_MaxWidth:      0x80000074,
                WA_MaxHeight:    0x80000075, WA_PubScreenName: 0x80000078,
                WA_SimpleRefresh:0x80000079, WA_SmartRefresh:  0x8000007A,
                WA_BackFill:     0x8000007F, WA_AutoAdjust:    0x80000083,

                /* Screen Attributes — SA_Dummy = TAG_USER + 32 = 0x80000020 */
                SA_Left:    0x80000021, SA_Top:     0x80000022,
                SA_Width:   0x80000023, SA_Height:  0x80000024,
                SA_Depth:   0x80000025, SA_DetailPen: 0x80000026,
                SA_BlockPen:0x80000027, SA_Title:   0x80000028,
                SA_Colors:  0x80000029, SA_ErrorCode: 0x8000002A,
                SA_Font:    0x8000002B, SA_SysFont: 0x8000002C,
                SA_Type:    0x8000002D, SA_BitMap:  0x8000002E,
                SA_PubName: 0x8000002F, SA_PubSig:  0x80000030,
                SA_PubTask: 0x80000031, SA_DisplayID: 0x80000032,

                /* IDCMP flags (WA_IDCMP values) */
                IDCMP_SIZEVERIFY:    0x00000001,
                IDCMP_NEWSIZE:       0x00000002,
                IDCMP_REFRESHWINDOW: 0x00000004,
                IDCMP_MOUSEBUTTONS:  0x00000008,
                IDCMP_MOUSEMOVE:     0x00000010,
                IDCMP_GADGETDOWN:    0x00000020,
                IDCMP_GADGETUP:      0x00000040,
                IDCMP_MENUPICK:      0x00000100,
                IDCMP_CLOSEWINDOW:   0x00000200,
                IDCMP_RAWKEY:        0x00000400,
                IDCMP_VANILLAKEY:    0x00200000,

                /* Window flags (WA_Flags value) */
                WFLG_SIZEGADGET:    0x00000001,
                WFLG_DRAGBAR:       0x00000002,
                WFLG_DEPTHGADGET:   0x00000004,
                WFLG_CLOSEGADGET:   0x00000008,
                WFLG_SIZEBRIGHT:    0x00000010,
                WFLG_SIZEBBOTTOM:   0x00000020,
                WFLG_BACKDROP:      0x00000100,
                WFLG_REPORTMOUSE:   0x00000200,
                WFLG_GIMMEZEROZERO: 0x00000400,
                WFLG_BORDERLESS:    0x00000800,
                WFLG_ACTIVATE:      0x00001000,

                lvo: LVOS.intuition,
            },

            /* ---------- graphics ---------- */
            graphics: {
                /* Draw modes */
                JAM1:    0x00,
                JAM2:    0x01,
                COMPLEMENT: 0x02,
                INVERSVID:  0x04,

                lvo: LVOS.graphics,
            },

            /* ---------- gadtools ---------- */
            gadtools: {
                /* GadTools tag constants */
                GT_Underscore: 0x80000036,
                GTCB_Checked:  0x800000B4, GTLV_Selected: 0x80000068,
                GTST_String:   0x80000140, GTIN_Number:   0x80000180,

                /* gadget kinds */
                GENERIC_KIND:  0, BUTTON_KIND: 1, CHECKBOX_KIND: 2,
                INTEGER_KIND:  3, LISTVIEW_KIND: 4, MX_KIND: 5,
                NUMBER_KIND:   6, CYCLE_KIND: 7, PALETTE_KIND: 8,
                SCROLLER_KIND: 9, SLIDER_KIND: 11, STRING_KIND: 12,
                TEXT_KIND:    13,

                lvo: LVOS.gadtools,
            },
        };

        globalThis.amiga = amiga;

        /* Auto-attach .lvo for every library in the generated LVOS table.
         * Hand-structured namespaces (exec, dos, intuition, graphics, gadtools)
         * already had their .lvo set via LVOS.<name> above; this loop only
         * adds .lvo for the other 71 libraries. Users call them like
         *   amiga.timer.lvo.GetSysTime  or  amiga.utility.lvo.GetTagData
         * with `amiga.call`. Library-specific constants can be added by
         * future commits under the same namespace without conflict. */
        for (const libName in LVOS) {
            if (!amiga[libName]) amiga[libName] = {};
            if (!amiga[libName].lvo) amiga[libName].lvo = LVOS[libName];
        }

        /* Extend require() to resolve 'amiga' and 'node:amiga'. */
        if (typeof globalThis.require === 'function') {
            const origRequire = globalThis.require;
            globalThis.require = function (id) {
                const n = typeof id === 'string' && id.startsWith('node:') ? id.substring(5) : id;
                if (n === 'amiga') return amiga;
                return origRequire(id);
            };
            globalThis.require.resolve = origRequire.resolve;
            globalThis.require.cache = origRequire.cache;
            globalThis.require.extensions = origRequire.extensions;
        }
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
