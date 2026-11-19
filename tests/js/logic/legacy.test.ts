// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { acknowledgedIds, exportedFileIds, hasLegacyRows, legacyWrites } from '../../../src/logic/legacy.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const PAIR = pictureOf(listingEntry(1, '/A/IMG_1.JPG'), listingEntry(2, '/A/IMG_1.CR3', { mime: 'image/x-dcraw' }))
const SINGLE = pictureOf(listingEntry(3, '/A/IMG_3.JPG'))
const UNTOUCHED = pictureOf(listingEntry(4, '/B/IMG_4.JPG'))
const RESET = pictureOf(listingEntry(5, '/B/IMG_5.JPG'))
const PICKED: Decision = { ...UNDECIDED, flag: 'picked' }

const tagsOf = (picture: Picture<ListingEntry>) => (picture === SINGLE ? ['Anna'] : [])

describe('legacyWrites', () => {
	// spec: XMP-007.5
	it('lists each picture with a stored decision other than undecided or a stored tag, in order', () => {
		const decisions = new Map([[2, PICKED], [5, UNDECIDED]])

		expect(legacyWrites([PAIR, SINGLE, UNTOUCHED, RESET], decisions, tagsOf)).toEqual([
			{ picture: PAIR, decided: true, tags: [] },
			{ picture: SINGLE, decided: false, tags: ['Anna'] },
		])
	})

	// spec: XMP-007.7
	it('lists nothing without legacy rows', () => {
		expect(legacyWrites([UNTOUCHED, RESET], new Map([[5, UNDECIDED]]), tagsOf)).toEqual([])
		expect(hasLegacyRows([])).toBe(false)
		expect(hasLegacyRows([{ picture: PAIR, decided: true, tags: [] }])).toBe(true)
	})
})

describe('acknowledgedIds', () => {
	// spec: XMP-007.6
	it('takes every member of each picture without a failed sidecar', () => {
		const writes = legacyWrites([PAIR, SINGLE], new Map([[1, PICKED]]), tagsOf)

		expect(acknowledgedIds(writes, [{ picture: SINGLE }])).toEqual([1, 2])
		expect(acknowledgedIds(writes, [])).toEqual([1, 2, 3])
		expect(acknowledgedIds(writes, [{ picture: PAIR }, { picture: SINGLE }])).toEqual([])
	})
})

describe('exportedFileIds', () => {
	// spec: XMP-007.8
	it('takes each file id of the export once, in order', () => {
		const exported = {
			decisions: [{ fileId: 9, rating: 1, colourLabel: null, flag: 'unflagged' as const, keepRaw: false }, { fileId: 7, ...PICKED }],
			tags: [{ fileId: 9, tags: ['Anna'] }, { fileId: 8, tags: ['Ben'] }],
		}

		expect(exportedFileIds(exported)).toEqual([7, 8, 9])
	})
})
