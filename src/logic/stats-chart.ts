// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BarUnit, PeriodBar } from './stats-period.ts'

import { METRIC } from './statistics.ts'

/** What the statistics chart shows (STATS-001.63). */
export type ChartMetric = 'decided' | 'freed' | 'active'

/** One stacked part of a bar. */
export type ChartPart = 'picked' | 'rejected' | 'trash' | 'deleted' | 'raws' | 'active'

/** One part's height in percent of the chart's scale. */
export interface BarSegment {
	readonly part: ChartPart
	readonly percent: number
}

/** What the detail panel shows of one bar (STATS-001.64). */
export type BarDetail
	= | { readonly state: 'future' | 'beforeFirst' | 'empty' }
		| { readonly state: 'counted', readonly decided: number, readonly picked: number, readonly rejected: number, readonly freedBytes: number, readonly activeSeconds: number }

/** The period a drill-down opens. */
export interface DrillTarget {
	readonly kind: 'month' | 'year'
	readonly anchor: string
}

/** The chart choices in the order of the switch. */
export const CHART_METRICS: readonly ChartMetric[] = ['decided', 'freed', 'active']

const PERCENT = 100
/** The counter of each part, stacked from the bottom. */
const PART_METRIC: Readonly<Record<ChartPart, string>> = {
	picked: METRIC.picked,
	rejected: METRIC.rejected,
	trash: METRIC.trashBytes,
	deleted: METRIC.deletedBytes,
	raws: METRIC.rawsRemovedBytes,
	active: METRIC.activeSeconds,
}
const PARTS: Readonly<Record<ChartMetric, readonly ChartPart[]>> = {
	decided: ['picked', 'rejected'],
	freed: ['trash', 'deleted', 'raws'],
	active: ['active'],
}

const sum = (bar: PeriodBar, metric: string): number => bar.sums[metric] ?? 0

/** The parts a chart stacks, from the bottom (STATS-001.63). */
export function chartParts(chart: ChartMetric): readonly ChartPart[] {
	return PARTS[chart]
}

/** The value of one part of a bar. */
export function partValue(bar: PeriodBar, part: ChartPart): number {
	return sum(bar, PART_METRIC[part])
}

/** The sum of a bar's parts in the chart. */
export function barTotal(bar: PeriodBar, chart: ChartMetric): number {
	return PARTS[chart].reduce((total, part) => total + partValue(bar, part), 0)
}

/** The highest bar of the chart, at least 1. */
export function chartScale(bars: readonly PeriodBar[], chart: ChartMetric): number {
	return Math.max(1, ...bars.map((bar) => barTotal(bar, chart)))
}

/** Each part's height in percent of `scale`, from the bottom (STATS-001.63). */
export function barSegments(bar: PeriodBar, chart: ChartMetric, scale: number): BarSegment[] {
	return PARTS[chart].map((part) => ({ part, percent: (partValue(bar, part) * PERCENT) / scale }))
}

/** A bar's numbers, or why it has none: to come, before the first counted day, nothing counted (STATS-001.64). */
export function barDetail(bar: PeriodBar): BarDetail {
	if (bar.future) {
		return { state: 'future' }
	}
	if (bar.beforeFirst) {
		return { state: 'beforeFirst' }
	}
	if (!bar.counted) {
		return { state: 'empty' }
	}
	return {
		state: 'counted',
		decided: sum(bar, METRIC.decided),
		picked: sum(bar, METRIC.picked),
		rejected: sum(bar, METRIC.rejected),
		freedBytes: barTotal(bar, 'freed'),
		activeSeconds: sum(bar, METRIC.activeSeconds),
	}
}

/** The month or year a counted month or year bar opens; null for a day or a bar without numbers (STATS-001.65). */
export function drillTarget(bar: PeriodBar, unit: BarUnit): DrillTarget | null {
	if (unit === 'day' || barDetail(bar).state !== 'counted') {
		return null
	}
	return { kind: unit, anchor: bar.range.from }
}

/** The bars a table lists: up to today from the first counted day on (STATS-001.66). */
export function tableBars(bars: readonly PeriodBar[]): PeriodBar[] {
	return bars.filter((bar) => !bar.future && !bar.beforeFirst)
}
