// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { rawBatch, rawFilesOf, rawRemoval } from '../../../src/logic/raw-removal.ts'
import { listingEntry, pictureOf, picturesOf } from './listing-entries.ts'

const xmp = (fileId: number, path: string) => listingEntry(fileId, path, { mime: 'application/octet-stream', size: 1 })
const raw = (fileId: number, path: string) => listingEntry(fileId, path, { mime: 'image/x-dcraw', size: 20 })

const PAIR = picturesOf([
	raw(1, '/Trip/IMG_1.CR3'),
	listingEntry(2, '/Trip/IMG_1.JPG', { size: 5 }),
	xmp(3, '/Trip/IMG_1.cr3.XMP'),
	xmp(4, '/Trip/IMG_1.xmp'),
	xmp(5, '/Trip/IMG_1.JPG.xmp'),
	xmp(6, '/Trip/IMG_1_01.CR3.xmp'),
])[0]!
const MARKED = pictureOf(raw(11, '/Trip/IMG_2.NEF'), listingEntry(12, '/Trip/IMG_2.JPG'))
const REJECTED = pictureOf(raw(21, '/Trip/IMG_3.NEF'), listingEntry(22, '/Trip/IMG_3.JPG'))
const MARKED_REJECTED = pictureOf(raw(31, '/Trip/IMG_4.NEF'), listingEntry(32, '/Trip/IMG_4.JPG'))
const JPEG_ONLY = pictureOf(listingEntry(41, '/Trip/IMG_5.JPG'))
const RAW_ONLY = pictureOf(raw(51, '/Trip/IMG_6.NEF'))

const DECISIONS = new Map<Picture<ListingEntry>, Decision>([
	[MARKED, { ...UNDECIDED, keepRaw: true }],
	[REJECTED, { ...UNDECIDED, flag: 'rejected' }],
	[MARKED_REJECTED, { ...UNDECIDED, flag: 'rejected', keepRaw: true }],
])
const decisionOf = (picture: Picture<ListingEntry>) => DECISIONS.get(picture) ?? UNDECIDED

describe('rawFilesOf', () => {
	// spec: DELETE-003.6
	it('lists the RAW member, then its own sidecars and darktable duplicates, never the JPEG\'s or the shared one', () => {
		expect(rawFilesOf(PAIR).map((file) => [file.role, file.entry.fileId])).toEqual([['raw', 1], ['sidecar', 3], ['sidecar', 6]])
		expect(rawFilesOf(PAIR).every((file) => file.picture === PAIR)).toBe(true)
	})

	// spec: DELETE-003.2
	it('lists nothing for a picture without a RAW member', () => {
		expect(rawFilesOf(JPEG_ONLY)).toEqual([])
	})
})

describe('rawRemoval', () => {
	// spec: DELETE-003.2
	it('takes the unmarked, unrejected pairs and counts why the others are skipped', () => {
		const removal = rawRemoval([PAIR, MARKED, REJECTED, MARKED_REJECTED, JPEG_ONLY, RAW_ONLY], decisionOf)

		expect(removal).toEqual({ removed: [PAIR], kept: [MARKED, MARKED_REJECTED], rejected: 1, singles: 2 })
	})

	// spec: DELETE-003.2
	it('takes nothing from an empty view', () => {
		expect(rawRemoval([], decisionOf)).toEqual({ removed: [], kept: [], rejected: 0, singles: 0 })
	})
})

describe('rawBatch', () => {
	// spec: DELETE-003.6, DELETE-003.7
	it('sends each RAW with its own sidecars as one unit, so a failed RAW keeps its sidecar', () => {
		expect(rawBatch([PAIR, MARKED]).map((files) => files.map((file) => file.entry.fileId))).toEqual([[1, 3, 6], [11]])
	})
})
