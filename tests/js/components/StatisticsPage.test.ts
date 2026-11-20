// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { StatsAnswer } from '../../../src/logic/statistics.ts'

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StatisticsPage from '../../../src/components/StatisticsPage.vue'
import { formatDay } from '../../../src/l10n.ts'
import { logger } from '../../../src/logger.ts'
import { METRIC } from '../../../src/logic/statistics.ts'

vi.mock('../../../src/logger.ts', () => ({ logger: { error: vi.fn() } }))

const TODAY = '2026-11-20'
const COUNTERS = [
	{ day: '2026-11-01', metric: METRIC.decided, value: 100 },
	{ day: '2026-11-19', metric: METRIC.decided, value: 18 },
	{ day: TODAY, metric: METRIC.trashPictures, value: 4 },
	{ day: TODAY, metric: METRIC.sidecarsCreated, value: 7 },
	{ day: TODAY, metric: METRIC.sidecarsUpdated, value: 3 },
]
const NOTHING_READ = { pictures: 0, picked: 0, rejected: 0, rated: 0 }
const POSITIONS = [
	{ folderSet: { paths: ['/Photos/Italy 2025'], subfolders: false }, fileId: 9, decided: 79, total: 100 },
	{ folderSet: { paths: ['/Photos/Wedding'], subfolders: false }, fileId: 10, decided: 40, total: 40 },
]

function mountPage(answer: Partial<StatsAnswer> = {}, settings: unknown = {}) {
	const seams = {
		loadStatistics: vi.fn(async () => ({ counters: COUNTERS, firstDay: '2026-11-01', today: TODAY, seriesDoneBefore: 0, read: NOTHING_READ, ...answer })),
		loadPositions: vi.fn(async () => POSITIONS),
		loadSettings: vi.fn(async () => settings),
		saveViewState: vi.fn(async (_patch: { yearReviewHintClosed: number }) => undefined),
	}
	return mount(StatisticsPage, { props: { seams } })
}

const tile = (wrapper: ReturnType<typeof mountPage>, label: string) => wrapper.findAll('.delete-stats__item').find((each) => each.text().includes(label))!.text()
const chip = (wrapper: ReturnType<typeof mountPage>, label: string) => wrapper.findAll('button').find((each) => each.text() === label)!

enableAutoUnmount(afterEach)

