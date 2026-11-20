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
const POSITIONS = [
	{ folderSet: { paths: ['/Photos/Italy 2025'], subfolders: false }, fileId: 9, decided: 79, total: 100 },
	{ folderSet: { paths: ['/Photos/Wedding'], subfolders: false }, fileId: 10, decided: 40, total: 40 },
]

function mountPage(answer: Partial<StatsAnswer> = {}, settings: unknown = {}) {
	const seams = {
		loadStatistics: vi.fn(async () => ({ counters: COUNTERS, firstDay: '2026-11-01', today: TODAY, ...answer })),
		loadPositions: vi.fn(async () => POSITIONS),
		loadSettings: vi.fn(async () => settings),
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
		const wrapper = mount(StatisticsPage, { props: { seams: { loadStatistics: async () => Promise.reject(error), loadPositions: async () => [], loadSettings: async () => ({}) } } })
		await flushPromises()

		expect(wrapper.text()).toContain('The statistics could not be loaded.')
		expect(logger.error).toHaveBeenCalledWith('Could not load the statistics', { error })
	})
})
