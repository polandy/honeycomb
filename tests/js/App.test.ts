// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FolderPicker from '../../src/components/FolderPicker.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import NoFolderState from '../../src/components/NoFolderState.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import { logger } from '../../src/logger.ts'
import { ENTRIES, fakeStorage, mountApp, openCull, SET, shownNames } from './app-cull.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from './l10n/marked-catalogue.ts'
import { listingEntry } from './logic/listing-entries.ts'

const MARK = TRANSLATED_MARK

describe('App', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		vi.restoreAllMocks()
	})

	// spec: APP-001.3
	it('shows that no folder is chosen and opens the folder picker', () => {
		const { wrapper } = mountApp()

		expect(wrapper.text()).toContain(`${MARK}No folder chosen`)
		expect(wrapper.text()).toContain(`${MARK}Choose a folder…`)
		expect(wrapper.findComponent(FolderPicker).props('current')).toBeNull()
		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
	})

	// spec: APP-001.3
	it('opens the folder picker again from the no-folder state', async () => {
		const { wrapper } = mountApp()
		wrapper.findComponent(FolderPicker).vm.$emit('cancel')
		await flushPromises()
		expect(wrapper.findComponent(FolderPicker).exists()).toBe(false)

		await wrapper.findComponent(NoFolderState).find('button').trigger('click')

		expect(wrapper.findComponent(FolderPicker).props('current')).toBeNull()
	})

	// spec: IMAGES-001.10
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

	// spec: IMAGES-001.11
	it('logs a failed warm-up and keeps the grid', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { wrapper } = mountApp({ warmPreviews: () => Promise.reject(new Error('down')) })

		await openCull(wrapper)

		expect(error).toHaveBeenCalledOnce()
		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(true)
	})

	// spec: LISTING-003.11
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

	// spec: GRID-001.9
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

	// spec: GRID-001.8
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

	// spec: GRID-001.8
	it('uses the default thumbnail size when the browser keeps no site data', async () => {
		const { wrapper } = mountApp({ storage: fakeStorage({}, true) })
		await openCull(wrapper)

		wrapper.findComponent(PhotoGrid).vm.$emit('update:tileSize', 250)
		await flushPromises()

		expect(wrapper.findComponent(PhotoGrid).props('tileSize')).toBe(250)
	})

	// spec: APP-001.4
	it('renders no text that bypasses the catalogue', async () => {
		const { wrapper } = mountApp()
		expect(untranslatedText(wrapper.element as Element)).toEqual([])

		await openCull(wrapper, SET, [])
		expect(untranslatedText(wrapper.element as Element)).toEqual([])
	})

	// spec: LISTING-002.11
	it('warns above the grid about a base name several files of a folder share', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper, SET, [...ENTRIES, listingEntry(5, '/Trip/B/IMG_2.jpg')])

		expect(wrapper.text()).toContain('2 files share the name IMG_2; shown as singles')
	})
})
