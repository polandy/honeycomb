// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Flag } from '../../../src/logic/decision.ts'

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from '../../../src/components/AppIcon.vue'
import FlagFilter from '../../../src/components/FlagFilter.vue'
import { FLAG_ICONS } from '../../../src/flag-icons.ts'

const mountFilter = (flags: Flag[]) => mount(FlagFilter, { props: { flags: new Set(flags) } })
const chip = (wrapper: ReturnType<typeof mountFilter>, name: string) => wrapper.find(`button[aria-label="${name}"]`)

describe('FlagFilter', () => {
	// spec: GRID-002.2
	it('shows a labelled filter with a chip per flag, pressed as the flags are', () => {
		const wrapper = mountFilter(['picked', 'unflagged'])

		expect(wrapper.find('[role="group"]').attributes('aria-label')).toBe('Flag')
		expect(wrapper.findAll('button').map((button) => button.attributes('aria-label'))).toEqual(['Picked', 'Unflagged', 'Rejected'])
		expect(wrapper.findAll('button').map((button) => button.attributes('aria-pressed'))).toEqual(['true', 'true', 'false'])
		expect(wrapper.findAllComponents(AppIcon).map((icon) => icon.props('name'))).toEqual(['filter', FLAG_ICONS.picked, FLAG_ICONS.unflagged, FLAG_ICONS.rejected])
	})

	// spec: GRID-002.2
	it.each([
		[['picked', 'unflagged'], 'Rejected', ['picked', 'unflagged', 'rejected']],
		[['picked', 'unflagged'], 'Unflagged', ['picked']],
		[['picked'], 'Picked', []],
		[[], 'Rejected', ['rejected']],
	] as const)('with %j pressed, a tap on %s emits %j', async (flags, name, expected) => {
		const wrapper = mountFilter([...flags])

		await chip(wrapper, name).trigger('click')

		expect(wrapper.emitted('update:flags')).toEqual([[new Set(expected)]])
	})

	// spec: GRID-002.12
	it('gives the three flags three different icons', () => {
		expect(new Set(Object.values(FLAG_ICONS)).size).toBe(3)
	})
})
