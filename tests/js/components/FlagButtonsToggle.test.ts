// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from '../../../src/components/AppIcon.vue'
import FlagButtonsToggle from '../../../src/components/FlagButtonsToggle.vue'

const mountToggle = (shown: boolean) => mount(FlagButtonsToggle, { props: { shown } })

describe('FlagButtonsToggle', () => {
	it('is pressed with a flag while the flag buttons show, and crossed out while they are hidden', () => {
		const shown = mountToggle(true)
		expect(shown.find('button').attributes('aria-label')).toBe('Flag buttons')
		expect(shown.find('button').attributes('aria-pressed')).toBe('true')
		expect(shown.findComponent(AppIcon).props('name')).toBe('flag')

		const hidden = mountToggle(false)
		expect(hidden.find('button').attributes('aria-pressed')).toBe('false')
		expect(hidden.findComponent(AppIcon).props('name')).toBe('flagCross')
	})

	it('flips the flag buttons', async () => {
		const wrapper = mountToggle(true)

		await wrapper.find('button').trigger('click')

		expect(wrapper.emitted('update:shown')).toEqual([[false]])
	})
})
