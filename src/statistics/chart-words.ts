import type { PeriodIntake } from '../logic/stats-added.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BarDetail, ChartMetric, ChartPart, DrillTarget } from '../logic/stats-chart.ts'
import type { BarUnit, PeriodBar, PeriodKind } from '../logic/stats-period.ts'

import { t } from '@nextcloud/l10n'
import { barDetail, barTotal, partValue } from '../logic/stats-chart.ts'
import { formatDay, formatDuration, formatFileSize, formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

const SECOND_MS = 1000
const YEAR_LENGTH = 'YYYY'.length
const WEEK_DAYS = 7
const DAY_START = 'YYYY-MM-'.length
const DAY_STYLE: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
const MONTH_STYLE: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }

/** The chart's heading, e.g. "Photos decided" (STATS-001.63). */
function chartTitle(chart: ChartMetric): string {
	return { decided: t('honeycomb', 'Photos decided'), freed: t('honeycomb', 'Space freed'), active: t('honeycomb', 'Active time'), added: t('honeycomb', 'Photos added') }[chart]
}

/** The chart's button in the switch *Chart shows*. */
export function chartSwitchLabel(chart: ChartMetric): string {
	return { decided: t('honeycomb', 'Decided'), freed: t('honeycomb', 'Space freed'), active: t('honeycomb', 'Active time'), added: t('honeycomb', 'Added') }[chart]
}

/** A part's name in the key and the table, with ✓ and ✕ so colour is never alone. */
export function partLabel(part: ChartPart): string {
	return {
		picked: t('honeycomb', '✓ Picked'),
		rejected: t('honeycomb', '✕ Rejected'),
		trash: t('honeycomb', 'Trash bin'),
		deleted: t('honeycomb', 'Deleted for good'),
		raws: t('honeycomb', 'RAWs removed'),
		active: t('honeycomb', 'Active time'),
		added: t('honeycomb', 'Photos added'),
	}[part]
}

/** The chart's heading with what one bar covers, e.g. "Photos decided per day". */
export function chartHeading(chart: ChartMetric, unit: BarUnit): string {
	const title = chartTitle(chart)
	return {
		day: () => t('honeycomb', '{title} per day', { title }, undefined, PLAIN_TEXT),
		month: () => t('honeycomb', '{title} per month', { title }, undefined, PLAIN_TEXT),
		year: () => t('honeycomb', '{title} per year', { title }, undefined, PLAIN_TEXT),
	}[unit]()
}

/** The table's first column. */
export function unitName(unit: BarUnit): string {
	return { day: t('honeycomb', 'Day'), month: t('honeycomb', 'Month'), year: t('honeycomb', 'Year') }[unit]
}

/** A bar's full name, e.g. "Tue, Nov 24, 2026", "October 2026" or "2025". */
export function barName(bar: PeriodBar, unit: BarUnit): string {
	const from = bar.range.from
	return { day: () => formatDay(from, DAY_STYLE), month: () => formatDay(from, MONTH_STYLE), year: () => from.slice(0, YEAR_LENGTH) }[unit]()
}

/** A chart value in its unit: a count, a size or a duration of seconds. */
export function formatChartValue(chart: ChartMetric, value: number): string {
	return { decided: () => formatNumber(value), freed: () => formatFileSize(value), active: () => formatDuration(value * SECOND_MS), added: () => formatNumber(value) }[chart]()
}

/** A bar's label for a screen reader: its name and the chart's value, photos added also before counting began (STATS-001.64, STATS-001.82). */
export function barLabel(bar: PeriodBar, unit: BarUnit, chart: ChartMetric): string {
	const name = barName(bar, unit)
	const detail = barDetail(bar)
	if (detail.state === 'future' || (detail.state === 'beforeFirst' && chart !== 'added')) {
		return detail.state === 'future'
			? t('honeycomb', '{name}: still to come', { name }, undefined, PLAIN_TEXT)
			: t('honeycomb', '{name}: before counting began', { name }, undefined, PLAIN_TEXT)
	}
	const value = formatChartValue(chart, barTotal(bar, chart))
	return {
		decided: () => t('honeycomb', '{name}: {decided} photos decided, {picked} picked, {rejected} rejected', {
			name,
			decided: formatNumber(detail.state === 'counted' ? detail.decided : 0),
			picked: formatNumber(partValue(bar, 'picked')),
			rejected: formatNumber(partValue(bar, 'rejected')),
		}, undefined, PLAIN_TEXT),
		freed: () => t('honeycomb', '{name}: {size} freed', { name, size: value }, undefined, PLAIN_TEXT),
		active: () => t('honeycomb', '{name}: {duration} active', { name, duration: value }, undefined, PLAIN_TEXT),
		added: () => t('honeycomb', '{name}: {added} photos added', { name, added: value }, undefined, PLAIN_TEXT),
	}[chart]()
}

/** The label under a bar: the weekday, every seventh day of a month from the 1st, the month or the year. */
export function barTick(bar: PeriodBar, unit: BarUnit, kind: PeriodKind): string {
	const day = bar.range.from
	if (unit === 'year') {
		return day.slice(0, YEAR_LENGTH)
	}
	if (unit === 'month') {
		return formatDay(day, { month: 'short' })
	}
	if (kind === 'week') {
		return formatDay(day, { weekday: 'short' })
	}
	const date = Number(day.slice(DAY_START))
	return (date - 1) % WEEK_DAYS === 0 ? String(date) : ''
}

/** The drill-down's button, e.g. "Show October" or "Show 2025" (STATS-001.65). */
export function drillLabel(target: DrillTarget): string {
	return target.kind === 'month'
		? t('honeycomb', 'Show {month}', { month: formatDay(target.anchor, { month: 'long' }) }, undefined, PLAIN_TEXT)
		: t('honeycomb', 'Show {year}', { year: target.anchor.slice(0, YEAR_LENGTH) }, undefined, PLAIN_TEXT)
}

/** The detail panel's lines of a bar: its numbers, or why it has none, and its photos added (STATS-001.64, STATS-001.82). */
export function detailLines(detail: BarDetail): string[] {
	if (detail.state === 'future') {
		return [t('honeycomb', 'Still to come.')]
	}
	const added = detail.added > 0 ? [t('honeycomb', '{added} added', { added: formatNumber(detail.added) }, undefined, PLAIN_TEXT)] : []
	if (detail.state !== 'counted') {
		return [{ beforeFirst: t('honeycomb', 'Before counting began.'), empty: t('honeycomb', 'Nothing counted.') }[detail.state], ...added]
	}
	return [
		t('honeycomb', '{decided} decided (✓ {picked} · ✕ {rejected})', {
			decided: formatNumber(detail.decided),
			picked: formatNumber(detail.picked),
			rejected: formatNumber(detail.rejected),
		}, undefined, PLAIN_TEXT),
		t('honeycomb', '{size} freed', { size: formatFileSize(detail.freedBytes) }, undefined, PLAIN_TEXT),
		t('honeycomb', '{duration} active', { duration: formatDuration(detail.activeSeconds * SECOND_MS) }, undefined, PLAIN_TEXT),
		...added,
	]
}

/** The line of a period's intake against its clean-up, e.g. "Added 1,240 · Decided 980 · Deleted 410" (STATS-001.83). */
export function intakeLine(intake: PeriodIntake): string {
	return t('honeycomb', 'Added {added} · Decided {decided} · Deleted {deleted}', {
		added: formatNumber(intake.added),
		decided: formatNumber(intake.decided),
		deleted: formatNumber(intake.deleted),
	}, undefined, PLAIN_TEXT)
}
