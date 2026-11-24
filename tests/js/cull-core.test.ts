// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../src/logic/decision.ts'
import type { PictureId } from '../../src/logic/picture-id.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCullCore } from '../../src/cull-core.ts'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { assetPicture } from '../../src/logic/immich-asset.ts'
import { immichEntry } from './logic/immich-fixtures.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

/** A decision row of the fake source. */
interface Row extends Decision {
	readonly id: PictureId
}

/** The core over a source whose saves wait until the test answers them; the pictures 1 and 2 start rated 2. */
function coreOn() {
	const saves: { rows: readonly Row[], answer: () => void, fail: (error: Error) => void }[] = []
	const source = { decide: (rows: readonly Row[]) => new Promise<void>((answer, fail) => saves.push({ rows, answer, fail })) }
	const shown = vi.fn<(moves: readonly (readonly [Decision, Decision])[]) => void>()
	const toast = { show: vi.fn(), showError: vi.fn() }
	const core = useCullCore<Row>({ storedOf: () => ({ ...UNDECIDED, rating: 2 }), rowOf: (id, decision) => ({ id, ...decision }), keyOf: (row) => String(row.id), shown, toast })
	core.open(source)
	const pictures = [assetPicture(immichEntry('a1'), 1, 'day'), assetPicture(immichEntry('a2'), 2, 'day')] as const
	return { core, saves, shown, toast, pictures }
}

const RATED_2 = { ...UNDECIDED, rating: 2 }
const PICKED = { ...RATED_2, flag: 'picked' } as const

describe('useCullCore', () => {
	// spec: IMMICH-003.4
	it('shows a decision at once, tells its move, saves its row and toasts it with Undo', () => {
		const { core, saves, shown, toast, pictures } = coreOn()

		expect(core.decisionOf(pictures[0])).toEqual(RATED_2)
		core.decide({ kind: 'flag', flag: 'picked' }, [pictures[0]])

		expect(core.decisionOf(pictures[0])).toEqual(PICKED)
		expect(core.decisionOf(pictures[1])).toEqual(RATED_2)
		expect(shown).toHaveBeenCalledExactlyOnceWith([[RATED_2, PICKED]])
		expect(saves.map(({ rows }) => rows)).toEqual([[{ id: 1, ...PICKED }]])
		expect(toast.show).toHaveBeenCalledExactlyOnceWith(expect.any(String), expect.objectContaining({ run: core.undo }))
	})

	it('records no step, saves nothing and toasts nothing for a decision that changes nothing', () => {
		const { core, saves, shown, toast, pictures } = coreOn()

		core.decide({ kind: 'rating', rating: 2 }, pictures)
		core.undo()

		expect(saves).toEqual([])
		expect(shown).not.toHaveBeenCalled()
		expect(toast.show).not.toHaveBeenCalled()
	})

	// spec: IMMICH-003.19
	it('takes a step back and puts it again, each as a new save', () => {
		const { core, saves, pictures } = coreOn()
		core.decide({ kind: 'flag', flag: 'picked' }, [pictures[0]])
		saves[0]!.answer()

		core.undo()
		expect(core.decisionOf(pictures[0])).toEqual(RATED_2)
		core.redo()

		expect(core.decisionOf(pictures[0])).toEqual(PICKED)
	})

	// spec: IMMICH-003.21
	it('puts back only what no later save stored, tells the move back and says so', async () => {
		vi.spyOn(logger, 'error').mockReturnValue()
		const { core, saves, shown, toast, pictures } = coreOn()
		core.decide({ kind: 'flag', flag: 'rejected' }, pictures)
		core.decide({ kind: 'flag', flag: 'picked' }, [pictures[0]])

		saves[0]!.fail(new Error('database down'))
		await flushPromises()
		saves[1]!.answer()
		await flushPromises()

		const rejected = { ...RATED_2, flag: 'rejected' }
		expect(core.decisionOf(pictures[0])).toEqual(PICKED)
		expect(core.decisionOf(pictures[1])).toEqual(RATED_2)
		expect(shown).toHaveBeenLastCalledWith([[rejected, RATED_2]])
		expect(toast.showError).toHaveBeenCalledExactlyOnceWith('Could not save the decision; it is back as it was')
		expect(logger.error).toHaveBeenCalledWith('Could not save the decisions', expect.objectContaining({ error: expect.any(Error) }))
	})

	it('forgets the decisions on clear and leaves them alone when a save from before fails', async () => {
		vi.spyOn(logger, 'error').mockReturnValue()
		const { core, saves, shown, toast, pictures } = coreOn()
		core.decide({ kind: 'flag', flag: 'picked' }, [pictures[0]])

		core.clear()
		expect(core.decided.value.size).toBe(0)
		saves[0]!.fail(new Error('database down'))
		await flushPromises()

		expect(core.decisionOf(pictures[0])).toEqual(RATED_2)
		expect(shown).toHaveBeenCalledTimes(1)
		expect(toast.showError).not.toHaveBeenCalled()
	})

	it('starts with no decision, a fresh history and save queue on open', async () => {
		const { core, saves, pictures } = coreOn()
		core.decide({ kind: 'flag', flag: 'picked' }, [pictures[0]])
		const reopened: (readonly Row[])[] = []

		core.open({ decide: async (rows) => {
			reopened.push(rows)
		} })
		expect(core.decided.value.size).toBe(0)
		core.undo()
		core.decide({ kind: 'rating', rating: 5 }, [pictures[1]])
		await flushPromises()

		expect(saves).toHaveLength(1)
		expect(reopened).toEqual([[{ id: 2, ...RATED_2, rating: 5 }]])
	})
})
