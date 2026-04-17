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

        globalThis.util = {
            format, inspect, promisify, callbackify, types,
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
            access(path) {
                return new Promise((resolve, reject) => {
                    const [, err] = os.stat(path);
                    if (err) reject(pError('ENOENT', path));
                    else resolve(undefined);
                });
            },
        };

        globalThis.fs = globalThis.fs || {};
        globalThis.fs.promises = fsp;
        globalThis.fsPromises = fsp;
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
