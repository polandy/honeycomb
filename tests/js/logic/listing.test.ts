// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../../src/logic/listing.ts'

import { describe, expect, it } from 'vitest'
import { mergeListings } from '../../../src/logic/listing.ts'

function entry(fileId: number, path: string): ListingEntry {
	return {
		fileId,
		path,
		size: 1,
		mtime: 100,
		etag: `e${fileId}`,
		mime: 'image/jpeg',
		captureTime: null,
		orientation: null,
		width: null,
		height: null,
		camera: null,
		visualHash: null,
	}
}

describe('mergeListings', () => {
	// spec: LISTING-001.11
	it('keeps every entry of listings that do not overlap, in listing order', () => {
		const a = [entry(1, '/A/1.jpg'), entry(2, '/A/2.jpg')]
		const b = [entry(3, '/B/3.jpg')]

		expect(mergeListings([a, b])).toEqual([...a, ...b])
	})

	// spec: LISTING-001.11
	it('lists a file once when a ticked parent with subfolders and a ticked child both list it', () => {
		const child = entry(2, '/A/B/2.jpg')
		const parent = [entry(1, '/A/1.jpg'), child]

		const merged = mergeListings([parent, [entry(2, '/A/B/2.jpg'), entry(3, '/A/B/3.jpg')]])

		expect(merged.map((item) => item.fileId)).toEqual([1, 2, 3])
		expect(merged[1]).toBe(child)
	})

	it('returns no entries for no listings', () => {
		expect(mergeListings([])).toEqual([])
	})
})
