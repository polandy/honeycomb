// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { parsePositions, pictureHolding, positionFileId, positionOf, resumeIndex } from '../../../src/logic/resume-position.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const pair = pictureOf(listingEntry(1, '/P/A.NEF'), listingEntry(2, '/P/A.JPG'))
const rawOnly = pictureOf(listingEntry(3, '/P/B.NEF'))
const jpegOnly = pictureOf(listingEntry(4, '/P/C.JPG'))
const position = { folderSet: { paths: ['/P', '/Q'], subfolders: false }, fileId: 2, decided: 1, total: 3, updatedAt: 10 }

describe('parsePositions', () => {
	it('keeps the well-formed positions in their order', () => {
		const other = { ...position, folderSet: { paths: [''], subfolders: true }, fileId: 9 }
		expect(parsePositions([position, other])).toEqual([
			{ folderSet: position.folderSet, fileId: 2, decided: 1, total: 3 },
			{ folderSet: other.folderSet, fileId: 9, decided: 1, total: 3 },
		])
	})

	it('drops malformed positions and answers nothing for an answer that is no list', () => {
		const malformed = [
			null,
			'x',
			{ ...position, folderSet: null },
			{ ...position, folderSet: { paths: '/P', subfolders: false } },
			{ ...position, folderSet: { paths: [1], subfolders: false } },
			{ ...position, folderSet: { paths: ['/P'] } },
			{ ...position, fileId: 0 },
			{ ...position, fileId: 1.5 },
			{ ...position, decided: -1 },
			{ ...position, decided: 4 },
			{ ...position, total: '3' },
		]
		expect(parsePositions([...malformed, position])).toHaveLength(1)
		expect(parsePositions({ positions: [position] })).toEqual([])
	})
})

describe('positionOf', () => {
	it('finds the position of the same folder set whatever the order of its paths', () => {
		const [parsed] = parsePositions([position])
		expect(positionOf([parsed!], { paths: ['/Q', '/P'], subfolders: false })).toBe(parsed)
		expect(positionOf([parsed!], { paths: ['/P', '/Q'], subfolders: true })).toBeNull()
	})
})

describe('positionFileId', () => {
	it('names a picture by its rendered member, a RAW alone by itself', () => {
		expect([positionFileId(pair), positionFileId(rawOnly), positionFileId(jpegOnly)]).toEqual([2, 3, 4])
	})
})

describe('pictureHolding', () => {
	it('finds the picture with the file as any member, or null', () => {
		expect(pictureHolding([rawOnly, pair], 1)).toBe(pair)
		expect(pictureHolding([rawOnly, pair], 2)).toBe(pair)
		expect(pictureHolding([rawOnly, pair], 7)).toBeNull()
	})
})

describe('resumeIndex', () => {
	const rejected: Decision = { ...UNDECIDED, flag: 'rejected' }
	const decisionOf = (decided: readonly Picture<ListingEntry>[]) => (picture: Picture<ListingEntry>) => (decided.includes(picture) ? rejected : UNDECIDED)

	// spec: DECISIONS-002.9
	it('opens at the picture, else at the first undecided one of the view, else at the first', () => {
		expect(resumeIndex([rawOnly, pair, jpegOnly], pair, decisionOf([]))).toBe(1)
		expect(resumeIndex([rawOnly, jpegOnly], pair, decisionOf([rawOnly]))).toBe(1)
		expect(resumeIndex([rawOnly, jpegOnly], pair, decisionOf([rawOnly, jpegOnly]))).toBe(0)
		expect(resumeIndex([], pair, decisionOf([]))).toBe(-1)
	})
})
