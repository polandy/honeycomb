// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { parseWarmCache, serializeWarmCache, warmKey } from '../../../src/logic/warm-cache.ts'
import { listingEntry } from './listing-entries.ts'

describe('warmKey', () => {
	// spec: IMAGES-001.15
	it('tells file versions apart by id and mtime', () => {
		expect(warmKey(listingEntry(7, '/A/X.JPG', { mtime: 1700 }))).toBe('7:1700')
		expect(warmKey(listingEntry(7, '/A/X.JPG', { mtime: 1701 }))).not.toBe(warmKey(listingEntry(7, '/A/X.JPG', { mtime: 1700 })))
	})
})

describe('parseWarmCache', () => {
	it('reads the stored keys in their order', () => {
		expect([...parseWarmCache('["1:10","2:20"]')]).toEqual(['1:10', '2:20'])
	})

	it('starts empty without a stored value, with broken JSON or with something else than a list', () => {
		expect(parseWarmCache(null).size).toBe(0)
		expect(parseWarmCache('{').size).toBe(0)
		expect(parseWarmCache('{"1:10":true}').size).toBe(0)
	})

	it('drops entries that are not a file version', () => {
		expect([...parseWarmCache('["1:10",3,"x:1","2:-5",null,"4:40"]')]).toEqual(['1:10', '4:40'])
	})
})

describe('serializeWarmCache', () => {
	// spec: IMAGES-001.15
	it('keeps the newest keys up to the limit', () => {
		expect(serializeWarmCache(new Set(['1:10', '2:20', '3:30']), 2)).toBe('["2:20","3:30"]')
		expect(parseWarmCache(serializeWarmCache(new Set(['1:10']), 5))).toEqual(new Set(['1:10']))
	})
})
