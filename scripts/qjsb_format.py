#!/usr/bin/env python3
"""The .qjsb container: reading, writing and the version stamp.

A .qjsb file holds several named blobs of QuickJS bytecode behind an
index, so that quickjs.library can open the file, seek, and read the one
blob it needs. docs/QJSB-FORMAT.md is the specification; this module and
library/vbcc/qjsb_format.h are its two implementations and must agree.

Everything is big-endian. See the specification for the reasons behind
each field.
"""
import os
import re
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QJS = os.path.join(ROOT, 'quickjs-master')
LIBRARYCONFIG = os.path.join(ROOT, 'library/vbcc/libraryconfig.h')

MAGIC = b'QJSB'
FORMAT_VERSION = 1
FIXED = struct.Struct('>4sHHHHIHHIII')       # the 32 binary bytes
VERSION_TEXT_SIZE = 96                       # then "$VER: ...", NUL-padded
HEADER_SIZE = FIXED.size + VERSION_TEXT_SIZE     # 128
RECORD = struct.Struct('>IIIBB')             # then the name, padded to even

FLAG_EXACT = 1      # only for the library version it was built for

KIND_SCRIPT = 0     # a classic script: evaluated
KIND_MODULE = 1     # an ES module: handed to the module loader
KIND_NAMES = {KIND_SCRIPT: 'script', KIND_MODULE: 'module'}

NAME_LIMIT = 255
ALIGN = 4


class QJSBError(Exception):
    """A file that is not a well-formed .qjsb container."""


def checksum(data):
    """The 32-bit check of a run of bytes.

    The bytes are taken as big-endian 32-bit words, the last one padded
    with zero bytes; for each word the sum is rotated left by one bit
    and the word added. It is there to catch a damaged or cut-off file
    before the engine is handed its contents, and costs a 68020 about
    one instruction per byte.
    """
    padded = data + b'\0' * (-len(data) % 4)
    total = 0
    for (word,) in struct.iter_unpack('>I', padded):
        total = (((total << 1) | (total >> 31)) + word) & 0xFFFFFFFF
    return total


def bytecode_version():
    """BC_VERSION of the engine in this tree."""
    with open(os.path.join(QJS, 'quickjs.c'), encoding='utf-8',
              errors='replace') as handle:
        match = re.search(r'^#define BC_VERSION\s+(\d+)', handle.read(), re.M)
    if not match:
        raise QJSBError('BC_VERSION not found in quickjs.c')
    return int(match.group(1))


def library_version():
    """LIBRARY_VERSION of library/vbcc/libraryconfig.h (239 is 0.239)."""
    with open(LIBRARYCONFIG, encoding='utf-8', errors='replace') as handle:
        match = re.search(r'^#define LIBRARY_VERSION\s+(\d+)', handle.read(),
                          re.M)
    if not match:
        raise QJSBError('LIBRARY_VERSION not found in libraryconfig.h')
    return int(match.group(1))


def engine_stamp():
    """A number that changes when bytecode stops being interchangeable.

    Serialised bytecode refers to the engine's predefined atoms by
    number and to its opcodes by number, so it is only valid for an
    engine with the same atom list and opcode list. The stamp is the
    CRC-32 of those two headers with comments and white space removed.
    BC_VERSION, the engine's own number for the serialisation format,
    is stored beside it in the header.
    """
    crc = 0
    for name in ('quickjs-atom.h', 'quickjs-opcode.h'):
        with open(os.path.join(QJS, name), encoding='utf-8') as handle:
            text = handle.read()
        text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
        text = re.sub(r'//[^\n]*', '', text)
        text = re.sub(r'\s+', '', text)
        crc = zlib.crc32(text.encode('utf-8'), crc)
    return crc & 0xFFFFFFFF


def library_release():
    """('0.239', '13.11.2026'): the version and date in the library's
    $VER string, LIBRARY_VERSION_STRING of libraryconfig.h. The core's
    own .qjsb files carry the same pair, so that `version file` shows
    at a glance whether a file belongs to a library."""
    with open(LIBRARYCONFIG, encoding='utf-8', errors='replace') as handle:
        match = re.search(r'\.library (\d+\.\d+) \((\d+\.\d+\.\d+)\)',
                          handle.read())
    if not match:
        raise QJSBError('no version and date in LIBRARY_VERSION_STRING')
    version, date = match.group(1), match.group(2)
    if version != version_text(library_version()):
        raise QJSBError('libraryconfig.h: $VER says %s but LIBRARY_VERSION '
                        'is %d' % (version, library_version()))
    return version, date


def ver_string(name, version, date):
    """The AmigaDOS version string of a file: what C:Version prints."""
    text = '$VER: %s %s (%s)' % (name, version, date)
    if not re.fullmatch(r'\d+\.\d+', version):
        raise QJSBError('version %r is not <number>.<number>' % version)
    if not re.fullmatch(r'\d{1,2}\.\d{1,2}\.\d{2,4}', date):
        raise QJSBError('date %r is not day.month.year' % date)
    if len(text.encode('ascii')) >= VERSION_TEXT_SIZE:
        raise QJSBError('version string too long: %r' % text)
    return text


