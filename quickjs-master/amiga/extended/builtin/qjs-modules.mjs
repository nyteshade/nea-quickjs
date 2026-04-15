/*
 * qjs:modules -- nea-quickjs plugin-system SDK
 *
 * Exports:
 *   Tiers     -- Enumeration of plugin execution tiers
 *   Providers -- Enumeration of feature provenance
 *   Manifest  -- Declarative + active feature manifest class
 *   ModuleRegistry -- runtime registry of installed features
 *
 * All plugin modules (built-in and third-party) import from here.
 */

import Enumeration from '../vendor/ne-enumeration/enumeration.mjs';
import { Extension, Patch, SemVer }
    from '../vendor/ne-extension/index.js';

/* =======================================================
 * Tiers -- classification of plugin implementation style
 * ======================================================= */
export class Tiers extends Enumeration {
    static {
        /**
         * Feature is implemented entirely in JavaScript.  Shipped as
         * bytecode or as a .js file in LIBS:quickjs/modules/.  No
         * native code required.  Examples: URL, path, TextEncoder.
         */
        Tiers.define('pureJS', 'pure-js');

        /**
         * Feature has a JavaScript-facing surface backed by native C
         * code (either in quickjs.library or a future qjs-*.library
         * plugin).  Examples: fetch (worker process), crypto.subtle
         * (AmiSSL), Response/Headers (C classes).
         */
        Tiers.define('bridge', 'bridge');

        /**
         * Feature is baked into quickjs.library itself and always
         * available.  Examples: the std, os, bjson modules; print;
         * console.log; Symbol.for('qjs.inspect').
         */
        Tiers.define('libraryCore', 'library-core');
    }
}

/* =======================================================
 * Providers -- feature provenance
 * ======================================================= */
export class Providers extends Enumeration {
    static {
        /** Stock quickjs-ng, unmodified upstream. */
        Providers.define('upstream', 'upstream');

        /** Added by the nea-quickjs Amiga port. */
        Providers.define('neaPort', 'nea-port');

        /** Third-party plugin (LIBS:quickjs/modules/ or qjs-*.library). */
        Providers.define('thirdParty', 'third-party');
    }
}

/* =======================================================
 * Manifest -- a feature's identity + activation logic
 * ======================================================= */
export class Manifest {
    /**
     * @param {object} opts
     * @param {string} opts.name            unique feature id
     * @param {Tiers|string} opts.tier      pureJS / bridge / libraryCore
     * @param {Providers|string} opts.provider  upstream / neaPort / thirdParty
     * @param {SemVer|string} [opts.version]    defaults to '1.0.0'
     * @param {string}    [opts.description]    human summary
     * @param {string[]}  [opts.requires]       names of prerequisite modules
     * @param {string[]}  [opts.exports]        names exported (for introspection)
     * @param {string[]}  [opts.globals]        names added to globalThis
     * @param {boolean}   [opts.standard]       part of a web/Node standard?
     * @param {Extension|Patch|object} [opts.extension]
     *                                      something with .apply()/.revert(),
     *                                      typically Extension.createSet() or
     *                                      a single Extension/Patch
     * @param {function}  [opts.install]      optional post-apply hook(manifest)
     * @param {function}  [opts.uninstall]    optional pre-revert hook(manifest)
     */
    constructor(opts) {
        if (!opts || typeof opts !== 'object') {
            throw new TypeError('Manifest requires an options object');
        }
        if (!opts.name || typeof opts.name !== 'string') {
            throw new TypeError('Manifest.name is required');
        }

        this.name        = opts.name;
        this.tier        = Manifest._coerceEnum(opts.tier, Tiers,
                                                'Manifest.tier');
        this.provider    = Manifest._coerceEnum(opts.provider, Providers,
                                                'Manifest.provider');
        this.version     = Manifest._coerceSemVer(opts.version);
        this.description = opts.description ?? '';
        this.requires    = Array.isArray(opts.requires)
                             ? opts.requires.slice() : [];
        this.exports     = Array.isArray(opts.exports)
                             ? opts.exports.slice() : [];
        this.globals     = Array.isArray(opts.globals)
                             ? opts.globals.slice() : [];
        this.standard    = opts.standard === true;

        this._extension  = opts.extension ?? null;
        this._install    = typeof opts.install   === 'function' ? opts.install   : null;
        this._uninstall  = typeof opts.uninstall === 'function' ? opts.uninstall : null;

        this._applied    = false;
    }

