// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PlannedSave } from '../../../src/logic/sidecar-sync.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { countedPictures, fieldCounts, flagCounts, holdsForeignData, summedCounts, withCounts } from '../../../src/logic/stats-counts.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'
import { packetOf, seq } from './xmp/xmp-builders.ts'

const A = pictureOf(listingEntry(1, '/P/A.NEF'), listingEntry(11, '/P/A.NEF.xmp'))
const B = pictureOf(listingEntry(2, '/P/B.NEF'), listingEntry(12, '/P/B.NEF.xmp'))
const bytes = new Uint8Array([1])
const SAVES: PlannedSave[] = [
	{ picture: A, path: '/P/A.NEF.xmp', item: { fileId: 11, etag: 'e', size: 1, bytes } },
	{ picture: A, path: '/P/A.JPG.xmp', item: { path: '/P/A.JPG.xmp', bytes } },
	{ picture: B, path: '/P/B.NEF.xmp', item: { fileId: 12, etag: 'e', size: 1, bytes } },
]

describe('flagCounts', () => {
	// spec: STATS-001.14
	it('counts a flag change as the state it leaves and the state it enters', () => {
		expect(flagCounts('unflagged', 'picked')).toEqual({ pictures_decided: 1, pictures_picked: 1 })
		expect(flagCounts('picked', 'rejected')).toEqual({ pictures_picked: -1, pictures_rejected: 1 })
		expect(flagCounts('picked', 'picked')).toEqual({})
	})

	// spec: STATS-001.15
	it('takes back what the change counted when it is undone', () => {
		expect(flagCounts('rejected', 'unflagged')).toEqual({ pictures_decided: -1, pictures_rejected: -1 })
	})
})

describe('fieldCounts', () => {
	// spec: STATS-001.37
	it('counts a rating or colour label set forward and takes it back on undo', () => {
		const after = { ...UNDECIDED, rating: 3, colourLabel: 'red' as const }

		expect(fieldCounts(UNDECIDED, after, 1)).toEqual({ ratings_set: 1, colour_labels_set: 1 })
		expect(fieldCounts(after, UNDECIDED, -1)).toEqual({ ratings_set: -1, colour_labels_set: -1 })
		expect(fieldCounts(UNDECIDED, { ...UNDECIDED, flag: 'picked' }, 1)).toEqual({})
	})
})

describe('summedCounts', () => {
	// spec: STATS-001.15
	it('adds the counts per metric and leaves out what sums to nothing', () => {
		expect(summedCounts({ ratings_set: 1, tags_set: 1 }, { ratings_set: 1, tags_set: -1 })).toEqual({ ratings_set: 2 })
	})
})

describe('holdsForeignData', () => {
	// spec: STATS-001.38
	it('finds darktable by its version and digiKam by a property honeycomb does not write', () => {
		expect(holdsForeignData(packetOf({ 'darktable:xmp_version': '5' }))).toBe(true)
		expect(holdsForeignData(packetOf({ 'digiKam:ImageUniqueID': 'x' }))).toBe(true)
		expect(holdsForeignData(packetOf({ 'digiKam:PickLabel': '1', 'digiKam:ColorLabel': '2', 'digiKam:TagsList': seq(['A']), 'xmp:Rating': '3' }))).toBe(false)
	})
})

describe('withCounts and countedPictures', () => {
	// spec: STATS-001.36
	it('puts a picture\'s counts on its first save only', () => {
		const counted = withCounts(SAVES, (picture) => (picture === A ? { ratings_set: 1 } : {}))

		expect(counted.map(({ item }) => ('counts' in item ? item.counts : null))).toEqual([{ ratings_set: 1 }, null, null])
	})

	// spec: STATS-001.36
	it('names the pictures whose counts a saved save carried', () => {
		const counted = withCounts(SAVES, () => ({ ratings_set: 1 }))
		const saved = { result: 'saved', fileId: 1, etag: 'e', size: 1, mtime: 1 } as const

		expect(countedPictures(counted, [{ result: 'changed' }, saved, saved])).toEqual(new Set([B]))
		expect(countedPictures(counted, null)).toEqual(new Set())
	})
})
