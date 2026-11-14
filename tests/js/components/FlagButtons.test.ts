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
	it('labels Pick, Unflag and Reject and gives each its own flag icon', () => {
		const wrapper = mount(FlagButtons, { props: { flag: undefined } })
		const buttons = wrapper.findAll('button')

		expect(buttons.map((button) => button.attributes('aria-label'))).toEqual(['Pick', 'Unflag', 'Reject'])
		expect(buttons.map((button) => button.findComponent(AppIcon).props('name'))).toEqual([FLAG_ICONS.picked, FLAG_ICONS.unflagged, FLAG_ICONS.rejected])
	})

	// spec: GRID-002.12
	it('draws the Pick flag filled and the Unflag flag as an outline', () => {
		const wrapper = mount(FlagButtons, { props: { flag: undefined } })
		const filled = wrapper.findAll('button').map((button) => button.find('.app-icon--filled').exists())

		expect(filled).toEqual([true, false, false])
	})

	// spec: LOUPE-002.11, GRID-003.15
	it.each(['small', 'large'] as const)('runs Pick, Unflag, Reject in the %s size, one order everywhere', (size) => {
		const wrapper = mount(FlagButtons, { props: { flag: undefined, size } })

		expect(wrapper.findAll('button').map((button) => button.attributes('aria-label'))).toEqual(['Pick', 'Unflag', 'Reject'])
	})
})
