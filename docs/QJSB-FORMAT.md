# The .qjsb file format

`.qjsb` is "QuickJS bytecode": a container of named, precompiled
JavaScript that `quickjs.library` reads one entry at a time.

Since 0.240 the JavaScript delivered with the library is not part of
the library image. It lives beside it, the same three files for all six
CPU variants:

    LIBS:quickjs.library              engine, regex, Unicode, numbers, std/os, native FFI glue
    LIBS:quickjs/extended.qjsb        the extended features (URL, Buffer, fetch wrappers, process, ...)
    LIBS:quickjs/amiga.qjsb           the Exec/DOS/Intuition/Graphics wrappers
    LIBS:quickjs/reaction.qjsb        the BOOPSI and Reaction classes
    LIBS:quickjs/<name>.qjsb          add-ons (docs/ADDONS.md)

The implementations are `scripts/qjsb_format.py` (writes, reads,
verifies) and `library/vbcc/qjsb_format.h` + `qjsb_loader.c` (reads).
They must agree with this document.

## Layout

Every number is big-endian.

    offset  size  field
    ------  ----  -----------------------------------------------------
    header, 128 bytes
       0     4    magic, the characters "QJSB"
       4     2    container format version: 1
       6     2    flags; bit 0 = EXACT (see "Versions")
       8     2    bytecode version: the engine's BC_VERSION
      10     2    library version, as LIBRARY_VERSION (240 means 0.240)
      12     4    engine stamp (see "Versions")
      16     2    number of entries
      18     2    reserved, zero
      20     4    index size in bytes
      24     4    size of the whole file in bytes
      28     4    check of header and index (see "Checks")
      32    96    version text: "$VER: extended.qjsb 0.240 (14.11.2026)",
                  padded with zero bytes; at least one zero byte ends it
    index, starting at 128: one record per entry, in file order
       0     4    offset of the blob from the start of the file
       4     4    length of the blob in bytes
       8     4    check of the blob
      12     1    kind: 0 = classic script, 1 = ES module
      13     1    length of the name, n (1..255)
      14     n    the name, ASCII, not terminated
              0/1 one zero byte if n is odd, so records start on even offsets
    blobs
                  each at a multiple of four, zero-padded to the next;
                  a blob is what `qjsc -b` writes (JS_WriteObject bytecode)

A name is whatever the reader asks for: a feature's name
(`url`, `buffer`, `@registry`) in `extended.qjsb`, `core` in
`amiga.qjsb`, `boopsi` in `reaction.qjsb`, and for add-on modules the
part of the import specifier after the colon (`fs` for `node:fs`), or
`@main` for the module `qjs:<add-on>`.

## Reading one entry

The format is laid out so that loading costs as few disk operations as
it can; on a real disk each of them is slow.

1. `Open` the file.
2. `Read` 2048 bytes: the header and, for up to about a hundred entries,
   the whole index. (A longer index takes one more `Read`, which follows
   on without a seek.)
3. For each entry wanted: `Seek` to its offset, `Read` exactly its
   length.
4. `Close`.

Nothing is kept open or cached between loads, so there is nothing to
clean up when a context ends and a file can be replaced while a program
runs. When several entries of one file are wanted at once (a feature
and the features it requires), the library opens the file once for all
of them.

Measured under vamos (`python3 scripts/check_qjsb.py`), DOS calls on
`.qjsb` files for the first use of a name:

    script                 Open  Read  Seek
    (uses none of it)        0     0     0
    typeof URL               1     3     2     url + text-encoding
    typeof Intuition         2     4     2     amiga-ffi feature + core wrappers
    typeof amiga.boopsi      3     6     3     the above + Reaction classes

Starting `qjs` opens no `.qjsb` file. The names the files provide
(`URL`, `Intuition`, ...) are registered from tables inside the library;
the code that turns the first use of a name into a load (two small
bytecode blobs, 5.5 KB and 0.8 KB) is in the library too.

## Versions

A file carries its version twice: once for the loader and once for
people.

### What the loader compares (binary fields)

Serialised bytecode refers to the engine's built-in atoms and to its
opcodes by number, so it is only valid for an engine with the same atom
and opcode lists. The loader therefore refuses a file unless

- the **format version** is one it reads (1);
- the **bytecode version** equals the engine's `BC_VERSION`;
- the **engine stamp** equals its own. The stamp is the CRC-32 of
  `quickjs-atom.h` and `quickjs-opcode.h` with comments and white space
  removed (`engine_stamp()` in `scripts/qjsb_format.py`);
- the **library version** fits:
  - with the EXACT flag, it must equal this library's version. The
    library's own three files have the flag: their JavaScript and the
    library's C are two halves of one thing.
  - without it, it is the oldest library version that may load the
    file. Add-ons are built this way, so an add-on keeps working across
    library updates that do not change the bytecode format, and stops
    with a clear message when one does.

The library gets its side of the comparison from
`quickjs-master/gen/qjsb_stamp.h`, which `scripts/qjsb.py` writes from
the same sources as the files.

