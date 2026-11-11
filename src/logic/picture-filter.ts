// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel, Decision, Flag } from './decision.ts'
import type { Picture } from './pairing.ts'

import { isDecided } from './decision.ts'

/** How the rating filter compares a picture's stars with the chosen count (Q8). */
export type RatingComparison = 'at-least' | 'at-most' | 'exactly'

/** Whether a picture is a pair or a single of one kind. */
export type PairingKind = 'pair' | 'rendered-only' | 'raw-only'

/** The chips of the Keep RAW group. */
export type KeepRawChip = 'marked' | 'not-marked'

/** Why the filtered view is empty, for its empty state. */
export type EmptyReason = 'no-pictures' | 'none-left' | 'no-match'

/** The filter bar's choices; an empty chip set filters nothing (Q9). */
export interface Filters {
	readonly rating: number | null
	readonly comparison: RatingComparison
	readonly colourLabels: ReadonlySet<ColourLabel>
	readonly flags: ReadonlySet<Flag>
	readonly pairings: ReadonlySet<PairingKind>
	readonly keepRaw: ReadonlySet<KeepRawChip>
	readonly folders: ReadonlySet<string>
}

/** Picked and unflagged, no other filter, the comparison at least. */
export const DEFAULT_FILTERS: Filters = {
	rating: null,
	comparison: 'at-least',
	colourLabels: new Set(),
	flags: new Set(['picked', 'unflagged']),
	pairings: new Set(),
	keepRaw: new Set(),
	folders: new Set(),
}

const NEXT_COMPARISON: Record<RatingComparison, RatingComparison> = { 'at-least': 'at-most', 'at-most': 'exactly', exactly: 'at-least' }

const COMPARE_RATING: Record<RatingComparison, (stars: number, rating: number) => boolean> = {
	'at-least': (stars, rating) => stars >= rating,
	'at-most': (stars, rating) => stars <= rating,
	exactly: (stars, rating) => stars === rating,
}

/** The comparison a tap on the comparison button switches to. */
export function nextComparison(comparison: RatingComparison): RatingComparison {
	return NEXT_COMPARISON[comparison]
}

/** Whether the picture is a pair, JPEG only or RAW only. */
export function pairingKind(picture: Picture<unknown>): PairingKind {
	if (picture.raw === null) {
		return 'rendered-only'
	}
	return picture.rendered === null ? 'raw-only' : 'pair'
}

/** Whether a picture with this decision passes every active filter group. */
export function matchesFilters(picture: Picture<unknown>, decision: Decision, filters: Filters): boolean {
	const chosen = <T>(chips: ReadonlySet<T>, value: T) => chips.size === 0 || chips.has(value)
	return (filters.rating === null || COMPARE_RATING[filters.comparison](decision.rating, filters.rating))
		&& (filters.colourLabels.size === 0 || (decision.colourLabel !== null && filters.colourLabels.has(decision.colourLabel)))
		&& chosen(filters.flags, decision.flag)
		&& chosen(filters.pairings, pairingKind(picture))
		&& chosen(filters.keepRaw, decision.keepRaw ? 'marked' : 'not-marked')
		&& chosen(filters.folders, picture.folder)
}

/** The pictures that pass the filters, in their given order. */
export function filterPictures<P extends Picture<unknown>>(pictures: readonly P[], decisionOf: (picture: P) => Decision, filters: Filters): P[] {
	return pictures.filter((picture) => matchesFilters(picture, decisionOf(picture), filters))
}

/** The "x of y decided" progress over the given pictures. */
export function progress<P>(pictures: readonly P[], decisionOf: (picture: P) => Decision): { decided: number, total: number } {
	return { decided: pictures.filter((picture) => isDecided(decisionOf(picture))).length, total: pictures.length }
}

/** How many filter groups have a choice; the flag filter has one when it is not the default. */
export function activeFilterCount(filters: Filters): number {
	const sets = [filters.colourLabels, filters.pairings, filters.keepRaw, filters.folders]
	return Number(filters.rating !== null) + Number(!isDefaultFlags(filters.flags)) + sets.filter((chips) => chips.size > 0).length
}

/** A copy of the chips with the chip switched. */
export function toggleChip<T>(chips: ReadonlySet<T>, chip: T): ReadonlySet<T> {
	const toggled = new Set(chips)
	if (!toggled.delete(chip)) {
		toggled.add(chip)
	}
	return toggled
}

/** Each folder of the pictures once, in name order, for the folder chips. */
export function pictureFolders(pictures: readonly Picture<unknown>[], compareNames: (a: string, b: string) => number): string[] {
	return [...new Set(pictures.map((picture) => picture.folder))].sort(compareNames)
}

/** Why no picture passes, given how many the cull has. */
export function emptyReason(filters: Filters, total: number): EmptyReason {
	if (total === 0) {
		return 'no-pictures'
	}
	return activeFilterCount(filters) > 0 ? 'no-match' : 'none-left'
}

/** Whether the flag filter is the default one. */
function isDefaultFlags(flags: ReadonlySet<Flag>): boolean {
	return flags.size === DEFAULT_FILTERS.flags.size && [...flags].every((flag) => DEFAULT_FILTERS.flags.has(flag))
}
