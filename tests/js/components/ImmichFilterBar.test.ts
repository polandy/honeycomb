// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ImmichFilterChoices } from '../../../src/logic/immich-filter-choices.ts'
import type { ImmichFilters } from '../../../src/logic/immich-filters.ts'

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ImmichFilterBar from '../../../src/components/ImmichFilterBar.vue'
import { defaultImmichFilters } from '../../../src/logic/immich-filters.ts'
import { NOW, UTC_CALENDAR } from '../logic/immich-fixtures.ts'

const DEFAULTS = defaultImmichFilters(NOW, UTC_CALENDAR)
const CHOICES: ImmichFilterChoices = {
	times: [
		{ option: { kind: 'last-7-days' }, count: 40 },
		{ option: { kind: 'month', year: 2026, month: 11 }, count: 120 },
		{ option: { kind: 'month', year: 2026, month: 10 }, count: 1840 },
		{ option: { kind: 'all' }, count: 3660 },
	],
	devices: [{ value: 'Pixel 9 Pro', count: 90 }, { value: 'SM-S918B', count: 20 }, { value: null, count: 10 }],
	kinds: [{ value: 'photo', count: 100 }, { value: 'live', count: 15 }, { value: 'video', count: 5 }],
}

function mountBar(filters: Partial<ImmichFilters> = {}, choices: ImmichFilterChoices = CHOICES, changed = false) {
	return mount(ImmichFilterBar, { props: { filters: { ...DEFAULTS, ...filters }, choices, changed } })
}

type Bar = ReturnType<typeof mountBar>

const group = (wrapper: Bar, label: string) => wrapper.findAll('[role="group"]').find((found) => found.attributes('aria-label') === label)!
const chips = (wrapper: Bar, label: string) => group(wrapper, label).findAll('button').map((button) => ({ label: button.attributes('aria-label'), text: button.text(), pressed: button.attributes('aria-pressed') }))
const chip = (wrapper: Bar, label: string) => wrapper.findAll('button').find((button) => button.attributes('aria-label') === label)!
const emitted = (wrapper: Bar) => wrapper.emitted<[ImmichFilters]>('update:filters')!.map(([filters]) => filters)

describe('ImmichFilterBar', () => {
	// spec: IMMICH-002.30
	it('shows the time, device and kind options with their counts', () => {
		const wrapper = mountBar()

		expect(chips(wrapper, 'Time')).toEqual([
			{ label: 'Last 7 days', text: 'Last 7 days 40', pressed: 'false' },
			{ label: 'November 2026', text: 'November 2026 120', pressed: 'true' },
			{ label: 'October 2026', text: 'October 2026 1,840', pressed: 'false' },
			{ label: 'All phone uploads', text: 'All phone uploads 3,660', pressed: 'false' },
		])
		expect(chips(wrapper, 'Device').map(({ text }) => text)).toEqual(['Pixel 9 Pro 90', 'SM-S918B 20', 'No camera data 10'])
		expect(chips(wrapper, 'Kind').map(({ text }) => text)).toEqual(['Photos 100', 'Motion photos 15', 'Videos 5'])
	})

	// spec: IMMICH-002.30
	it('chooses one time option and ticks devices and kinds', async () => {
		const wrapper = mountBar({ devices: new Set(['Pixel 9 Pro']) })

		await chip(wrapper, 'October 2026').trigger('click')
		await chip(wrapper, 'No camera data').trigger('click')
		await chip(wrapper, 'Pixel 9 Pro').trigger('click')
		await chip(wrapper, 'Videos').trigger('click')

		expect(emitted(wrapper)).toEqual([
			{ ...DEFAULTS, devices: new Set(['Pixel 9 Pro']), time: { kind: 'month', year: 2026, month: 10 } },
			{ ...DEFAULTS, devices: new Set(['Pixel 9 Pro', null]) },
			{ ...DEFAULTS, devices: new Set() },
			{ ...DEFAULTS, devices: new Set(['Pixel 9 Pro']), kinds: new Set(['video']) },
		])
	})

	// spec: IMMICH-002.33
	it('shows no numbers while counting and no device group without devices', () => {
		const counting: ImmichFilterChoices = { times: CHOICES.times.map(({ option }) => ({ option, count: null })), devices: [], kinds: CHOICES.kinds.map(({ value }) => ({ value, count: null })) }
		const wrapper = mountBar({}, counting)

		expect(chips(wrapper, 'Time').map(({ text }) => text)).toEqual(['Last 7 days', 'November 2026', 'October 2026', 'All phone uploads'])
		expect(chips(wrapper, 'Kind').map(({ text }) => text)).toEqual(['Photos', 'Motion photos', 'Videos'])
		expect(group(wrapper, 'Device')).toBeUndefined()
	})

	// spec: IMMICH-002.31
	it('offers Clear filters only while a filter differs from its default', async () => {
		expect(mountBar().text()).not.toContain('Clear filters')
		const wrapper = mountBar({ kinds: new Set(['video']) }, CHOICES, true)

		const clear = wrapper.findAll('button').find((button) => button.text() === 'Clear filters')!
		await clear.trigger('click')

		expect(wrapper.emitted('clear')).toHaveLength(1)
	})
})
