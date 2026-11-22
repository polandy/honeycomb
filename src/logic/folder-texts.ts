import type { FolderFilter, FolderSort } from './folder-list.ts'
import type { FolderProgress } from './folder-progress.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderRow } from './folder-row.ts'

const KB = 1024
const GB = KB ** 3
/** From this many GB the size shows no decimal. */
const WHOLE_GB_FROM = 10
const THOUSANDS_LOCALE = 'en-GB'
const DATE_LENGTH = 'YYYY-MM-DD'.length

/** The chip labels of the filters. */
export const FILTER_LABELS: Record<FolderFilter, string> = { suggested: 'Suggested', new: 'New photos', all: 'All' }

/** The labels of the sorts. */
export const SORT_LABELS: Record<FolderSort, string> = { suggested: 'Suggested', undecided: 'Most undecided', largest: 'Largest', oldest: 'Oldest', newest: 'Newest', name: 'Name' }

/** What a complete folder that is not done says. */
export const COMPLETE_TEXT = 'Complete · not marked done'

/** The badge of a folder the user may not rate. */
export const READ_ONLY_TEXT = 'Read-only'

/** What an empty list says. */
export const EMPTY_LIST_TEXT = 'No folders here.'

/** The heading of the folders without a capture time under *Oldest* and *Newest*. */
export const UNKNOWN_YEAR_TEXT = 'Unknown year'

/** A count with thousands separators. */
export function formatCount(count: number): string {
	return count.toLocaleString(THOUSANDS_LOCALE)
}

/** Bytes as GB, or as MB below 1 GB: `4.2 GB`, `12 GB`, `300 MB`. */
export function formatBytes(bytes: number): string {
	if (bytes < GB) {
		return `${formatCount(Math.round(bytes / KB / KB))} MB`
	}
	const gigabytes = bytes / GB
	return `${gigabytes.toFixed(gigabytes >= WHOLE_GB_FROM ? 0 : 1)} GB`
}

/** The four lines of the progress card. */
export function progressTexts(progress: FolderProgress): { headline: string, folders: string, month: string, decided: string } {
	return {
		headline: `${progress.donePercent} % of photos in done folders`,
		folders: `${formatCount(progress.doneFolders)} of ${formatCount(progress.folders)} folders done`,
		month: `${formatCount(progress.doneThisMonth)} this month`,
		decided: `${progress.decidedPercent} % of all photos decided`,
	}
}

/** The line of a done folder: when and by whom; null for a folder that is not done. */
export function doneText(row: FolderRow): string | null {
	return row.done === null ? null : `Done ${new Date(row.done.at * 1000).toISOString().slice(0, DATE_LENGTH)} · by ${row.done.by}`
}

/** The strip while the server rescans folders. */
export function scanningText(folders: number): string {
	return `Updating ${plural(folders, 'folder')}`
}

/** The card's subtitle: the roots, folders and photos below them. */
export function rootsSummary(roots: number, totals: { readonly folders: number, readonly photos: number }): string {
	return [plural(roots, 'root'), plural(totals.folders, 'folder'), plural(totals.photos, 'photo')].join(' · ')
}

/**
 *
 */
function plural(count: number, noun: string): string {
	return `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`
}
