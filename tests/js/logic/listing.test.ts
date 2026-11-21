// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry, SourceEntry } from '../../../src/logic/listing.ts'

import { describe, expect, it } from 'vitest'
import { assertListedSeries, isListingPicture, listedPicture, listedPictures, mergeListings, NotListedError } from '../../../src/logic/listing.ts'
import { DEFAULT_PAIRING_SETTINGS, pairPictures } from '../../../src/logic/pairing.ts'

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
		flag: null,
		keepRaw: null,
		flagUpdated: null,
		visualHash: null,
		quality: null,
		exposure: null,
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

const BARE: SourceEntry = { fileId: 1, path: '/A/1.jpg', mtime: 100, mime: 'image/jpeg', captureTime: null, orientation: null, width: null, height: null, camera: null, flag: null, keepRaw: null, flagUpdated: null }

describe('isListingPicture', () => {
	it('takes a picture of listing entries as one', () => {
		const [picture] = pairPictures([entry(1, '/A/1.jpg')], DEFAULT_PAIRING_SETTINGS)

		expect(isListingPicture(picture!)).toBe(true)
	})

	it('takes a picture of bare source entries as none', () => {
		const [picture] = pairPictures([BARE], DEFAULT_PAIRING_SETTINGS)

		expect(isListingPicture(picture!)).toBe(false)
	})
})

describe('listedPictures', () => {
	it('gives pictures of listing entries back as they are', () => {
		const pictures = pairPictures([entry(1, '/A/1.jpg'), entry(2, '/A/2.jpg')], DEFAULT_PAIRING_SETTINGS)

		expect(listedPictures(pictures)).toEqual(pictures)
	})

	it('throws on a picture of bare source entries', () => {
		expect(() => listedPictures(pairPictures([BARE], DEFAULT_PAIRING_SETTINGS))).toThrow(NotListedError)
	})
})

describe('listedPicture', () => {
	it('gives a picture of listing entries back and throws on one of bare source entries', () => {
		const [picture] = pairPictures([entry(1, '/A/1.jpg')], DEFAULT_PAIRING_SETTINGS)

		expect(listedPicture(picture!)).toBe(picture)
		expect(() => listedPicture(pairPictures([BARE], DEFAULT_PAIRING_SETTINGS)[0]!)).toThrow(NotListedError)
	})
})

describe('assertListedSeries', () => {
	it('passes a series of listing pictures', () => {
		const members = pairPictures([entry(1, '/A/1.jpg'), entry(2, '/A/2.jpg')], DEFAULT_PAIRING_SETTINGS)

		expect(() => assertListedSeries({ key: 1, members })).not.toThrow()
	})

	it('throws on a series with a picture of bare source entries', () => {
		const members = [...pairPictures([entry(2, '/A/2.jpg')], DEFAULT_PAIRING_SETTINGS), ...pairPictures([BARE], DEFAULT_PAIRING_SETTINGS)]

		expect(() => assertListedSeries({ key: 1, members })).toThrow(NotListedError)
	})
})
