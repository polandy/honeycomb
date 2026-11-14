// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import PickerRecentSets from '../../../src/components/PickerRecentSets.vue'
import { installMarkedCatalogue, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

const trip = { folderSet: { paths: ['/Photos/Trip'], subfolders: true }, fileId: 2, decided: 1, total: 3 }
const pair = { folderSet: { paths: ['/A', '/B'], subfolders: false }, fileId: 9, decided: 0, total: 40 }
const ITEMS = [
	{ position: trip, current: true, decided: 2, total: 3 },
	{ position: pair, current: false, decided: 0, total: 40 },
]

function item(index: number) {
	const position = { folderSet: { paths: [`/Set ${index}`], subfolders: false }, fileId: index, decided: 0, total: 10 }
	return { position, current: false, decided: index, total: 10 }
}
const MANY = [1, 2, 3, 4, 5].map(item)

describe('PickerRecentSets', () => {
	// spec: DECISIONS-002.8, LISTING-003.13
	it('lists each folder set with its progress, marks the open one and opens one on a tap', async () => {
		const wrapper = mount(PickerRecentSets, { props: { items: ITEMS } })
		const rows = wrapper.findAll('button.picker-recent-sets__row')

		expect(rows.map((row) => row.text())).toEqual(['Trip + subfolders2 / 3 decided', '2 folders0 / 40 decided'])
		expect(rows.map((row) => row.attributes('aria-current'))).toEqual(['true', undefined])
		await rows[1]!.trigger('click')

		expect(wrapper.emitted('open')).toEqual([[pair]])
	})

	// spec: LISTING-003.15
	it('shows at most three folder sets and no toggle while there are three or fewer', () => {
		const three = mount(PickerRecentSets, { props: { items: MANY.slice(0, 3) } })
		expect(three.findAll('button.picker-recent-sets__row')).toHaveLength(3)
		expect(three.find('.picker-recent-sets__toggle').exists()).toBe(false)

		const five = mount(PickerRecentSets, { props: { items: MANY } })
		expect(five.findAll('button.picker-recent-sets__row')).toHaveLength(3)
		expect(five.find('.picker-recent-sets__toggle').text()).toBe('Show all 5')
	})

	// spec: LISTING-003.15
	it('opens the full list in place and folds it back', async () => {
		const wrapper = mount(PickerRecentSets, { props: { items: MANY } })
		const toggle = () => wrapper.find('.picker-recent-sets__toggle')

		expect(toggle().attributes('aria-expanded')).toBe('false')
		await toggle().trigger('click')
		expect(wrapper.findAll('button.picker-recent-sets__row')).toHaveLength(5)
		expect(toggle().attributes('aria-expanded')).toBe('true')
		expect(toggle().text()).toBe('Show fewer')
		await toggle().trigger('click')
		expect(wrapper.findAll('button.picker-recent-sets__row')).toHaveLength(3)
	})

	// spec: LISTING-003.15
	it('keeps the toggle in the page while it folds, so the focus stays on it', async () => {
		const wrapper = mount(PickerRecentSets, { props: { items: MANY }, attachTo: document.body })
		const toggle = wrapper.find('.picker-recent-sets__toggle')
		;(toggle.element as HTMLElement).focus()
		await toggle.trigger('click')

		expect(document.activeElement).toBe(wrapper.find('.picker-recent-sets__toggle').element)
		wrapper.unmount()
	})

	// spec: LISTING-003.15
	it('keeps the full path in the tooltip of a row so a long name can be cut', () => {
		const long = { folderSet: { paths: ['/Photos/Wedding 2026-06-14 Ceremony and Reception'], subfolders: false }, fileId: 1, decided: 0, total: 300 }
		const wrapper = mount(PickerRecentSets, { props: { items: [{ position: long, current: false, decided: 0, total: 300 }] } })
		const row = wrapper.find('button.picker-recent-sets__row')

		expect(row.attributes('data-tip')).toBe('/Photos/Wedding 2026-06-14 Ceremony and Reception')
		expect(row.find('.picker-recent-sets__name').text()).toBe('Wedding 2026-06-14 Ceremony and Reception')
	})

	describe('translations', () => {
		beforeEach(installMarkedCatalogue)
		afterEach(uninstallMarkedCatalogue)

		it('renders no text that bypasses the catalogue but folder names', async () => {
			const wrapper = mount(PickerRecentSets, { props: { items: [{ ...ITEMS[1]! }] } })
			await nextTick()
			expect(untranslatedText(wrapper.element)).toEqual(['/A, /B'])
		})
	})
})
