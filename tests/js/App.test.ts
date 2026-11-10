// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { StoredDecision } from '../../src/logic/decision.ts'
import type { FolderSet } from '../../src/logic/folder-set.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.vue'
import FilterBar from '../../src/components/FilterBar.vue'
import FolderPicker from '../../src/components/FolderPicker.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import { logger } from '../../src/logger.ts'
import { DEFAULT_FILTERS } from '../../src/logic/picture-filter.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from './l10n/marked-catalogue.ts'
import { listingEntry } from './logic/listing-entries.ts'

const MARK = TRANSLATED_MARK
const ENTRIES = [
	listingEntry(1, '/Trip/B/IMG_2.JPG'),
	listingEntry(2, '/Trip/A/IMG_10.JPG'),
	listingEntry(3, '/Trip/A/IMG_10.CR3', { mime: 'image/x-dcraw' }),
	listingEntry(4, '/Trip/A/IMG_9.JPG'),
]
const SET: FolderSet = { paths: ['/Trip'], subfolders: true }

/** A storage over a plain map, or one that throws like a browser with site data blocked. */
function fakeStorage(stored: Record<string, string> = {}, blocked = false) {
	return () => {
		if (blocked) {
			throw new DOMException('blocked', 'SecurityError')
		}
		return {
			getItem: (key: string) => stored[key] ?? null,
			setItem: (key: string, value: string) => {
				stored[key] = value
			},
		}
	}
}

/** A stored decision of the file with the given flag. */
function stored(fileId: number, flag: StoredDecision['flag']): StoredDecision {
	return { fileId, rating: 0, colourLabel: null, flag, keepRaw: false }
}

function mountApp(props: Record<string, unknown> = {}, decisions: StoredDecision[] = []) {
	const warmed: number[][] = []
	const lookedUp: number[][] = []
	const wrapper = mount(App, {
		props: {
			storage: fakeStorage(),
			warmPreviews: async (ids: readonly number[]) => { warmed.push([...ids]) },
			lookupDecisions: async (ids: readonly number[]) => {
				lookedUp.push([...ids])
				return decisions
			},
			...props,
		},
		global: { stubs: { FolderPicker: true, PhotoGrid: true, GridToolbar: true, FilterBar: true } },
	})
	return { wrapper, warmed, lookedUp }
}

/** The base names of the pictures the grid shows, in its order. */
function shownNames(wrapper: ReturnType<typeof mountApp>['wrapper']): string[] {
	return wrapper.findComponent(PhotoGrid).props('pictures').map((picture: { baseName: string }) => picture.baseName)
}

async function openCull(wrapper: ReturnType<typeof mountApp>['wrapper'], set = SET, entries = ENTRIES) {
	wrapper.findComponent(FolderPicker).vm.$emit('confirm', set, entries)
	await flushPromises()
}

