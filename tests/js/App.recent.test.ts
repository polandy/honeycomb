// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppNavigation from '../../src/components/AppNavigation.vue'
import FolderPicker from '../../src/components/FolderPicker.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import SettingsDialog from '../../src/components/SettingsDialog.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { ENTRIES, mountApp, openCull, SET, shownNames } from './app-cull.ts'
import { listingEntry } from './logic/listing-entries.ts'

const OTHER = { paths: ['/Other'], subfolders: false }
const trip = { folderSet: SET, fileId: 4, decided: 1, total: 3, updatedAt: 2 }
const other = { folderSet: OTHER, fileId: 7, decided: 0, total: 1, updatedAt: 1 }

/** The app over a server that stores the positions of /Trip and /Other and lists /Trip. */
function openApp() {
	const listed: string[] = []
	return {
		listed,
		...mountApp({
			positions: { loadPositions: async () => [trip, other], savePosition: async () => undefined },
			listEntries: async (path: string, subfolders: boolean) => {
				listed.push(`${path}${subfolders ? ' +' : ''}`)
				return { entries: path === '/Trip' ? ENTRIES : [], truncated: false, sharedFolders: [] }
			},
		}),
	}
}

describe('App: Recent', () => {
	// spec: DECISIONS-002.8
	it('lists the recent folder sets in the navigation and opens one at its position', async () => {
		const { wrapper, listed } = openApp()
		await flushPromises()
		const navigation = wrapper.findComponent(AppNavigation)
		expect(navigation.props('items').map((item: { position: { fileId: number } }) => item.position.fileId)).toEqual([4, 7])

		navigation.vm.$emit('openRecent', trip)
		await flushPromises()

		expect(listed).toEqual(['/Trip +'])
		expect(wrapper.findComponent(PhotoLoupe).props('index')).toBe(shownNames(wrapper).indexOf('IMG_9'))
		expect(wrapper.findComponent(UndoToast).exists()).toBe(false)
		expect(wrapper.findComponent(AppNavigation).props('items')![0]!.current).toBe(true)
	})

	// spec: LISTING-003.13
	it('passes the recent folder sets to the folder picker and opens the one it picks', async () => {
		const { wrapper } = openApp()
		await flushPromises()
		const picker = wrapper.findComponent(FolderPicker)
		expect(picker.props('recent')!.map((item: { position: { fileId: number } }) => item.position.fileId)).toEqual([4, 7])

		picker.vm.$emit('openRecent', trip)
		await flushPromises()

		expect(wrapper.findComponent(FolderPicker).exists()).toBe(false)
		expect(wrapper.findComponent(PhotoLoupe).props('index')).toBe(shownNames(wrapper).indexOf('IMG_9'))
	})

	it('opens the folder picker and the settings from the navigation', async () => {
		const { wrapper } = openApp()
		await openCull(wrapper)

		wrapper.findComponent(AppNavigation).vm.$emit('chooseFolders')
		wrapper.findComponent(AppNavigation).vm.$emit('openSettings')
		await flushPromises()

		expect(wrapper.findComponent(FolderPicker).exists()).toBe(true)
		expect(wrapper.findComponent(SettingsDialog).props('open')).toBe(true)
	})

	// spec: DECISIONS-002.8
	it('lists a folder set first once its cull saved a position', async () => {
		const { wrapper } = openApp()
		await openCull(wrapper, OTHER, [listingEntry(7, '/Other/IMG_7.JPG')])

		wrapper.findComponent(PhotoGrid).vm.$emit('open', 0)
		await flushPromises()

		expect(wrapper.findComponent(AppNavigation).props('items').map((item: { position: { fileId: number }, current: boolean }) => [item.position.fileId, item.current])).toEqual([[7, true], [4, false]])
	})
})
