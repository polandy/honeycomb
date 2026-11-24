// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullStep } from '../../src/cull.ts'

import { describe, expect, it, vi } from 'vitest'
import { REJECT_HINT_MS, useToastedDecisions } from '../../src/toasted-decisions.ts'

const HINT = 'Rejected photos are hidden; show them with the Rejected chip.'

const rejected = { kind: 'decision', names: ['IMG_0001'], change: { flag: 'rejected' } } as unknown as CullStep
const picked = { kind: 'decision', names: ['IMG_0001'], change: { flag: 'picked' } } as unknown as CullStep
const pickRest = { kind: 'pickRest', names: ['IMG_0001', 'IMG_0002'], picked: 'IMG_0001' } as unknown as CullStep
const reduction = { kind: 'reduction', names: [], series: 2, rejected: 3 } as unknown as CullStep

/** The decisions over a cull that records `step`, a seen flag the hint reads and writes, and the toasts shown. */
function setup(step: CullStep, seen = false) {
	const state = { seen }
	const show = vi.fn()
	const cull = {
		decide: () => step,
		pickRest: () => step,
		reduceSeries: () => step,
		takeSkipped: () => [],
	}
	const decisions = useToastedDecisions(cull as never, show, vi.fn(), { seen: () => state.seen, dismiss: () => { state.seen = true } })
	return { decisions, show, state }
}

describe('the first-reject hint', () => {
	// spec: LOUPE-003.9
	it('adds itself to the toast of the first reject, for longer, and is then dismissed', () => {
		const { decisions, show, state } = setup(rejected)

		decisions.decide({ flag: 'rejected' } as never, [])

		expect(show).toHaveBeenCalledTimes(1)
		expect(show.mock.calls[0]![0]).toBe(`Rejected IMG_0001. ${HINT}`)
		expect(show.mock.calls[0]![4]).toBe(REJECT_HINT_MS)
		expect(state.seen).toBe(true)
	})

	// spec: LOUPE-003.9
	it('says nothing once dismissed', () => {
		const { decisions, show } = setup(rejected, true)

		decisions.decide({ flag: 'rejected' } as never, [])

		expect(show.mock.calls[0]![0]).toBe('Rejected IMG_0001')
		expect(show.mock.calls[0]![4]).toBeUndefined()
	})

	// spec: LOUPE-003.9
	it('stays quiet for a change that rejects nothing and keeps the hint for later', () => {
		const { decisions, show, state } = setup(picked)

		decisions.decide({ flag: 'picked' } as never, [])

		expect(show.mock.calls[0]![0]).toBe('Picked IMG_0001')
		expect(state.seen).toBe(false)
	})

	// spec: LOUPE-003.9
	it('also speaks at pick-the-rest and a series reduction', () => {
		const first = setup(pickRest)
		first.decisions.pickRest({} as never, [])
		const second = setup(reduction)
		second.decisions.reduceSeries({} as never)

		expect(first.show.mock.calls[0]![0]).toContain(HINT)
		expect(second.show.mock.calls[0]![0]).toContain(HINT)
	})
})