describe('App', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		vi.restoreAllMocks()
	})

	it('shows that no folder is chosen and opens the folder picker', () => {
		const { wrapper } = mountApp()

		expect(wrapper.text()).toContain(`${MARK}No folder chosen`)
		expect(wrapper.text()).toContain(`${MARK}Choose a folder…`)
		expect(wrapper.findComponent(FolderPicker).props('current')).toBeNull()
		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
	})

	it('shows the grid of the chosen folders in order and warms their previews in that order', async () => {
		const { wrapper, warmed } = mountApp()

		await openCull(wrapper)

		expect(wrapper.findComponent(FolderPicker).exists()).toBe(false)
		expect(wrapper.text()).not.toContain(`${MARK}No folder chosen`)
		const grid = wrapper.findComponent(PhotoGrid)
		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
		expect(grid.props('folderSet')).toEqual(SET)
		expect(warmed).toEqual([[1, 4, 2]])
		expect(wrapper.findComponent(GridToolbar).props()).toMatchObject({ folderSet: SET, folders: 2, sortOrder: 'capture-time', scope: 'not-rejected' })
	})

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

	it('looks up the decisions of every member and hides rejected photos until the scope is All', async () => {
		const { wrapper, lookedUp } = mountApp({}, [stored(3, 'rejected'), stored(1, 'picked')])

		await openCull(wrapper)

		expect(lookedUp.map((ids) => [...ids].sort((a, b) => a - b))).toEqual([[1, 2, 3, 4]])
		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9'])
		expect(wrapper.findComponent(GridToolbar).props()).toMatchObject({ decided: 2, total: 3, scopeLocked: false })

		wrapper.findComponent(GridToolbar).vm.$emit('update:scope', 'all')
		await flushPromises()
		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
	})

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

	it('locks the scope while a flag filter is active', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		wrapper.findComponent(GridToolbar).vm.$emit('update:filtersOpen', true)
		await flushPromises()

		wrapper.findComponent(FilterBar).vm.$emit('update:filters', { ...DEFAULT_FILTERS, flags: new Set(['unflagged']) })
		await flushPromises()

		expect(wrapper.findComponent(GridToolbar).props('scopeLocked')).toBe(true)
	})

	it('resets the filters and the sort on opening a folder set', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		wrapper.findComponent(GridToolbar).vm.$emit('update:scope', 'undecided')
		wrapper.findComponent(GridToolbar).vm.$emit('update:sortOrder', 'file-name')
		await flushPromises()

		await openCull(wrapper)

		expect(wrapper.findComponent(GridToolbar).props()).toMatchObject({ scope: 'not-rejected', sortOrder: 'capture-time' })
	})

	it('says when the folders hold no photos', async () => {
		const { wrapper } = mountApp()

		await openCull(wrapper, SET, [])

		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
		expect(wrapper.text()).toContain(`${MARK}No photos in these folders`)
	})

	it.each([
		['not-rejected', 'rejected', 'No photos left to cull'],
		['undecided', 'picked', 'Every photo is decided'],
	] as const)('says when the scope %s leaves nothing and shows all on request', async (scope, flag, name) => {
		const { wrapper } = mountApp({}, ENTRIES.map((entry) => stored(entry.fileId, flag)))
		await openCull(wrapper)
		wrapper.findComponent(GridToolbar).vm.$emit('update:scope', scope)
		await flushPromises()

		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
		expect(wrapper.text()).toContain(`${MARK}${name}`)
		await wrapper.findAll('button').find((button) => button.text() === `${MARK}Show all`)!.trigger('click')

		expect(shownNames(wrapper)).toHaveLength(3)
		expect(wrapper.findComponent(GridToolbar).props('scope')).toBe('all')
	})

	it('says when nothing matches the filters and clears them, keeping the scope', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		wrapper.findComponent(GridToolbar).vm.$emit('update:scope', 'undecided')
		wrapper.findComponent(GridToolbar).vm.$emit('update:filtersOpen', true)
		await flushPromises()
		wrapper.findComponent(FilterBar).vm.$emit('update:filters', { ...DEFAULT_FILTERS, scope: 'undecided', rating: 5 })
		await flushPromises()

		expect(wrapper.text()).toContain(`${MARK}Nothing matches these filters`)
		await wrapper.findAll('button').find((button) => button.text() === `${MARK}Clear filters`)!.trigger('click')

		expect(shownNames(wrapper)).toHaveLength(3)
		expect(wrapper.findComponent(GridToolbar).props()).toMatchObject({ scope: 'undecided', activeFilters: 0 })
	})

	it('logs a failed warm-up and keeps the grid', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { wrapper } = mountApp({ warmPreviews: () => Promise.reject(new Error('down')) })

		await openCull(wrapper)

		expect(error).toHaveBeenCalledOnce()
		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(true)
	})

	it('reopens the folder picker on the open cull from the toolbar and closes it on cancel', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)

		wrapper.findComponent(GridToolbar).vm.$emit('changeFolders')
		await flushPromises()
		expect(wrapper.findComponent(FolderPicker).props('current')).toEqual(SET)

		wrapper.findComponent(FolderPicker).vm.$emit('cancel')
		await flushPromises()
		expect(wrapper.findComponent(FolderPicker).exists()).toBe(false)
	})

	it('groups by folder only while the cull spans more than one folder', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)

		wrapper.findComponent(GridToolbar).vm.$emit('update:groupByFolder', true)
		await flushPromises()
		expect(wrapper.findComponent(PhotoGrid).props('groupByFolder')).toBe(true)

		wrapper.findComponent(GridToolbar).vm.$emit('changeFolders')
		await flushPromises()
		await openCull(wrapper, { paths: ['/Trip/A'], subfolders: false }, ENTRIES.slice(1))
		expect(wrapper.findComponent(PhotoGrid).props('groupByFolder')).toBe(false)
	})

	it('reads the thumbnail size from the browser and saves every change', async () => {
		const stored = { 'honeycomb.tileSize': '200' }
		const { wrapper } = mountApp({ storage: fakeStorage(stored) })
		await openCull(wrapper)
		expect(wrapper.findComponent(PhotoGrid).props('tileSize')).toBe(200)

		wrapper.findComponent(PhotoGrid).vm.$emit('update:tileSize', 250.5)
		await flushPromises()

		expect(wrapper.findComponent(GridToolbar).props('tileSize')).toBe(250.5)
		expect(stored['honeycomb.tileSize']).toBe('250.5')
		wrapper.findComponent(GridToolbar).vm.$emit('update:tileSize', 120)
		await flushPromises()
		expect(stored['honeycomb.tileSize']).toBe('120')
	})

	it('uses the default thumbnail size when the browser keeps no site data', async () => {
		const { wrapper } = mountApp({ storage: fakeStorage({}, true) })
		await openCull(wrapper)

		wrapper.findComponent(PhotoGrid).vm.$emit('update:tileSize', 250)
		await flushPromises()

		expect(wrapper.findComponent(PhotoGrid).props('tileSize')).toBe(250)
	})

	it('renders no text that bypasses the catalogue', async () => {
		const { wrapper } = mountApp()
		expect(untranslatedText(wrapper.element as Element)).toEqual([])

		await openCull(wrapper, SET, [])
		expect(untranslatedText(wrapper.element as Element)).toEqual([])
	})
})
