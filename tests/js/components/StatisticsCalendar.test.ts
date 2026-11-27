// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { chip, fakeLocation, mountPage, periodLabel, ROOTS } from './statistics-page-fixtures.ts'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

enableAutoUnmount(afterEach)

const COUNTERS = [
	{ day: '2025-03-14', metric: METRIC.decided, value: 30 },
	{ day: '2026-10-05', metric: METRIC.decided, value: 9 },
	{ day: '2026-11-02', metric: METRIC.decided, value: 50 },
	{ day: '2026-11-02', metric: METRIC.picked, value: 25 },
	{ day: '2026-11-02', metric: METRIC.rejected, value: 25 },
	{ day: '2026-11-19', metric: METRIC.decided, value: 100 },
]

type Wrapper = ReturnType<typeof mountPage>

/** Mounts the page on the calendar's counters at `hash`, counted since 14 March 2025. */
async function mountCalendar(hash = '', location = fakeLocation(hash)): Promise<Wrapper> {
	const wrapper = mountPage({ counters: COUNTERS, firstDay: '2025-03-14' }, ROOTS, undefined, location)
	await flushPromises()
	return wrapper
}

const square = (wrapper: Wrapper, from: string) => wrapper.find(`.statistics-calendar__square[data-from="${from}"]`)
const detail = (wrapper: Wrapper) => wrapper.find('.statistics-calendar .statistics-bars__detail')
const squares = (wrapper: Wrapper) => wrapper.findAll('.statistics-calendar__grid .statistics-calendar__square')

describe('StatisticsPage activity calendar', () => {
	// spec: STATS-001.70
	it('shows a square per day of the month with its date and level, and a key', async () => {
		const wrapper = await mountCalendar()

		expect(wrapper.find('.statistics-calendar h3').text()).toBe('Activity photos decided per day')
		expect(squares(wrapper)).toHaveLength(30)
		expect(square(wrapper, '2026-11-19').find('.statistics-calendar__text').text()).toBe('19')
		expect(square(wrapper, '2026-11-19').attributes('data-level')).toBe('3')
		expect(square(wrapper, '2026-11-02').attributes('data-level')).toBe('2')
		expect(square(wrapper, '2026-11-03').attributes('data-level')).toBe('0')
		expect(wrapper.findAll('.statistics-calendar__weekday')).toHaveLength(7)
		expect(wrapper.find('.statistics-calendar__legend').text()).toMatch(/^Less\s+More · the fill height shows the amount$/u)
		expect(wrapper.findAll('.statistics-calendar__key')).toHaveLength(4)
	})

	// spec: STATS-001.70
	it('names the days to come, before the first counted day and today by more than their colour', async () => {
		const wrapper = await mountCalendar()

		expect(square(wrapper, '2026-11-21').classes()).toContain('statistics-calendar__square--future')
		expect(square(wrapper, '2026-11-21').attributes('aria-label')).toBe('Sat, Nov 21, 2026: Still to come.')
		expect(square(wrapper, '2026-11-20').classes()).toContain('statistics-calendar__square--today')
		expect(square(wrapper, '2026-11-20').attributes('aria-current')).toBe('date')
		expect(square(wrapper, '2026-11-19').attributes('aria-current')).toBeUndefined()
		expect(square(wrapper, '2026-11-19').attributes('aria-label')).toBe('Thu, Nov 19, 2026: 100 decided (✓ 0 · ✕ 0)')
		expect(square(wrapper, '2026-11-03').attributes('aria-label')).toBe('Tue, Nov 3, 2026: Nothing counted.')
	})

	// spec: STATS-001.70
	it('shows the week as seven squares and the year as twelve months without dates', async () => {
		const week = await mountCalendar('#week=2026-11-19')
		expect(squares(week)).toHaveLength(7)

		const year = await mountCalendar('#year=2026')
		expect(year.findAll('.statistics-calendar__group h4').map((each) => each.text()).slice(0, 2)).toEqual(['January', 'February'])
		expect(squares(year)).toHaveLength(365)
		expect(year.find('.statistics-calendar__weekday').exists()).toBe(false)
		expect(square(year, '2026-11-19').find('.statistics-calendar__text').text()).toBe('')
	})

	// spec: STATS-001.70
	it('shows all time as a row per year with a square per month', async () => {
		const wrapper = await mountCalendar('#all')

		expect(wrapper.find('.statistics-calendar h3').text()).toBe('Activity photos decided per month')
		expect(wrapper.findAll('.statistics-calendar__group h4').map((each) => each.text())).toEqual(['2025', '2026'])
		expect(squares(wrapper)).toHaveLength(24)
		expect(square(wrapper, '2026-11-01').find('.statistics-calendar__text').text()).toBe('N')
		expect(square(wrapper, '2026-11-01').attributes('data-level')).toBe('3')
		expect(square(wrapper, '2026-11-01').attributes('aria-current')).toBeUndefined()
	})

	// spec: STATS-001.72
	it('holds a tapped day in the panel and releases it on the next tap', async () => {
		const wrapper = await mountCalendar()
		expect(detail(wrapper).text()).toBe('Select a day to see its numbers.')

		await square(wrapper, '2026-11-02').trigger('click')

		expect(square(wrapper, '2026-11-02').attributes('aria-pressed')).toBe('true')
		expect(detail(wrapper).text()).toContain('Mon, Nov 2, 2026')
		expect(detail(wrapper).text()).toContain('50 decided (✓ 25 · ✕ 25)')
		expect(detail(wrapper).attributes('aria-live')).toBe('polite')
		expect(detail(wrapper).find('button').exists()).toBe(false)

		await square(wrapper, '2026-11-02').trigger('click')

		expect(square(wrapper, '2026-11-02').attributes('aria-pressed')).toBe('false')
		expect(detail(wrapper).text()).toBe('Select a day to see its numbers.')
	})

	// spec: STATS-001.72
	it('says why a day to come, one without a counter and one before counting began have no numbers', async () => {
		const wrapper = await mountCalendar()
		await square(wrapper, '2026-11-25').trigger('click')
		expect(detail(wrapper).text()).toContain('Still to come.')

		await square(wrapper, '2026-11-03').trigger('click')
		expect(detail(wrapper).text()).toContain('Nothing counted.')
		expect(square(wrapper, '2026-11-25').attributes('aria-pressed')).toBe('false')

		const year = await mountCalendar('#year=2025')
		await square(year, '2025-01-05').trigger('click')
		expect(detail(year).text()).toContain('Before counting began.')
	})

	// spec: STATS-001.72
	it('releases the held day when the period changes', async () => {
		const wrapper = await mountCalendar()
		await square(wrapper, '2026-11-02').trigger('click')

		await chip(wrapper, 'Year').trigger('click')

		expect(wrapper.findAll('.statistics-calendar__square[aria-pressed="true"]')).toHaveLength(0)
		expect(detail(wrapper).text()).toBe('Select a day to see its numbers.')
	})

	// spec: STATS-001.72, STATS-001.65
	it('opens a held month of all time from the panel', async () => {
		const location = fakeLocation('#all')
		const wrapper = await mountCalendar('', location)

		await square(wrapper, '2026-10-01').trigger('click')
		expect(detail(wrapper).text()).toContain('9 decided')
		expect(detail(wrapper).text()).toContain('October 2026')
		await detail(wrapper).find('button').trigger('click')
		await flushPromises()

		expect(periodLabel(wrapper)).toBe('October 2026')
		expect(location.hash).toBe('#month=2026-10')
		expect(squares(wrapper)).toHaveLength(31)
	})
})
