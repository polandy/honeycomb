// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FolderSet } from '../../src/logic/folder-set.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.vue'
import FolderPicker from '../../src/components/FolderPicker.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import { logger } from '../../src/logger.ts'
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

function mountApp(props: Record<string, unknown> = {}) {
	const warmed: number[][] = []
	const wrapper = mount(App, {
		props: { storage: fakeStorage(), warmPreviews: async (ids: readonly number[]) => { warmed.push([...ids]) }, ...props },
		global: { stubs: { FolderPicker: true, PhotoGrid: true, GridToolbar: true } },
	})
	return { wrapper, warmed }
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
		expect(grid.props('pictures').map((picture: { baseName: string }) => picture.baseName)).toEqual(['IMG_9', 'IMG_10', 'IMG_2'])
		expect(grid.props('folderSet')).toEqual(SET)
		expect(warmed).toEqual([[4, 2, 1]])
		expect(wrapper.findComponent(GridToolbar).props()).toMatchObject({ folderSet: SET, folders: 2 })
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

	it('renders no text that bypasses the catalogue', () => {
		const { wrapper } = mountApp()

		expect(untranslatedText(wrapper.element as Element)).toEqual([])
	})
})
