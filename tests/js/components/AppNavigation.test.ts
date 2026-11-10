// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import AppNavigation from '../../../src/components/AppNavigation.vue'
import RecentFolderSets from '../../../src/components/RecentFolderSets.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK
const position = { folderSet: { paths: ['/A', '/B'], subfolders: false }, fileId: 9, decided: 0, total: 40 }
const ITEMS = [{ position, current: false, decided: 0, total: 40 }]

/** The navigation without NcAppNavigation's own resize handling: its list and footer in place. */
function mountNavigation(items = ITEMS) {
	return mount(AppNavigation, { props: { items } })
}

describe('AppNavigation', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

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

	// spec: APP-001.4
	it('renders no text that bypasses the catalogue', () => {
		expect(untranslatedText(mountNavigation().element)).toEqual([])
	})
})
