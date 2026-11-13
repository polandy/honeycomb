// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { emit, subscribe, unsubscribe } from '@nextcloud/event-bus'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AppNavigation from '../../../src/components/AppNavigation.vue'
import RecentFolderSets from '../../../src/components/RecentFolderSets.vue'
import { NAVIGATION_OPEN_KEY } from '../../../src/navigation-choice.ts'
import { fakeStorage } from '../app-cull.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

const isMobile = ref(true)
vi.mock('@nextcloud/vue/composables/useIsMobile', () => ({ useIsMobile: () => isMobile }))

const MARK = TRANSLATED_MARK
const position = { folderSet: { paths: ['/A', '/B'], subfolders: false }, fileId: 9, decided: 0, total: 40 }
const ITEMS = [{ position, current: false, decided: 0, total: 40 }]

function mountNavigation(items = ITEMS, stored: Record<string, string> = {}, width = 1440) {
	return mount(AppNavigation, { props: { items, storage: fakeStorage(stored), viewportWidth: () => width } })
}

/** Records what the navigation is told from now on: true to open, false to close. */
function recordToggles() {
	const toggled = vi.fn()
	subscribe('toggle-navigation', toggled)
	return { opens: () => toggled.mock.calls.map(([event]) => event.open), stop: () => unsubscribe('toggle-navigation', toggled) }
}

enableAutoUnmount(afterEach)

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
		const wrapper = mountNavigation()
		const toggles = recordToggles()
		const button = (name: string) => wrapper.findAll('a, button').find((each) => each.text() === `${MARK}${name}`)!

		wrapper.findComponent(RecentFolderSets).vm.$emit('open', position)
		await button('Folder').trigger('click')
		await button('Settings').trigger('click')
		toggles.stop()

		expect(toggles.opens()).toEqual(narrow ? [false, false, false] : [])
	})

	// spec: APP-001.7
	it.each([[1440, true], [1279, false]])('starts open from 1280 px on while the user made no choice (%i px: %s)', (width, open) => {
		isMobile.value = false
		const toggles = recordToggles()
		const stored: Record<string, string> = {}

		mountNavigation(ITEMS, stored, width)
		toggles.stop()

		expect(toggles.opens()).toEqual([open])
		expect(stored).toEqual({})
	})

	// spec: APP-001.7
	it('reads the width of the browser window by default', () => {
		isMobile.value = false
		vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280)
		const toggles = recordToggles()

		mount(AppNavigation, { props: { items: ITEMS, storage: fakeStorage() } })
		toggles.stop()

		expect(toggles.opens()).toEqual([true])
	})

	// spec: APP-001.7
	it('leaves the navigation to Nextcloud on a narrow screen', () => {
		const toggles = recordToggles()

		mountNavigation(ITEMS, { [NAVIGATION_OPEN_KEY]: 'true' })
		toggles.stop()

		expect(toggles.opens()).toEqual([])
	})

	// spec: APP-001.8
	it('remembers the choice made with the toggle and starts with it next time', () => {
		isMobile.value = false
		const stored: Record<string, string> = {}
		const wrapper = mountNavigation(ITEMS, stored, 1440)

		emit('navigation-toggled', { open: true })
		expect(stored).toEqual({})
		emit('navigation-toggled', { open: false })
		expect(stored).toEqual({ [NAVIGATION_OPEN_KEY]: 'false' })
		wrapper.unmount()

		const toggles = recordToggles()
		mountNavigation(ITEMS, { [NAVIGATION_OPEN_KEY]: 'true' }, 1024)
		toggles.stop()
		expect(toggles.opens()).toEqual([true])
	})

	// spec: APP-001.8
	it('remembers no choice made on a narrow screen and starts over when the screen widens', () => {
		isMobile.value = false
		const stored: Record<string, string> = {}
		mountNavigation(ITEMS, stored, 1100)
		const toggles = recordToggles()

		isMobile.value = true
		emit('navigation-toggled', { open: false })
		emit('navigation-toggled', { open: true })
		isMobile.value = false
		emit('navigation-toggled', { open: true })
		toggles.stop()

		expect(stored).toEqual({})
		expect(toggles.opens()).toEqual([false])
	})

	it('stops listening once it is gone', () => {
		isMobile.value = false
		const stored: Record<string, string> = {}
		mountNavigation(ITEMS, stored).unmount()

		emit('navigation-toggled', { open: false })

		expect(stored).toEqual({})
	})

	// spec: APP-001.4
	it('renders no text that bypasses the catalogue but the toggle, which @nextcloud/vue translates', () => {
		expect(untranslatedText(mountNavigation().element)).toEqual(['Open navigation', 'Open navigation'])
	})
})
