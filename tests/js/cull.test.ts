// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { CullSidecars } from '../../src/cull.ts'
import type { StoredDecision } from '../../src/logic/decision.ts'
import type { Settings } from '../../src/logic/settings.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { useCull } from '../../src/cull.ts'
import { logger } from '../../src/logger.ts'
import { DEFAULT_FILTERS } from '../../src/logic/picture-filter.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { ENTRIES, fakeStorage, SET, stored } from './app-cull.ts'
import { listingEntry } from './logic/listing-entries.ts'

/** Sidecars with nothing to take over, written without a word. */
const NO_SIDECARS: CullSidecars = { takeOver: async () => [], write: async () => ({ written: 0, failed: [] }) }

/** The error the next lookups fail with, reset before each test. */
let lookupFails: Error | null = null
beforeEach(() => {
	lookupFails = null
})
afterEach(() => vi.restoreAllMocks())

/** A cull opened on ENTRIES whose saves are recorded. */
async function openedCull(stored: StoredDecision[] = [], entries = ENTRIES) {
	const saved: StoredDecision[][] = []
	const lookedUp: number[][] = []
	const settings = shallowRef<Settings>(DEFAULT_SETTINGS)
	const cull = useCull({
		hashImage: () => new Promise(() => undefined),
		warmPreviews: async () => undefined,
		lookupDecisions: async (fileIds) => {
			lookedUp.push([...fileIds])
			if (lookupFails !== null) {
				throw lookupFails
			}
			return [...stored]
		},
		saveDecisions: async (rows) => { saved.push([...rows]) },
	}, fakeStorage(), () => settings.value, NO_SIDECARS)
	cull.open(SET, entries, [])
	await flushPromises()
	return { cull, saved, lookedUp, settings, picture: (name: string) => cull.pictures.value.find((picture) => picture.baseName === name)! }
}

describe('useCull: redo', () => {
	// spec: KEYS-001.10
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

	// spec: KEYS-001.11
	it('has nothing to redo after a new decision or a new cull', async () => {
		const { cull, picture } = await openedCull()
		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_9')])
		cull.undo()
		cull.decide({ kind: 'rating', rating: 2 }, [picture('IMG_2')])
		expect(cull.redo()).toBeNull()

		cull.undo()
		cull.open(SET, ENTRIES, [])
		expect(cull.redo()).toBeNull()
	})
})

describe('useCull: series', () => {
	// spec: SERIES-001.9
	it('picks one picture and rejects the rest as one stored undo step', async () => {
		const { cull, saved, picture } = await openedCull()
		const step = cull.pickRest(picture('IMG_9'), [picture('IMG_10'), picture('IMG_2')])

		expect(step?.change).toEqual({ pickRest: 'IMG_9' })
		expect(saved.at(-1)).toEqual(step!.after)
		expect(['IMG_9', 'IMG_10', 'IMG_2'].map((name) => cull.decisionOf(picture(name)).flag)).toEqual(['picked', 'rejected', 'rejected'])
		expect(cull.undo()).toBe(step)
		expect(['IMG_9', 'IMG_10', 'IMG_2'].map((name) => cull.decisionOf(picture(name)).flag)).toEqual(['unflagged', 'unflagged', 'unflagged'])
		expect(cull.pickRest(picture('IMG_9'), [])).not.toBeNull()
		expect(cull.pickRest(picture('IMG_9'), [])).toBeNull()
	})

	// spec: SERIES-001.1, SERIES-001.5
	it('forms the series of the cull and leaves a picture out once it is rejected', async () => {
		const entries = [
			listingEntry(1, '/Trip/A.JPG', { captureTime: 10 }),
			listingEntry(2, '/Trip/B.JPG', { captureTime: 11 }),
			listingEntry(3, '/Trip/C.JPG', { captureTime: 12 }),
		]
		const { cull, picture } = await openedCull([], entries)
		expect(cull.series.value.map((series) => series.map((each) => each.baseName))).toEqual([['A', 'B', 'C']])

		cull.decide({ kind: 'flag', flag: 'rejected' }, [picture('B')])
		expect(cull.series.value.map((series) => series.map((each) => each.baseName))).toEqual([['A', 'C']])
		expect([picture('A'), picture('B')].map((each) => cull.seriesSizes.value.get(each))).toEqual([2, undefined])
	})
})

