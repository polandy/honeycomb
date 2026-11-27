// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { formatFileSize } from '../../../src/shared/l10n.ts'
import { mountPage, TODAY } from './statistics-page-fixtures.ts'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

enableAutoUnmount(afterEach)

const FREED = [
	{ day: TODAY, metric: METRIC.trashPictures, value: 4 },
	{ day: TODAY, metric: METRIC.trashBytes, value: 4_000_000 },
	{ day: TODAY, metric: METRIC.deletedPictures, value: 1 },
	{ day: TODAY, metric: METRIC.deletedBytes, value: 1_000_000 },
	{ day: TODAY, metric: METRIC.rawsRemoved, value: 3 },
	{ day: TODAY, metric: METRIC.rawsRemovedBytes, value: 5_000_000 },
]
const WORK = [
	{ day: TODAY, metric: METRIC.sidecarsCreated, value: 7 },
	{ day: TODAY, metric: METRIC.sidecarsUpdated, value: 3 },
	{ day: TODAY, metric: METRIC.sidecarsForeign, value: 2 },
	{ day: TODAY, metric: METRIC.ratingsSet, value: 12 },
	{ day: TODAY, metric: METRIC.colourLabelsSet, value: 4 },
	{ day: TODAY, metric: METRIC.tagsSet, value: 10 },
	{ day: TODAY, metric: METRIC.seriesDone, value: 2 },
	{ day: TODAY, metric: METRIC.foldersDone, value: 1 },
	{ day: TODAY, metric: METRIC.picturesMoved, value: 30 },
]

type Page = ReturnType<typeof mountPage>
const rows = (wrapper: Page, card: string) => wrapper.findAll(`.${card} .statistics-rows__row`).map((row) => [row.find('.statistics-rows__name').text(), row.find('.statistics-rows__note').exists() ? row.find('.statistics-rows__note').text() : '', row.find('.statistics-rows__value').text()])

describe('StatisticsPage Clean-up', () => {
	// spec: STATS-001.78
	it('names the space freed in all, splits it by part and lists a row per part', async () => {
		const wrapper = mountPage({ counters: FREED })
		await flushPromises()

		const card = wrapper.find('.statistics-cleanup')
		expect(card.find('h3').text()).toBe('Clean-up')
		expect(card.find('.statistics-cleanup__freed').text()).toBe(`${formatFileSize(10_000_000)} freed`)
		const split = card.find('.statistics-cleanup__split')
		expect(split.attributes('role')).toBe('img')
		expect(split.attributes('aria-label')).toBe(`Moved to the trash bin ${formatFileSize(4_000_000)}, Deleted for good ${formatFileSize(1_000_000)}, RAW files removed ${formatFileSize(5_000_000)}`)
		expect(split.findAll('i').map((each) => each.attributes('style'))).toEqual(['width: 40%', 'width: 10%', 'width: 50%'])
		expect(rows(wrapper, 'statistics-cleanup')).toEqual([
			['Moved to the trash bin', '4 photos', formatFileSize(4_000_000)],
			['Deleted for good', '1 photo the trash bin would not keep', formatFileSize(1_000_000)],
			['RAW files removed', '3 RAW files', formatFileSize(5_000_000)],
		])
		expect(card.text()).toContain('Space is freed when the trash bin is emptied.')
	})

	// spec: STATS-001.78
	it('leaves a part out that freed nothing', async () => {
		const wrapper = mountPage({ counters: FREED.filter((each) => each.metric === METRIC.rawsRemoved || each.metric === METRIC.rawsRemovedBytes) })
		await flushPromises()

		expect(rows(wrapper, 'statistics-cleanup').map((row) => row[0])).toEqual(['RAW files removed'])
		expect(wrapper.findAll('.statistics-cleanup__split i')).toHaveLength(1)
	})

	// spec: STATS-001.78
	it('says nothing was freed and shows no bar when the period freed nothing', async () => {
		const wrapper = mountPage({ counters: [{ day: TODAY, metric: METRIC.decided, value: 5 }] })
		await flushPromises()

		expect(wrapper.find('.statistics-cleanup').text()).toContain('Nothing freed in this period.')
		expect(wrapper.find('.statistics-cleanup__split').exists()).toBe(false)
		expect(wrapper.find('.statistics-cleanup__freed').exists()).toBe(false)
	})
})

describe('StatisticsPage Work done', () => {
	// spec: STATS-001.79
	it('lists the counters the page did not show before, in order, with those from digiKam or darktable', async () => {
		const wrapper = mountPage({ counters: WORK })
		await flushPromises()

		expect(wrapper.find('.statistics-work h3').text()).toBe('Work done')
		expect(rows(wrapper, 'statistics-work')).toEqual([
			['Sidecars created', '', '7'],
			['Sidecars updated', '2 from digiKam or darktable', '3'],
			['Ratings set', '', '12'],
			['Colour labels set', '', '4'],
			['Tags set', '', '10'],
			['Series done', '', '2'],
			['Folders done', '', '1'],
			['Pictures moved', '', '30'],
		])
	})

	// spec: STATS-001.79
	it('hides a row at zero and says nothing was done when every row is', async () => {
		const some = mountPage({ counters: [{ day: TODAY, metric: METRIC.picturesMoved, value: 1234 }] })
		const none = mountPage({ counters: [{ day: TODAY, metric: METRIC.decided, value: 5 }] })
		await flushPromises()

		expect(rows(some, 'statistics-work')).toEqual([['Pictures moved', '', '1,234']])
		expect(none.find('.statistics-work').text()).toContain('Nothing done in this period.')
		expect(none.findAll('.statistics-work .statistics-rows__row')).toHaveLength(0)
	})

	// spec: STATS-001.79
	it('counts only the period shown', async () => {
		const wrapper = mountPage({ counters: [...WORK, { day: '2026-10-05', metric: METRIC.tagsSet, value: 99 }] })
		await flushPromises()

		expect(rows(wrapper, 'statistics-work').find((row) => row[0] === 'Tags set')![2]).toBe('10')
	})
})
