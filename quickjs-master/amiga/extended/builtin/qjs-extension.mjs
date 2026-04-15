/*
 * qjs:extension -- re-exports of @nejs/extension primitives
 *
 * Use this when you want the low-level Extension/Patch/PatchToggle
 * classes without also pulling in the Tiers/Providers/Manifest/
 * ModuleRegistry machinery from qjs:modules.
 *
 * Plugin authors typically want qjs:modules (which already re-exports
 * the common primitives).  qjs:extension is here for advanced use or
 * when you just need the primitive surface.
 */

export { Extension, Patch, PatchEntry, PatchToggle, SemVer, Errors }
    from '../vendor/ne-extension/index.js';