def version_text(version):
    """239 -> '0.239', as the library's $VER string shows it."""
    return '%d.%03d' % (version // 1000, version % 1000)


def pack(entries, ver, flags=0, built_for=None, bc_version=None,
         stamp=None):
    """The bytes of a container.

    entries is a list of (name, kind, blob) in the order they are to be
    stored. ver is the file's "$VER: ..." string (ver_string). With
    FLAG_EXACT in flags, built_for is the one library version that may
    load the file; without it, the oldest that may. The remaining
    arguments default to this tree's values.
    """
    if built_for is None:
        built_for = library_version()
    if bc_version is None:
        bc_version = bytecode_version()
    if stamp is None:
        stamp = engine_stamp()

    text = ver.encode('ascii')
    if not text.startswith(b'$VER: ') or len(text) >= VERSION_TEXT_SIZE:
        raise QJSBError('bad version string %r' % ver)
    text += b'\0' * (VERSION_TEXT_SIZE - len(text))

    seen = set()
    encoded = []
    for name, kind, blob in entries:
        raw = name.encode('ascii')
        if not raw or len(raw) > NAME_LIMIT or b'\0' in raw:
            raise QJSBError('bad entry name %r' % name)
        if name in seen:
            raise QJSBError('entry %r is there twice' % name)
        if kind not in KIND_NAMES:
            raise QJSBError('entry %r: unknown kind %r' % (name, kind))
        seen.add(name)
        encoded.append((raw, kind, blob))

    index_size = sum(RECORD.size + len(raw) + (len(raw) & 1)
                     for raw, _, _ in encoded)
    offset = HEADER_SIZE + index_size
    offset += -offset % ALIGN

    index = b''
    body = b''
    for raw, kind, blob in encoded:
        index += RECORD.pack(offset, len(blob), checksum(blob), kind, len(raw))
        index += raw + b'\0' * (len(raw) & 1)
        body += blob + b'\0' * (-len(blob) % ALIGN)
        offset += len(blob) + (-len(blob) % ALIGN)

    def header(check):
        return FIXED.pack(MAGIC, FORMAT_VERSION, flags, bc_version, built_for,
                          stamp, len(encoded), 0, index_size, offset,
                          check) + text

    check = checksum(header(0) + index)
    gap = b'\0' * (-(HEADER_SIZE + index_size) % ALIGN)
    return header(check) + index + gap + body


def unpack(data):
    """(header dict, [entry dict]) of a container; raises QJSBError.

    Every check the library makes is made here too, and the blobs'
    checks as well, so `qjsb.py verify` vouches for the whole file.
    """
    if len(data) < HEADER_SIZE:
        raise QJSBError('shorter than a header')
    (magic, version, flags, bc_version, built_for, stamp, count, reserved,
     index_size, file_size, check) = FIXED.unpack_from(data)
    if magic != MAGIC:
        raise QJSBError('not a QJSB file (magic %r)' % magic)
    if version != FORMAT_VERSION:
        raise QJSBError('format version %d, this tool knows %d'
                        % (version, FORMAT_VERSION))
    if file_size != len(data):
        raise QJSBError('header says %d bytes, file has %d'
                        % (file_size, len(data)))
    if HEADER_SIZE + index_size > len(data):
        raise QJSBError('index runs past the end')

    index = data[HEADER_SIZE:HEADER_SIZE + index_size]
    zeroed = (data[:FIXED.size - 4] + b'\0\0\0\0'
              + data[FIXED.size:HEADER_SIZE])
    ver = data[FIXED.size:HEADER_SIZE].split(b'\0')[0].decode('ascii',
                                                             'replace')
    if not ver.startswith('$VER: '):
        raise QJSBError('no $VER: string in the header')
    if checksum(zeroed + index) != check:
        raise QJSBError('header and index fail their check')

    entries = []
    position = 0
    for _ in range(count):
        if position + RECORD.size > len(index):
            raise QJSBError('index is cut off')
        offset, length, blob_check, kind, name_length = RECORD.unpack_from(
            index, position)
        position += RECORD.size
        name = index[position:position + name_length].decode('ascii')
        position += name_length + (name_length & 1)
        if offset + length > len(data):
            raise QJSBError('entry %r runs past the end' % name)
        blob = data[offset:offset + length]
        if checksum(blob) != blob_check:
            raise QJSBError('entry %r fails its check' % name)
        entries.append({'name': name, 'kind': kind, 'offset': offset,
                        'length': length, 'check': blob_check, 'blob': blob})
    if position != len(index):
        raise QJSBError('index has %d spare bytes' % (len(index) - position))

    header = {'format': version, 'flags': flags, 'bc_version': bc_version,
              'built_for': built_for, 'stamp': stamp, 'count': count,
              'ver': ver,
              'index_size': index_size, 'file_size': file_size}
    return header, entries
