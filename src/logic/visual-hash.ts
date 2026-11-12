// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The width of the image a visual hash is taken from; one column more than bits per row (ADR 0021). */
export const HASH_COLUMNS = 9

/** The height of the image a visual hash is taken from, one row of bits each. */
export const HASH_ROWS = 8

/** RGBA has four channels per pixel. */
const CHANNELS = 4

/** The bits a hex digit holds. */
const BITS_PER_DIGIT = 4

/** A visual hash: 64 bits as 16 lower-case hex digits. */
const HASH_PATTERN = /^[0-9a-f]{16}$/

/** The difference hash (dHash) of HASH_COLUMNS × HASH_ROWS RGBA pixels: a bit per pixel brighter than its right neighbour. */
export function differenceHash(rgba: ArrayLike<number>): string {
	if (rgba.length !== HASH_COLUMNS * HASH_ROWS * CHANNELS) {
		throw new RangeError(`Expected ${HASH_COLUMNS} × ${HASH_ROWS} RGBA pixels, got ${rgba.length} values`)
	}
	const luma = (column: number, row: number) => {
		const at = (row * HASH_COLUMNS + column) * CHANNELS
		return 0.299 * rgba[at]! + 0.587 * rgba[at + 1]! + 0.114 * rgba[at + 2]!
	}
	let bits = 0n
	for (let row = 0; row < HASH_ROWS; row++) {
		for (let column = 0; column < HASH_COLUMNS - 1; column++) {
			bits = (bits << 1n) | (luma(column, row) > luma(column + 1, row) ? 1n : 0n)
		}
	}
	return bits.toString(16).padStart((HASH_ROWS * (HASH_COLUMNS - 1)) / BITS_PER_DIGIT, '0')
}

/** The number of bits in which two visual hashes differ (Hamming distance). */
export function hashDistance(a: string, b: string): number {
	if (!HASH_PATTERN.test(a) || !HASH_PATTERN.test(b)) {
		throw new RangeError('A visual hash is 16 hex digits')
	}
	let difference = BigInt(`0x${a}`) ^ BigInt(`0x${b}`)
	let count = 0
	while (difference > 0n) {
		count += Number(difference & 1n)
		difference >>= 1n
	}
	return count
}

/** The stored visual hashes by file version, empty when nothing valid is stored. */
export function parseHashCache(stored: string | null): Map<string, string> {
	let parsed: unknown
	try {
		parsed = JSON.parse(stored ?? '{}')
	} catch {
		return new Map()
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return new Map()
	}
	return new Map(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && HASH_PATTERN.test(entry[1])))
}

/** The newest `limit` visual hashes, in insertion order, for storage. */
export function serializeHashCache(cache: ReadonlyMap<string, string>, limit: number): string {
	return JSON.stringify(Object.fromEntries([...cache].slice(-limit)))
}
