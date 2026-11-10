// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FolderPicker from '../../src/components/FolderPicker.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import SettingsDialog from '../../src/components/SettingsDialog.vue'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { mountApp, openCull, shownNames } from './app-cull.ts'

describe('App: the settings', () => {
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

	it('applies and saves a change from the dialog: singles off leave the grid', async () => {
		const { wrapper, savedSettings } = mountApp()
		await openCull(wrapper)
		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])

		wrapper.findComponent(SettingsDialog).vm.$emit('update', { showSingles: false })
		await flushPromises()

		expect(shownNames(wrapper)).toEqual(['IMG_10'])
		expect(savedSettings).toEqual([{ ...DEFAULT_SETTINGS, showSingles: false }])
	})

	it('gives the folder picker the pairing settings', async () => {
		const { wrapper } = mountApp({ loadSettings: async () => ({ rawExtensions: ['nef'] }) })
		await flushPromises()

		expect(wrapper.findComponent(FolderPicker).props('pairing')).toEqual({ rawExtensions: ['nef'], renderedExtensions: DEFAULT_SETTINGS.renderedExtensions, folderMode: DEFAULT_SETTINGS.folderMode })
	})

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
})
