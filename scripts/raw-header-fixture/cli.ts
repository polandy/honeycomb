// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Copies the bytes honeycomb's RAW header parser reads (ADR 0061) from a TIFF-based or RAF file and zeroes the rest.
import { closeSync, openSync, readSync, writeFileSync } from 'node:fs'

const READ_LIMIT = 1 << 20
const TIFF_HEADER = 8
const ENTRY = 12
const RAF_MAGIC = 'FUJIFILMCCD-RAW '
const RAF_HEADER = 92
const RAF_PREVIEW_OFFSET = 84
const EXIF_HEADER = 'Exif\0\0'
const JPEG_APP1 = 0xe1
const JPEG_START_OF_SCAN = 0xda
const TAG_EXIF_IFD = 0x8769
/** Make, Model, DateTimeOriginal, OffsetTimeOriginal: the values the parser reads. */
const KEPT_TAGS = new Set([0x010f, 0x0110, 0x9003, 0x9011])
const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8, 13: 4 }

/** The first MiB of the file, opened read-only. */
function head(path: string): Buffer {
	const buffer = Buffer.alloc(READ_LIMIT)
	const descriptor = openSync(path, 'r')
	try {
		return buffer.subarray(0, readSync(descriptor, buffer, 0, READ_LIMIT, 0))
	} finally {
		closeSync(descriptor)
	}
}

/** Copies kept byte ranges of `source` into a zeroed copy and cuts it after the last one. */
class Sanitizer {
	private readonly source: Buffer
	private readonly out: Buffer
	private end = 0

	constructor(source: Buffer) {
		this.source = source
		this.out = Buffer.alloc(source.length)
	}

	keep(start: number, length: number): void {
		const stop = Math.min(start + length, this.source.length)
		if (start < 0 || start >= stop) {
			return
		}
		this.source.copy(this.out, start, start, stop)
		this.end = Math.max(this.end, stop)
	}

	result(): Buffer {
		return this.out.subarray(0, this.end)
	}

	tiff(base: number): void {
		const little = this.source.toString('latin1', base, base + 2) === 'II'
		this.keep(base, TIFF_HEADER)
		this.ifd(base, little, this.u32(base + 4, little))
	}

	private ifd(base: number, little: boolean, offset: number): void {
		const start = base + offset
		if (offset === 0 || start + 2 > this.source.length) {
			return
		}
		const count = this.u16(start, little)
		this.keep(start, 2)
		for (let index = 0; index < count; index++) {
			this.entry(base, little, start + 2 + index * ENTRY)
		}
	}

	private entry(base: number, little: boolean, at: number): void {
		const tag = this.u16(at, little)
		if (tag === TAG_EXIF_IFD) {
			this.keep(at, ENTRY)
			this.ifd(base, little, this.u32(at + 8, little))
			return
		}
		if (!KEPT_TAGS.has(tag)) {
			this.keep(at, 8)
			return
		}
		this.keep(at, ENTRY)
		const size = (TYPE_SIZES[this.u16(at + 2, little)] ?? 1) * this.u32(at + 4, little)
		if (size > 4) {
			this.keep(base + this.u32(at + 8, little), size)
		}
	}

	raf(): void {
		this.keep(0, RAF_HEADER)
		let at = this.source.readUInt32BE(RAF_PREVIEW_OFFSET)
		this.keep(at, 2)
		at += 2
		while (at + 4 <= this.source.length && this.source[at + 1] !== JPEG_START_OF_SCAN) {
			this.keep(at, 4)
			if (this.source[at + 1] === JPEG_APP1 && this.source.toString('latin1', at + 4, at + 10) === EXIF_HEADER) {
				this.keep(at + 4, EXIF_HEADER.length)
				this.tiff(at + 4 + EXIF_HEADER.length)
				return
			}
			at += 2 + this.source.readUInt16BE(at + 2)
		}
	}

	private u16(at: number, little: boolean): number {
		return at + 2 <= this.source.length ? (little ? this.source.readUInt16LE(at) : this.source.readUInt16BE(at)) : 0
	}

	private u32(at: number, little: boolean): number {
		return at + 4 <= this.source.length ? (little ? this.source.readUInt32LE(at) : this.source.readUInt32BE(at)) : 0
	}
}

const [source, target] = process.argv.slice(2)
if (source === undefined || target === undefined) {
	throw new Error('Usage: scripts/raw-header-fixture.sh <RAW file> <fixture>')
}
const bytes = head(source)
const sanitizer = new Sanitizer(bytes)
if (bytes.toString('latin1', 0, RAF_MAGIC.length) === RAF_MAGIC) {
	sanitizer.raf()
} else {
	sanitizer.tiff(0)
}
writeFileSync(target, sanitizer.result())
