// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { StoredDecision } from '../../src/logic/decision.ts'
import type { Settings } from '../../src/logic/settings.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { useCull } from '../../src/cull/cull.ts'
import { folderSource } from '../../src/logic/opened-source.ts'
import { DEFAULT_FILTERS } from '../../src/logic/picture-filter.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { ENTRIES, fakeFlags, fakeStorage, NO_SERIES, NO_SIDECARS, NO_TAGS, SAVED_SERIES, SET, stored } from './app-cull.ts'
import { listingEntry } from './logic/listing-entries.ts'

afterEach(() => vi.restoreAllMocks())

/** A cull opened on ENTRIES listed with the rows of its flag table. */
async function openedCull(stored: StoredDecision[] = [], entries = ENTRIES) {
	const flags = fakeFlags(stored)
	const settings = shallowRef<Settings>(DEFAULT_SETTINGS)
	const cull = useCull({
		hashImage: () => new Promise(() => undefined),
		saveVisualHashes: async () => undefined,
		measureImage: async () => ({ sharpness: 0, focusTile: 0 }),
		saveQualityValues: async () => undefined,
		wait: async () => {},
		warmPreviews: async () => undefined,
		flags: flags.api,
		lookupSeries: NO_SERIES,
		saveSeries: SAVED_SERIES,
		tags: NO_TAGS,
	}, fakeStorage(), () => settings.value, NO_SIDECARS)
	cull.open(SET, flags.listed(entries))
	await flushPromises()
	return { cull, flags, settings, picture: (name: string) => cull.pictures.value.find((picture) => picture.baseName === name)! }
}

describe('useCull: open', () => {
	it('holds the opened folder set as a folder source', async () => {
		const { cull } = await openedCull()

		expect(cull.source.value).toEqual(folderSource(SET))
		expect(cull.folderSet.value).toBe(SET)
	})
})

describe('useCull: redo', () => {
	// spec: KEYS-001.10
	it('puts an undone step again', async () => {
		const { cull, picture } = await openedCull()
		const decided = cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_9')])
		cull.undo()

		expect(cull.redo()).toBe(decided)
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
		cull.open(SET, ENTRIES)
		expect(cull.redo()).toBeNull()
	})
})

describe('useCull: series', () => {
	// spec: SERIES-001.9
	it('picks one picture and rejects the rest as one stored undo step', async () => {
		const { cull, picture } = await openedCull()
		const step = cull.pickRest(picture('IMG_9'), [picture('IMG_10'), picture('IMG_2')])

		expect(step).toMatchObject({ kind: 'pickRest', picked: 'IMG_9' })
		expect(['IMG_9', 'IMG_10', 'IMG_2'].map((name) => cull.decisionOf(picture(name)).flag)).toEqual(['picked', 'rejected', 'rejected'])
		expect(cull.undo()).toBe(step)
		expect(['IMG_9', 'IMG_10', 'IMG_2'].map((name) => cull.decisionOf(picture(name)).flag)).toEqual(['unflagged', 'unflagged', 'unflagged'])
		expect(cull.pickRest(picture('IMG_9'), [])).not.toBeNull()
		expect(cull.pickRest(picture('IMG_9'), [])).toBeNull()
	})
})

describe('useCull: toggleFiltersOff', () => {
	const filtered = { ...DEFAULT_FILTERS, rating: 3, flags: new Set(['picked' as const]) }

	it('forgets the saved filters when a new cull opens', async () => {
		const { cull } = await openedCull()
		cull.filters.value = filtered
		cull.toggleFiltersOff()
		cull.open(SET, ENTRIES)

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
		const { cull, picture, flags } = await openedCull()
		const pair = picture('IMG_10')
		cull.decide({ kind: 'flag', flag: 'picked' }, [pair])
		const entries = [pair.raw!, pair.rendered!]
		cull.removeFiles(new Set(entries.map((entry) => entry.fileId)))

		cull.restoreFiles(entries)

		expect(picture('IMG_10')).toMatchObject({ raw: { fileId: pair.raw!.fileId }, rendered: { fileId: pair.rendered!.fileId } })
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('picked')
		expect(cull.pictures.value).toHaveLength(3)
		expect(flags.takenOver).toHaveLength(1)
	})

	// spec: MOVE-004.14
	it('shows the flags the files back carry under new file ids', async () => {
		const { cull, picture, flags } = await openedCull()
		const pair = picture('IMG_10')
		cull.removeFiles(new Set([pair.raw!.fileId, pair.rendered!.fileId]))

		cull.restoreFiles([pair.raw!, pair.rendered!].map((entry) => ({ ...entry, fileId: entry.fileId + 100, flag: 'picked' as const, keepRaw: false, flagUpdated: 1 })))
		await flushPromises()

		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('picked')
		expect(flags.takenOver).toHaveLength(1)
	})

	// spec: MOVE-004.14
	it('takes over the files back that carry no flag', async () => {
		const { cull, picture, flags } = await openedCull()
		const pair = picture('IMG_10')
		cull.removeFiles(new Set([pair.raw!.fileId, pair.rendered!.fileId]))

		cull.restoreFiles([{ ...pair.raw!, fileId: 103 }, { ...pair.rendered!, fileId: 102 }])
		await flushPromises()

		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('unflagged')
		expect(flags.takenOver.at(-1)).toEqual([103, 102].map((fileId) => ({ fileId, flag: 'unflagged', keepRaw: false })))
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

	it('pairs the open cull again when the extensions change and keeps the listed flags', async () => {
		const { cull, settings, picture } = await openedCull([stored(3, 'rejected')])
		const before = cull.pictures.value

		settings.value = { ...settings.value, rawExtensions: ['nef'] }
		await flushPromises()

		expect(cull.pictures.value).not.toBe(before)
		expect(picture('IMG_10')).toMatchObject({ rendered: { fileId: 2 }, raw: null })
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('rejected')
		settings.value = { ...settings.value, rawExtensions: ['cr3'] }
		await flushPromises()
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('rejected')
	})

	it('keeps the pictures when a setting that does not pair changes', async () => {
		const { cull, settings } = await openedCull()
		const before = cull.pictures.value

		settings.value = { ...settings.value, viKeys: true, autoAdvance: false }
		await flushPromises()

		expect(cull.pictures.value).toBe(before)
	})

	it('pairs what is left after a delete with the settings', async () => {
		const { cull, settings } = await openedCull()
		settings.value = { ...settings.value, folderMode: { kind: 'separate-subfolders', rawSubfolder: 'RAW', renderedSubfolder: 'JPG' } }
		cull.open(SET, [listingEntry(5, '/Trip/A/RAW/X.CR3'), listingEntry(6, '/Trip/A/JPG/X.JPG')])

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