A refused file is a JavaScript error that names the file and both
versions, for example:

    LIBS:quickjs/extended.qjsb was built for quickjs.library 0.238
    (bytecode 24.43b07bf5) but this is quickjs.library 0.239 (bytecode
    24.43b07bf5); install the .qjsb files that belong to this library

    T:qjsbtest/tooNew.qjsb needs quickjs.library 0.999 or newer but
    this is quickjs.library 0.239

### What people read (the `$VER:` text)

Bytes 32..127 hold a standard AmigaDOS version string, in the style of
the library's own:

    $VER: extended.qjsb 0.240 (14.11.2026)

so that

    version file LIBS:quickjs/extended.qjsb
    version LIBS:quickjs/extended.qjsb full

print the name, version and date, to be compared with
`version file LIBS:quickjs.library` and with `qjs -v`, which lists the
library and every `.qjsb` file it finds (in the directory `QJSB_DIR`
names, if set, and in `LIBS:quickjs`), marking a file the loaded
library will refuse:

    qjs 0.240 (14.11.2026), QuickJS-ng 0.12.1
    quickjs.020soft.library 0.240 (14.11.2026)
    LIBS:quickjs/amiga.qjsb: amiga.qjsb 0.240 (14.11.2026)
    LIBS:quickjs/reaction.qjsb: reaction.qjsb 0.240 (14.11.2026)
    LIBS:quickjs/extended.qjsb: extended.qjsb 0.239 (13.11.2026) - NOT for this library: only for 0.239

Only `qjs -v` opens the files for this; an ordinary start does not.
`python3 scripts/qjsb.py list <file>` prints the same string on the Mac.

For the library's three files the version and date are read from
`LIBRARY_VERSION_STRING` in `library/vbcc/libraryconfig.h`, the one
place a release's number is written; `LIBRARY_VERSION` in the same file
gives the binary field, and the tool stops if the two disagree. For an
add-on they are given on the tool's command line.

The text is not what the loader trusts: it compares the binary fields.
The text is covered by the header's check, though, so a file whose text
was edited in place is reported as damaged.

Where the string sits: `C:Version` finds a version string by searching
the file for the characters `$VER:`. Here they are at offset 32, in the
first disk block, ahead of anything else that could contain them. *Not
verified:* whether `C:Version` limits how far into a file it searches;
the manuals at hand did not say, and it has not been run on an Amiga
against these files. At offset 32 a limit would not matter.

## Checks

A check is a 32-bit sum over a run of bytes taken as big-endian 32-bit
words, the last word padded with zero bytes: for each word, rotate the
sum left by one bit, then add the word (modulo 2^32). It starts at zero.

- The header's check covers the 128 header bytes, with the check field
  itself taken as zero, and the index.
- Each index record holds the check of its blob.

The engine does not validate bytecode; a damaged blob can crash it. So
the loader checks the index before using it and each blob before
handing it to the engine, and bounds every offset against the file
size. A file that is cut off, overwritten or corrupted on disk is
reported ("... is damaged: 'url' fails its check"), not executed. The
check costs a 68020 about one instruction per byte.

## Where the files are looked for

1. The directory named by the **local** shell variable `QJSB_DIR`, if it
   is set and has the file: `set QJSB_DIR Work:dev/quickjs` in the shell
   that starts the program. (Local only: a global variable would mean
   opening a file in `ENV:` for every load. `std.setenv()` sets a local
   variable.)
2. `LIBS:quickjs/`.

A file found in the first directory is used even if it turns out to be
the wrong version: the error says so, the second directory is not tried
instead.

## When a file is missing or refused

Nothing crashes and nothing is half-loaded. The use of the name that
needed the file throws an `Error`; a script can catch it:

    'url' needs LIBS:quickjs/extended.qjsb, which is missing: copy the
    'quickjs' drawer that comes with quickjs.library into LIBS:

The name stays as it was, so once the file is there the same name
works, in the same program. Scripts that use none of the bundled
JavaScript run with no `LIBS:quickjs` directory at all.

## Tools

    python3 scripts/bundle_extended.py      compile the extended features (needs the host qjsc)
    python3 scripts/bundle_ffi.py           compile the FFI wrappers (needs the host qjsc)
    python3 scripts/qjsb.py core            pack amiga/libs/quickjs/*.qjsb and write gen/qjsb_stamp.h
    make -C library/vbcc qjsb               the same packing, plus the test add-on
    python3 scripts/qjsb.py list FILE       header, version string and index of a file
    python3 scripts/qjsb.py verify FILE...  every check, and that the file fits this tree
    python3 scripts/qjsb.py compile ...     build an add-on (docs/ADDONS.md)
    python3 scripts/check_qjsb.py           the checks above, under vamos

Every library build (`make -C library/vbcc variants`) packs the files
again when `libraryconfig.h` or the engine's atom or opcode list has
changed; that step needs python3 but not qjsc. The bundlers are run by
hand after the JavaScript sources change, as before.

Tests: `amiga/tests/test_qjsb.js` (runs on the Amiga and under vamos)
and `scripts/check_qjsb.py` (Mac).