describe('useCull: setFlags', () => {
	// spec: GRID-002.2
	it('replaces the flag filter and keeps the other groups', async () => {
		const { cull } = await openedCull()
		cull.filters.value = { ...DEFAULT_FILTERS, rating: 2 }

		cull.setFlags(new Set(['rejected']))

		expect(cull.filters.value).toEqual({ ...DEFAULT_FILTERS, rating: 2, flags: new Set(['rejected']) })
	})
})

describe('useCull: toggleFiltersOff', () => {
	const filtered = { ...DEFAULT_FILTERS, rating: 3, flags: new Set(['picked' as const]) }

	it('clears the filters, and the second press restores them', async () => {
		const { cull } = await openedCull()
		cull.filters.value = filtered

		cull.toggleFiltersOff()
		expect(cull.filters.value).toEqual(DEFAULT_FILTERS)
		cull.toggleFiltersOff()
		expect(cull.filters.value).toEqual(filtered)
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
		cull.open(SET, ENTRIES, [])

		cull.toggleFiltersOff()
		expect(cull.filters.value).toEqual(DEFAULT_FILTERS)
	})
})

describe('useCull: removeFiles', () => {
	it('takes trashed files out of the listing, pairs again what is left and keeps the decision of the member that stayed', async () => {
		const { cull, picture } = await openedCull()
		const pair = picture('IMG_10')
		const single = picture('IMG_2')
		cull.decide({ kind: 'flag', flag: 'rejected' }, [pair])

		const replaced = cull.removeFiles(new Set([1, 2]))

		expect(cull.pictures.value.map((shown) => shown.baseName).sort()).toEqual(['IMG_10', 'IMG_9'])
		expect(picture('IMG_10')).toMatchObject({ raw: { fileId: 3 }, rendered: null })
		expect(replaced).toEqual(new Map([[pair, picture('IMG_10')], [single, null]]))
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('rejected')
		expect(cull.progress.value).toEqual({ decided: 1, total: 2 })
	})
})

describe('useCull: restoreFiles', () => {
	// spec: MOVE-004.11
	it('puts files back into the listing, pairs them again and keeps their decisions', async () => {
		const { cull, picture, lookedUp } = await openedCull()
		const pair = picture('IMG_10')
		cull.decide({ kind: 'flag', flag: 'picked' }, [pair])
		const entries = [pair.raw!, pair.rendered!]
		cull.removeFiles(new Set(entries.map((entry) => entry.fileId)))

		cull.restoreFiles(entries)

		expect(picture('IMG_10')).toMatchObject({ raw: { fileId: pair.raw!.fileId }, rendered: { fileId: pair.rendered!.fileId } })
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('picked')
		expect(cull.pictures.value).toHaveLength(3)
		expect(lookedUp).toHaveLength(1)
	})

	// spec: MOVE-004.14
	it('reads the decisions of files back under new file ids', async () => {
		const rows: StoredDecision[] = []
		const { cull, picture, lookedUp } = await openedCull(rows)
		const pair = picture('IMG_10')
		cull.removeFiles(new Set([pair.raw!.fileId, pair.rendered!.fileId]))
		rows.push(stored(pair.raw!.fileId + 100, 'picked'), stored(pair.rendered!.fileId + 100, 'picked'))

		cull.restoreFiles([{ ...pair.raw!, fileId: pair.raw!.fileId + 100 }, { ...pair.rendered!, fileId: pair.rendered!.fileId + 100 }])
		await flushPromises()

		expect(lookedUp.at(-1)).toEqual([pair.raw!.fileId + 100, pair.rendered!.fileId + 100])
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('picked')
	})

	// spec: MOVE-004.14
	it('logs a failed read of the decisions of files back, and leaves them undecided', async () => {
		const { cull, picture } = await openedCull()
		const error = new Error('offline')
		const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const pair = picture('IMG_10')
		cull.removeFiles(new Set([pair.raw!.fileId, pair.rendered!.fileId]))
		lookupFails = error

		cull.restoreFiles([{ ...pair.raw!, fileId: 103 }, { ...pair.rendered!, fileId: 102 }])
		await flushPromises()

		expect(logged).toHaveBeenCalledWith('Could not read the decisions of the photos moved back', { error })
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('unflagged')
	})

	// spec: MOVE-004.14
	it('drops the decisions of files back once another folder set is open', async () => {
		const rows: StoredDecision[] = []
		const { cull, picture } = await openedCull(rows)
		const pair = picture('IMG_10')
		cull.removeFiles(new Set([pair.raw!.fileId, pair.rendered!.fileId]))
		rows.push(stored(103, 'picked'))

		cull.restoreFiles([{ ...pair.raw!, fileId: 103 }])
		rows.length = 0
		cull.open(SET, [{ ...pair.raw!, fileId: 103 }], [])
		await flushPromises()

		expect(cull.decisionOf(cull.pictures.value[0]!).flag).toBe('unflagged')
	})
})

