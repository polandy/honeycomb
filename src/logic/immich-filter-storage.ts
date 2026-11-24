// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel, Flag } from './decision.ts'
import type { ImmichKind } from './immich-asset.ts'
import type { Calendar, ImmichFilters, TimeOption } from './immich-filters.ts'
import type { RatingComparison } from './picture-filter.ts'

import { COLOUR_LABELS, FLAGS } from './decision.ts'
import { IMMICH_KINDS } from './immich-asset.ts'
import { defaultImmichFilters, REQUEST_RATING_OPS, sameTimeOption, timeOptions } from './immich-filters.ts'

/** A stored time: the current month as `'current'`, so it follows the calendar, or a fixed choice. */
export type StoredTime = 'current' | 'last-7-days' | 'all' | { readonly year: number, readonly month: number }

/** One connection's filters as the view state keeps them (ADR 0019). */
export interface StoredImmichFilters {
	readonly time: StoredTime
	readonly devices: readonly (string | null)[]
	readonly kinds: readonly ImmichKind[]
	readonly flags: readonly Flag[]
	readonly rating: number | null
	readonly comparison: RatingComparison
	readonly colourLabels: readonly ColourLabel[]
}

/** The view state key that holds the Immich filters per connection id. */
export const IMMICH_FILTERS_KEY = 'immich_filters'

const MIN_RATING = 0
const MAX_RATING = 5

/** The filters in the form the view state keeps. */
export function storedImmichFilters(filters: ImmichFilters, now: number, calendar: Calendar): StoredImmichFilters {
	return {
		time: storedTime(filters.time, now, calendar),
		devices: [...filters.devices],
		kinds: [...filters.kinds],
		flags: [...filters.flags],
		rating: filters.rating,
		comparison: filters.comparison,
		colourLabels: [...filters.colourLabels],
	}
}

/** The filters stored, each value it cannot read taking its default. */
export function readImmichFilters(stored: unknown, now: number, calendar: Calendar): ImmichFilters {
	const defaults = defaultImmichFilters(now, calendar)
	if (!isRecord(stored)) {
		return defaults
	}
	const rating = Number.isInteger(stored.rating) && (stored.rating as number) >= MIN_RATING && (stored.rating as number) <= MAX_RATING ? stored.rating as number : defaults.rating
	return {
		time: readTime(stored.time, now, calendar) ?? defaults.time,
		devices: Array.isArray(stored.devices) ? new Set(stored.devices.filter(isDevice)) : defaults.devices,
		kinds: readSet(stored.kinds, IMMICH_KINDS) ?? defaults.kinds,
		flags: readSet(stored.flags, FLAGS) ?? defaults.flags,
		rating,
		comparison: Object.hasOwn(REQUEST_RATING_OPS, String(stored.comparison)) ? stored.comparison as RatingComparison : defaults.comparison,
		colourLabels: readSet(stored.colourLabels, COLOUR_LABELS) ?? defaults.colourLabels,
	}
}

/** The stored filters of one connection in a view state answer, `null` without them. */
export function storedFiltersOf(viewState: unknown, connectionId: string): unknown {
	if (!isRecord(viewState)) {
		return null
	}
	const perConnection = viewState[IMMICH_FILTERS_KEY]
	return isRecord(perConnection) && Object.hasOwn(perConnection, connectionId) ? perConnection[connectionId] : null
}

/** The time as stored: the current month as `'current'`. */
function storedTime(time: TimeOption, now: number, calendar: Calendar): StoredTime {
	if (time.kind !== 'month') {
		return time.kind
	}
	return sameTimeOption(time, { kind: 'month', ...calendar.monthOf(now) }) ? 'current' : { year: time.year, month: time.month }
}

/** The stored time if it is one of today's options, otherwise `null`. */
function readTime(stored: unknown, now: number, calendar: Calendar): TimeOption | null {
	if (stored === 'current') {
		return { kind: 'month', ...calendar.monthOf(now) }
	}
	const wanted: TimeOption | null = stored === 'last-7-days' || stored === 'all'
		? { kind: stored }
		: isRecord(stored) ? { kind: 'month', year: Number(stored.year), month: Number(stored.month) } : null
	return wanted === null ? null : timeOptions(now, calendar).find((option) => sameTimeOption(option, wanted)) ?? null
}

/** The known values of a stored list, or `null` when it is not a list. */
function readSet<T extends string>(stored: unknown, known: readonly T[]): Set<T> | null {
	return Array.isArray(stored) ? new Set(stored.filter((value): value is T => known.includes(value as T))) : null
}

/** A camera model, or `null` for *No camera data*. */
function isDevice(value: unknown): value is string | null {
	return value === null || (typeof value === 'string' && value !== '')
}

/** A JSON object, not a list. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
