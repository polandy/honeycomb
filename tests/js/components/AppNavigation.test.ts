// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { subscribe, unsubscribe } from '@nextcloud/event-bus'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AppNavigation from '../../../src/components/AppNavigation.vue'
import RecentFolderSets from '../../../src/components/RecentFolderSets.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

const isMobile = ref(true)
vi.mock('@nextcloud/vue/composables/useIsMobile', () => ({ useIsMobile: () => isMobile }))

const MARK = TRANSLATED_MARK
const position = { folderSet: { paths: ['/A', '/B'], subfolders: false }, fileId: 9, decided: 0, total: 40 }
const ITEMS = [{ position, current: false, decided: 0, total: 40 }]

function mountNavigation(items = ITEMS) {
	return mount(AppNavigation, { props: { items } })
}

describe('AppNavigation', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		isMobile.value = true
	})

	// spec: DECISIONS-002.8
	it('lists the recent folder sets under Recent and opens one', async () => {
		const wrapper = mountNavigation()

		expect(wrapper.text()).toContain(`${MARK}Recent`)
		expect(wrapper.findComponent(RecentFolderSets).props('items')).toEqual(ITEMS)
		wrapper.findComponent(RecentFolderSets).vm.$emit('open', position)

		expect(wrapper.emitted('openRecent')).toEqual([[position]])
	})

	it('says so while no folder set was culled', () => {
		expect(mountNavigation([]).text()).toContain(`${MARK}Folder sets you cull show here.`)
	})

	it('opens the folder picker and the settings', async () => {
		const wrapper = mountNavigation()
		const button = (name: string) => wrapper.findAll('a, button').find((each) => each.text() === `${MARK}${name}`)!

		await button('Folder').trigger('click')
		await button('Settings').trigger('click')

		expect(wrapper.emitted('chooseFolders')).toEqual([[]])
		expect(wrapper.emitted('openSettings')).toEqual([[]])
	})

	// spec: DECISIONS-002.12
	it.each([true, false])('closes the navigation after a tap on a narrow screen only (narrow: %s)', async (narrow) => {
		isMobile.value = narrow
		const toggled = vi.fn()
		subscribe('toggle-navigation', toggled)
		const wrapper = mountNavigation()
		const button = (name: string) => wrapper.findAll('a, button').find((each) => each.text() === `${MARK}${name}`)!

		wrapper.findComponent(RecentFolderSets).vm.$emit('open', position)
		await button('Folder').trigger('click')
		await button('Settings').trigger('click')
		unsubscribe('toggle-navigation', toggled)

		expect(toggled).toHaveBeenCalledTimes(narrow ? 3 : 0)
		expect(toggled.mock.calls.every(([event]) => event.open === false)).toBe(true)
	})

	// spec: APP-001.4
	it('renders no text that bypasses the catalogue but the toggle, which @nextcloud/vue translates', () => {
		expect(untranslatedText(mountNavigation().element)).toEqual(['Open navigation', 'Open navigation'])
	})
})
