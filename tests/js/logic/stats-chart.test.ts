// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PeriodBar } from '../../../src/logic/stats-period.ts'

import { describe, expect, it } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { barDetail, barSegments, barTotal, chartParts, chartScale, drillTarget, tableBars } from '../../../src/logic/stats-chart.ts'

const DAY = '2026-11-24'

/** A bar of one day with the given sums. */
function bar(sums: PeriodBar['sums'], overrides: Partial<PeriodBar> = {}): PeriodBar {
	return {
		range: { from: DAY, to: DAY },
		sums,
		counted: Object.keys(sums).length > 0,
		future: false,
		beforeFirst: false,
		today: false,
		...overrides,
	}
}

const COUNTED = bar({
	[METRIC.decided]: 86,
	[METRIC.picked]: 31,
	[METRIC.rejected]: 55,
	[METRIC.trashBytes]: 40,
	[METRIC.deletedBytes]: 5,
	[METRIC.rawsRemovedBytes]: 75,
	[METRIC.activeSeconds]: 1260,
})

describe('chartParts', () => {
	// spec: STATS-001.63
	it('stacks picked under rejected, the trash bin, deleted for good and RAWs, and active time alone', () => {
		expect(chartParts('decided')).toEqual(['picked', 'rejected'])
		expect(chartParts('freed')).toEqual(['trash', 'deleted', 'raws'])
		expect(chartParts('active')).toEqual(['active'])
	})

	// spec: STATS-001.82
	it('shows photos added as one part', () => {
		expect(chartParts('added')).toEqual(['added'])
		expect(barTotal(bar({ [METRIC.photosAdded]: 12, [METRIC.decided]: 4 }), 'added')).toBe(12)
		expect(barSegments(bar({ [METRIC.photosAdded]: 12 }), 'added', 48)).toEqual([{ part: 'added', percent: 25 }])
	})
})

describe('barTotal and chartScale', () => {
	// spec: STATS-001.63
	it('adds the parts of the chosen chart', () => {
		expect(barTotal(COUNTED, 'decided')).toBe(86)
		expect(barTotal(COUNTED, 'freed')).toBe(120)
		expect(barTotal(COUNTED, 'active')).toBe(1260)
		expect(barTotal(bar({}), 'decided')).toBe(0)
	})

	// spec: STATS-001.63
	it('is the highest bar, at least 1 so an empty chart divides by nothing', () => {
		expect(chartScale([COUNTED, bar({ [METRIC.picked]: 100 })], 'decided')).toBe(100)
		expect(chartScale([COUNTED, bar({ [METRIC.picked]: 100 })], 'freed')).toBe(120)
		expect(chartScale([bar({})], 'active')).toBe(1)
		expect(chartScale([], 'decided')).toBe(1)
	})
})

describe('barSegments', () => {
	// spec: STATS-001.63
	it('gives each part its share of the scale, oldest part at the bottom', () => {
		expect(barSegments(bar({ [METRIC.picked]: 25, [METRIC.rejected]: 75 }), 'decided', 200)).toEqual([{ part: 'picked', percent: 12.5 }, { part: 'rejected', percent: 37.5 }])
		const freed = barSegments(COUNTED, 'freed', 120)
		expect(freed.map((each) => each.part)).toEqual(['trash', 'deleted', 'raws'])
		expect(freed[0]!.percent).toBeCloseTo(33.33, 2)
		expect(freed[1]!.percent).toBeCloseTo(4.17, 2)
		expect(freed[2]!.percent).toBe(62.5)
		expect(barSegments(bar({}), 'active', 1)).toEqual([{ part: 'active', percent: 0 }])
	})
})

describe('barDetail', () => {
	// spec: STATS-001.64
	it('names the pictures decided with picked and rejected, the space freed and the active time', () => {
		expect(barDetail(COUNTED)).toEqual({ state: 'counted', decided: 86, picked: 31, rejected: 55, freedBytes: 120, activeSeconds: 1260, added: 0 })
	})

	// spec: STATS-001.64
	it('is to come after today, before counting began, or nothing counted', () => {
		expect(barDetail(bar({}, { future: true }))).toEqual({ state: 'future' })
		expect(barDetail(bar({}, { beforeFirst: true }))).toEqual({ state: 'beforeFirst', added: 0 })
		expect(barDetail(bar({}))).toEqual({ state: 'empty', added: 0 })
		expect(barDetail(bar({ [METRIC.decided]: 0 }))).toEqual({ state: 'counted', decided: 0, picked: 0, rejected: 0, freedBytes: 0, activeSeconds: 0, added: 0 })
	})

	// spec: STATS-001.82
	it('names the photos added of a counted bar and of one without a count, not of one to come', () => {
		const added = { [METRIC.photosAdded]: 7 }
		expect(barDetail(bar({ ...added, [METRIC.decided]: 2 }))).toMatchObject({ state: 'counted', decided: 2, added: 7 })
		expect(barDetail(bar(added, { counted: false, beforeFirst: true }))).toEqual({ state: 'beforeFirst', added: 7 })
		expect(barDetail(bar(added, { counted: false }))).toEqual({ state: 'empty', added: 7 })
		expect(barDetail(bar(added, { counted: false, future: true }))).toEqual({ state: 'future' })
	})
})

describe('drillTarget', () => {
	const month = bar({ [METRIC.decided]: 3 }, { range: { from: '2026-10-01', to: '2026-10-31' } })

	// spec: STATS-001.65
	it('opens the month of a month bar and the year of a year bar', () => {
		expect(drillTarget(month, 'month')).toEqual({ kind: 'month', anchor: '2026-10-01' })
		expect(drillTarget({ ...month, range: { from: '2025-01-01', to: '2025-12-31' } }, 'year')).toEqual({ kind: 'year', anchor: '2025-01-01' })
	})

	// spec: STATS-001.65
	it('offers nothing for a day, nor for a bar without a count', () => {
		expect(drillTarget(COUNTED, 'day')).toBeNull()
		expect(drillTarget(bar({}, { range: month.range }), 'month')).toBeNull()
		expect(drillTarget({ ...month, future: true }, 'month')).toBeNull()
	})
})

describe('tableBars', () => {
	// spec: STATS-001.66
	it('keeps the bars up to today from the first counted day on', () => {
		const before = bar({}, { beforeFirst: true, range: { from: '2026-11-23', to: '2026-11-23' } })
		const future = bar({}, { future: true, range: { from: '2026-11-27', to: '2026-11-27' } })
		const empty = bar({}, { range: { from: '2026-11-25', to: '2026-11-25' } })

		expect(tableBars([before, COUNTED, empty, future], 'decided')).toEqual([COUNTED, empty])
		expect(tableBars([], 'decided')).toEqual([])
	})

	// spec: STATS-001.82
	it('keeps a bar before the first counted day with photos added in the table of photos added', () => {
		const before = bar({}, { beforeFirst: true, range: { from: '2026-11-22', to: '2026-11-22' } })
		const added = bar({ [METRIC.photosAdded]: 3 }, { counted: false, beforeFirst: true, range: { from: '2026-11-23', to: '2026-11-23' } })

		expect(tableBars([before, added, COUNTED], 'added')).toEqual([added, COUNTED])
		expect(tableBars([before, added, COUNTED], 'decided')).toEqual([COUNTED])
	})
})
