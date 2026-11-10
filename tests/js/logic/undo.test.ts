// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { NO_HISTORY, pushUndo, recordStep, redoStep, UNDO_LIMIT, undoEntry, undoStep } from '../../../src/logic/undo.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const PAIR = pictureOf(listingEntry(1, '/P/A.JPG'), listingEntry(2, '/P/A.NEF', { mime: 'image/x-dcraw' }))
const JPEG = pictureOf(listingEntry(3, '/P/B.JPG'))
const decided = (fields: Partial<Decision>): Decision => ({ ...UNDECIDED, ...fields })

describe('undoEntry', () => {
	// spec: KEYS-001.11
	it('names the pictures the change alters, with the rows it writes and the rows that put them back', () => {
		const entry = undoEntry([
			{ picture: PAIR, decision: decided({ flag: 'picked', rating: 2 }) },
			{ picture: JPEG, decision: decided({ flag: 'rejected' }) },
		], { flag: 'rejected' })

		expect(entry).toEqual({
			change: { flag: 'rejected' },
			names: ['A'],
			after: [{ fileId: 1, ...decided({ flag: 'rejected', rating: 2 }) }, { fileId: 2, ...decided({ flag: 'rejected', rating: 2 }) }],
			before: [{ fileId: 1, ...decided({ flag: 'picked', rating: 2 }) }, { fileId: 2, ...decided({ flag: 'picked', rating: 2 }) }],
		})
	})

	// spec: KEYS-001.11
	it('names only the pairs for Keep RAW', () => {
		const entry = undoEntry([{ picture: PAIR, decision: UNDECIDED }, { picture: JPEG, decision: UNDECIDED }], { keepRaw: true })

		expect(entry?.names).toEqual(['A'])
	})

	// spec: KEYS-001.11
	it('is null when the change alters nothing', () => {
		expect(undoEntry([{ picture: JPEG, decision: decided({ rating: 3 }) }], { rating: 3 })).toBeNull()
	})
})

describe('pushUndo', () => {
	// spec: KEYS-001.11
	it('adds the entry last and keeps the most recent steps only', () => {
		const entry = undoEntry([{ picture: JPEG, decision: UNDECIDED }], { rating: 1 })!
		const full = Array.from({ length: UNDO_LIMIT }, (_, at) => ({ ...entry, names: [String(at)] }))

		expect(pushUndo([], entry)).toEqual([entry])
		const pushed = pushUndo(full, entry)
		expect(pushed).toHaveLength(UNDO_LIMIT)
		expect(pushed[0]!.names).toEqual(['1'])
		expect(pushed.at(-1)).toBe(entry)
		expect(UNDO_LIMIT).toBe(50)
	})
})

describe('undo and redo steps', () => {
	const step = (rating: number) => undoEntry([{ picture: JPEG, decision: UNDECIDED }], { rating })!

	// spec: KEYS-001.10
	it('moves a step to redo on undo and back on redo', () => {
		const recorded = recordStep(recordStep(NO_HISTORY, step(1)), step(2))
		const undone = undoStep(recorded)!
		expect(undone.entry).toEqual(step(2))
		expect(undone.history).toEqual({ done: [step(1)], undone: [step(2)] })
		const redone = redoStep(undone.history)!
		expect(redone.entry).toEqual(step(2))
		expect(redone.history).toEqual({ done: [step(1), step(2)], undone: [] })
	})

	// spec: KEYS-001.10
	it('has nothing to undo or redo on empty stacks', () => {
		expect(undoStep(NO_HISTORY)).toBeNull()
		expect(redoStep(NO_HISTORY)).toBeNull()
	})

	// spec: KEYS-001.11
	it('clears redo on a new decision', () => {
		const undone = undoStep(recordStep(NO_HISTORY, step(1)))!.history
		expect(redoStep(recordStep(undone, step(3)))).toBeNull()
	})

	it('keeps the limit on redo', () => {
		const full = { done: Array.from({ length: UNDO_LIMIT }, (_, at) => step(at % 6)), undone: [step(5)] }
		expect(redoStep(full)!.history.done).toHaveLength(UNDO_LIMIT)
	})
})
