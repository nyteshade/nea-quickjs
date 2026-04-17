# Open issue: AmiSSL `OpenAmiSSLTags` fails from main task

## Summary

`OpenAmiSSLTags(AMISSL_CURRENT_VERSION, ...)` returns non-zero when
called from the qjs CLI's main task, using the same tag set that
works fine from a `QJS_Worker`-spawned task in `sharedlib_fetch.c`.

## Symptom

Crypto digest via the native `__qjs_cryptoDigest` path fails with
`InternalError: digest: AmiSSL open/compute failed` on Amigas with
AmiSSL installed (fetch HTTPS works in the same session, so the
install is healthy).

Not blocking users since 0.094 — pure-JS fallback covers
SHA-1/256/MD5 unconditionally.

## What we've tried

| Version | Tag set | Result |
|---|---|---|
| 0.091 | `UsesOpenSSLStructs, GetAmiSSLBase` | `AN_IntrMem $81000005` crash |
| 0.092 | + `AmiSSL_ErrNoPtr=&errno` | no crash, `OpenAmiSSLTags` returns non-zero |
| 0.093 | + `GetAmiSSLExtBase`, `SocketBase`, bsdsocket open | same failure |

The 0.093 tag set is byte-identical to `amiga_ssl_init()` in
`library/vbcc/amiga_ssl_lib.c` — which is called successfully from
every fetch worker task. Whatever is different between main task
and fresh worker task defeats the open.

## Hypotheses (untested)

1. **`AMISSL_CURRENT_VERSION` enum mismatch.** SDK v5.26 defines
   `AMISSL_V361` as the current version. User's installed AmiSSL
   might be older. But fetch works with the same enum, so this
   would also break fetch — contradicted.
2. **Main-task state mismatch.** Fresh worker tasks have clean
   `tc_UserData`; main task doesn't. AmiSSL may be allergic to
   some main-task state.
3. **Reentrant OpenAmiSSLTags from within library code.** Our
   LVO runs in caller's task context but the code executes inside
   the library's address space. AmiSSL's init may have expectations
   about caller code region that we violate.
4. **Stack depth.** AmiSSL init may need more than 64KB. Fetch
   workers allocate their own stack (likely larger); main task is
   bound by `stack 65536`.

## Diagnostic plan (future session)

1. Instrument `crypto_ensure_ssl()` to log each step to
   `T:qjs-crypto-trace.txt`. Identify which open returns failure.
2. If it's `OpenAmiSSLTags`: print the return code value — different
   non-zero values might hint at which tag is rejected.
3. Compare `tc_UserData`, stack size, and task priority between
   main task and a fetch worker at the moment of the open call.
4. Try `AmiSSL_InitAmiSSL` tag (tag 0x10 in `amissl/tags.h`) — role
   unclear from headers.
5. Try calling from within a freshly-spawned `QJS_Worker` even on
   the CLI-main invocation path, to isolate whether the failure is
   task-related vs. library-code-related.

## Related

- Fina: decision `decision:m7b3ldkjxrslb2pairjz` — pivoted to
  pure-JS primary, AmiSSL optional
- Commit: `d06ab6d` (0.094 — pivot landed)
- Tagged in Fina: `open-issue,crypto,amissl,in-progress`
