// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichKind } from './immich-asset.ts'
import type { ImmichCounts } from './immich-counts.ts'
import type { Calendar, CountedTimeOption, ImmichFilters, TimeOption } from './immich-filters.ts'

import { IMMICH_KINDS } from './immich-asset.ts'
import { defaultImmichFilters, sameTimeOption, shownTimeOptions } from './immich-filters.ts'
import { DEFAULT_FILTERS } from './picture-filter.ts'

/** One chip of a filter group and its count, `null` until the counts arrive. */
export interface FilterChoice<T> {
	readonly value: T
	readonly count: number | null
}

/** The chips the Immich filter bar shows (IMMICH-002.30). */
export interface ImmichFilterChoices {
	readonly times: readonly CountedTimeOption[]
	readonly devices: readonly FilterChoice<string | null>[]
	readonly kinds: readonly FilterChoice<ImmichKind>[]
}

/** The device chips: the counted models, or the known ones while counting, and every chosen one. */
export function deviceChoices(counts: ImmichCounts | null, known: readonly (string | null)[], chosen: ReadonlySet<string | null>): FilterChoice<string | null>[] {
	const listed: FilterChoice<string | null>[] = counts === null
		? known.map((value) => ({ value, count: null }))
		: counts.devices.map(({ model, count }) => ({ value: model, count }))
	const missing = [...chosen].filter((value) => !listed.some((choice) => choice.value === value))
	return [...listed, ...missing.map((value) => ({ value, count: counts === null ? null : 0 }))]
}

/** The kind chips with their counts. */
export function kindChoices(counts: ImmichCounts | null): FilterChoice<ImmichKind>[] {
	return IMMICH_KINDS.map((value) => ({ value, count: counts?.kinds[value] ?? null }))
}

/** Every chip of the time, device and kind groups. */
export function filterChoices(filters: ImmichFilters, counts: ImmichCounts | null, options: readonly TimeOption[], known: readonly (string | null)[], now: number, calendar: Calendar): ImmichFilterChoices {
	return {
		times: shownTimeOptions(options, counts?.periods ?? null, filters.time, now, calendar),
		devices: deviceChoices(counts, known, filters.devices),
		kinds: kindChoices(counts),
	}
}

/** Whether every filter is at its default; the comparison counts only with a rating chosen. */
export function isDefaultImmichFilters(filters: ImmichFilters, now: number, calendar: Calendar): boolean {
	const defaults = defaultImmichFilters(now, calendar)
	return sameTimeOption(filters.time, defaults.time)
		&& filters.devices.size === 0
		&& filters.kinds.size === 0
		&& sameSet(filters.flags, DEFAULT_FILTERS.flags)
		&& filters.rating === null
		&& filters.colourLabels.size === 0
}

/** Whether both sets hold the same values. */
function sameSet<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
	return a.size === b.size && [...a].every((value) => b.has(value))
}
