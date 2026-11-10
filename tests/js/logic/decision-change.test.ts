// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'

import { describe, expect, it } from 'vitest'
import { changedRows, commonDecision, resolveChange, revertRows, withRows } from '../../../src/logic/decision-change.ts'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const PAIR = pictureOf(listingEntry(1, '/P/A.JPG'), listingEntry(2, '/P/A.NEF', { mime: 'image/x-dcraw' }))
const JPEG = pictureOf(listingEntry(3, '/P/B.JPG'))
const RAW = pictureOf(listingEntry(4, '/P/C.NEF', { mime: 'image/x-dcraw' }))
const decided = (fields: Partial<Decision>): Decision => ({ ...UNDECIDED, ...fields })

describe('commonDecision', () => {
	it('holds each value all pictures share and undefined where they differ', () => {
		const common = commonDecision([
			{ picture: PAIR, decision: decided({ rating: 3, flag: 'picked', keepRaw: true }) },
			{ picture: JPEG, decision: decided({ rating: 3, colourLabel: 'red' }) },
		])

		expect(common).toEqual({ rating: 3, colourLabel: undefined, flag: undefined, keepRaw: true, canKeepRaw: true })
	})

	it('takes Keep RAW from the pairs only, and none without a pair', () => {
		expect(commonDecision([{ picture: JPEG, decision: UNDECIDED }])).toMatchObject({ keepRaw: undefined, canKeepRaw: false })
		expect(commonDecision([])).toEqual({ rating: undefined, colourLabel: undefined, flag: undefined, keepRaw: undefined, canKeepRaw: false })
	})
})

describe('resolveChange', () => {
	const two = (a: Partial<Decision>, b: Partial<Decision>) => [{ picture: PAIR, decision: decided(a) }, { picture: JPEG, decision: decided(b) }]

	it('sets the rating as given', () => {
		expect(resolveChange({ kind: 'rating', rating: 4 }, two({ rating: 4 }, { rating: 4 }))).toEqual({ rating: 4 })
	})

	it.each([
		['sets a flag not every picture has', 'picked', {}, { flag: 'picked' }, { flag: 'picked' }],
		['unflags when every picture has the flag', 'rejected', { flag: 'rejected' }, { flag: 'rejected' }, { flag: 'unflagged' }],
		['keeps Unflag an unflag', 'unflagged', {}, {}, { flag: 'unflagged' }],
	] as const)('%s', (_, flag, a, b, change) => {
		expect(resolveChange({ kind: 'flag', flag }, two(a, b))).toEqual(change)
	})

	it.each([
		['sets a label not every picture has', 'red', { colourLabel: 'red' }, {}, { colourLabel: 'red' }],
		['removes it when every picture has it', 'red', { colourLabel: 'red' }, { colourLabel: 'red' }, { colourLabel: null }],
		['removes every label for no label', null, { colourLabel: 'blue' }, {}, { colourLabel: null }],
	] as const)('%s', (_, label, a, b, change) => {
		expect(resolveChange({ kind: 'colourLabel', colourLabel: label }, two(a, b))).toEqual(change)
	})

	it('marks Keep RAW unless every pair has it, ignoring singles', () => {
		const pairs = (keepRaw: boolean) => [{ picture: PAIR, decision: decided({ keepRaw }) }, { picture: JPEG, decision: UNDECIDED }]

		expect(resolveChange({ kind: 'keepRaw' }, pairs(false))).toEqual({ keepRaw: true })
		expect(resolveChange({ kind: 'keepRaw' }, pairs(true))).toEqual({ keepRaw: false })
	})
})

describe('changedRows', () => {
	it('writes the whole new state for every member of each changed picture', () => {
		const rows = changedRows([{ picture: PAIR, decision: decided({ rating: 2 }) }, { picture: RAW, decision: UNDECIDED }], { flag: 'picked' })

		expect(rows).toEqual([
			{ fileId: 1, ...decided({ rating: 2, flag: 'picked' }) },
			{ fileId: 2, ...decided({ rating: 2, flag: 'picked' }) },
			{ fileId: 4, ...decided({ flag: 'picked' }) },
		])
	})

	it('skips pictures the change leaves as they are', () => {
		expect(changedRows([{ picture: JPEG, decision: decided({ rating: 5 }) }], { rating: 5 })).toEqual([])
	})

	it('changes Keep RAW on pairs only', () => {
		const rows = changedRows([{ picture: PAIR, decision: UNDECIDED }, { picture: JPEG, decision: UNDECIDED }], { keepRaw: true })

		expect(rows.map((row) => row.fileId)).toEqual([1, 2])
	})
})

describe('withRows and revertRows', () => {
	const before = new Map([[1, decided({ rating: 1 })], [9, decided({ flag: 'picked' })]])
	const rows = [{ fileId: 1, ...decided({ rating: 4 }) }, { fileId: 2, ...decided({ rating: 4 }) }]

	it('puts the rows over the decisions without changing the given map', () => {
		const after = withRows(before, rows)

		expect([...after]).toEqual([[1, decided({ rating: 4 })], [9, decided({ flag: 'picked' })], [2, decided({ rating: 4 })]])
		expect(before.get(1)).toEqual(decided({ rating: 1 }))
	})

	it('restores what the rows replaced', () => {
		expect(revertRows(withRows(before, rows), rows, before)).toEqual(before)
	})

	it('keeps a file a later change wrote again', () => {
		const later = withRows(withRows(before, rows), [{ fileId: 2, ...decided({ flag: 'rejected' }) }])

		expect([...revertRows(later, rows, before)]).toEqual([[1, decided({ rating: 1 })], [9, decided({ flag: 'picked' })], [2, decided({ flag: 'rejected' })]])
	})
})