    /** true iff apply() has been called (and not yet revert()'d). */
    get applied() { return this._applied; }

    /** The raw extension/patch object (for advanced introspection). */
    get extension() { return this._extension; }

    /**
     * Install this feature.  Idempotent -- calling twice is a no-op
     * after the first.
     */
    apply() {
        if (this._applied) return this;
        if (this._extension && typeof this._extension.apply === 'function') {
            this._extension.apply();
        }
        if (this._install) this._install(this);
        this._applied = true;
        return this;
    }

    /** Uninstall this feature.  Idempotent. */
    revert() {
        if (!this._applied) return this;
        if (this._uninstall) this._uninstall(this);
        if (this._extension && typeof this._extension.revert === 'function') {
            this._extension.revert();
        }
        this._applied = false;
        return this;
    }

    /** Serialize for introspection (qjs.modules.list()). */
    toJSON() {
        return {
            name:        this.name,
            tier:        this.tier.value,
            provider:    this.provider.value,
            version:     this.version.toString ? this.version.toString()
                                                : String(this.version),
            description: this.description,
            requires:    this.requires,
            exports:     this.exports,
            globals:     this.globals,
            standard:    this.standard,
            applied:     this._applied,
        };
    }

    /* ---------- internal helpers ---------- */

    static _coerceEnum(value, Cls, label) {
        if (value instanceof Cls) return value;
        if (typeof value === 'string') {
            for (const inst of Cls.values()) {
                if (inst.value === value || inst.key === value) return inst;
            }
        }
        throw new TypeError(
            `${label}: expected ${Cls.name} instance or matching value/key, got ${value}`);
    }

    static _coerceSemVer(value) {
        if (!value) return new SemVer('1.0.0');
        if (value instanceof SemVer) return value;
        if (typeof value === 'string') {
            try { return new SemVer(value); }
            catch (e) {
                const ext = SemVer.from(value);
                if (ext && ext.semVer) {
                    return new SemVer(`${ext.semVer.major}.${ext.semVer.minor}.${ext.semVer.patch}`);
                }
                throw e;
            }
        }
        return value;   /* pass through unknown types */
    }
}

/* =======================================================
 * ModuleRegistry -- runtime bookkeeping of installed features
 *
 * One singleton per runtime, stashed on globalThis.qjs.modules.
 * Loader eagerly adds built-ins + scanned plugins here.
 * ======================================================= */
export class ModuleRegistry {
    constructor() {
        this._map = new Map();   /* name -> Manifest */
    }

    /** Register a Manifest (and optionally apply() it). */
    register(manifest, { apply = true } = {}) {
        if (!(manifest instanceof Manifest)) {
            throw new TypeError('register requires a Manifest');
        }
        if (this._map.has(manifest.name)) {
            throw new Error(`module already registered: ${manifest.name}`);
        }
        /* Dependency check (names only for v1) */
        for (const req of manifest.requires) {
            if (!this._map.has(req)) {
                throw new Error(`module '${manifest.name}' requires '${req}' (not registered)`);
            }
        }
        this._map.set(manifest.name, manifest);
        if (apply) manifest.apply();
        return manifest;
    }

    /** Unregister (reverting first if applied). */
    unregister(name) {
        const m = this._map.get(name);
        if (!m) return false;
        if (m.applied) m.revert();
        this._map.delete(name);
        return true;
    }

    /** Array of manifests (useful for iteration / JSON.stringify). */
    list() {
        return [...this._map.values()];
    }

    /** Manifest by name, or undefined. */
    get(name) { return this._map.get(name); }

    /** true iff name is registered. */
    has(name) { return this._map.has(name); }

    /** Re-run apply() for all registered manifests (e.g. after a mass revert). */
    applyAll() {
        for (const m of this._map.values()) m.apply();
    }

    /** Reverse of applyAll. */
    revertAll() {
        for (const m of [...this._map.values()].reverse()) m.revert();
    }
}

/* =======================================================
 * Re-export the Enumeration + ne-extension foundations so
 * plugin authors can `import { Extension, SemVer } from
 * 'qjs:modules'` without reaching for the individual vendor
 * modules.
 * ======================================================= */
export { Extension, Patch, SemVer };
export { Enumeration };
