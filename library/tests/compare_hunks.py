#!/usr/bin/env python3
"""
compare_hunks.py — Compare two AmigaOS hunk binaries at the byte level.

Loads both binaries, applies relocations as LoadSeg would (assuming
base address 0 for each hunk), and compares the resulting code/data
segments. Reports any differences.

This helps diagnose why the same .o files produce different runtime
behavior when linked as an executable vs a library.
"""
import struct
import sys

HUNK_HEADER      = 0x3F3
HUNK_CODE        = 0x3E9
HUNK_DATA        = 0x3EA
HUNK_BSS         = 0x3EB
HUNK_RELOC32     = 0x3EC
HUNK_SYMBOL      = 0x3F0
HUNK_DEBUG       = 0x3F1
HUNK_END         = 0x3F2

def read32(f):
    d = f.read(4)
    if len(d) < 4:
        return None
    return struct.unpack(">I", d)[0]

def load_hunks(filename):
    """Load a hunk file, return list of (type, data, relocs) tuples."""
    segments = []

    with open(filename, "rb") as f:
        magic = read32(f)
        assert magic == HUNK_HEADER, f"Not a hunk file: {filename}"

        res_libs = read32(f)
        tsize = read32(f)
        tnum = read32(f)
        tmax = read32(f)
        num_hunks = tmax - tnum + 1

        sizes = []
        for i in range(num_hunks):
            s = read32(f)
            memtype = (s >> 30) & 3
            size_longs = s & 0x3FFFFFFF
            if memtype == 3:
                read32(f)
            sizes.append(size_longs * 4)

        # Initialize segments
        for i in range(num_hunks):
            segments.append({
                'type': None,
                'data': bytearray(sizes[i]),
                'size': sizes[i],
                'relocs': {},  # target_hunk -> [offset, ...]
            })

        seg_idx = 0
        while True:
            htype = read32(f)
            if htype is None:
                break
            htype_clean = htype & 0x1FFFFFFF

            if htype_clean in (HUNK_CODE, HUNK_DATA):
                length = read32(f)
                data = f.read(length * 4)
                segments[seg_idx]['type'] = 'CODE' if htype_clean == HUNK_CODE else 'DATA'
                segments[seg_idx]['data'][:len(data)] = data

            elif htype_clean == HUNK_BSS:
                length = read32(f)
                segments[seg_idx]['type'] = 'BSS'

            elif htype_clean == HUNK_RELOC32:
                while True:
                    count = read32(f)
                    if count is None or count == 0:
                        break
                    target = read32(f)
                    offsets = []
                    for _ in range(count):
                        offsets.append(read32(f))
                    if target not in segments[seg_idx]['relocs']:
                        segments[seg_idx]['relocs'][target] = []
                    segments[seg_idx]['relocs'][target].extend(offsets)

            elif htype_clean == HUNK_SYMBOL:
                while True:
                    nlen = read32(f)
                    if nlen is None or nlen == 0:
                        break
                    f.read(nlen * 4)
                    read32(f)

            elif htype_clean == HUNK_DEBUG:
                length = read32(f)
                f.read(length * 4)

            elif htype_clean == HUNK_END:
                seg_idx += 1

            else:
                break

    return segments

def apply_relocs(segments, base_addrs):
    """Apply relocations: for each reloc entry, add the target hunk's
    base address to the 32-bit value at the specified offset."""
    for seg_idx, seg in enumerate(segments):
        for target_hunk, offsets in seg['relocs'].items():
            if target_hunk >= len(base_addrs):
                continue
            target_base = base_addrs[target_hunk]
            for off in offsets:
                if off + 4 <= len(seg['data']):
                    val = struct.unpack_from(">I", seg['data'], off)[0]
                    val = (val + target_base) & 0xFFFFFFFF
                    struct.pack_into(">I", seg['data'], off, val)

def find_segment_by_type_and_approx_size(segments, seg_type, min_size):
    """Find the largest segment of given type at least min_size bytes."""
    best = None
    for i, seg in enumerate(segments):
        if seg['type'] == seg_type and seg['size'] >= min_size:
            if best is None or seg['size'] > segments[best]['size']:
                best = i
    return best

