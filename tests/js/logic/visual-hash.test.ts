// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { differenceHash, HASH_COLUMNS, HASH_ROWS, hashDistance, parseHashCache, serializeHashCache } from '../../../src/logic/visual-hash.ts'

/** RGBA pixels of a HASH_COLUMNS × HASH_ROWS image whose grey level is `level(column, row)`. */
function pixels(level: (column: number, row: number) => number): number[] {
	return Array.from({ length: HASH_ROWS * HASH_COLUMNS }, (_, index) => {
		const grey = level(index % HASH_COLUMNS, Math.floor(index / HASH_COLUMNS))
		return [grey, grey, grey, 255]
	}).flat()
}

describe('differenceHash', () => {
	// spec: SERIES-001.17
	it('sets a bit where a pixel is brighter than its right neighbour, row by row', () => {
		expect(differenceHash(pixels((column) => column * 20))).toBe('0000000000000000')
		expect(differenceHash(pixels((column) => 200 - column * 20))).toBe('ffffffffffffffff')
		expect(differenceHash(pixels((column, row) => (row === 7 && column === 7 ? 255 : 0)))).toBe('0000000000000001')
	})

	it('compares luminance, so a darker green outweighs a full blue', () => {
		const rgba = pixels(() => 0)
		rgba.splice(0, 8, 0, 200, 0, 255, 0, 0, 255, 255)

		expect(differenceHash(rgba)).toBe('c000000000000000')
	})

	it('refuses pixels of another size', () => {
		expect(() => differenceHash([0, 0, 0, 255])).toThrow(RangeError)
	})
})

describe('hashDistance', () => {
	// spec: SERIES-001.14
	it('counts the bits in which two hashes differ', () => {
		expect(hashDistance('0000000000000000', '0000000000000000')).toBe(0)
		expect(hashDistance('0000000000000000', '00000000000003ff')).toBe(10)
		expect(hashDistance('0000000000000000', 'ffffffffffffffff')).toBe(64)
	})

	it('refuses hashes that are not 16 hex digits', () => {
		expect(() => hashDistance('0', '0000000000000000')).toThrow(RangeError)
		expect(() => hashDistance('000000000000000g', '0000000000000000')).toThrow(RangeError)
	})
})

describe('hash cache', () => {
	// spec: SERIES-001.17
	it('reads stored hashes and drops what is not one', () => {
		const stored = JSON.stringify({ '1:a': '00000000000003ff', '2:b': 'nope', '3:c': 7 })

		expect([...parseHashCache(stored)]).toEqual([['1:a', '00000000000003ff']])
		expect(parseHashCache(null).size).toBe(0)
		expect(parseHashCache('{').size).toBe(0)
		expect(parseHashCache('[]').size).toBe(0)
	})

	it('writes the newest hashes up to the limit', () => {
		const cache = new Map([['1:a', '0000000000000001'], ['2:b', '0000000000000002'], ['3:c', '0000000000000003']])

		expect(JSON.parse(serializeHashCache(cache, 2))).toEqual({ '2:b': '0000000000000002', '3:c': '0000000000000003' })
	})
})
