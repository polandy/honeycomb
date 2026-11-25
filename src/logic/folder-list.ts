// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderRow } from './folder-row.ts'

import { isComplete, isRateable, newCount } from './folder-row.ts'
import { folderScore } from './folder-score.ts'

/** The filter chips. */
export type FolderFilter = 'suggested' | 'new' | 'all'

/** The sorts of the list. */
export type FolderSort = 'suggested' | 'undecided' | 'largest' | 'oldest' | 'newest' | 'name'

/** What the list shows: the roots, the chosen root (null for *All roots*), the filter and the sort. */
export interface FolderListView {
	readonly roots: readonly string[]
	readonly root: string | null
	readonly filter: FolderFilter
	readonly sort: FolderSort
}

/** A year heading, or the heading of folders without a capture time; null for no heading. */
export type YearHeading = number | 'unknown' | null

/** Rows under one heading, in order. */
export interface FolderGroup {
	readonly heading: YearHeading
	readonly rows: readonly FolderRow[]
}

/** The rows of one root. */
export interface RootSection {
	readonly root: string
	readonly count: number
	readonly groups: readonly FolderGroup[]
}

/** The list as the screen renders it; `rootHeadings` says whether the sections carry the root's name. */
export interface FolderListing {
	readonly sections: readonly RootSection[]
	readonly rootHeadings: boolean
}

const NAMES = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/** Whether the folder is complete and not done: it leads *Suggested* with *Mark done*. */
function isCompleteNotDone(row: FolderRow): boolean {
	return row.done === null && isComplete(row)
}

const FILTERS: Record<FolderFilter, (row: FolderRow) => boolean> = {
	suggested: (row) => row.done === null && isRateable(row) && (row.undecided > 0 || isComplete(row)),
	new: (row) => newCount(row) > 0,
	all: () => true,
}

/** The rows the filter keeps, in their order. */
export function filterRows(rows: readonly FolderRow[], filter: FolderFilter): FolderRow[] {
	return rows.filter(FILTERS[filter])
}

/** How many rows each filter keeps; *All* counts every folder, as the other filters search them. */
export function filterCounts(rows: readonly FolderRow[]): Record<FolderFilter, number> {
	return { suggested: filterRows(rows, 'suggested').length, new: filterRows(rows, 'new').length, all: rows.length }
}

/** The badge *n new* of a done folder with new photos, else null. */
export function badgeText(row: FolderRow): string | null {
	const count = newCount(row)
	return count > 0 ? `${count} new` : null
}

/** Paths in natural order, the code point order breaking case-only ties. */
function byPath(a: FolderRow, b: FolderRow): number {
	return NAMES.compare(a.path, b.path) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}

/** Ascending by a time, rows without one last. */
function byTime(time: (row: FolderRow) => number | null, direction: 1 | -1): (a: FolderRow, b: FolderRow) => number {
	return (a, b) => {
		const [first, second] = [time(a), time(b)]
		if (first === null || second === null) {
			return Number(first === null) - Number(second === null)
		}
		return direction * (first - second)
	}
}

/** The score a done folder never earns: it ranks last. */
function suggestedScore(row: FolderRow): number {
	return row.done === null ? folderScore(row) : 0
}

const ORDERS: Record<FolderSort, (a: FolderRow, b: FolderRow) => number> = {
	suggested: (a, b) => Number(isCompleteNotDone(b)) - Number(isCompleteNotDone(a)) || suggestedScore(b) - suggestedScore(a) || b.undecided - a.undecided,
	undecided: (a, b) => b.undecided - a.undecided,
	largest: (a, b) => b.bytes - a.bytes,
	oldest: byTime((row) => row.oldest, 1),
	newest: byTime((row) => row.newest, -1),
	name: () => 0,
}

/** The rows in the order of the sort, ties by path; the input stays as it is. */
export function sortRows(rows: readonly FolderRow[], sort: FolderSort): FolderRow[] {
	return [...rows].sort((a, b) => ORDERS[sort](a, b) || byPath(a, b))
}

/** The filtered and sorted rows per root, each root's rows under year headings for *Oldest* and *Newest*. */
export function buildFolderList(rows: readonly FolderRow[], view: FolderListView): FolderListing {
	const shown = sortRows(filterRows(rows, view.filter), view.sort)
	const sections = view.roots
		.filter((root) => view.root === null || view.root === root)
		.map((root) => ({ root, rows: shown.filter((row) => row.root === root) }))
		.filter((section) => section.rows.length > 0)
		.map((section) => ({ root: section.root, count: section.rows.length, groups: groupByYear(section.rows, view.sort) }))
	return { sections, rootHeadings: view.root === null && view.roots.length > 1 }
}

/** One group without a heading, or a group per year of the sorted capture time, rows without one last. */
function groupByYear(rows: readonly FolderRow[], sort: FolderSort): FolderGroup[] {
	if (sort !== 'oldest' && sort !== 'newest') {
		return [{ heading: null, rows }]
	}
	const groups: { heading: YearHeading, rows: FolderRow[] }[] = []
	for (const row of rows) {
		const time = sort === 'oldest' ? row.oldest : row.newest
		const heading = time === null ? 'unknown' : new Date(time * 1000).getUTCFullYear()
		const last = groups.at(-1)
		if (last?.heading === heading) {
			last.rows.push(row)
		} else {
			groups.push({ heading, rows: [row] })
		}
	}
	return groups
}
