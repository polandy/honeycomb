// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { DecisionIntent } from '../../src/logic/decision-change.ts'
import type { Decision } from '../../src/logic/decision.ts'
import type { Toast } from '../../src/toast.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { useLoupeDecisions } from '../../src/loupe-decisions.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'

const PICTURES = picturesOf([1, 2, 3].map((id) => listingEntry(id, `/P/IMG_${id}.JPG`)))

/** The loupe's decisions at `index`, with the decisions stored in a map and every call recorded. */
function loupeDecisions(index: number, decided: Record<string, Decision> = {}) {
	const went: number[] = []
	const shown: boolean[] = []
	const toasts: Toast[] = []
	const intents: DecisionIntent[] = []
	const decisions = useLoupeDecisions({
		pictures: () => PICTURES,
		index: () => index,
		decisionOf: (picture) => decided[picture.baseName] ?? UNDECIDED,
		decide: (intent, picture) => {
			intents.push(intent)
			if (intent.kind === 'flag') {
				decided[picture.baseName] = { ...UNDECIDED, flag: intent.flag }
			}
		},
		go: (next) => went.push(next),
		setFlagButtonsShown: (on) => shown.push(on),
		toast: (toast) => toasts.push(toast),
	})
	return { decisions, went, shown, toasts, intents }
}

describe('useLoupeDecisions: decide', () => {
	it('says it moved when a flag sends it to the next undecided photo', () => {
		const { decisions, went } = loupeDecisions(0, { IMG_2: { ...UNDECIDED, flag: 'picked' } })
		expect(decisions.decide({ kind: 'flag', flag: 'rejected' })).toBe(true)
		expect(went).toEqual([2])
	})

	it.each([
		['a rating', { kind: 'rating', rating: 3 }, 0],
		['an unflag', { kind: 'flag', flag: 'unflagged' }, 0],
		['a flag on the last undecided photo', { kind: 'flag', flag: 'picked' }, 2],
	] as const)('says it stayed after %s', (_, intent, index) => {
		const { decisions, went } = loupeDecisions(index)
		expect(decisions.decide(intent)).toBe(false)
		expect(went).toEqual([])
	})
})

describe('useLoupeDecisions: decideByKey', () => {
	it('steps the shown photo\'s rating', () => {
		const { decisions, intents } = loupeDecisions(0, { IMG_1: { ...UNDECIDED, rating: 2 } })
		expect(decisions.decideByKey({ kind: 'ratingStep', step: 1 }, false)).toBeUndefined()
		decisions.decideByKey({ kind: 'ratingStep', step: -1 }, false)
		expect(intents).toEqual([{ kind: 'rating', rating: 3 }, { kind: 'rating', rating: 1 }])
	})

	it('goes to the next photo when advancing, unless the decision already moved', () => {
		const { decisions, went } = loupeDecisions(0, { IMG_2: { ...UNDECIDED, flag: 'picked' } })
		decisions.decideByKey({ kind: 'rating', rating: 3 }, true)
		decisions.decideByKey({ kind: 'flag', flag: 'rejected' }, true)
		expect(went).toEqual([1, 2])
	})

	it('stays without advancing', () => {
		const { decisions, went } = loupeDecisions(0)
		decisions.decideByKey({ kind: 'colourLabel', colourLabel: 'red' }, false)
		expect(went).toEqual([])
	})
})

describe('useLoupeDecisions: setFlagButtonsShown', () => {
	it('names the swipe and the flag at the top when hidden by a tap', () => {
		const { decisions, shown, toasts } = loupeDecisions(0)
		decisions.setFlagButtonsShown(false)
		expect(shown).toEqual([false])
		expect(toasts[0]!.message).toBe('Flag buttons hidden · swipe to decide, the flag at the top shows them')
	})

	it('names the key when hidden by B, and Show brings them back', () => {
		const { decisions, shown, toasts } = loupeDecisions(0)
		decisions.setFlagButtonsShown(false, true)
		expect(toasts[0]!.message).toBe('Flag buttons hidden · B shows them')

		toasts[0]!.action!.run()
		expect(shown).toEqual([false, true])
		expect(toasts[1]).toEqual({ message: 'Flag buttons shown', action: null })
	})
})
