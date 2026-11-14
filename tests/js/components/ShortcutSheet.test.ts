// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShortcutSheet from '../../../src/components/ShortcutSheet.vue'
import { KEYMAP } from '../../../src/logic/hotkeys.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { DialogStub } from './stubs.ts'

/** The sheet on a keyboard with Ctrl, or with ⌘ when `mac`. */
function mountSheet(props: Record<string, unknown> = {}, mac = false) {
	vi.spyOn(navigator, 'platform', 'get').mockReturnValue(mac ? 'MacIntel' : 'Linux x86_64')
	return mount(ShortcutSheet, { props, global: { stubs: { NcDialog: DialogStub } } })
}

const rows = (wrapper: ReturnType<typeof mountSheet>) => wrapper.findAll('tr:has(td)').map((row) => [row.findAll('kbd').map((cap) => cap.text()), row.find('td:last-child').text()])

describe('ShortcutSheet', () => {
	afterEach(() => vi.restoreAllMocks())

	// spec: KEYS-001.1
	it('lists every key of the key map under its group, its caps as keys', () => {
		const wrapper = mountSheet()

		expect(wrapper.find('[role="dialog"]').attributes('name')).toBe('Keyboard shortcuts')
		expect(wrapper.findAll('th[scope="rowgroup"]').map((heading) => heading.text())).toEqual(['Flags', 'Rating, colour label, Keep RAW', 'Views and photos', 'Filter and selection', 'Undo, delete and help', 'Vi keys (Settings › Keyboard)'])
		expect(rows(wrapper)).toHaveLength(KEYMAP.length)
		expect(rows(wrapper)[0]).toEqual([['P'], 'Pick (again: unflag)'])
		expect(rows(wrapper).every(([, label]) => label !== '')).toBe(true)
	})

	// spec: SERIES-001.23
	it('names Enter for the loupe and for full screen from the series compare', () => {
		expect(rows(mountSheet()).find(([caps]) => caps?.[0] === 'Enter')).toEqual([['Enter'], 'Open the loupe; series compare: view full screen'])
	})

	// spec: LOUPE-001.25
	it('names N for the series compare and, in the loupe, for the shown photo\'s series', () => {
		expect(rows(mountSheet()).find(([caps]) => caps?.[0] === 'N')).toEqual([['N'], 'Compare series; loupe: the shown photo\'s series'])
	})

	// spec: LOUPE-002.15
	it('names Shift+K for the series compare, the series viewer and the loupe alike', () => {
		expect(rows(mountSheet()).find(([caps]) => caps?.[0] === 'Shift+K')).toEqual([['Shift+K'], 'Series: pick this, reject the rest'])
	})

	// spec: KEYS-001.12
	it('lays out every group in one table, so all groups share the key column', () => {
		const wrapper = mountSheet()
		expect(wrapper.findAll('table')).toHaveLength(1)
		expect(wrapper.findAll('tbody')).toHaveLength(6)
		expect(wrapper.findAll('th[scope="rowgroup"]').every((heading) => heading.attributes('colspan') === '2')).toBe(true)
	})

	// spec: KEYS-001.12
	it('shows a range as from – to and Ctrl as ⌘ on a Mac', () => {
		const wrapper = mountSheet({}, true)
		const rating = wrapper.findAll('tr').find((row) => row.text().includes('Set rating'))!
		expect(rating.find('td').text()).toBe('0 – 5')
		expect(rows(wrapper).find(([, label]) => label === 'Undo')![0]).toEqual(['⌘+Z'])
	})

	// spec: KEYS-001.12
	it('closes by its Close button and by the dialog\'s own close', async () => {
		const wrapper = mountSheet()
		await wrapper.find('button').trigger('click')
		wrapper.findComponent(DialogStub).vm.$emit('update:open', false)
		wrapper.findComponent(DialogStub).vm.$emit('update:open', true)
		expect(wrapper.emitted('close')).toHaveLength(2)
	})

	it('opens inside the given container', () => {
		expect(mountSheet({ container: '.photo-loupe' }).find('[role="dialog"]').attributes('container')).toBe('.photo-loupe')
	})

	describe('with the marked catalogue', () => {
		beforeEach(installMarkedCatalogue)
		afterEach(uninstallMarkedCatalogue)

		it('translates every text but the key caps', () => {
			const wrapper = mountSheet()
			expect(wrapper.find('th').text()).toBe(`${TRANSLATED_MARK}Flags`)
			wrapper.findAll('kbd').forEach((cap) => cap.element.remove())
			expect(untranslatedText(wrapper.element)).toEqual([])
		})
	})
})
