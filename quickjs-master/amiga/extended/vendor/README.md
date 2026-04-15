# Vendored dependencies

Libraries vendored into the nea-quickjs Amiga port.  Each library
retains its upstream LICENSE and a copy of its package.json (renamed
to `UPSTREAM-package.json` so our build tools don't mistake it for our
own package.json).

Do **not** edit files here directly — if a fix is needed, fix it
upstream first and re-vendor.  See `refresh.sh` for the sync
procedure.

## Catalogue

### ne-enumeration (@nejs/enumeration)
- Upstream: https://github.com/nyteshade/ne-enumeration
- Local source of truth: /Volumes/Code/JavaScript/ne-enumeration
- Exposed in the port as: `qjs:modules` (provides the `Tiers` and
  `Providers` enum classes built on top of `Enumeration`)
- Compat verified: amiga/tests/host/compat_ne_enumeration.mjs

### ne-extension (@nejs/extension)
- Upstream: https://github.com/nyteshade/ne-extension
- Local source of truth: /Volumes/Code/JavaScript/ne-extension
- Exposed in the port as: `qjs:extension` (re-exports Extension,
  Patch, PatchToggle, PatchEntry, SemVer, Errors)
- Compat verified: amiga/tests/host/compat_ne_extension.mjs

## Planned (future)

### ne-basic-extensions (@nejs/basic-extensions)
Deferred pending upstream review.  Will live in
`vendor/ne-basic-extensions/` when adopted, exposed as
`qjs:basic-extensions` (opt-in via explicit import + apply()).
