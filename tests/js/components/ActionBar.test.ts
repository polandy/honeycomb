// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { CommonDecision } from '../../../src/logic/decision-change.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import ActionBar from '../../../src/components/ActionBar.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK
const MIXED: CommonDecision = { rating: undefined, colourLabel: undefined, flag: undefined, keepRaw: undefined, canKeepRaw: true }

function mountBar(common: Partial<CommonDecision> = {}, disabled = false) {
	return mount(ActionBar, { props: { common: { ...MIXED, ...common }, disabled }, slots: { default: '<span class="extra">3 selected</span>' } })
}

const button = (wrapper: ReturnType<typeof mountBar>, label: string) => wrapper.findAll('button').find((found) => found.attributes('aria-label')?.replaceAll(MARK, '') === label)!
const pressed = (wrapper: ReturnType<typeof mountBar>) => wrapper.findAll('button[aria-pressed="true"]').map((found) => found.attributes('aria-label')!.replaceAll(MARK, ''))

describe('ActionBar', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	it('presses what every picture shares and nothing where they differ', () => {
		expect(pressed(mountBar())).toEqual([])
		expect(pressed(mountBar({ rating: 3, flag: 'rejected', keepRaw: true }))).toEqual(['Rate 3 stars', 'Keep RAW', 'Reject'])
	})

	it.each([
		['Clear rating', { kind: 'rating', rating: 0 }],
		['Rate 1 star', { kind: 'rating', rating: 1 }],
		['Rate 5 stars', { kind: 'rating', rating: 5 }],
		['Pick', { kind: 'flag', flag: 'picked' }],
		['Reject', { kind: 'flag', flag: 'rejected' }],
		['Unflag', { kind: 'flag', flag: 'unflagged' }],
		['Keep RAW', { kind: 'keepRaw' }],
	])('asks for a change with %s', async (label, intent) => {
		const wrapper = mountBar()

		await button(wrapper, label).trigger('click')

		expect(wrapper.emitted('decide')).toEqual([[intent]])
	})

	it('chooses a colour label or none from the palette and closes it', async () => {
		const wrapper = mountBar({ colourLabel: 'green' })
		const opener = button(wrapper, 'Colour label: Green')
		expect(opener.attributes('aria-expanded')).toBe('false')

		await opener.trigger('click')
		expect(opener.attributes('aria-expanded')).toBe('true')
		expect(wrapper.find('[aria-label$="Green"][aria-pressed="true"]').exists()).toBe(true)
		await button(wrapper, 'Red').trigger('click')
		await opener.trigger('click')
		await button(wrapper, 'No label').trigger('click')

		expect(wrapper.emitted('decide')).toEqual([[{ kind: 'colourLabel', colourLabel: 'red' }], [{ kind: 'colourLabel', colourLabel: null }]])
		expect(wrapper.find('[role="group"].colour-labels__palette').exists()).toBe(false)
	})

	it('closes the palette on Escape without a change and claims the key', async () => {
		const wrapper = mountBar()
		await button(wrapper, 'Colour label').trigger('click')

		const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
		wrapper.find('.colour-labels__palette').element.dispatchEvent(escape)
		await nextTick()

		expect(escape.defaultPrevented).toBe(true)
		expect(wrapper.find('.colour-labels__palette').exists()).toBe(false)
		expect(wrapper.emitted('decide')).toBeUndefined()
	})

	it('disables Keep RAW without a pair and says why', () => {
		const keepRaw = button(mountBar({ canKeepRaw: false }), 'Keep RAW: only for pairs')

		expect(keepRaw.attributes('disabled')).toBeDefined()
	})

	it('disables every control while nothing is selected, the slot stays', () => {
		const wrapper = mountBar({}, true)

		expect(wrapper.findAll('button').every((found) => found.attributes('disabled') !== undefined)).toBe(true)
		expect(wrapper.find('.extra').text()).toBe('3 selected')
	})

	it('translates every text it shows', async () => {
		const wrapper = mountBar({ colourLabel: 'red' })
		await button(wrapper, 'Colour label: Red').trigger('click')

		expect(untranslatedText(wrapper.element as Element)).toEqual(['3 selected'])
	})
})
