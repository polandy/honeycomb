// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { CullWrite } from '../../src/cull/cull-core.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { TagStep } from '../../src/logic/undo.ts'

import { describe, expect, it, vi } from 'vitest'
import { useCullSteps } from '../../src/cull/cull-core.ts'
import { prepareCull } from '../../src/logic/cull.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { DEFAULT_SETTINGS, pairingSettings } from '../../src/logic/settings.ts'
import { listingEntry } from './logic/listing-entries.ts'

type FolderPicture = Picture<ListingEntry>

/** The steps of a folder cull over the pair a (JPEG 1, RAW 2) and the single b (3); the pictures start rated 1. */
function stepsOn() {
	const writes: CullWrite[] = []
	const effects = vi.fn<(step: TagStep<FolderPicture>, back: boolean) => void>()
	const steps = useCullSteps<TagStep<FolderPicture>>({ storedOf: () => RATED_1, write: (write) => writes.push(write), effects })
	steps.open()
	const pictures = prepareCull([listingEntry(1, '/P/a.jpg'), listingEntry(2, '/P/a.dng'), listingEntry(3, '/P/b.jpg')], pairingSettings(DEFAULT_SETTINGS)).pictures
	return { steps, writes, effects, pair: pictures[0]!, single: pictures[1]! }
}

const RATED_1 = { ...UNDECIDED, rating: 1 }
const PICKED = { ...RATED_1, flag: 'picked' } as const

describe('useCullSteps', () => {
	it('shows a decision on every member at once and hands its rows and the decisions before to the write', () => {
		const { steps, writes, pair } = stepsOn()
		steps.put([{ fileId: 3, ...RATED_1, rating: 4 }])
		const before = steps.decided.value

		const step = steps.decide({ kind: 'flag', flag: 'picked' }, [pair])

		expect(step?.kind).toBe('decision')
		expect(steps.decisionOf(pair)).toEqual(PICKED)
		expect(writes).toEqual([{ from: [{ fileId: 1, ...RATED_1 }, { fileId: 2, ...RATED_1 }], to: [{ fileId: 1, ...PICKED }, { fileId: 2, ...PICKED }], before, back: false }])
	})

	it('takes a step back through the write and puts it again', () => {
		const { steps, writes, pair } = stepsOn()
		steps.decide({ kind: 'flag', flag: 'picked' }, [pair])

		expect(steps.undo()?.kind).toBe('decision')
		expect(steps.decisionOf(pair)).toEqual(RATED_1)
		expect(writes[1]).toMatchObject({ to: [{ fileId: 1, ...RATED_1 }, { fileId: 2, ...RATED_1 }], back: true })
		expect(steps.redo()?.kind).toBe('decision')

		expect(steps.decisionOf(pair)).toEqual(PICKED)
		expect(writes[2]).toMatchObject({ to: [{ fileId: 1, ...PICKED }, { fileId: 2, ...PICKED }], back: false })
	})

	it('hands a step of another kind to the effects, also back, and writes no rows for it', () => {
		const { steps, writes, effects, single } = stepsOn()
		const tags: TagStep<FolderPicture> = { kind: 'tags', names: ['b'], change: { added: ['sea'], removed: [] }, pictures: [single] }

		expect(steps.record(tags)).toBe(tags)
		steps.undo()

		expect(effects.mock.calls).toEqual([[tags, false], [tags, true]])
		expect(writes).toEqual([])
	})

	it('reads a decision from the rendered member, then the RAW, then the stored one', () => {
		const { steps, pair, single } = stepsOn()

		steps.put([{ fileId: 2, ...PICKED }])
		expect(steps.decisionOf(pair)).toEqual(PICKED)
		expect(steps.decisionOf(single)).toEqual(RATED_1)
		steps.put([{ fileId: 1, ...RATED_1, rating: 5 }])

		expect(steps.decisionOf(pair)).toEqual({ ...RATED_1, rating: 5 })
	})

	it('records and writes nothing for a decision that changes nothing', () => {
		const { steps, writes, pair } = stepsOn()

		expect(steps.decide({ kind: 'rating', rating: 1 }, [pair])).toBeNull()
		expect(steps.undo()).toBeNull()

		expect(writes).toEqual([])
	})

	it('forgets the decisions on clear but keeps the steps', () => {
		const { steps, pair } = stepsOn()
		steps.decide({ kind: 'flag', flag: 'picked' }, [pair])

		steps.clear()
		expect(steps.decided.value.size).toBe(0)

		expect(steps.undo()?.kind).toBe('decision')
	})

	it('forgets the decisions and the steps on open', () => {
		const { steps, writes, pair } = stepsOn()
		steps.decide({ kind: 'flag', flag: 'picked' }, [pair])

		steps.open()

		expect(steps.decisionOf(pair)).toEqual(RATED_1)
		expect(steps.undo()).toBeNull()
		expect(writes).toHaveLength(1)
	})
})
