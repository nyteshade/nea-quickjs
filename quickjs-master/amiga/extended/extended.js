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
    description: 'Node.js process global — argv, env, exit, platform, cwd, hrtime, nextTick',
    globals:     ['process'],
    standard:    false,
    install() {
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
            cwd()      { return os.getcwd(); },
            chdir(path) {
                const [, err] = os.chdir(path);
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
        };
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
                        this._list.push([_pctDecode(name.replace(/\+/g, ' ')),
                                         _pctDecode(value.replace(/\+/g, ' '))]);
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
                    _pctEncode(k, unreserved).replace(/%20/g, '+') + '=' +
                    _pctEncode(v, unreserved).replace(/%20/g, '+')
                ).join('&');
            }
            _notify() { if (this._url) this._url._syncSearchFromParams(); }
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
                this._params._url = this;
            }

            static _parse(str, base) {
                str = str.trim();
                const o = { scheme: '', username: '', password: '', host: '',
                            port: '', path: '', query: '', fragment: '' };
                let s = str;

                const m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):(.*)$/.exec(s);
                if (m) { o.scheme = m[1].toLowerCase(); s = m[2]; }
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
                    const pathIdx = s.search(/[/?#]/);
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
                this._params._url = this;
            }

            get protocol() { return this._scheme + ':'; }
            set protocol(v) { this._scheme = String(v).replace(/:$/, '').toLowerCase(); }
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
                this._params._url = this;
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
