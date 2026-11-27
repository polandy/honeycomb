// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StatisticsPage from '../../../src/components/StatisticsPage.vue'
import { formatDay, formatDayRange } from '../../../src/shared/l10n.ts'
import { logger } from '../../../src/shared/logger.ts'
import { fakePageNavigation } from '../page-navigation.ts'
import { chip, fakeLocation, hero, MONDAY, mountPage, periodLabel, ROOTS, ROWS, step, tile } from './statistics-page-fixtures.ts'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

enableAutoUnmount(afterEach)

describe('StatisticsPage', () => {
	// spec: STATS-001.21, STATS-001.53
	it('opens on the current month and shows the calendar week, year and all time picked', async () => {
		const wrapper = mountPage()
		await flushPromises()

		expect(chip(wrapper, 'Month').attributes('aria-pressed')).toBe('true')
		expect(periodLabel(wrapper)).toBe('November 2026')
		expect(hero(wrapper)).toContain('118')
		expect(wrapper.findAll('.statistics-bars__bar')).toHaveLength(30)
		expect(wrapper.find('.statistics-bars h3').text()).toBe('Photos decided per day')

		await chip(wrapper, 'Week').trigger('click')

		expect(chip(wrapper, 'Week').attributes('aria-pressed')).toBe('true')
		expect(periodLabel(wrapper)).toBe(formatDayRange('2026-11-16', '2026-11-22', { month: 'short', day: 'numeric', year: 'numeric' }))
		expect(hero(wrapper)).toContain('18')
		expect(wrapper.findAll('.statistics-bars__bar')).toHaveLength(7)

		await chip(wrapper, 'Year').trigger('click')

		expect(periodLabel(wrapper)).toBe('2026')
		expect(wrapper.findAll('.statistics-bars__bar')).toHaveLength(12)
		expect(wrapper.find('.statistics-bars h3').text()).toBe('Photos decided per month')

		await chip(wrapper, 'All time').trigger('click')

		expect(periodLabel(wrapper)).toBe(`Since ${formatDay('2026-11-01')}`)
		expect(step(wrapper, 'Previous period').exists()).toBe(false)
		expect(wrapper.findAll('.statistics-bars__bar')).toHaveLength(1)
	})

	// spec: STATS-001.73
	it('shows Back to the cull in the wide title row, not on the page', async () => {
		const wrapper = mountPage()
		await flushPromises()
		const row = wrapper.find('.page-title-row.page-title-row--page-width')

		expect(row.find('.page-title-row__actions a').text()).toBe('Back to the cull')
		expect(wrapper.find('.statistics-page').text()).not.toContain('Back to the cull')
	})

	// spec: STATS-001.21
	it('shows the four tiles in order', async () => {
		const wrapper = mountPage()
		await flushPromises()

		expect(wrapper.findAll('.delete-stats__label').map((each) => each.text())).toEqual(['Space freed', 'Keep rate', 'Active time', 'Days in a row'])
		expect(tile(wrapper, 'Space freed')).toContain('4 photos')
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

		const card = wrapper.find('.statistics-empty')
		expect(card.find('h3').text()).toBe('Nothing counted yet')
		expect(card.text()).toContain('Cull a folder and the numbers show here.')
		expect(card.find('a').text()).toBe('Open Folders')
		expect(card.find('a').attributes('href')).toMatch(/\/apps\/honeycomb\/$/)
		expect(wrapper.find('.statistics-period').exists()).toBe(false)
		expect(wrapper.text()).not.toMatch(/reset/i)
		expect(wrapper.find('.delete-stats').exists()).toBe(false)
		expect(wrapper.find('.statistics-hero').exists()).toBe(false)
		expect(wrapper.find('.statistics-library__ring').attributes('aria-label')).toMatch(/^50\s?% of the photos are in folders marked done$/)
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
		expect(hero(wrapper)).toContain('118')
		expect(logger.error).toHaveBeenCalledWith('Could not load the library progress', { error })
	})

	// spec: STATS-001.43, STATS-001.1
	it('adds that statistics are off and shows the numbers already counted', async () => {
		const wrapper = mountPage({}, { keepStatistics: false })
		await flushPromises()

		expect(wrapper.text()).toContain('Statistics are off. Turn on Keep statistics in the settings to count again.')
		expect(hero(wrapper)).toContain('118')
		expect(mountPage().text()).not.toContain('Statistics are off.')
	})

	it('marks itself settled only once the numbers and the library progress are in', async () => {
		let answerFolders: (rows: typeof ROWS) => void = () => undefined
		const wrapper = mountPage({}, ROOTS, vi.fn(async (_root: string) => new Promise<typeof ROWS>((resolve) => {
			answerFolders = resolve
		})))
		await flushPromises()
		expect(wrapper.find('.statistics-page').attributes('data-settled')).toBeUndefined()

		answerFolders(ROWS)
		await flushPromises()

		expect(wrapper.find('.statistics-page').attributes('data-settled')).toBe('true')
	})

	// spec: STATS-001.86
	it('shows a skeleton, announced as a status, until the numbers answer', async () => {
		const wrapper = mountPage()

		expect(wrapper.find('.statistics-skeleton').attributes('aria-busy')).toBe('true')
		expect(wrapper.find('.statistics-skeleton [role="status"]').text()).toBe('Loading the statistics…')
		expect(wrapper.find('.statistics-hero').exists()).toBe(false)

		await flushPromises()

		expect(wrapper.find('.statistics-skeleton').exists()).toBe(false)
		expect(wrapper.find('.statistics-hero').exists()).toBe(true)
	})

	it('says so and logs when the numbers cannot be loaded', async () => {
		const error = new Error('down')
		const wrapper = mount(StatisticsPage, { props: { seams: { loadStatistics: async () => Promise.reject(error), loadLibraryFolders: async () => [], loadSettings: async () => ({}), saveViewState: async () => undefined, firstWeekDay: () => MONDAY, location: fakeLocation() }, navigation: fakePageNavigation().seams } })
		await flushPromises()

		expect(wrapper.text()).toContain('The statistics could not be loaded.')
		expect(wrapper.find('.statistics-skeleton').exists()).toBe(false)
		expect(logger.error).toHaveBeenCalledWith('Could not load the statistics', { error })
		expect(wrapper.find('.statistics-page').attributes('data-settled')).toBe('true')
	})
})