describe('useCull: settings', () => {
	it('leaves the singles out of the cull while show singles is off', async () => {
		const { cull, settings } = await openedCull([stored(1, 'rejected'), stored(4, 'picked')])

		settings.value = { ...settings.value, showSingles: false }

		expect(cull.pictures.value.map((shown) => shown.baseName)).toEqual(['IMG_10'])
		expect(cull.view.value.map((shown) => shown.baseName)).toEqual(['IMG_10'])
		expect(cull.progress.value).toEqual({ decided: 0, total: 1 })

		settings.value = { ...settings.value, showSingles: true }

		expect(cull.progress.value).toEqual({ decided: 2, total: 3 })
	})

	it('pairs the open cull again when the extensions change, keeps the decisions and reads those of new members', async () => {
		const { cull, settings, lookedUp, picture } = await openedCull([stored(3, 'rejected')])
		const before = cull.pictures.value

		settings.value = { ...settings.value, rawExtensions: ['nef'] }
		await flushPromises()

		expect(cull.pictures.value).not.toBe(before)
		expect(picture('IMG_10')).toMatchObject({ rendered: { fileId: 2 }, raw: null })
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('unflagged')
		settings.value = { ...settings.value, rawExtensions: ['cr3'] }
		await flushPromises()
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('rejected')
		expect(lookedUp).toHaveLength(3)
	})

	it('keeps the pictures when a setting that does not pair changes', async () => {
		const { cull, settings, lookedUp } = await openedCull()
		const before = cull.pictures.value

		settings.value = { ...settings.value, viKeys: true, autoAdvance: false }
		await flushPromises()

		expect(cull.pictures.value).toBe(before)
		expect(lookedUp).toHaveLength(1)
	})

	it('pairs what is left after a delete with the settings', async () => {
		const { cull, settings } = await openedCull()
		settings.value = { ...settings.value, folderMode: { kind: 'separate-subfolders', rawSubfolder: 'RAW', renderedSubfolder: 'JPG' } }
		cull.open(SET, [listingEntry(5, '/Trip/A/RAW/X.CR3'), listingEntry(6, '/Trip/A/JPG/X.JPG')], [])

		cull.removeFiles(new Set([6]))

		expect(cull.pictures.value).toEqual([expect.objectContaining({ folder: '/Trip/A', raw: expect.objectContaining({ fileId: 5 }) })])
	})

	// spec: GRID-002.7
	it('counts the progress shown over the filtered pictures and the saved progress over all', async () => {
		const { cull } = await openedCull([stored(1, 'rejected'), stored(4, 'picked')])

		expect(cull.shownProgress.value).toEqual({ decided: 1, total: cull.view.value.length })
		expect(cull.progress.value.total).toBeGreaterThan(cull.shownProgress.value.total)
	})
})
