// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { pushUndo, UNDO_LIMIT, undoEntry } from '../../../src/logic/undo.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const PAIR = pictureOf(listingEntry(1, '/P/A.JPG'), listingEntry(2, '/P/A.NEF', { mime: 'image/x-dcraw' }))
const JPEG = pictureOf(listingEntry(3, '/P/B.JPG'))
const decided = (fields: Partial<Decision>): Decision => ({ ...UNDECIDED, ...fields })

describe('undoEntry', () => {
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

	it('names only the pairs for Keep RAW', () => {
		const entry = undoEntry([{ picture: PAIR, decision: UNDECIDED }, { picture: JPEG, decision: UNDECIDED }], { keepRaw: true })

		expect(entry?.names).toEqual(['A'])
	})

	it('is null when the change alters nothing', () => {
		expect(undoEntry([{ picture: JPEG, decision: decided({ rating: 3 }) }], { rating: 3 })).toBeNull()
	})
})

describe('pushUndo', () => {
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
