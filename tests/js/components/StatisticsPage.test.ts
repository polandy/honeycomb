// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { StatsAnswer } from '../../../src/logic/statistics.ts'

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StatisticsPage from '../../../src/components/StatisticsPage.vue'
import { METRIC } from '../../../src/logic/statistics.ts'
import { formatDay, formatDayRange } from '../../../src/shared/l10n.ts'
import { logger } from '../../../src/shared/logger.ts'
import { doneRow, row } from '../logic/folder-fixtures.ts'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

const TODAY = '2026-11-20'
const COUNTERS = [
	{ day: '2026-11-01', metric: METRIC.decided, value: 100 },
	{ day: '2026-11-19', metric: METRIC.decided, value: 18 },
	{ day: TODAY, metric: METRIC.trashPictures, value: 4 },
	{ day: TODAY, metric: METRIC.sidecarsCreated, value: 7 },
	{ day: TODAY, metric: METRIC.sidecarsUpdated, value: 3 },
]
const MONDAY = 1
const NOTHING_READ = { pictures: 0, picked: 0, rejected: 0, rated: 0 }
const ROOTS = { libraryRoots: ['/Photos'] }
const ROWS = [doneRow({ path: '/Photos/Wedding' }), row({ path: '/Photos/Italy 2025' })]

function mountPage(answer: Partial<StatsAnswer> = {}, settings: unknown = ROOTS, folders = vi.fn(async (_root: string) => ROWS)) {
	const seams = {
		loadStatistics: vi.fn(async () => ({ counters: COUNTERS, firstDay: '2026-11-01', today: TODAY, seriesDoneBefore: 0, read: NOTHING_READ, ...answer })),
		loadLibraryFolders: folders,
		loadSettings: vi.fn(async () => settings),
		saveViewState: vi.fn(async (_patch: { year_review_hint_closed: number }) => undefined),
		firstWeekDay: () => MONDAY,
	}
	return mount(StatisticsPage, { props: { seams } })
}

const tile = (wrapper: ReturnType<typeof mountPage>, label: string) => wrapper.findAll('.delete-stats__item').find((each) => each.text().includes(label))!.text()
const chip = (wrapper: ReturnType<typeof mountPage>, label: string) => wrapper.findAll('button').find((each) => each.text() === label)!
const step = (wrapper: ReturnType<typeof mountPage>, label: 'Previous period' | 'Next period') => wrapper.find(`button[aria-label="${label}"]`)
const periodLabel = (wrapper: ReturnType<typeof mountPage>) => wrapper.find('.statistics-page__label').text()

enableAutoUnmount(afterEach)

