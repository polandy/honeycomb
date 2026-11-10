// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { DecisionIntent } from '../../src/logic/decision-change.ts'
import type { Decision } from '../../src/logic/decision.ts'
import type { SwipeSetting } from '../../src/logic/loupe-gesture.ts'
import type { Toast } from '../../src/toast.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { DEFAULT_SWIPES } from '../../src/logic/loupe-gesture.ts'
import { useLoupeDecisions } from '../../src/loupe-decisions.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'

const PICTURES = picturesOf([1, 2, 3].map((id) => listingEntry(id, `/P/IMG_${id}.JPG`)))

/** The loupe's decisions at `index`, with the decisions stored in a map and every call recorded. */
function loupeDecisions(index: number, decided: Record<string, Decision> = {}, settings: { swipes?: SwipeSetting, autoAdvance?: boolean } = {}) {
	const went: number[] = []
	const shown: boolean[] = []
	const toasts: Toast[] = []
	const intents: DecisionIntent[] = []
	let allDecided = 0
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
		allDecided: () => allDecided++,
		swipes: () => settings.swipes ?? DEFAULT_SWIPES,
		autoAdvance: () => settings.autoAdvance ?? true,
	})
	return { decisions, went, shown, toasts, intents, allDecided: () => allDecided }
}

describe('useLoupeDecisions: decide', () => {
	// spec: LOUPE-002.1
	it('says it moved when a flag sends it to the next undecided photo', () => {
		const { decisions, went } = loupeDecisions(0, { IMG_2: { ...UNDECIDED, flag: 'picked' } })
		expect(decisions.decide({ kind: 'flag', flag: 'rejected' })).toBe(true)
		expect(went).toEqual([2])
	})

	it.each([
		['a rating', { kind: 'rating', rating: 3 }, 0],
		['an unflag', { kind: 'flag', flag: 'unflagged' }, 0],
		['a flag on the last undecided photo', { kind: 'flag', flag: 'picked' }, 2],
	// spec: LOUPE-002.2
	] as const)('says it stayed after %s', (_, intent, index) => {
		const { decisions, went } = loupeDecisions(index)
		expect(decisions.decide(intent)).toBe(false)
		expect(went).toEqual([])
	})
})

describe('useLoupeDecisions: auto-advance off', () => {
	// spec: LOUPE-002.5
	it('stays on the photo after a flag', () => {
		const { decisions, went } = loupeDecisions(0, {}, { autoAdvance: false })
		expect(decisions.decide({ kind: 'flag', flag: 'picked' })).toBe(false)
		expect(went).toEqual([])
	})

	it('still goes to the next photo by a Shift key', () => {
		const { decisions, went } = loupeDecisions(0, {}, { autoAdvance: false })
		decisions.decideByKey({ kind: 'flag', flag: 'rejected' }, true)
		expect(went).toEqual([1])
	})

	it('still says when the last undecided photo is decided', () => {
		const { decisions, allDecided } = loupeDecisions(2, { IMG_1: { ...UNDECIDED, flag: 'picked' }, IMG_2: { ...UNDECIDED, flag: 'rejected' } }, { autoAdvance: false })
		decisions.decide({ kind: 'flag', flag: 'picked' })
		expect(allDecided()).toBe(1)
	})
})

describe('useLoupeDecisions: swipe', () => {
	// spec: LOUPE-002.5
	it('sets the flag the settings give the direction', () => {
		const { decisions, intents } = loupeDecisions(0, {}, { swipes: { up: 'rejected', down: null } })
		decisions.swipe('up')
		decisions.swipe('down')
		expect(intents).toEqual([{ kind: 'flag', flag: 'rejected' }])
	})
})

describe('useLoupeDecisions: all decided', () => {
	// spec: LOUPE-002.3
	it('says so when a flag decides the last undecided photo', () => {
		const { decisions, allDecided } = loupeDecisions(2, { IMG_1: { ...UNDECIDED, flag: 'picked' }, IMG_2: { ...UNDECIDED, flag: 'rejected' } })
		decisions.decide({ kind: 'flag', flag: 'picked' })
		expect(allDecided()).toBe(1)
	})

	it.each([
		['an undecided photo is left before the shown one', { kind: 'flag', flag: 'picked' }, { IMG_2: { ...UNDECIDED, flag: 'rejected' } }],
		['the decision is a rating', { kind: 'rating', rating: 4 }, { IMG_1: { ...UNDECIDED, flag: 'picked' }, IMG_2: { ...UNDECIDED, flag: 'rejected' } }],
	// spec: LOUPE-002.3
	] as const)('stays silent when %s', (_, intent, decided) => {
		const { decisions, allDecided } = loupeDecisions(2, { ...decided })
		decisions.decide(intent)
		expect(allDecided()).toBe(0)
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
	// spec: LOUPE-002.6
	it('names the swipe and the flag at the top when hidden by a tap', () => {
		const { decisions, shown, toasts } = loupeDecisions(0)
		decisions.setFlagButtonsShown(false)
		expect(shown).toEqual([false])
		expect(toasts[0]!.message).toBe('Flag buttons hidden · swipe to decide, the flag at the top shows them')
	})

	// spec: LOUPE-002.6
	it('names only the flag at the top when hidden by a tap and no swipe decides', () => {
		const { decisions, toasts } = loupeDecisions(0, {}, { swipes: { up: null, down: null } })
		decisions.setFlagButtonsShown(false)
		expect(toasts[0]!.message).toBe('Flag buttons hidden, and no swipe decides: the flag at the top shows them')
	})

	// spec: LOUPE-002.6
	it('names the key when hidden by B, and Show brings them back', () => {
		const { decisions, shown, toasts } = loupeDecisions(0)
		decisions.setFlagButtonsShown(false, true)
		expect(toasts[0]!.message).toBe('Flag buttons hidden · B shows them')

		toasts[0]!.action!.run()
		expect(shown).toEqual([false, true])
		expect(toasts[1]).toEqual({ message: 'Flag buttons shown', action: null })
	})
})
