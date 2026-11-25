// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSums, SubtreeState } from '../logic/folder-hierarchy.ts'
import type { FolderFilter, FolderSort, YearHeading } from '../logic/folder-list.ts'
import type { FolderProgress } from '../logic/folder-progress.ts'
import type { FolderRow } from '../logic/folder-row.ts'
import type { LibraryRootRefusal } from '../logic/library-roots.ts'

import { n, t } from '@nextcloud/l10n'
import { newCount, percent } from '../logic/folder-row.ts'
import { formatFileSize, formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

/** Between the parts of a line of the list. */
const SEPARATOR = ' · '
const DATE_LENGTH = 'YYYY-MM-DD'.length

/** The chip labels of the filters (FOLDERS-002). */
export function filterLabel(filter: FolderFilter): string {
	return { suggested: t('honeycomb', 'Suggested'), new: t('honeycomb', 'New photos'), all: t('honeycomb', 'All') }[filter]
}

/** The labels of the sorts (FOLDERS-002). */
export function sortLabel(sort: FolderSort): string {
	return {
		suggested: t('honeycomb', 'Suggested'),
		undecided: t('honeycomb', 'Most undecided'),
		largest: t('honeycomb', 'Largest'),
		oldest: t('honeycomb', 'Oldest'),
		newest: t('honeycomb', 'Newest'),
		name: t('honeycomb', 'Name'),
	}[sort]
}

/** A year heading's text; folders without a capture time are headed *Unknown year*. */
export function yearHeadingText(heading: YearHeading): string | null {
	return heading === 'unknown' ? t('honeycomb', 'Unknown year') : heading === null ? null : String(heading)
}

/** Why the folder is worth culling: "63 % undecided · 18 in bursts · 4.2 GB · 2019" (FOLDERS-001). */
export function reasonText(row: FolderRow): string {
	const parts = [t('honeycomb', '{percent} % undecided', { percent: percent(row.undecided, row.photos) })]
	if (row.bursts > 0) {
		parts.push(t('honeycomb', '{count} in bursts', { count: formatNumber(row.bursts) }))
	}
	parts.push(formatFileSize(row.bytes))
	if (row.oldest !== null) {
		parts.push(String(new Date(row.oldest * 1000).getUTCFullYear()))
	}
	return parts.join(SEPARATOR)
}

/** The split bar's accessible name. */
export function splitText(row: Pick<FolderRow, 'picked' | 'undecided' | 'rejected'>): string {
	const counts = { picked: formatNumber(row.picked), undecided: formatNumber(row.undecided), rejected: formatNumber(row.rejected) }
	return t('honeycomb', '{picked} picked · {undecided} undecided · {rejected} rejected', counts)
}

/** "100 photos". */
export function photosText(count: number): string {
	return n('honeycomb', '{count} photo', '{count} photos', count, { count: formatNumber(count) })
}

/** "12 folders". */
export function foldersText(count: number): string {
	return n('honeycomb', '{count} folder', '{count} folders', count, { count: formatNumber(count) })
}

/** "63 undecided". */
export function undecidedText(count: number): string {
	return t('honeycomb', '{count} undecided', { count: formatNumber(count) })
}

/** The line of a done folder: when and by whom; null for a folder that is not done. */
export function doneText(row: FolderRow): string | null {
	if (row.done === null) {
		return null
	}
	const date = new Date(row.done.at * 1000).toISOString().slice(0, DATE_LENGTH)
	if (row.done.by === null) {
		return t('honeycomb', 'Done {date}', { date }, undefined, PLAIN_TEXT)
	}
	return t('honeycomb', 'Done {date} · by {user}', { date, user: row.done.by }, undefined, PLAIN_TEXT)
}

/** The badge *n new* of a done folder with new photos, else null. */
export function newBadgeText(row: FolderRow): string | null {
	const count = newCount(row)
	return count > 0 ? n('honeycomb', '{count} new', '{count} new', count, { count: formatNumber(count) }) : null
}

/** The card's subtitle: the roots (only for the whole library), folders and photos below them. */
export function summaryText(roots: number | null, progress: FolderProgress): string {
	const parts = [
		foldersText(progress.folders),
		photosText(progress.photos),
	]
	if (roots !== null) {
		parts.unshift(n('honeycomb', '{count} root', '{count} roots', roots, { count: formatNumber(roots) }))
	}
	return parts.join(SEPARATOR)
}

/** The lines of the progress card. */
export function progressTexts(progress: FolderProgress): { headline: string, folders: string, month: string, decided: string } {
	return {
		headline: t('honeycomb', '{percent} % of photos in done folders', { percent: progress.donePercent }),
		folders: foldersDoneText(progress.doneFolders, progress.folders),
		month: t('honeycomb', '{count} this month', { count: formatNumber(progress.doneThisMonth) }),
		decided: t('honeycomb', '{percent} % of all photos decided', { percent: progress.decidedPercent }),
	}
}

/** "2 of 5 folders done". */
function foldersDoneText(done: number, total: number): string {
	return n('honeycomb', '{done} of {total} folder done', '{done} of {total} folders done', total, { done: formatNumber(done), total: formatNumber(total) })
}

/** The state line of a row with subfolders: its derived state of FOLDERS-009, `subfolders` naming an empty one's. */
export function subtreeStateText(state: SubtreeState, sums: FolderSums, subfolders: number): string {
	switch (state) {
		case 'empty':
			return n('honeycomb', 'No photos of its own · {count} subfolder', 'No photos of its own · {count} subfolders', subfolders, { count: formatNumber(subfolders) })
		case 'read-only':
			return t('honeycomb', 'Read-only')
		case 'done':
			return n('honeycomb', 'Done · all {count} folder', 'Done · all {count} folders', sums.rateable, { count: formatNumber(sums.rateable) })
		case 'complete': {
			const open = sums.rateable - sums.done
			return n('honeycomb', 'Complete · {count} folder not marked done', 'Complete · {count} folders not marked done', open, { count: formatNumber(open) })
		}
		case 'open':
			return [
				t('honeycomb', '{percent} % undecided', { percent: percent(sums.undecided, sums.photos) }),
				foldersDoneText(sums.done, sums.rateable),
			].join(SEPARATOR)
	}
}

/** The level card's line: the photos with subfolders, directly in it when there are, and the undecided ones. */
export function levelSummaryText(all: FolderSums, own: FolderSums): string {
	const parts = [n('honeycomb', '{count} photo with subfolders', '{count} photos with subfolders', all.photos, { count: formatNumber(all.photos) })]
	if (own.photos > 0) {
		parts.push(n('honeycomb', '{count} directly in it', '{count} directly in it', own.photos, { count: formatNumber(own.photos) }))
	}
	parts.push(undecidedText(all.undecided))
	return parts.join(SEPARATOR)
}

/** The strip while the server summarises folders: the folders not yet fresh. */
export function updatingText(folders: number): string {
	return n('honeycomb', 'Updating {count} folder', 'Updating {count} folders', folders, { count: formatNumber(folders) })
}

/** Why the setup does not add a folder as a root (FOLDERS-004). */
export function refusalText(refused: LibraryRootRefusal): string {
	const path = { path: refused.path }
	switch (refused.reason) {
		case 'empty':
			return t('honeycomb', 'Your home folder cannot be a root; choose a folder in it.')
		case 'invalid':
			return t('honeycomb', '{path} is not a folder path.', path, undefined, PLAIN_TEXT)
		case 'duplicate':
			return t('honeycomb', '{path} is already a root.', path, undefined, PLAIN_TEXT)
		case 'inside':
			return t('honeycomb', '{path} lies inside the root {other}.', { ...path, other: refused.other }, undefined, PLAIN_TEXT)
		case 'contains':
			return t('honeycomb', '{path} holds the root {other}; remove that one first.', { ...path, other: refused.other }, undefined, PLAIN_TEXT)
	}
}