describe('StatisticsPage', () => {
	// spec: STATS-001.21, STATS-001.53
	it('opens on the current month and shows the calendar week, year and all time picked', async () => {
		const wrapper = mountPage()
		await flushPromises()

		expect(chip(wrapper, 'Month').attributes('aria-pressed')).toBe('true')
		expect(periodLabel(wrapper)).toBe('November 2026')
		expect(tile(wrapper, 'Photos decided')).toContain('118')
		expect(wrapper.findAll('.statistics-bars__bar')).toHaveLength(30)
		expect(wrapper.find('.statistics-bars h3').text()).toBe('Per day')

		await chip(wrapper, 'Week').trigger('click')

		expect(chip(wrapper, 'Week').attributes('aria-pressed')).toBe('true')
		expect(periodLabel(wrapper)).toBe(formatDayRange('2026-11-16', '2026-11-22', { month: 'short', day: 'numeric', year: 'numeric' }))
		expect(tile(wrapper, 'Photos decided')).toContain('18')
		expect(wrapper.findAll('.statistics-bars__bar')).toHaveLength(7)

		await chip(wrapper, 'Year').trigger('click')

		expect(periodLabel(wrapper)).toBe('2026')
		expect(wrapper.findAll('.statistics-bars__bar')).toHaveLength(12)
		expect(wrapper.find('.statistics-bars h3').text()).toBe('Per month')

		await chip(wrapper, 'All time').trigger('click')

		expect(periodLabel(wrapper)).toBe(`Since ${formatDay('2026-11-01')}`)
		expect(step(wrapper, 'Previous period').exists()).toBe(false)
		expect(wrapper.findAll('.statistics-bars__bar')).toHaveLength(1)
	})

	// spec: STATS-001.21
	it('shows moved to the trash bin and the sidecars created and updated', async () => {
		const wrapper = mountPage()
		await flushPromises()

		expect(tile(wrapper, 'Moved to the trash bin')).toContain('4')
		expect(tile(wrapper, 'Sidecars created / updated')).toContain('7 / 3')
	})

	// spec: STATS-001.52, STATS-001.55
	it('steps back to an empty month and to today, with the arrows disabled at the ends', async () => {
		const wrapper = mountPage({ firstDay: '2026-10-01' })
		await flushPromises()

		expect(step(wrapper, 'Next period').attributes('disabled')).toBeDefined()
		expect(chip(wrapper, 'Today').attributes('disabled')).toBeDefined()

		await step(wrapper, 'Previous period').trigger('click')

		expect(periodLabel(wrapper)).toBe('October 2026')
		expect(tile(wrapper, 'Photos decided')).toContain('0')
		expect(tile(wrapper, 'Photos decided')).not.toContain('%')
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

		expect(tile(wrapper, 'Photos decided')).not.toContain('%')

		const before = mountPage({ counters: [...COUNTERS, { day: '2026-11-10', metric: METRIC.decided, value: 9 }, { day: '2026-11-15', metric: METRIC.decided, value: 900 }], firstDay: '2026-10-01' })
		await flushPromises()
		await chip(before, 'Week').trigger('click')

		expect(tile(before, 'Photos decided')).toMatch(/\+100\s?%/)
		expect(tile(before, 'Photos decided')).toContain(`% on ${formatDayRange('2026-11-09', '2026-11-13')}`)
	})

	// spec: STATS-001.41
	it('compares a past period with the whole period before', async () => {
		const wrapper = mountPage({ counters: [{ day: '2026-09-03', metric: METRIC.decided, value: 10 }, { day: '2026-10-30', metric: METRIC.decided, value: 5 }], firstDay: '2026-09-03' })
		await flushPromises()
		await step(wrapper, 'Previous period').trigger('click')

		expect(tile(wrapper, 'Photos decided')).toMatch(/-50\s?% on September/)

		const week = mountPage({ counters: [{ day: '2026-11-04', metric: METRIC.decided, value: 10 }, { day: '2026-11-11', metric: METRIC.decided, value: 5 }], firstDay: '2026-11-01' })
		await flushPromises()
		await chip(week, 'Week').trigger('click')
		await step(week, 'Previous period').trigger('click')

		expect(tile(week, 'Photos decided')).toMatch(/-50\s?% on the week before/)
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

	// spec: STATS-001.22
	it('shows the days in a row and the longest streak', async () => {
		const wrapper = mountPage()
		await flushPromises()

		expect(tile(wrapper, 'Days in a row')).toContain('2')
		expect(tile(wrapper, 'Days in a row')).toContain('Longest 2')
	})

	// spec: STATS-001.23
	it('says nothing is counted yet and still shows the library progress', async () => {
		const wrapper = mountPage({ counters: [], firstDay: null })
		await flushPromises()

		expect(wrapper.text()).toContain('Nothing counted yet. Cull a folder and the numbers show here.')
		expect(wrapper.find('.delete-stats').exists()).toBe(false)
		expect(wrapper.text()).toContain('50 % of photos in done folders')
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
	it('shows the shares of the photos read so far, nothing while none was read', async () => {
		const wrapper = mountPage({ read: { pictures: 50, picked: 23, rejected: 10, rated: 30 } })
		await flushPromises()

		expect(wrapper.text()).toContain('Of the photos read so far')
		expect(wrapper.text()).toMatch(/46\s?% picked · 20\s?% rejected · 34\s?% unflagged · 60\s?% rated/)
		const none = mountPage()
		await flushPromises()
		expect(none.text()).not.toContain('Of the photos read so far')
	})

	// spec: STATS-001.42
	it('shows the library progress: done photos, folders, this month and the decided share', async () => {
		const folders = vi.fn(async (_root: string) => ROWS)
		const wrapper = mountPage({}, ROOTS, folders)
		await flushPromises()
		const panel = wrapper.find('.statistics-library')

		expect(folders).toHaveBeenCalledWith('/Photos')
		expect(panel.text()).toContain('50 % of photos in done folders')
		expect(panel.text()).toContain('1 of 2 folders done')
		expect(panel.text()).toContain('1 this month')
		expect(panel.text()).toContain('90 % of all photos decided')
		expect(panel.find('a').text()).toBe('Open Folders')
		expect(panel.find('a').attributes('href')).toMatch(/\/index\.php\/apps\/honeycomb\/$/)
	})

	// spec: STATS-001.42
	it('shows a bar per root of several roots', async () => {
		const wrapper = mountPage({}, { libraryRoots: ['/Photos', '/Archive'] }, vi.fn(async (root: string) => (root === '/Photos' ? ROWS : [row({ root: '/Archive', path: '/Archive/old' })])))
		await flushPromises()

		expect(wrapper.findAll('.folders-progress__root').map((each) => each.text())).toEqual([expect.stringContaining('/Photos'), expect.stringContaining('/Archive')])
	})

	// spec: STATS-001.50
	it('asks to choose the library without roots and reads no folders', async () => {
		const folders = vi.fn(async (_root: string) => ROWS)
		const wrapper = mountPage({}, {}, folders)
		await flushPromises()
		const panel = wrapper.find('.statistics-library')

		expect(panel.text()).toContain('Choose your library')
		expect(panel.find('a').text()).toBe('Open Folders')
		expect(folders).not.toHaveBeenCalled()
	})

	// spec: STATS-001.51
	it('says the library progress could not be loaded, logs it and keeps the other numbers', async () => {
		const error = new Error('down')
		const wrapper = mountPage({}, ROOTS, vi.fn(async (_root: string): Promise<typeof ROWS> => {
			throw error
		}))
		await flushPromises()

		expect(wrapper.find('.statistics-library').text()).toContain('The library progress could not be loaded.')
		expect(tile(wrapper, 'Photos decided')).toContain('118')
		expect(logger.error).toHaveBeenCalledWith('Could not load the library progress', { error })
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
		const wrapper = mount(StatisticsPage, { props: { seams: { loadStatistics: async () => Promise.reject(error), loadLibraryFolders: async () => [], loadSettings: async () => ({}), saveViewState: async () => undefined } } })
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

			expect((wrapper.vm.$.props.seams as { saveViewState: unknown }).saveViewState).toHaveBeenCalledExactlyOnceWith({ year_review_hint_closed: 2026 })
		})

		// spec: STATS-001.48
		it('stores nothing outside the review dates', async () => {
			const wrapper = mountPage()
			await flushPromises()

			expect((wrapper.vm.$.props.seams as { saveViewState: unknown }).saveViewState).not.toHaveBeenCalled()
		})
	})
})
