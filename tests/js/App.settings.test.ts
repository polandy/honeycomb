// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ViewState } from '../../src/logic/view-state.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CullDialogs from '../../src/components/CullDialogs.vue'
import FolderPicker from '../../src/components/FolderPicker.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import SettingsDialog from '../../src/components/SettingsDialog.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { mountApp, openCull, shownNames } from './app-cull.ts'

enableAutoUnmount(afterEach)

describe('App: the settings', () => {
	// spec: SETTINGS-001.7
	it('opens the settings dialog from the toolbar with the stored settings', async () => {
		const { wrapper } = mountApp({ loadSettings: async () => ({ viKeys: true }) })
		await openCull(wrapper)
		expect(wrapper.findComponent(SettingsDialog).props('open')).toBe(false)

		wrapper.findComponent(GridToolbar).vm.$emit('openSettings')
		await flushPromises()

		const dialog = wrapper.findComponent(SettingsDialog)
		expect(dialog.props('open')).toBe(true)
		expect(dialog.props('settings')).toEqual({ ...DEFAULT_SETTINGS, viKeys: true })
		dialog.vm.$emit('update:open', false)
		await flushPromises()
		expect(wrapper.findComponent(SettingsDialog).props('open')).toBe(false)
	})

	// spec: SETTINGS-001.10, SETTINGS-001.11
	it('applies and saves a change from the dialog: singles off leave the grid', async () => {
		const { wrapper, savedSettings } = mountApp()
		await openCull(wrapper)
		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])

		wrapper.findComponent(SettingsDialog).vm.$emit('update', { showSingles: false })
		await flushPromises()

		expect(shownNames(wrapper)).toEqual(['IMG_10'])
		expect(savedSettings).toEqual([{ ...DEFAULT_SETTINGS, showSingles: false }])
	})

	// spec: SETTINGS-001.22
	it('shows the gesture guide again from the dialog and writes only that key', async () => {
		const saved: Partial<ViewState>[] = []
		const { wrapper } = mountApp({ viewState: { loadViewState: async () => ({ infoPanelOpen: null, gestureGuideSeen: true }), saveViewState: async (patch: Partial<ViewState>) => void saved.push(patch) } })
		await openCull(wrapper)
		expect(wrapper.findComponent(SettingsDialog).props('gestureGuideSeen')).toBe(true)

		wrapper.findComponent(SettingsDialog).vm.$emit('showGestureGuide')
		await flushPromises()

		expect(wrapper.findComponent(SettingsDialog).props('gestureGuideSeen')).toBe(false)
		expect(saved).toEqual([{ gestureGuideSeen: false }])
	})

	// spec: SETTINGS-001.13
	it('clears the selection when the pairing changes, but not on another change', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		wrapper.findComponent(GridToolbar).vm.$emit('update:selecting', true)
		wrapper.findComponent(PhotoGrid).vm.$emit('update:selection', { ids: new Set([1, 4]), anchor: 4 })
		await flushPromises()
		const selected = () => [...wrapper.findComponent(PhotoGrid).props('selection')!.ids]

		wrapper.findComponent(SettingsDialog).vm.$emit('update', { viKeys: true })
		await flushPromises()
		expect(selected()).toEqual([1, 4])
		wrapper.findComponent(SettingsDialog).vm.$emit('update', { renderedExtensions: ['jpg', 'tif'] })
		await flushPromises()

		expect(selected()).toEqual([])
	})

	// spec: SETTINGS-001.13
	it('gives the folder picker the pairing settings', async () => {
		const { wrapper } = mountApp({ loadSettings: async () => ({ rawExtensions: ['nef'] }) })
		await flushPromises()

		expect(wrapper.findComponent(FolderPicker).props('pairing')).toEqual({ rawExtensions: ['nef'], renderedExtensions: DEFAULT_SETTINGS.renderedExtensions, folderMode: DEFAULT_SETTINGS.folderMode })
	})

	// spec: LISTING-003.24
	it('asks for the folders of the picker and the move dialog with the extension lists', async () => {
		const listFolders = vi.fn(async () => [])
		const { wrapper } = mountApp({ listFolders, loadSettings: async () => ({ rawExtensions: ['nef'], renderedExtensions: ['jpg', 'tif'] }) })
		await flushPromises()
		const extensions = { rawExtensions: ['nef'], renderedExtensions: ['jpg', 'tif'] }

		await wrapper.findComponent(FolderPicker).props('listFolders')?.('/P')
		expect(listFolders).toHaveBeenLastCalledWith('/P', extensions)
		await openCull(wrapper)
		await wrapper.findComponent(CullDialogs).props('listFolders')('/Q')
		expect(listFolders).toHaveBeenLastCalledWith('/Q', extensions)
	})

	// spec: SETTINGS-001.14
	it('gives the loupe the settings and saves the changes it makes', async () => {
		const { wrapper, savedSettings } = mountApp()
		await openCull(wrapper)
		wrapper.findComponent(PhotoGrid).vm.$emit('open', 0)
		await flushPromises()
		const loupe = wrapper.findComponent(PhotoLoupe)
		expect(loupe.props('settings')).toEqual(DEFAULT_SETTINGS)

		loupe.vm.$emit('updateSettings', { flagButtonsShown: false })
		await flushPromises()

		expect(wrapper.findComponent(PhotoLoupe).props('settings')).toEqual({ ...DEFAULT_SETTINGS, flagButtonsShown: false })
		expect(savedSettings).toEqual([{ ...DEFAULT_SETTINGS, flagButtonsShown: false }])
	})

	// spec: SETTINGS-001.25
	it('clears the cache from the dialog and says so', async () => {
		let cleared = 0
		const { wrapper } = mountApp({ clearCache: async () => void cleared++ })
		await openCull(wrapper)

		wrapper.findComponent(SettingsDialog).vm.$emit('clearCache')
		await flushPromises()

		expect(cleared).toBe(1)
		expect(wrapper.findComponent(UndoToast).text()).toContain('Cache cleared')
	})

	// spec: STATS-001.3
	it('resets the statistics from the dialog and says so', async () => {
		let resets = 0
		const { wrapper } = mountApp({ resetStatistics: async () => void resets++ })
		await openCull(wrapper)

		wrapper.findComponent(SettingsDialog).vm.$emit('resetStatistics')
		await flushPromises()

		expect(resets).toBe(1)
		expect(wrapper.findComponent(UndoToast).text()).toContain('Statistics reset')
	})

	// spec: SETTINGS-001.27
	it('cleans up the orphaned data for an admin and says how much', async () => {
		let cleanUps = 0
		const { wrapper } = mountApp({ admin: () => true, cleanUp: async () => (cleanUps++, 12) })
		await openCull(wrapper)
		expect(wrapper.findComponent(SettingsDialog).props('admin')).toBe(true)

		wrapper.findComponent(SettingsDialog).vm.$emit('cleanUp')
		await flushPromises()

		expect(cleanUps).toBe(1)
		expect(wrapper.findComponent(UndoToast).text()).toContain('Removed 12 orphaned entries')
	})

	// spec: SETTINGS-001.27
	it('tells the dialog a user is no admin', async () => {
		const { wrapper } = mountApp({ admin: () => false })
		await openCull(wrapper)

		expect(wrapper.findComponent(SettingsDialog).props('admin')).toBe(false)
	})
	// spec: GRID-004.1, GRID-004.2, GRID-004.3
	it('shows the file names from the More menu and by Shift+J, saving the setting', async () => {
		const { wrapper, savedSettings } = mountApp()
		await openCull(wrapper)
		expect(wrapper.findComponent(PhotoGrid).props('fileNames')).toBe(false)

		wrapper.findComponent(GridToolbar).vm.$emit('update:fileNames', true)
		await flushPromises()
		expect(wrapper.findComponent(PhotoGrid).props('fileNames')).toBe(true)
		expect(wrapper.findComponent(GridToolbar).props('view').fileNames).toBe(true)

		document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', shiftKey: true, bubbles: true, cancelable: true }))
		await flushPromises()
		expect(wrapper.findComponent(PhotoGrid).props('fileNames')).toBe(false)
		expect(savedSettings).toEqual([{ ...DEFAULT_SETTINGS, showFileNames: true }, { ...DEFAULT_SETTINGS, showFileNames: false }])
	})
})
