// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from '../../../src/components/AppIcon.vue'
import FlagButtons from '../../../src/components/FlagButtons.vue'
import { FLAG_ICONS } from '../../../src/flag-icons.ts'

describe('FlagButtons', () => {
	// spec: GRID-002.12
	it('labels Pick, Reject and Unflag and gives each its own flag icon', () => {
		const wrapper = mount(FlagButtons, { props: { flag: undefined } })
		const buttons = wrapper.findAll('button')

		expect(buttons.map((button) => button.attributes('aria-label'))).toEqual(['Pick', 'Reject', 'Unflag'])
		expect(buttons.map((button) => button.findComponent(AppIcon).props('name'))).toEqual([FLAG_ICONS.picked, FLAG_ICONS.rejected, FLAG_ICONS.unflagged])
	})

	// spec: GRID-002.12
	it('draws the Pick flag filled and the Unflag flag as an outline', () => {
		const wrapper = mount(FlagButtons, { props: { flag: undefined } })
		const filled = wrapper.findAll('button').map((button) => button.find('.app-icon--filled').exists())

		expect(filled).toEqual([true, false, false])
	})

	// spec: LOUPE-002.11
	it('puts Unflag between Pick and Reject when large, so Pick and Reject take the outer edges', () => {
		const wrapper = mount(FlagButtons, { props: { flag: undefined, size: 'large' } })

		expect(wrapper.findAll('button').map((button) => button.attributes('aria-label'))).toEqual(['Pick', 'Unflag', 'Reject'])
	})
})
