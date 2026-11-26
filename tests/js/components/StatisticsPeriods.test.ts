// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { formatDay, formatDayRange } from '../../../src/shared/l10n.ts'
import { chip, COUNTERS, hero, mountPage, periodLabel, step, tile, TODAY } from './statistics-page-fixtures.ts'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

enableAutoUnmount(afterEach)

describe('StatisticsPage periods', () => {
	// spec: STATS-001.52, STATS-001.55
	it('steps back to an empty month and to today, with the arrows disabled at the ends', async () => {
		const wrapper = mountPage({ firstDay: '2026-10-01' })
		await flushPromises()

		expect(step(wrapper, 'Next period').attributes('disabled')).toBeDefined()
		expect(chip(wrapper, 'Today').attributes('disabled')).toBeDefined()

		await step(wrapper, 'Previous period').trigger('click')

		expect(periodLabel(wrapper)).toBe('October 2026')
		expect(wrapper.find('.statistics-hero__value').text()).toBe('0')
		expect(hero(wrapper)).not.toContain('%')
		expect(hero(wrapper)).toContain('No active day in this period')
		expect(wrapper.findAll('.statistics-hero__split i')).toHaveLength(0)
		expect(wrapper.find('.statistics-bars__empty').text()).toBe('Nothing counted in this period.')
		expect(wrapper.find('.statistics-bars__chart').exists()).toBe(false)
		expect(step(wrapper, 'Previous period').attributes('disabled')).toBeDefined()
		expect(step(wrapper, 'Next period').attributes('disabled')).toBeUndefined()

		await chip(wrapper, 'Today').trigger('click')

		expect(periodLabel(wrapper)).toBe('November 2026')
	})

	// spec: STATS-001.52
	it('keeps the month stepped to when the segment goes to the year and back', async () => {
		const wrapper = mountPage({ firstDay: '2025-01-01' })
		await flushPromises()
		await step(wrapper, 'Previous period').trigger('click')
		await chip(wrapper, 'Year').trigger('click')

		expect(periodLabel(wrapper)).toBe('2026')

		await chip(wrapper, 'Month').trigger('click')

		expect(periodLabel(wrapper)).toBe('October 2026')
	})

	// spec: STATS-001.41
	it('compares Photos decided up to the same day and names the days before', async () => {
		const wrapper = mountPage()
		await flushPromises()
		await chip(wrapper, 'Week').trigger('click')

		expect(hero(wrapper)).not.toContain('%')

		const before = mountPage({ counters: [...COUNTERS, { day: '2026-11-10', metric: METRIC.decided, value: 9 }, { day: '2026-11-15', metric: METRIC.decided, value: 900 }], firstDay: '2026-10-01' })
		await flushPromises()
		await chip(before, 'Week').trigger('click')

		expect(wrapper.find('.statistics-hero__change').exists()).toBe(false)
		expect(before.find('.statistics-hero__change').text()).toMatch(new RegExp(`^▲ 100\\s?% more than ${formatDayRange('2026-11-09', '2026-11-13')}$`))
	})

	// spec: STATS-001.41
	it('compares a past period with the whole period before', async () => {
		const wrapper = mountPage({ counters: [{ day: '2026-09-03', metric: METRIC.decided, value: 10 }, { day: '2026-10-30', metric: METRIC.decided, value: 5 }], firstDay: '2026-09-03' })
		await flushPromises()
		await step(wrapper, 'Previous period').trigger('click')

		expect(wrapper.find('.statistics-hero__change').text()).toMatch(/^▼ 50\s?% fewer than September$/)

		const week = mountPage({ counters: [{ day: '2026-11-04', metric: METRIC.decided, value: 10 }, { day: '2026-11-11', metric: METRIC.decided, value: 5 }], firstDay: '2026-11-01' })
		await flushPromises()
		await chip(week, 'Week').trigger('click')
		await step(week, 'Previous period').trigger('click')

		expect(week.find('.statistics-hero__change').text()).toMatch(/^▼ 50\s?% fewer than the week before$/)
	})

	// spec: STATS-001.56
	it('shows the longest run inside a past period', async () => {
		const wrapper = mountPage({ counters: [...COUNTERS, { day: '2026-10-07', metric: METRIC.decided, value: 1 }, { day: '2026-10-08', metric: METRIC.decided, value: 1 }, { day: '2026-10-09', metric: METRIC.decided, value: 1 }], firstDay: '2026-10-07' })
		await flushPromises()
		await step(wrapper, 'Previous period').trigger('click')

		expect(tile(wrapper, 'Days in a row')).toContain('3')
		expect(tile(wrapper, 'Days in a row')).toContain('Longest in this period')
	})

	// spec: STATS-001.54
	it('hatches the days after today and outlines today', async () => {
		const wrapper = mountPage()
		await flushPromises()

		expect(wrapper.findAll('.statistics-bars__bar--future')).toHaveLength(10)
		expect(wrapper.findAll('.statistics-bars__bar--today')).toHaveLength(1)
		expect(wrapper.find('.statistics-bars__bar--today').attributes('aria-label')).toContain(formatDay(TODAY))
	})
})
