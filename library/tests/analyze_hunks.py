#!/usr/bin/env python3
"""
analyze_hunks.py — Analyze AmigaOS hunk binary for relocation table sizes.
Checks if any HUNK_RELOC32 group exceeds the 65536-entry LoadSeg limit.
"""
import struct
import sys

HUNK_HEADER      = 0x3F3
HUNK_CODE        = 0x3E9
HUNK_DATA        = 0x3EA
HUNK_BSS         = 0x3EB
HUNK_RELOC32     = 0x3EC
HUNK_RELOC32SHORT= 0x3FC
HUNK_SYMBOL      = 0x3F0
HUNK_DEBUG       = 0x3F1
HUNK_END         = 0x3F2
HUNK_OVERLAY     = 0x3F5
HUNK_NAME        = 0x3E8

HUNK_NAMES = {
    HUNK_HEADER: "HUNK_HEADER",
    HUNK_CODE: "HUNK_CODE",
    HUNK_DATA: "HUNK_DATA",
    HUNK_BSS: "HUNK_BSS",
    HUNK_RELOC32: "HUNK_RELOC32",
    HUNK_RELOC32SHORT: "HUNK_RELOC32SHORT",
    HUNK_SYMBOL: "HUNK_SYMBOL",
    HUNK_DEBUG: "HUNK_DEBUG",
    HUNK_END: "HUNK_END",
    HUNK_OVERLAY: "HUNK_OVERLAY",
    HUNK_NAME: "HUNK_NAME",
}

def read32(f):
    d = f.read(4)
    if len(d) < 4:
        return None
    return struct.unpack(">I", d)[0]

def analyze(filename):
    with open(filename, "rb") as f:
        magic = read32(f)
        if magic != HUNK_HEADER:
            print(f"Not a hunk file (magic=0x{magic:08x})")
            return

        print(f"=== Analyzing {filename} ===\n")

        # Parse HUNK_HEADER
        res_libs = read32(f)  # should be 0
        tsize = read32(f)
        tnum = read32(f)
        tmax = read32(f)
        num_hunks = tmax - tnum + 1
        print(f"HUNK_HEADER: {num_hunks} segments (tnum={tnum}, tmax={tmax})")

        # Read segment sizes
        sizes = []
        for i in range(num_hunks):
            s = read32(f)
            memtype = (s >> 30) & 3
            size_longs = s & 0x3FFFFFFF
            if memtype == 3:
                extra = read32(f)
            sizes.append(size_longs * 4)
            print(f"  Segment {i}: {size_longs*4} bytes (memtype={memtype})")

        print()

        # Parse hunks
        seg_idx = 0
        total_relocs = 0
        max_reloc_group = 0
        reloc_issues = []

        while True:
            htype = read32(f)
            if htype is None:
                break

            # Mask out memory type bits and advisory flag
            htype_clean = htype & 0x1FFFFFFF

            name = HUNK_NAMES.get(htype_clean, f"UNKNOWN(0x{htype_clean:x})")

            if htype_clean == HUNK_CODE or htype_clean == HUNK_DATA:
                length = read32(f)
                data_bytes = length * 4
                f.read(data_bytes)  # skip payload
                print(f"  [{seg_idx}] {name}: {data_bytes} bytes")

            elif htype_clean == HUNK_BSS:
                length = read32(f)
                print(f"  [{seg_idx}] {name}: {length*4} bytes")

            elif htype_clean == HUNK_RELOC32:
                groups = 0
                total_in_hunk = 0
                while True:
                    count = read32(f)
                    if count is None or count == 0:
                        break
                    target = read32(f)
                    # Skip the offsets
                    for _ in range(count):
                        read32(f)
                    groups += 1
                    total_in_hunk += count
                    total_relocs += count

                    if count > max_reloc_group:
                        max_reloc_group = count

                    if count > 65536:
                        reloc_issues.append((seg_idx, target, count))
                        flag = " *** EXCEEDS 65536 LIMIT! ***"
                    elif count > 50000:
                        flag = " ** NEAR LIMIT **"
                    else:
                        flag = ""

                    print(f"  [{seg_idx}] {name}: {count} entries -> hunk {target}{flag}")

                if groups > 1:
                    print(f"           ({groups} groups, {total_in_hunk} total in this reloc hunk)")

            elif htype_clean == HUNK_RELOC32SHORT:
                groups = 0
                total_in_hunk = 0
                while True:
                    d = f.read(2)
                    if len(d) < 2:
                        break
                    count = struct.unpack(">H", d)[0]
                    if count == 0:
                        break
                    d = f.read(2)
                    target = struct.unpack(">H", d)[0]
                    for _ in range(count):
                        f.read(2)
                    groups += 1
                    total_in_hunk += count
                    total_relocs += count
                    print(f"  [{seg_idx}] HUNK_RELOC32SHORT: {count} entries -> hunk {target}")
                # Align to longword
                # padding handled by format

            elif htype_clean == HUNK_SYMBOL:
                while True:
                    nlen = read32(f)
                    if nlen is None or nlen == 0:
                        break
                    f.read(nlen * 4)  # symbol name
                    read32(f)  # symbol value

            elif htype_clean == HUNK_DEBUG:
                length = read32(f)
                f.read(length * 4)

            elif htype_clean == HUNK_END:
                seg_idx += 1

            elif htype_clean == HUNK_NAME:
                length = read32(f)
                f.read(length * 4)

            else:
                print(f"  Unknown hunk type 0x{htype_clean:x}, stopping")
                break

        print(f"\n=== Summary ===")
        print(f"Total relocation entries: {total_relocs}")
        print(f"Largest single group: {max_reloc_group}")
        if reloc_issues:
            print(f"\n*** PROBLEM: {len(reloc_issues)} relocation group(s) exceed the 65536 LoadSeg limit! ***")
            for seg, tgt, cnt in reloc_issues:
                print(f"    Segment {seg} -> Hunk {tgt}: {cnt} entries")
            print(f"\nThis WILL cause LoadSeg to corrupt the binary on Kickstart 2.0+.")
            print(f"Fix: split relocations or reduce absolute data references.")
        else:
            print(f"All relocation groups are within the 65536 LoadSeg limit.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <hunkfile>")
        sys.exit(1)
    analyze(sys.argv[1])
