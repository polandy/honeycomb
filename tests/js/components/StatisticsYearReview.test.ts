// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { formatDay } from '../../../src/shared/l10n.ts'
import { mountPage } from './statistics-page-fixtures.ts'

enableAutoUnmount(afterEach)

describe('year in review', () => {
	const DECEMBER = '2026-12-05'
	const YEAR = [
		{ day: '2026-01-01', metric: METRIC.decided, value: 30 },
		{ day: '2026-01-02', metric: METRIC.decided, value: 90 },
		{ day: '2026-01-02', metric: METRIC.trashPictures, value: 12 },
		{ day: '2026-01-02', metric: METRIC.rawsRemoved, value: 5 },
		{ day: '2026-01-02', metric: METRIC.sidecarsUpdated, value: 6 },
		{ day: '2026-01-02', metric: METRIC.sidecarsForeign, value: 2 },
	]
	const toggle = (wrapper: ReturnType<typeof mountPage>) => wrapper.find('.year-review__toggle')
	const showReview = async (wrapper: ReturnType<typeof mountPage>) => {
		await toggle(wrapper).trigger('click')
	}
	const reviewTile = (wrapper: ReturnType<typeof mountPage>, label: string) => wrapper.findAll('.year-review__tile').find((each) => each.text().includes(label))!.text()

	// spec: STATS-001.25
	it('shows the year in review in December above the period chips and not in November', async () => {
		const december = mountPage({ counters: YEAR, today: DECEMBER, firstDay: '2026-01-01' })
		const november = mountPage()
		await flushPromises()

		expect(december.find('.year-review').exists()).toBe(true)
		expect(december.find('.year-review').element.compareDocumentPosition(december.find('.statistics-period').element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		expect(november.find('.year-review').exists()).toBe(false)
	})

	// spec: STATS-001.25
	it('shows the year just ended in January', async () => {
		const wrapper = mountPage({ counters: YEAR, today: '2027-01-10', firstDay: '2026-01-01' })
		await flushPromises()

		expect(wrapper.find('.year-review').text()).toContain('Your 2026 in honeycomb')
	})

	// spec: STATS-001.46
	it('shows the headline and the tiles of the year', async () => {
		const wrapper = mountPage({ counters: YEAR, today: DECEMBER, firstDay: '2026-01-01' })
		await flushPromises()
		await showReview(wrapper)

		expect(wrapper.find('.year-review').text()).toContain('Your 2026 in honeycomb')
		expect(wrapper.find('.year-review__headline').text()).toContain('120')
		expect(reviewTile(wrapper, 'Moved to the trash bin')).toContain('12')
		expect(reviewTile(wrapper, 'RAW files removed')).toContain('5')
		expect(reviewTile(wrapper, 'Sidecars updated')).toContain('6')
		expect(reviewTile(wrapper, 'Sidecars updated')).toContain('2 from digiKam or darktable')
		expect(reviewTile(wrapper, 'Longest streak')).toContain('2')
	})

	// spec: STATS-001.46
	it('says nothing from digiKam or darktable while no sidecar was', async () => {
		const wrapper = mountPage({ counters: [{ day: '2026-01-02', metric: METRIC.decided, value: 3 }], today: DECEMBER, firstDay: '2026-01-02' })
		await flushPromises()
		await showReview(wrapper)

		expect(wrapper.find('.year-review').text()).not.toContain('digiKam')
	})

	// spec: STATS-001.47
	it('names the busiest day and draws one square per day with the shade of its share', async () => {
		const wrapper = mountPage({ counters: YEAR, today: DECEMBER, firstDay: '2026-01-01' })
		await flushPromises()
		await showReview(wrapper)

		expect(reviewTile(wrapper, 'Busiest day')).toContain(formatDay('2026-01-02'))
		expect(reviewTile(wrapper, 'Busiest day')).toContain('90')
		const squares = wrapper.findAll('.year-review__day')
		expect(squares).toHaveLength(365)
		expect(squares.slice(0, 3).map((each) => each.attributes('data-shade'))).toEqual(['1', '3', '0'])
		expect(wrapper.find('.year-review__days').text()).toContain('2 active days')
	})

	// spec: STATS-001.49
	it('says since when it counts only when the counting began in the year', async () => {
		const inside = mountPage({ counters: YEAR, today: DECEMBER, firstDay: '2026-01-01' })
		const before = mountPage({ counters: YEAR, today: DECEMBER, firstDay: '2025-06-01' })
		await flushPromises()
		await showReview(inside)
		await showReview(before)

		expect(inside.find('.year-review').text()).toContain(`Counted since ${formatDay('2026-01-01')}.`)
		expect(before.find('.year-review').text()).not.toContain('Counted since')
	})

	// spec: STATS-001.25
	it('shows the banner with the year decided and freed and the year hidden until the button opens it', async () => {
		const wrapper = mountPage({ counters: YEAR, today: DECEMBER, firstDay: '2026-01-01' })
		await flushPromises()

		expect(wrapper.find('.year-review__headline').text()).toContain('120 photos decided')
		expect(toggle(wrapper).text()).toBe('Show the year in review')
		expect(toggle(wrapper).attributes('aria-expanded')).toBe('false')
		expect(wrapper.find('.year-review__tile').exists()).toBe(false)
		expect(wrapper.find('.year-review__day').exists()).toBe(false)

		await showReview(wrapper)

		expect(toggle(wrapper).text()).toBe('Hide the year in review')
		expect(toggle(wrapper).attributes('aria-expanded')).toBe('true')
		expect(wrapper.findAll('.year-review__tile').length).toBeGreaterThan(0)

		await showReview(wrapper)

		expect(wrapper.find('.year-review__tile').exists()).toBe(false)
	})

	// spec: STATS-001.48
	it('stores the year as closed for the hint once the year in review is first shown, once', async () => {
		const wrapper = mountPage({ counters: YEAR, today: DECEMBER, firstDay: '2026-01-01' })
		await flushPromises()
		const save = (wrapper.vm.$.props.seams as { saveViewState: unknown }).saveViewState

		expect(save).not.toHaveBeenCalled()

		await showReview(wrapper)
		await showReview(wrapper)
		await showReview(wrapper)

		expect(save).toHaveBeenCalledTimes(1)
		expect(save).toHaveBeenNthCalledWith(1, { year_review_hint_closed: 2026 })
	})

	// spec: STATS-001.48
	it('stores nothing outside the review dates', async () => {
		const wrapper = mountPage()
		await flushPromises()

		expect((wrapper.vm.$.props.seams as { saveViewState: unknown }).saveViewState).not.toHaveBeenCalled()
	})
})
