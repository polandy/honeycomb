// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UndoEntry } from './logic/undo.ts'

import { n, t } from '@nextcloud/l10n'
import { colourLabelName } from './colour-labels.ts'
import { formatNumber, PLAIN_TEXT } from './l10n.ts'

type Described = Pick<UndoEntry, 'change' | 'names'>

/** The one name, or the count of the photos. */
function photos(names: readonly string[]): string {
	return names.length === 1
		? names[0]!
		: n('honeycomb', '{count} photo', '{count} photos', names.length, { count: formatNumber(names.length) }, PLAIN_TEXT)
}

/** What a change did, for its toast: "Rejected IMG_0001", "Rated 3 photos ★★★". */
export function changeText({ change, names }: Described): string {
	const vars = { photos: photos(names) }
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

/** What an undo took back: "Undid: Rejected IMG_0001". */
export function undoneText(entry: Described): string {
	return t('honeycomb', 'Undid: {change}', { change: changeText(entry) }, undefined, PLAIN_TEXT)
}
