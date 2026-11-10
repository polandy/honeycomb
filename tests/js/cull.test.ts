// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { StoredDecision } from '../../src/logic/decision.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { useCull } from '../../src/cull.ts'
import { DEFAULT_FILTERS } from '../../src/logic/picture-filter.ts'
import { ENTRIES, fakeStorage, SET } from './app-cull.ts'

/** A cull opened on ENTRIES whose saves are recorded. */
async function openedCull() {
	const saved: StoredDecision[][] = []
	const cull = useCull({
		warmPreviews: async () => undefined,
		lookupDecisions: async () => [],
		saveDecisions: async (rows) => { saved.push([...rows]) },
	}, fakeStorage())
	cull.open(SET, ENTRIES)
	await flushPromises()
	return { cull, saved, picture: (name: string) => cull.pictures.value.find((picture) => picture.baseName === name)! }
}

describe('useCull: redo', () => {
	it('puts an undone step again and stores what it wrote', async () => {
		const { cull, saved, picture } = await openedCull()
		const decided = cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_9')])
		cull.undo()

		expect(cull.redo()).toBe(decided)
		expect(saved.at(-1)).toEqual(decided!.after)
		expect(cull.decisionOf(picture('IMG_9')).flag).toBe('picked')
		expect(cull.redo()).toBeNull()
		expect(cull.undo()).toBe(decided)
	})

	it('has nothing to redo after a new decision or a new cull', async () => {
		const { cull, picture } = await openedCull()
		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_9')])
		cull.undo()
		cull.decide({ kind: 'rating', rating: 2 }, [picture('IMG_2')])
		expect(cull.redo()).toBeNull()

		cull.undo()
		cull.open(SET, ENTRIES)
		expect(cull.redo()).toBeNull()
	})
})

describe('useCull: toggleFiltersOff', () => {
	const filtered = { ...DEFAULT_FILTERS, scope: 'all' as const, rating: 3, flags: new Set(['picked' as const]) }

	it('clears the filters but the scope, and the second press restores them', async () => {
		const { cull } = await openedCull()
		cull.filters.value = filtered

		cull.toggleFiltersOff()
		expect(cull.filters.value).toEqual({ ...DEFAULT_FILTERS, scope: 'all' })
		cull.toggleFiltersOff()
		expect(cull.filters.value).toEqual(filtered)
	})

	it('keeps a scope switched while the filters were off', async () => {
		const { cull } = await openedCull()
		cull.filters.value = filtered
		cull.toggleFiltersOff()
		cull.setScope('undecided')

		cull.toggleFiltersOff()
		expect(cull.filters.value).toEqual({ ...filtered, scope: 'undecided' })
	})

	it('turns off filters set while they were off rather than restoring the saved ones', async () => {
		const { cull } = await openedCull()
		cull.filters.value = filtered
		cull.toggleFiltersOff()
		cull.filters.value = { ...cull.filters.value, rating: 1 }

		cull.toggleFiltersOff()
		expect(cull.filters.value.rating).toBeNull()
		cull.toggleFiltersOff()
		expect(cull.filters.value.rating).toBe(1)
	})

	it('forgets the saved filters when a new cull opens', async () => {
		const { cull } = await openedCull()
		cull.filters.value = filtered
		cull.toggleFiltersOff()
		cull.open(SET, ENTRIES)

		cull.toggleFiltersOff()
		expect(cull.filters.value).toEqual(DEFAULT_FILTERS)
	})
})
