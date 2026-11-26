// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { formatDayRange, formatDuration, formatFileSize, formatPercent } from '../../../src/shared/l10n.ts'
import { chip, hero, mountPage, tile, TODAY } from './statistics-page-fixtures.ts'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

enableAutoUnmount(afterEach)

const DECIDED = [
	{ day: '2026-11-02', metric: METRIC.decided, value: 40 },
	{ day: '2026-11-02', metric: METRIC.picked, value: 11 },
	{ day: '2026-11-02', metric: METRIC.rejected, value: 29 },
	{ day: TODAY, metric: METRIC.decided, value: 46 },
	{ day: TODAY, metric: METRIC.picked, value: 20 },
	{ day: TODAY, metric: METRIC.rejected, value: 26 },
	{ day: TODAY, metric: METRIC.trashPictures, value: 4 },
	{ day: TODAY, metric: METRIC.trashBytes, value: 4_000_000 },
	{ day: TODAY, metric: METRIC.deletedPictures, value: 1 },
	{ day: TODAY, metric: METRIC.deletedBytes, value: 500_000 },
	{ day: TODAY, metric: METRIC.rawsRemoved, value: 3 },
	{ day: TODAY, metric: METRIC.rawsRemovedBytes, value: 60_000_000 },
	{ day: TODAY, metric: METRIC.activeSeconds, value: 630 },
	{ day: TODAY, metric: METRIC.seriesDone, value: 2 },
	{ day: TODAY, metric: METRIC.sidecarsForeign, value: 1 },
]

describe('StatisticsPage overview', () => {
	// spec: STATS-001.59
	it('splits picked from rejected in the hero and counts the pictures per active day', async () => {
		const wrapper = mountPage({ counters: DECIDED })
		await flushPromises()

		expect(wrapper.find('.statistics-hero__value').text()).toBe('86')
		const split = wrapper.find('.statistics-hero__split')
		expect(split.attributes('role')).toBe('img')
		expect(split.attributes('aria-label')).toBe('31 picked, 55 rejected')
		expect(split.find('.statistics-hero__picked').attributes('style')).toContain('width: 36%')
		expect(split.find('.statistics-hero__rejected').attributes('style')).toContain('width: 64%')
		expect(wrapper.find('.statistics-hero__key').text()).toMatch(/^✓ 31 picked\s+✕ 55 rejected$/)
		expect(hero(wrapper)).toContain('43 per active day · 2 active days')
	})

	// spec: STATS-001.60
	it('shows the keep rate with the kept of the decided', async () => {
		const wrapper = mountPage({ counters: DECIDED })
		await flushPromises()

		expect(tile(wrapper, 'Keep rate')).toContain(formatPercent(36))
		expect(tile(wrapper, 'Keep rate')).toContain('31 kept of 86')
	})

	// spec: STATS-001.60
	it('shows no keep rate without a decision and 0 % with only rejected pictures', async () => {
		const none = mountPage({ counters: [{ day: TODAY, metric: METRIC.trashPictures, value: 2 }] })
		const rejected = mountPage({ counters: [{ day: TODAY, metric: METRIC.rejected, value: 12 }] })
		await flushPromises()

		expect(none.find('.statistics-hero__value').text()).toBe('0')
		expect(none.findAll('.statistics-hero__split i')).toHaveLength(0)
		expect(tile(none, 'Keep rate')).toMatch(/^—\s*Keep rate\s*Nothing decided$/)
		expect(tile(rejected, 'Keep rate')).toContain(formatPercent(0))
		expect(tile(rejected, 'Keep rate')).toContain('0 kept of 12')
	})

	// spec: STATS-001.61
	it('adds the RAW bytes to the space freed and names the photos and the RAW files', async () => {
		const wrapper = mountPage({ counters: DECIDED })
		const noRaws = mountPage({ counters: [{ day: TODAY, metric: METRIC.trashPictures, value: 1 }, { day: TODAY, metric: METRIC.trashBytes, value: 2048 }] })
		await flushPromises()

		expect(tile(wrapper, 'Space freed')).toContain(formatFileSize(64_500_000))
		expect(tile(wrapper, 'Space freed')).toContain('5 photos · 3 RAW files')
		expect(tile(noRaws, 'Space freed')).toContain(formatFileSize(2048))
		expect(tile(noRaws, 'Space freed')).toContain('1 photo')
		expect(tile(noRaws, 'Space freed')).not.toContain('RAW')
	})

	// spec: STATS-001.62
	it('shows the active time with the pace, and no pace below one active minute', async () => {
		const wrapper = mountPage({ counters: DECIDED })
		const short = mountPage({ counters: [{ day: TODAY, metric: METRIC.decided, value: 9 }, { day: TODAY, metric: METRIC.activeSeconds, value: 59 }] })
		await flushPromises()

		expect(tile(wrapper, 'Active time')).toContain(formatDuration(630_000))
		expect(tile(wrapper, 'Active time')).toContain('8.2 photos a minute')
		expect(tile(short, 'Active time')).toMatch(new RegExp(`^${formatDuration(59_000)}\\s*Active time\\s*—$`))
	})

	// spec: STATS-001.41
	it('says same as the period before at no change', async () => {
		const wrapper = mountPage({ counters: [{ day: '2026-11-13', metric: METRIC.decided, value: 5 }, { day: TODAY, metric: METRIC.decided, value: 5 }], firstDay: '2026-11-01' })
		await flushPromises()
		await chip(wrapper, 'Week').trigger('click')

		expect(wrapper.find('.statistics-hero__change').text()).toBe(`Same as ${formatDayRange('2026-11-09', '2026-11-13')}`)
	})

	// spec: STATS-001.21
	it('puts the series done and the sidecars from digiKam or darktable in the line', async () => {
		const wrapper = mountPage({ counters: DECIDED })
		await flushPromises()

		expect(wrapper.find('.statistics-page__line').text()).toBe('1 from digiKam or darktable · 2 series done')
	})
})
