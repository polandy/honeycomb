// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { LibraryApi } from '../../src/folders.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppNavigation from '../../src/components/AppNavigation.vue'
import FoldersHome from '../../src/components/FoldersHome.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import { ENTRIES, mountApp, openCull, shownNames } from './app-cull.ts'
import { row } from './logic/folder-fixtures.ts'

const TRIP = { paths: ['/Photos/Trip'], subfolders: false }
const NEW = { paths: ['/Photos/New'], subfolders: false }
const position = { folderSet: TRIP, fileId: 4, decided: 1, total: 3, updatedAt: 2 }

/** The app with the root /Photos, a stored position in /Photos/Trip, and a library that records its reads. */
function openApp() {
	const listed: string[] = []
	const reads: string[] = []
	const library: LibraryApi = {
		listLibraryFolders: async (root) => {
			reads.push(root)
			return { folders: [row({ path: '/Photos/Trip' })], next: null, scanning: null }
		},
		scanLibrary: async () => ({ done: 0, total: 0 }),
	}
	const mounted = mountApp({
		library,
		loadSettings: async () => ({ libraryRoots: ['/Photos'] }),
		positions: { loadPositions: async () => [position], savePosition: async () => undefined },
		listEntries: async (path: string, subfolders: boolean) => {
			listed.push(`${path}${subfolders ? ' +' : ''}`)
			return { entries: ENTRIES, truncated: false, folders: [] }
		},
	})
	return { ...mounted, listed, reads }
}

type App = ReturnType<typeof openApp>['wrapper']

async function cull(wrapper: App, set: typeof TRIP) {
	wrapper.findComponent(FoldersHome).vm.$emit('cull', set)
	await flushPromises()
}

describe('App: Folders', () => {
	// spec: FOLDERS-006.1
	it('reads the list of the roots once the settings are read', async () => {
		const { wrapper, reads } = openApp()
		await flushPromises()

		expect(reads).toEqual(['/Photos'])
		expect(wrapper.findComponent(FoldersHome).props('folders').rows.value).toHaveLength(1)
	})

	// spec: FOLDERS-006.13
	it('opens a folder with a stored position in the loupe at it, as Recent does', async () => {
		const { wrapper, listed } = openApp()
		await flushPromises()

		await cull(wrapper, TRIP)

		expect(listed).toEqual(['/Photos/Trip'])
		expect(wrapper.findComponent(FoldersHome).isVisible()).toBe(false)
		expect(wrapper.findComponent(PhotoLoupe).props('index')).toBe(shownNames(wrapper).indexOf('IMG_9'))
	})

	// spec: FOLDERS-006.13
	it('opens a folder without a stored position at the start of its grid', async () => {
		const { wrapper, listed } = openApp()
		await flushPromises()

		await cull(wrapper, NEW)

		expect(listed).toEqual(['/Photos/New'])
		expect(wrapper.findComponent(PhotoGrid).props('folderSet')).toEqual(NEW)
		expect(wrapper.findComponent(PhotoLoupe).exists()).toBe(false)
	})

	// spec: FOLDERS-006.14
	it('offers Back to folders on a cull from the list and shows the list again with its rows read again', async () => {
		const { wrapper, reads } = openApp()
		await flushPromises()
		await cull(wrapper, NEW)
		expect(wrapper.findComponent(GridToolbar).props('folders')).toMatchObject({ set: NEW, back: true })

		wrapper.findComponent(GridToolbar).vm.$emit('back')
		await flushPromises()

		expect(wrapper.findComponent(FoldersHome).isVisible()).toBe(true)
		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
		expect(reads).toEqual(['/Photos', '/Photos'])
	})

	// spec: FOLDERS-006.15
	it('keeps Change folders on a cull from the folder picker', async () => {
		const { wrapper } = openApp()
		await flushPromises()
		await cull(wrapper, NEW)

		await openCull(wrapper, TRIP)

		expect(wrapper.findComponent(GridToolbar).props('folders')).toMatchObject({ set: TRIP, back: false })
	})

	// spec: FOLDERS-006.16
	it('shows the list from the grid by the navigation\'s Folders', async () => {
		const { wrapper } = openApp()
		await flushPromises()
		await openCull(wrapper, NEW)
		expect(wrapper.findComponent(FoldersHome).isVisible()).toBe(false)

		wrapper.findComponent(AppNavigation).vm.$emit('openFolders')
		await flushPromises()

		expect(wrapper.findComponent(FoldersHome).isVisible()).toBe(true)
		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
	})

	// spec: FOLDERS-006.5
	it('saves the roots the setup chose', async () => {
		const { wrapper, savedSettings } = mountApp()
		await flushPromises()

		wrapper.findComponent(FoldersHome).vm.$emit('saveRoots', ['/Photos', '/Phone'])
		await flushPromises()

		expect(savedSettings.at(-1)).toMatchObject({ libraryRoots: ['/Photos', '/Phone'] })
	})
})
