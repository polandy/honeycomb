// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Calendar } from '../logic/stats-calendar.ts'
import type { PeriodBar } from '../logic/stats-period.ts'

import { t } from '@nextcloud/l10n'
import { addDays } from '../logic/days.ts'
import { barDetail } from '../logic/stats-chart.ts'
import { formatDay, PLAIN_TEXT } from '../shared/l10n.ts'
import { barName, detailLines } from './chart-words.ts'

const YEAR_LENGTH = 'YYYY'.length
const DAY_START = 'YYYY-MM-'.length
/** A Sunday, from which a weekday's name is found. */
const SUNDAY = '2023-01-01'

/** What a square counts, e.g. "photos decided per day" (STATS-001.70). */
export function calendarSubtitle(unit: Calendar['unit']): string {
	return unit === 'day' ? t('honeycomb', 'photos decided per day') : t('honeycomb', 'photos decided per month')
}

/** The line asking to select a square (STATS-001.72). */
export function calendarHint(unit: Calendar['unit']): string {
	return unit === 'day' ? t('honeycomb', 'Select a day to see its numbers.') : t('honeycomb', 'Select a month to see its numbers.')
}

/** A square's name for a screen reader: its date and numbers, or why it has none (STATS-001.72). */
export function squareLabel(bar: PeriodBar, unit: Calendar['unit']): string {
	return t('honeycomb', '{name}: {numbers}', { name: barName(bar, unit), numbers: detailLines(barDetail(bar))[0]! }, undefined, PLAIN_TEXT)
}

/** The letter above a column of days. */
export function weekdayInitial(weekday: number): string {
	return formatDay(addDays(SUNDAY, weekday), { weekday: 'narrow' })
}

/** The text in a square: the date of a day in a week or month, the month's letter in all time, none in a year. */
export function squareText(bar: PeriodBar, layout: Calendar['layout']): string {
	const day = bar.range.from
	return { days: () => String(Number(day.slice(DAY_START))), year: () => '', all: () => formatDay(day, { month: 'narrow' }) }[layout]()
}

/** A group's heading: the month in a year, the year in all time, none in a week or month. */
export function groupHeading(anchor: string, layout: Calendar['layout']): string {
	return { days: () => '', year: () => formatDay(anchor, { month: 'long' }), all: () => anchor.slice(0, YEAR_LENGTH) }[layout]()
}
