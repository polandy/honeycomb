// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'

import { describe, expect, it } from 'vitest'
import { countsAsDecided, decisionsByFileId, isDecided, isOpen, isPicked, isRejected, nextUndecided, pictureDecision, UNDECIDED } from '../../../src/logic/decision.ts'
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

	// spec: DECISIONS-001.8
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

	// spec: DECISIONS-001.8
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

describe('isPicked, isRejected and isOpen', () => {
	it.each([
		['picked', true, false, false],
		['rejected', false, true, false],
		['unflagged', false, false, true],
	] as const)('tell %s apart', (flag, picks, rejects, open) => {
		const decision = { ...UNDECIDED, rating: 5, flag }
		expect([isPicked(decision), isRejected(decision), isOpen(decision)]).toEqual([picks, rejects, open])
		expect(isOpen(decision)).toBe(!isDecided(decision))
	})

	it('accepts anything that carries a flag', () => {
		expect(isRejected({ flag: 'rejected' })).toBe(true)
	})
})

describe('nextUndecided', () => {
	const decisions: Decision[] = (['picked', 'unflagged', 'rejected', 'unflagged'] as const).map((flag) => ({ ...UNDECIDED, flag }))
	const next = (from: number) => nextUndecided(decisions, from, isDecided)

	it('finds the first undecided picture after the given one', () => {
		expect(next(0)).toBe(1)
		expect(next(1)).toBe(3)
	})

	it('is null when every picture after it is decided', () => {
		expect(next(3)).toBeNull()
		expect(nextUndecided([], 0, isDecided)).toBeNull()
	})

	// spec: SERIES-005.14
	it('skips what the given test counts as decided', () => {
		expect(nextUndecided(decisions, 0, (decision) => decision !== decisions[1] && isDecided(decision))).toBe(3)
	})
})

describe('countsAsDecided', () => {
	// spec: SERIES-005.14
	it.each([
		['picked', false, true],
		['rejected', false, true],
		['unflagged', false, false],
		['unflagged', true, true],
		['rejected', true, true],
	] as const)('counts %s with a done series %s as %s', (flag, seriesDone, expected) => {
		expect(countsAsDecided({ ...UNDECIDED, flag }, seriesDone)).toBe(expected)
	})
})
