// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { StoredDecision } from '../../src/logic/decision.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FilterBar from '../../src/components/FilterBar.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import { logger } from '../../src/logger.ts'
import { DEFAULT_FILTERS } from '../../src/logic/picture-filter.ts'
import { ENTRIES, mountApp, openCull, SET, shownNames, stored } from './app-cull.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from './l10n/marked-catalogue.ts'
import { listingEntry } from './logic/listing-entries.ts'

const MARK = TRANSLATED_MARK

describe('App: decisions, flag filter, filters and sort', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		vi.restoreAllMocks()
	})

	// spec: GRID-002.8
	it('sorts one folder by file name and follows the sort chosen in the toolbar', async () => {
		const entries = [
			listingEntry(1, '/Trip/IMG_2.JPG', { captureTime: 300 }),
			listingEntry(2, '/Trip/IMG_10.JPG', { captureTime: 100 }),
			listingEntry(3, '/Trip/IMG_9.JPG', { captureTime: 200 }),
		]
		const { wrapper } = mountApp()
		await openCull(wrapper, { paths: ['/Trip'], subfolders: false }, entries)
		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])

		wrapper.findComponent(GridToolbar).vm.$emit('update:sortOrder', 'capture-time')
		await flushPromises()

		expect(shownNames(wrapper)).toEqual(['IMG_10', 'IMG_9', 'IMG_2'])
	})

	// spec: GRID-002.1, GRID-002.7
	it('looks up the decisions of every member and hides rejected photos until the Rejected chip is pressed', async () => {
		const { wrapper, lookedUp } = mountApp({}, [stored(3, 'rejected'), stored(1, 'picked')])

		await openCull(wrapper)

		expect(lookedUp.map((ids) => [...ids].sort((a, b) => a - b))).toEqual([[1, 2, 3, 4]])
		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9'])
		expect(wrapper.findComponent(GridToolbar).props()).toMatchObject({ decided: 1, total: 2 })

		wrapper.findComponent(GridToolbar).vm.$emit('update:flags', new Set())
		await flushPromises()
		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
		expect(wrapper.findComponent(GridToolbar).props()).toMatchObject({ decided: 2, total: 3 })
	})

	// spec: DECISIONS-001.9
	it('ignores the decisions of a folder set that is no longer open', async () => {
		let answer: (rows: StoredDecision[]) => void = () => undefined
		const late = new Promise<StoredDecision[]>((resolve) => {
			answer = resolve
		})
		const lookups = [late, Promise.resolve([])]
		const { wrapper } = mountApp({ lookupDecisions: () => lookups.shift()! })
		await openCull(wrapper)
		await openCull(wrapper, { paths: ['/Trip/A'], subfolders: false }, ENTRIES.slice(1))

		answer([stored(4, 'rejected')])
		await flushPromises()

		expect(shownNames(wrapper)).toEqual(['IMG_9', 'IMG_10'])
	})

	// spec: DECISIONS-001.9
	it('logs a failed lookup and treats every photo as undecided', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { wrapper } = mountApp({ lookupDecisions: () => Promise.reject(new Error('down')) })

		await openCull(wrapper)

		expect(error).toHaveBeenCalledOnce()
		expect(shownNames(wrapper)).toHaveLength(3)
		expect(wrapper.findComponent(GridToolbar).props('decided')).toBe(0)
	})

	it('opens the filter bar from the toolbar and shows what passes its filters', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		expect(wrapper.findComponent(FilterBar).exists()).toBe(false)

		wrapper.findComponent(GridToolbar).vm.$emit('update:filtersOpen', true)
		await flushPromises()
		const bar = wrapper.findComponent(FilterBar)
		expect(bar.props()).toMatchObject({ folders: ['/Trip/A', '/Trip/B'], folderSet: SET, shown: 3, total: 3 })

		bar.vm.$emit('update:filters', { ...DEFAULT_FILTERS, folders: new Set(['/Trip/A']) })
		await flushPromises()
		expect(shownNames(wrapper)).toEqual(['IMG_9', 'IMG_10'])
		expect(wrapper.findComponent(FilterBar).props('shown')).toBe(2)
		expect(wrapper.findComponent(GridToolbar).props()).toMatchObject({ activeFilters: 1, filtersOpen: true })
	})

	// spec: GRID-002.2
	it('shows the toolbar chips and the filter bar group as one flag filter', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		wrapper.findComponent(GridToolbar).vm.$emit('update:filtersOpen', true)
		await flushPromises()

		wrapper.findComponent(FilterBar).vm.$emit('update:filters', { ...DEFAULT_FILTERS, flags: new Set(['unflagged']) })
		await flushPromises()
		expect(wrapper.findComponent(GridToolbar).props('flags')).toEqual(new Set(['unflagged']))

		wrapper.findComponent(GridToolbar).vm.$emit('update:flags', new Set(['picked', 'rejected']))
		await flushPromises()
		expect(wrapper.findComponent(FilterBar).props('filters').flags).toEqual(new Set(['picked', 'rejected']))
	})

	// spec: GRID-002.10
	it('resets the filters and the sort on opening a folder set', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		wrapper.findComponent(GridToolbar).vm.$emit('update:flags', new Set(['rejected']))
		wrapper.findComponent(GridToolbar).vm.$emit('update:sortOrder', 'file-name')
		await flushPromises()

		await openCull(wrapper)

		expect(wrapper.findComponent(GridToolbar).props()).toMatchObject({ flags: new Set(['picked', 'unflagged']), sortOrder: 'capture-time' })
	})

	// spec: GRID-002.11
	it('says when the folders hold no photos', async () => {
		const { wrapper } = mountApp()

		await openCull(wrapper, SET, [])

		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
		expect(wrapper.text()).toContain(`${MARK}No photos in these folders`)
	})

	// spec: GRID-002.11
	it('says when the default flag filter leaves nothing and shows all on request', async () => {
		const { wrapper } = mountApp({}, ENTRIES.map((entry) => stored(entry.fileId, 'rejected')))
		await openCull(wrapper)

		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
		expect(wrapper.text()).toContain(`${MARK}No photos left to cull`)
		await wrapper.findAll('button').find((button) => button.text() === `${MARK}Show all`)!.trigger('click')

		expect(shownNames(wrapper)).toHaveLength(3)
		expect(wrapper.findComponent(GridToolbar).props('flags')).toEqual(new Set())
	})

	// spec: GRID-002.11
	it('says when nothing matches the filters and clears them, the flag filter to its default', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		wrapper.findComponent(GridToolbar).vm.$emit('update:filtersOpen', true)
		await flushPromises()
		wrapper.findComponent(FilterBar).vm.$emit('update:filters', { ...DEFAULT_FILTERS, flags: new Set(['rejected']), rating: 5 })
		await flushPromises()

		expect(wrapper.text()).toContain(`${MARK}Nothing matches these filters`)
		await wrapper.findAll('button').find((button) => button.text() === `${MARK}Clear filters`)!.trigger('click')

		expect(shownNames(wrapper)).toHaveLength(3)
		expect(wrapper.findComponent(GridToolbar).props()).toMatchObject({ flags: new Set(['picked', 'unflagged']), activeFilters: 0 })
	})
})
