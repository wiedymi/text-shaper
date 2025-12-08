#!/usr/bin/env python3
"""
Generate WOFF2 test files for edge case coverage
"""
import struct
import brotli

def write_uint16_be(value):
    return struct.pack('>H', value)

def write_uint32_be(value):
    return struct.pack('>I', value)

def create_woff2_with_invalid_glyf_version():
    """Create a WOFF2 with invalid glyf version to trigger error"""
    # Create head table
    head = bytearray(54)
    struct.pack_into('>I', head, 0, 0x00010000)  # version
    struct.pack_into('>I', head, 12, 0x5F0F3CF5)  # magicNumber
    struct.pack_into('>H', head, 18, 1024)  # unitsPerEm
    struct.pack_into('>h', head, 50, 1)  # indexToLocFormat = 1

    # Create maxp table
    maxp = bytearray(6)
    struct.pack_into('>I', maxp, 0, 0x00005000)  # version 0.5
    struct.pack_into('>H', maxp, 4, 2)  # numGlyphs

    # Create glyf table with INVALID version (not 0)
    glyf = bytearray()
    glyf.extend(write_uint16_be(999))  # INVALID version
    glyf.extend(write_uint16_be(0))  # optionFlags
    glyf.extend(write_uint16_be(2))  # numGlyphs
    glyf.extend(write_uint16_be(1))  # indexFormat
    glyf.extend(write_uint32_be(2))  # nContourStreamSize
    glyf.extend(write_uint32_be(0))  # nPointsStreamSize
    glyf.extend(write_uint32_be(0))  # flagStreamSize
    glyf.extend(write_uint32_be(0))  # glyphStreamSize
    glyf.extend(write_uint32_be(0))  # compositeStreamSize
    glyf.extend(write_uint32_be(0))  # bboxStreamSize
    glyf.extend(write_uint32_be(0))  # instructionStreamSize
    glyf.extend(write_uint16_be(0))  # nContours for glyph 0

    # Compress all tables together
    decompressed = head + maxp + glyf
    compressed = brotli.compress(decompressed)

    # Build WOFF2 header
    woff2 = bytearray()
    woff2.extend(b'wOF2')  # signature
    woff2.extend(write_uint32_be(0x00010000))  # flavor (TTF)
    woff2.extend(write_uint32_be(0))  # length (fill later)
    woff2.extend(write_uint16_be(3))  # numTables
    woff2.extend(write_uint16_be(0))  # reserved
    woff2.extend(write_uint32_be(0))  # totalSfntSize
    woff2.extend(write_uint32_be(len(compressed)))  # totalCompressedSize
    woff2.extend(write_uint16_be(0))  # majorVersion
    woff2.extend(write_uint16_be(0))  # minorVersion
    woff2.extend(write_uint32_be(0))  # metaOffset
    woff2.extend(write_uint32_be(0))  # metaLength
    woff2.extend(write_uint32_be(0))  # metaOrigLength
    woff2.extend(write_uint32_be(0))  # privOffset
    woff2.extend(write_uint32_be(0))  # privLength

    # Table directory
    # head
    woff2.append(0x01)  # flags (tag index 1 = "head")
    woff2.append(54)  # origLength

    # maxp
    woff2.append(0x04)  # flags (tag index 4 = "maxp")
    woff2.append(6)  # origLength

    # glyf with transform
    woff2.append(0x14)  # flags (tag index 20 = "glyf", transform version 0)
    woff2.append(len(glyf))  # origLength
    woff2.append(len(glyf))  # transformLength

    # Add compressed data
    woff2.extend(compressed)

    # Fix length
    struct.pack_into('>I', woff2, 8, len(woff2))

    return bytes(woff2)

def create_woff2_with_short_loca():
    """Create a WOFF2 with indexFormat 0 (short loca)"""
    # Create head table with indexFormat = 0
    head = bytearray(54)
    struct.pack_into('>I', head, 0, 0x00010000)
    struct.pack_into('>I', head, 12, 0x5F0F3CF5)
    struct.pack_into('>H', head, 18, 1024)
    struct.pack_into('>h', head, 50, 0)  # indexToLocFormat = 0 (SHORT)

    # Create maxp
    maxp = bytearray(6)
    struct.pack_into('>I', maxp, 0, 0x00005000)
    struct.pack_into('>H', maxp, 4, 2)

    # Create transformed glyf with empty glyphs
    glyf = bytearray()
    glyf.extend(write_uint16_be(0))  # version
    glyf.extend(write_uint16_be(0))  # optionFlags
    glyf.extend(write_uint16_be(2))  # numGlyphs
    glyf.extend(write_uint16_be(0))  # indexFormat = 0
    glyf.extend(write_uint32_be(4))  # nContourStreamSize
    glyf.extend(write_uint32_be(0))  # nPointsStreamSize
    glyf.extend(write_uint32_be(0))  # flagStreamSize
    glyf.extend(write_uint32_be(0))  # glyphStreamSize
    glyf.extend(write_uint32_be(0))  # compositeStreamSize
    glyf.extend(write_uint32_be(0))  # bboxStreamSize
    glyf.extend(write_uint32_be(0))  # instructionStreamSize
    glyf.extend(write_uint16_be(0))  # nContours = 0 (empty glyph 0)
    glyf.extend(write_uint16_be(0))  # nContours = 0 (empty glyph 1)

    decompressed = head + maxp + glyf
    compressed = brotli.compress(decompressed)

    woff2 = bytearray()
    woff2.extend(b'wOF2')
    woff2.extend(write_uint32_be(0x00010000))
    woff2.extend(write_uint32_be(0))
    woff2.extend(write_uint16_be(3))
    woff2.extend(write_uint16_be(0))
    woff2.extend(write_uint32_be(0))
    woff2.extend(write_uint32_be(len(compressed)))
    woff2.extend(write_uint16_be(0))
    woff2.extend(write_uint16_be(0))
    woff2.extend(write_uint32_be(0))
    woff2.extend(write_uint32_be(0))
    woff2.extend(write_uint32_be(0))
    woff2.extend(write_uint32_be(0))
    woff2.extend(write_uint32_be(0))

    woff2.append(0x01)
    woff2.append(54)
    woff2.append(0x04)
    woff2.append(6)
    woff2.append(0x14)
    woff2.append(len(glyf))
    woff2.append(len(glyf))

    woff2.extend(compressed)
    struct.pack_into('>I', woff2, 8, len(woff2))

    return bytes(woff2)

def main():
    # Generate test files
    with open('/Users/uyakauleu/vivy/experiments/typeshaper/tests/font/fixtures/woff2-invalid-version.woff2', 'wb') as f:
        f.write(create_woff2_with_invalid_glyf_version())

    with open('/Users/uyakauleu/vivy/experiments/typeshaper/tests/font/fixtures/woff2-short-loca.woff2', 'wb') as f:
        f.write(create_woff2_with_short_loca())

    print("Test files generated successfully")

if __name__ == '__main__':
    main()