def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <executable> <library>")
        sys.exit(1)

    exe_file = sys.argv[1]
    lib_file = sys.argv[2]

    print(f"Loading {exe_file}...")
    exe_segs = load_hunks(exe_file)
    print(f"  {len(exe_segs)} segments")
    for i, s in enumerate(exe_segs):
        nrelocs = sum(len(v) for v in s['relocs'].values())
        print(f"  [{i}] {s['type']} {s['size']} bytes, {nrelocs} relocs")

    print(f"\nLoading {lib_file}...")
    lib_segs = load_hunks(lib_file)
    print(f"  {len(lib_segs)} segments")
    for i, s in enumerate(lib_segs):
        nrelocs = sum(len(v) for v in s['relocs'].values())
        print(f"  [{i}] {s['type']} {s['size']} bytes, {nrelocs} relocs")

    # Find the main CODE and DATA segments in each
    exe_code_idx = find_segment_by_type_and_approx_size(exe_segs, 'CODE', 100000)
    exe_data_idx = find_segment_by_type_and_approx_size(exe_segs, 'DATA', 100000)
    lib_code_idx = find_segment_by_type_and_approx_size(lib_segs, 'CODE', 100000)
    lib_data_idx = find_segment_by_type_and_approx_size(lib_segs, 'DATA', 100000)

    print(f"\nMain segments:")
    print(f"  Exe: CODE=[{exe_code_idx}] ({exe_segs[exe_code_idx]['size']}), DATA=[{exe_data_idx}] ({exe_segs[exe_data_idx]['size']})")
    print(f"  Lib: CODE=[{lib_code_idx}] ({lib_segs[lib_code_idx]['size']}), DATA=[{lib_data_idx}] ({lib_segs[lib_data_idx]['size']})")

    # Apply relocations with base=0 for all hunks (so relocated values = offsets within target)
    # This way we can compare the PRE-relocated data (all targets at base 0)
    exe_bases = [0] * len(exe_segs)
    lib_bases = [0] * len(lib_segs)
    # Don't apply relocs — compare raw (unrelocated) data

    # Compare DATA segments byte-by-byte
    exe_data = exe_segs[exe_data_idx]['data']
    lib_data = lib_segs[lib_data_idx]['data']

    min_len = min(len(exe_data), len(lib_data))
    print(f"\nComparing DATA segments (first {min_len} bytes)...")

    diff_count = 0
    diff_regions = []
    in_diff = False
    diff_start = 0

    for i in range(min_len):
        if exe_data[i] != lib_data[i]:
            if not in_diff:
                in_diff = True
                diff_start = i
            diff_count += 1
        else:
            if in_diff:
                diff_regions.append((diff_start, i))
                in_diff = False
    if in_diff:
        diff_regions.append((diff_start, min_len))

    if diff_count == 0:
        print(f"  DATA segments are IDENTICAL for first {min_len} bytes!")
    else:
        print(f"  {diff_count} bytes differ in {len(diff_regions)} regions:")
        for start, end in diff_regions[:20]:
            length = end - start
            print(f"    offset 0x{start:06x}-0x{end:06x} ({length} bytes)")
            # Show first few differing bytes
            for j in range(start, min(start + 16, end)):
                print(f"      [{j:06x}] exe=0x{exe_data[j]:02x} lib=0x{lib_data[j]:02x}")

    if len(exe_data) != len(lib_data):
        print(f"  Size difference: exe={len(exe_data)} lib={len(lib_data)} (delta={len(exe_data)-len(lib_data)})")

    # Compare relocation counts for main DATA segment
    print(f"\nDATA segment relocations:")
    for target, offsets in sorted(exe_segs[exe_data_idx]['relocs'].items()):
        lib_target = target  # assume same target mapping
        lib_offsets = lib_segs[lib_data_idx]['relocs'].get(lib_target, [])
        if len(offsets) != len(lib_offsets):
            print(f"  →hunk {target}: exe={len(offsets)} lib={len(lib_offsets)} DIFFERENT")
        else:
            print(f"  →hunk {target}: both {len(offsets)}")

    # Check for relocation offset differences
    print(f"\nChecking if DATA→CODE reloc offsets match...")
    exe_code_relocs = sorted(exe_segs[exe_data_idx]['relocs'].get(exe_code_idx, []))
    lib_code_relocs = sorted(lib_segs[lib_data_idx]['relocs'].get(lib_code_idx, []))

    if exe_code_relocs == lib_code_relocs:
        print(f"  All {len(exe_code_relocs)} DATA→CODE reloc offsets match!")
    else:
        print(f"  MISMATCH: exe has {len(exe_code_relocs)}, lib has {len(lib_code_relocs)}")
        exe_set = set(exe_code_relocs)
        lib_set = set(lib_code_relocs)
        only_exe = exe_set - lib_set
        only_lib = lib_set - exe_set
        if only_exe:
            print(f"  Only in exe ({len(only_exe)}): {sorted(only_exe)[:10]}")
        if only_lib:
            print(f"  Only in lib ({len(only_lib)}): {sorted(only_lib)[:10]}")

if __name__ == "__main__":
    main()
