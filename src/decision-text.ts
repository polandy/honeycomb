// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionChange } from './logic/decision-change.ts'
import type { SeriesEdit } from './logic/series-edit.ts'
import type { TagChange } from './logic/tag.ts'
import type { DescribedStep, StepKind } from './logic/undo.ts'

import { n, t } from '@nextcloud/l10n'
import { colourLabelName } from './colour-labels.ts'
import { formatNumber, PLAIN_TEXT } from './l10n.ts'

/** The one name, or the count of the photos. */
function photos(names: readonly string[]): string {
	return names.length === 1
		? names[0]!
		: n('honeycomb', '{count} photo', '{count} photos', names.length, { count: formatNumber(names.length) }, PLAIN_TEXT)
}

/** What a decision did to the photos. */
function decisionText(change: DecisionChange, photos: string): string {
	const vars = { photos }
	if ('flag' in change && 'keepRaw' in change) {
		return t('honeycomb', '{photos} reset', vars, undefined, PLAIN_TEXT)
	}
	if ('flag' in change) {
		return change.flag === 'picked'
			? t('honeycomb', 'Picked {photos}', vars, undefined, PLAIN_TEXT)
			: change.flag === 'rejected'
				? t('honeycomb', 'Rejected {photos}', vars, undefined, PLAIN_TEXT)
				: t('honeycomb', 'Unflagged {photos}', vars, undefined, PLAIN_TEXT)
	}
	if ('rating' in change) {
		return change.rating === 0
			? t('honeycomb', 'Cleared rating of {photos}', vars, undefined, PLAIN_TEXT)
			: t('honeycomb', 'Rated {photos} {stars}', { ...vars, stars: '★'.repeat(change.rating) }, undefined, PLAIN_TEXT)
	}
	if ('colourLabel' in change) {
		return change.colourLabel === null
			? t('honeycomb', 'Removed label from {photos}', vars, undefined, PLAIN_TEXT)
			: t('honeycomb', 'Labelled {photos} {label}', { ...vars, label: colourLabelName(change.colourLabel) }, undefined, PLAIN_TEXT)
	}
	return change.keepRaw
		? t('honeycomb', 'Marked {photos} Keep RAW', vars, undefined, PLAIN_TEXT)
		: t('honeycomb', 'Removed Keep RAW from {photos}', vars, undefined, PLAIN_TEXT)
}

/** What a tag change did to the photos. */
function tagText(change: TagChange, photos: string): string {
	return change.added.length > 0
		? t('honeycomb', 'Tagged {photos} {tag}', { photos, tag: change.added.join(', ') }, undefined, PLAIN_TEXT)
		: t('honeycomb', 'Removed {tag} from {photos}', { photos, tag: change.removed.join(', ') }, undefined, PLAIN_TEXT)
}

/** What each series edit did, given how many photos it named, the photos and how many series it touched. */
const SERIES_TEXT: { readonly [E in SeriesEdit]: (count: number, photos: string, series: number) => string } = {
	new: (count) => n('honeycomb', 'Made a series of {count} photo', 'Made a series of {count} photos', count, { count: formatNumber(count) }, PLAIN_TEXT),
	add: (_count, photos) => t('honeycomb', 'Added {photos} to the series', { photos }, undefined, PLAIN_TEXT),
	merge: (count, _photos, series) => n('honeycomb', 'Merged {series} series · {count} photo', 'Merged {series} series · {count} photos', count, { count: formatNumber(count), series: formatNumber(series) }, PLAIN_TEXT),
	remove: (count, photos) => (count === 1
		? t('honeycomb', 'Removed {photos} from the series', { photos }, undefined, PLAIN_TEXT)
		: t('honeycomb', 'Removed {photos} from their series', { photos }, undefined, PLAIN_TEXT)),
	dissolve: (count) => n('honeycomb', 'Dissolved the series · {count} photo', 'Dissolved the series · {count} photos', count, { count: formatNumber(count) }, PLAIN_TEXT),
	done: () => t('honeycomb', 'Marked the series done'),
	reopen: () => t('honeycomb', 'Reopened the series'),
}

/** The words of each kind of step, given the step and its photos. */
const STEP_TEXT: { readonly [K in StepKind]: (step: DescribedStep<K>, photos: string) => string } = {
	decision: ({ change }, photos) => decisionText(change, photos),
	pickRest: ({ picked }) => t('honeycomb', 'Picked {name}, rejected the rest', { name: picked }, undefined, PLAIN_TEXT),
	tags: ({ change }, photos) => tagText(change, photos),
	series: ({ edit, names, series }, photos) => SERIES_TEXT[edit](names.length, photos, series),
}

/** What a change did, for its toast: "Rejected IMG_0001", "Rated 3 photos ★★★", "Tagged 2 photos Sunrise". */
export function changeText<K extends StepKind>(step: DescribedStep<K>): string {
	return STEP_TEXT[step.kind](step, photos(step.names))
}

/** What an undo took back: "Undid: Rejected IMG_0001". */
export function undoneText(entry: DescribedStep): string {
	return t('honeycomb', 'Undid: {change}', { change: changeText(entry) }, undefined, PLAIN_TEXT)
}

/** What a redo put again: "Redid: Rejected IMG_0001". */
export function redoneText(entry: DescribedStep): string {
	return t('honeycomb', 'Redid: {change}', { change: changeText(entry) }, undefined, PLAIN_TEXT)
}

/** The toast of flag saves the server did not take: "Could not save the flag of 2 photos; they are back as they were" (XMP-008.17). */
export function flagsNotSavedText(photos: number): string {
	return n('honeycomb', 'Could not save the flag of {count} photo; it is back as it was', 'Could not save the flags of {count} photos; they are back as they were', photos, { count: formatNumber(photos) })
}

/** The progress over the photos the filters show, while they hide some: "4 / 20 shown decided" (GRID-002.7). */
export function shownDecidedText(decided: number, total: number): string {
	return n('honeycomb', '{decided} / {total} shown decided', '{decided} / {total} shown decided', total, { decided: formatNumber(decided), total: formatNumber(total) })
}

/** The progress of a cull: "1,200 / 1,840 decided". */
export function decidedText(decided: number, total: number): string {
	return n('honeycomb', '{decided} / {total} decided', '{decided} / {total} decided', total, { decided: formatNumber(decided), total: formatNumber(total) })
}