describe('StatisticsPage', () => {
	// spec: STATS-001.21
	it('shows the sums of 30 days first and of the period picked', async () => {
		const wrapper = mountPage()
		await flushPromises()

		expect(chip(wrapper, '30 days').attributes('aria-pressed')).toBe('true')
		expect(tile(wrapper, 'Photos decided')).toContain('118')
		expect(wrapper.findAll('.statistics-bars__bar')).toHaveLength(5)

		await chip(wrapper, '7 days').trigger('click')

		expect(chip(wrapper, '7 days').attributes('aria-pressed')).toBe('true')
		expect(tile(wrapper, 'Photos decided')).toContain('18')
		expect(wrapper.findAll('.statistics-bars__bar')).toHaveLength(7)
		expect(chip(wrapper, '2026').exists()).toBe(true)
		expect(chip(wrapper, 'All time').exists()).toBe(true)
	})

	// spec: STATS-001.21
	it('shows moved to the trash bin and the sidecars created and updated', async () => {
		const wrapper = mountPage()
		await flushPromises()

		expect(tile(wrapper, 'Moved to the trash bin')).toContain('4')
		expect(tile(wrapper, 'Sidecars created / updated')).toContain('7 / 3')
	})

	// spec: STATS-001.41
	it('adds the change against the period before to Photos decided', async () => {
		const wrapper = mountPage()
		await flushPromises()
		await chip(wrapper, '7 days').trigger('click')

		expect(tile(wrapper, 'Photos decided')).not.toContain('%')

		const before = mountPage({ counters: [...COUNTERS, { day: '2026-11-10', metric: METRIC.decided, value: 9 }] })
		await flushPromises()
		await chip(before, '7 days').trigger('click')

		expect(tile(before, 'Photos decided')).toMatch(/\+100\s?% on the 7 days before/)
	})

	// spec: STATS-001.22
	it('shows the days in a row and the longest streak', async () => {
		const wrapper = mountPage()
		await flushPromises()

		expect(tile(wrapper, 'Days in a row')).toContain('2')
		expect(tile(wrapper, 'Days in a row')).toContain('Longest 2')
	})

	// spec: STATS-001.23
	it('says nothing is counted yet and still shows the folder sets', async () => {
		const wrapper = mountPage({ counters: [], firstDay: null })
		await flushPromises()

		expect(wrapper.text()).toContain('Nothing counted yet. Cull a folder and the numbers show here.')
		expect(wrapper.find('.delete-stats').exists()).toBe(false)
		expect(wrapper.text()).toContain('Italy 2025')
		expect(wrapper.text()).not.toContain('Counted since')
	})

	// spec: STATS-001.24
	it('says since when it counts and that the trash bin frees the space', async () => {
		const wrapper = mountPage()
		await flushPromises()

		expect(wrapper.text()).toContain(`Counted since ${formatDay('2026-11-01')}.`)
		expect(wrapper.text()).toContain('Space is freed when the trash bin is emptied.')
	})

	// spec: STATS-001.24, STATS-001.44
	it('adds the series done before the counting only above zero', async () => {
		const wrapper = mountPage({ seriesDoneBefore: 3 })
		await flushPromises()

		expect(wrapper.text()).toContain('Before that: 3 series done (no date).')
		const none = mountPage()
		await flushPromises()
		expect(none.text()).not.toContain('Before that')
	})

	// spec: STATS-001.45
	it('shows the shares of the pictures read so far, nothing while none was read', async () => {
		const wrapper = mountPage({ read: { pictures: 50, picked: 23, rejected: 10, rated: 30 } })
		await flushPromises()

		expect(wrapper.text()).toContain('Of the pictures read so far')
		expect(wrapper.text()).toMatch(/46\s?% picked · 20\s?% rejected · 34\s?% unflagged · 60\s?% rated/)
		const none = mountPage()
		await flushPromises()
		expect(none.text()).not.toContain('Of the pictures read so far')
	})

	// spec: STATS-001.42
	it('lists the folder sets with their share decided, Done at 100 %', async () => {
		const wrapper = mountPage()
		await flushPromises()
		const rows = wrapper.findAll('.statistics-folder-sets__row').map((row) => row.text())

		expect(rows[0]).toMatch(/Italy 2025.*79\s?%/)
		expect(rows[1]).toMatch(/Wedding.*Done/)
	})

	// spec: STATS-001.43, STATS-001.1
	it('adds that statistics are off and shows the numbers already counted', async () => {
		const wrapper = mountPage({}, { keepStatistics: false })
		await flushPromises()

		expect(wrapper.text()).toContain('Statistics are off. Turn on Keep statistics in the settings to count again.')
		expect(tile(wrapper, 'Photos decided')).toContain('118')
		expect(mountPage().text()).not.toContain('Statistics are off.')
	})

	it('says so and logs when the numbers cannot be loaded', async () => {
		const error = new Error('down')
		const wrapper = mount(StatisticsPage, { props: { seams: { loadStatistics: async () => Promise.reject(error), loadPositions: async () => [], loadSettings: async () => ({}), saveViewState: async () => undefined } } })
		await flushPromises()

		expect(wrapper.text()).toContain('The statistics could not be loaded.')
		expect(logger.error).toHaveBeenCalledWith('Could not load the statistics', { error })
	})

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
		const reviewTile = (wrapper: ReturnType<typeof mountPage>, label: string) => wrapper.findAll('.year-review__tile').find((each) => each.text().includes(label))!.text()

		// spec: STATS-001.25
		it('shows the year in review in December above the period chips and not in November', async () => {
			const december = mountPage({ counters: YEAR, today: DECEMBER, firstDay: '2026-01-01' })
			const november = mountPage()
			await flushPromises()

			expect(december.find('.year-review').exists()).toBe(true)
			expect(december.find('.year-review').element.compareDocumentPosition(december.find('.statistics-page__periods').element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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

			expect(wrapper.find('.year-review').text()).not.toContain('digiKam')
		})

		// spec: STATS-001.47
		it('names the busiest day and draws one square per day with the shade of its share', async () => {
			const wrapper = mountPage({ counters: YEAR, today: DECEMBER, firstDay: '2026-01-01' })
			await flushPromises()

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

			expect(inside.find('.year-review').text()).toContain(`Counted since ${formatDay('2026-01-01')}.`)
			expect(before.find('.year-review').text()).not.toContain('Counted since')
		})

		// spec: STATS-001.48
		it('stores the year as closed for the hint once it shows', async () => {
			const wrapper = mountPage({ counters: YEAR, today: DECEMBER, firstDay: '2026-01-01' })
			await flushPromises()

			expect(wrapper.vm.$.props.seams.saveViewState).toHaveBeenCalledExactlyOnceWith({ yearReviewHintClosed: 2026 })
		})

		// spec: STATS-001.48
		it('stores nothing outside the review dates', async () => {
			const wrapper = mountPage()
			await flushPromises()

			expect(wrapper.vm.$.props.seams.saveViewState).not.toHaveBeenCalled()
		})
	})
})
