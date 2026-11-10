// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { deleteSummary, filesOf, rejectedPictures } from '../../../src/logic/delete-summary.ts'
import { listingEntry, pictureOf, picturesOf } from './listing-entries.ts'

const PAIR = picturesOf([
	listingEntry(1, '/Trip/IMG_1.CR3', { mime: 'image/x-dcraw', size: 20 }),
	listingEntry(2, '/Trip/IMG_1.JPG', { size: 5 }),
	listingEntry(3, '/Trip/IMG_1.CR3.xmp', { mime: 'application/octet-stream', size: 1 }),
	listingEntry(4, '/Trip/IMG_1.xmp', { mime: 'application/octet-stream', size: 2 }),
])[0]!
const SINGLE = pictureOf(listingEntry(5, '/Trip/Day 2/IMG_2.JPG', { size: 7 }))
const RAW_ONLY = pictureOf(listingEntry(6, '/Trip/Day 2/IMG_3.NEF', { mime: 'image/x-dcraw', size: 30 }))

const paths = (picture: Picture<ListingEntry>) => filesOf(picture).map((file) => [file.role, file.entry.path])

describe('filesOf', () => {
	// spec: DELETE-002.6
	it('lists the rendered member, the RAW member, then every sidecar form', () => {
		expect(paths(PAIR)).toEqual([
			['rendered', '/Trip/IMG_1.JPG'],
			['raw', '/Trip/IMG_1.CR3'],
			['sidecar', '/Trip/IMG_1.CR3.xmp'],
			['sidecar', '/Trip/IMG_1.xmp'],
		])
		expect(filesOf(PAIR).every((file) => file.picture === PAIR)).toBe(true)
	})

	// spec: DELETE-002.6
	it('lists the one member of a single', () => {
		expect(paths(SINGLE)).toEqual([['rendered', '/Trip/Day 2/IMG_2.JPG']])
		expect(paths(RAW_ONLY)).toEqual([['raw', '/Trip/Day 2/IMG_3.NEF']])
	})
})

describe('rejectedPictures', () => {
	// spec: DELETE-002.1
	it('keeps the rejected pictures in their order', () => {
		const flags = new Map<Picture<ListingEntry>, Decision['flag']>([[PAIR, 'rejected'], [SINGLE, 'picked'], [RAW_ONLY, 'rejected']])
		const decisionOf = (picture: Picture<ListingEntry>): Decision => ({ ...UNDECIDED, flag: flags.get(picture)! })

		expect(rejectedPictures([RAW_ONLY, SINGLE, PAIR], decisionOf)).toEqual([RAW_ONLY, PAIR])
	})
})

describe('deleteSummary', () => {
	// spec: DELETE-002.6
	it('counts pictures, files, bytes, pairs, singles and the pictures per folder in first-seen order', () => {
		expect(deleteSummary([SINGLE, PAIR, RAW_ONLY])).toEqual({
			pictures: 3,
			files: 6,
			bytes: 65,
			pairs: 1,
			singles: 2,
			folders: [{ folder: '/Trip/Day 2', pictures: 2 }, { folder: '/Trip', pictures: 1 }],
		})
	})

	// spec: DELETE-002.6
	it('is all zero for no pictures', () => {
		expect(deleteSummary([])).toEqual({ pictures: 0, files: 0, bytes: 0, pairs: 0, singles: 0, folders: [] })
	})
})
