// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'

import { describe, expect, it } from 'vitest'
import { decisionsByFileId, isDecided, pictureDecision, UNDECIDED } from '../../../src/logic/decision.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const picked = { rating: 4, colourLabel: 'red', flag: 'picked', keepRaw: true } as const
const rejected = { rating: 1, colourLabel: null, flag: 'rejected', keepRaw: false } as const

describe('decisionsByFileId', () => {
	it('keys the stored decisions by file id without the id', () => {
		const byFileId = decisionsByFileId([{ fileId: 7, ...picked }])

		expect(byFileId.get(7)).toEqual(picked)
		expect(byFileId.size).toBe(1)
	})
})

describe('pictureDecision', () => {
	const pair = pictureOf(listingEntry(1, '/P/A.NEF'), listingEntry(2, '/P/A.JPG'))

	it('is undecided without a stored row for any member', () => {
		expect(pictureDecision(pair, new Map())).toEqual(UNDECIDED)
	})

	it.each([
		['the rendered member\'s row', [[2, picked]], picked],
		['the RAW member\'s row without the rendered member\'s', [[1, rejected]], rejected],
		['the rendered member\'s row when the members differ', [[1, rejected], [2, picked]], picked],
	] as const)('of a pair is %s', (_case, rows, expected) => {
		expect(pictureDecision(pair, new Map<number, Decision>(rows))).toEqual(expected)
	})

	it('of a RAW-only single is its row', () => {
		expect(pictureDecision(pictureOf(listingEntry(3, '/P/B.NEF')), new Map([[3, rejected]]))).toEqual(rejected)
	})
})

describe('isDecided', () => {
	it.each([
		['picked', true],
		['rejected', true],
		['unflagged', false],
	] as const)('is %s → %s', (flag, expected) => {
		expect(isDecided({ ...UNDECIDED, rating: 5, flag })).toBe(expected)
	})
})
