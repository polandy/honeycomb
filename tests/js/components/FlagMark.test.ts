// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from '../../../src/components/AppIcon.vue'
import FlagMark from '../../../src/components/FlagMark.vue'
import { FLAG_ICONS } from '../../../src/flag-icons.ts'

describe('FlagMark', () => {
	// spec: GRID-002.12
	it.each(['picked', 'rejected'] as const)('badges %s with the icon of the flag buttons', (flag) => {
		const wrapper = mount(FlagMark, { props: { flag } })

		expect(wrapper.findComponent(AppIcon).props('name')).toBe(FLAG_ICONS[flag])
	})
})
