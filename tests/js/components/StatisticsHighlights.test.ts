// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { chip, fakeLocation, mountPage, TODAY } from './statistics-page-fixtures.ts'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

enableAutoUnmount(afterEach)

const COUNTERS = [
	{ day: '2026-11-02', metric: METRIC.decided, value: 40 },
	{ day: '2026-11-02', metric: METRIC.activeSeconds, value: 600 },
	{ day: '2026-11-19', metric: METRIC.decided, value: 60 },
	{ day: '2026-11-19', metric: METRIC.activeSeconds, value: 300 },
	{ day: '2026-11-20', metric: METRIC.decided, value: 10 },
]

/** The text of the highlight card titled `title`. */
const card = (wrapper: ReturnType<typeof mountPage>, title: string) => wrapper.findAll('.statistics-highlights__card').find((each) => each.find('h3').text() === title)!

describe('StatisticsPage highlights', () => {
	// spec: STATS-001.67, STATS-001.68, STATS-001.69
	it('shows the five highlights of the month', async () => {
		const wrapper = mountPage({ counters: COUNTERS })
		await flushPromises()

		expect(wrapper.findAll('.statistics-highlights__card').map((each) => each.find('h3').text())).toEqual(['Best day', 'Busiest weekday', 'Pace', 'Active days', 'Longest streak'])
		expect(card(wrapper, 'Best day').text()).toContain('60')
		expect(card(wrapper, 'Best day').text()).toContain('in 5 min 0 s')
		const weekday = card(wrapper, 'Busiest weekday')
		expect(weekday.text()).toContain('Thursday')
		expect(weekday.find('[role="img"]').attributes('aria-label')).toBe('Average photos decided per weekday: Mon 13, Tue 0, Wed 0, Thu 20, Fri 3, Sat 0, Sun 0')
		expect(weekday.find('.statistics-highlights__day--top').text()).toBe('Thu')
		expect(card(wrapper, 'Pace').text()).toContain('photos a minute')
		expect(card(wrapper, 'Active days').text()).toContain('3 of 20')
		expect(card(wrapper, 'Longest streak').text()).toContain('2 days')
	})

	// spec: STATS-001.69
	it('compares the pace with the days before in words and a sign', async () => {
		const counters = [...COUNTERS, { day: '2026-10-05', metric: METRIC.decided, value: 60 }, { day: '2026-10-05', metric: METRIC.activeSeconds, value: 600 }]
		const wrapper = mountPage({ counters, firstDay: '2026-10-01' })
		await flushPromises()

		expect(card(wrapper, 'Pace').text()).toMatch(/^Pace\s*7\.3\s*▲ 1\.3 faster than Oct\s1\s*–\s*20$/u)
	})

	// spec: STATS-001.69
	it('reads "1 photo" for an average of one and keeps a decimal for an average below one', async () => {
		const one = mountPage({ counters: [{ day: '2026-11-02', metric: METRIC.decided, value: 3 }] })
		await flushPromises()
		expect(card(one, 'Busiest weekday').text()).toContain('1 photo on average')

		const below = mountPage({ counters: [{ day: '2026-11-02', metric: METRIC.decided, value: 1 }] })
		await flushPromises()
		const weekday = card(below, 'Busiest weekday')
		expect(weekday.text()).toContain('0.3 photos on average')
		expect(weekday.find('[role="img"]').attributes('aria-label')).toContain('Mon 0.3, Tue 0')
	})

	// spec: STATS-001.67
	it('says so instead of the cards in a period without a counter', async () => {
		const wrapper = mountPage({ counters: COUNTERS, firstDay: '2026-09-01' })
		await flushPromises()
		await wrapper.find('button[aria-label="Previous period"]').trigger('click')

		expect(wrapper.find('.statistics-highlights').text()).toBe('Nothing counted in this period.')
	})

	// spec: STATS-001.68
	it('shows the week of the best day with Show day, and offers none in a week', async () => {
		const location = fakeLocation()
		const wrapper = mountPage({ counters: COUNTERS }, undefined, undefined, location)
		await flushPromises()
		await wrapper.findAll('button').find((each) => each.text() === 'Show day')!.trigger('click')

		expect(location.hash).toBe('#week')

		expect(chip(wrapper, 'Week').attributes('aria-pressed')).toBe('true')
		expect(wrapper.find('.statistics-bars').findAll('.statistics-bars__bar')).toHaveLength(7)
		expect(card(wrapper, 'Best day').text()).toContain('Nov 19, 2026')
		expect(wrapper.findAll('button').some((each) => each.text() === 'Show day')).toBe(false)
	})

	// spec: STATS-001.69
	it('has no best day and no busiest weekday without a decision, and says a streak of one day', async () => {
		const wrapper = mountPage({ counters: [{ day: TODAY, metric: METRIC.trashBytes, value: 5 }] })
		await flushPromises()

		expect(card(wrapper, 'Best day').text()).toContain('—')
		expect(card(wrapper, 'Busiest weekday').text()).toContain('—')
		expect(card(wrapper, 'Pace').text()).toContain('—')
		expect(card(wrapper, 'Longest streak').text()).toContain('1 day')
	})
})
