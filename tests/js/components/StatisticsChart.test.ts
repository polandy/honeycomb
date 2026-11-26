// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { formatDay } from '../../../src/shared/l10n.ts'
import { chip, fakeLocation, mountPage, periodLabel, ROOTS, step, TODAY } from './statistics-page-fixtures.ts'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

enableAutoUnmount(afterEach)

const DAY = '2026-11-19'
const COUNTERS = [
	{ day: '2026-11-02', metric: METRIC.decided, value: 50 },
	{ day: '2026-11-02', metric: METRIC.picked, value: 25 },
	{ day: '2026-11-02', metric: METRIC.rejected, value: 25 },
	{ day: DAY, metric: METRIC.decided, value: 100 },
	{ day: DAY, metric: METRIC.picked, value: 25 },
	{ day: DAY, metric: METRIC.rejected, value: 75 },
	{ day: DAY, metric: METRIC.trashBytes, value: 40_000_000 },
	{ day: DAY, metric: METRIC.deletedBytes, value: 20_000_000 },
	{ day: DAY, metric: METRIC.rawsRemovedBytes, value: 20_000_000 },
	{ day: DAY, metric: METRIC.activeSeconds, value: 1260 },
	{ day: '2026-10-05', metric: METRIC.decided, value: 9 },
]
const DAY_NAME = formatDay(DAY, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

type Wrapper = ReturnType<typeof mountPage>

/** Mounts the page on the chart's counters, counted since 1 October. */
async function mountChart(location = fakeLocation()): Promise<Wrapper> {
	const wrapper = mountPage({ counters: COUNTERS, firstDay: '2026-10-01' }, ROOTS, undefined, location)
	await flushPromises()
	return wrapper
}

/** The bar button of the day or month starting on `from`. */
const bar = (wrapper: Wrapper, from: string) => wrapper.findAll('.statistics-bars__bar').find((each) => each.attributes('data-from') === from)!.find('button')
const detail = (wrapper: Wrapper) => wrapper.find('.statistics-bars__detail')
const heights = (wrapper: Wrapper, from: string) => bar(wrapper, from).findAll('.statistics-bars__part').map((each) => [each.classes().find((name) => name.startsWith('statistics-bars__part--')), each.attributes('style')])

describe('the statistics chart', () => {
	// spec: STATS-001.63
	it('stacks picked under rejected by default and switches to space freed and active time', async () => {
		const wrapper = await mountChart()

		expect(wrapper.find('.statistics-bars h3').text()).toBe('Photos decided per day')
		expect(chip(wrapper, 'Decided').attributes('aria-pressed')).toBe('true')
		expect(heights(wrapper, DAY)).toEqual([['statistics-bars__part--picked', 'height: 25%;'], ['statistics-bars__part--rejected', 'height: 75%;']])
		expect(heights(wrapper, '2026-11-02')).toEqual([['statistics-bars__part--picked', 'height: 25%;'], ['statistics-bars__part--rejected', 'height: 25%;']])
		expect(wrapper.findAll('.statistics-bars__axis span').map((each) => each.text())).toEqual(['100', '50'])
		expect(wrapper.find('.statistics-bars__legend').text()).toContain('✓ Picked')
		expect(wrapper.find('.statistics-bars__legend').text()).toContain('✕ Rejected')
		expect(wrapper.find('.statistics-bars__legend').text()).toContain('Still to come')
		expect(bar(wrapper, DAY).attributes('aria-label')).toBe(`${DAY_NAME}: 100 photos decided, 25 picked, 75 rejected`)

		await chip(wrapper, 'Space freed').trigger('click')

		expect(chip(wrapper, 'Space freed').attributes('aria-pressed')).toBe('true')
		expect(chip(wrapper, 'Decided').attributes('aria-pressed')).toBe('false')
		expect(wrapper.find('.statistics-bars h3').text()).toBe('Space freed per day')
		expect(heights(wrapper, DAY)).toEqual([['statistics-bars__part--trash', 'height: 50%;'], ['statistics-bars__part--deleted', 'height: 25%;'], ['statistics-bars__part--raws', 'height: 25%;']])
		expect(wrapper.find('.statistics-bars__legend').text()).toContain('Deleted for good')
		expect(bar(wrapper, DAY).attributes('aria-label')).toBe(`${DAY_NAME}: 80 MB freed`)

		await chip(wrapper, 'Active time').trigger('click')

		expect(heights(wrapper, DAY)).toEqual([['statistics-bars__part--active', 'height: 100%;']])
		expect(wrapper.findAll('.statistics-bars__axis span').map((each) => each.text())).toEqual(['21 min 0 s', '10 min 30 s'])
		expect(bar(wrapper, DAY).attributes('aria-label')).toBe(`${DAY_NAME}: 21 min 0 s active`)
	})

	// spec: STATS-001.64
	it('holds a tapped bar in the detail panel and releases it on a second tap', async () => {
		const wrapper = await mountChart()

		expect(detail(wrapper).attributes('aria-live')).toBe('polite')
		expect(detail(wrapper).text()).toBe('Select a bar to see its numbers.')

		await bar(wrapper, DAY).trigger('click')

		expect(bar(wrapper, DAY).attributes('aria-pressed')).toBe('true')
		expect(detail(wrapper).text()).toContain(DAY_NAME)
		expect(detail(wrapper).text()).toContain('100 decided (✓ 25 · ✕ 75)')
		expect(detail(wrapper).text()).toContain('80 MB freed')
		expect(detail(wrapper).text()).toContain('21 min 0 s active')
		expect(detail(wrapper).find('button').exists()).toBe(false)

		await bar(wrapper, DAY).trigger('click')

		expect(bar(wrapper, DAY).attributes('aria-pressed')).toBe('false')
		expect(detail(wrapper).text()).toBe('Select a bar to see its numbers.')
	})

	// spec: STATS-001.64
	it('previews the bar under the mouse only, then shows the held bar again', async () => {
		const wrapper = await mountChart()
		await bar(wrapper, DAY).trigger('click')

		await bar(wrapper, '2026-11-02').trigger('pointerenter', { pointerType: 'mouse' })

		expect(detail(wrapper).text()).toContain('50 decided (✓ 25 · ✕ 25)')
		expect(bar(wrapper, '2026-11-02').attributes('aria-pressed')).toBe('false')

		await wrapper.find('.statistics-bars__chart').trigger('pointerleave')

		expect(detail(wrapper).text()).toContain('100 decided')

		await bar(wrapper, '2026-11-02').trigger('pointerenter', { pointerType: 'touch' })

		expect(detail(wrapper).text()).toContain('100 decided')
	})

	// spec: STATS-001.64
	it('says a bar is to come, before counting began or has nothing counted', async () => {
		const wrapper = mountPage({ counters: COUNTERS, firstDay: '2026-11-02' })
		await flushPromises()

		await bar(wrapper, '2026-11-25').trigger('click')
		expect(detail(wrapper).text()).toContain('Still to come.')
		expect(bar(wrapper, '2026-11-25').attributes('aria-label')).toContain('still to come')

		await bar(wrapper, '2026-11-01').trigger('click')
		expect(detail(wrapper).text()).toContain('Before counting began.')
		expect(bar(wrapper, '2026-11-01').attributes('aria-label')).toContain('before counting began')

		await bar(wrapper, '2026-11-03').trigger('click')
		expect(detail(wrapper).text()).toContain('Nothing counted.')
		expect(bar(wrapper, '2026-11-03').attributes('aria-pressed')).toBe('true')
	})

	// spec: STATS-001.64
	it('releases the held bar in a new period but keeps the chart shown', async () => {
		const wrapper = await mountChart()
		await chip(wrapper, 'Space freed').trigger('click')
		await bar(wrapper, DAY).trigger('click')

		await step(wrapper, 'Previous period').trigger('click')

		expect(periodLabel(wrapper)).toBe('October 2026')
		expect(detail(wrapper).text()).toBe('Select a bar to see its numbers.')
		expect(chip(wrapper, 'Space freed').attributes('aria-pressed')).toBe('true')
	})

	// spec: STATS-001.65
	it('opens a held month of the year from the detail panel', async () => {
		const location = fakeLocation('#year=2026')
		const wrapper = await mountChart(location)

		await bar(wrapper, '2026-10-01').trigger('click')
		expect(detail(wrapper).text()).toContain('9 decided')

		await detail(wrapper).find('button').trigger('click')

		expect(periodLabel(wrapper)).toBe('October 2026')
		expect(chip(wrapper, 'Month').attributes('aria-pressed')).toBe('true')
		expect(location.hash).toBe('#month=2026-10')
		expect(wrapper.findAll('.statistics-bars__bar')).toHaveLength(31)
	})

	// spec: STATS-001.65
	it('offers no drill-down for a month without a count', async () => {
		const wrapper = await mountChart(fakeLocation('#year=2026'))

		await bar(wrapper, '2026-09-01').trigger('click')

		expect(detail(wrapper).text()).toContain('Before counting began.')
		expect(detail(wrapper).find('button').exists()).toBe(false)
	})

	// spec: STATS-001.66
	it('shows the same values as a table up to today and keeps it in another period', async () => {
		const wrapper = await mountChart()

		await chip(wrapper, 'Show as table').trigger('click')

		expect(wrapper.find('.statistics-bars__chart').exists()).toBe(false)
		expect(wrapper.findAll('.statistics-bars__table th').map((each) => each.text())).toEqual(['Day', '✓ Picked', '✕ Rejected'])
		const rows = wrapper.findAll('.statistics-bars__table tbody tr')
		expect(rows).toHaveLength(Number(TODAY.slice(-2)))
		expect(rows[18]!.findAll('td').map((each) => each.text())).toEqual([DAY_NAME, '25', '75'])

		await chip(wrapper, 'Space freed').trigger('click')
		expect(wrapper.findAll('.statistics-bars__table th').map((each) => each.text())).toEqual(['Day', 'Trash bin', 'Deleted for good', 'RAWs removed'])

		await step(wrapper, 'Previous period').trigger('click')
		expect(wrapper.findAll('.statistics-bars__table tbody tr')).toHaveLength(31)

		await chip(wrapper, 'Show as chart').trigger('click')
		expect(wrapper.find('.statistics-bars__table').exists()).toBe(false)
		expect(wrapper.findAll('.statistics-bars__bar')).toHaveLength(31)
	})
})
