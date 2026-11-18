// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MenuEntry, SelectionEdit, SeriesOffer } from './logic/series-menu.ts'

import { n, t } from '@nextcloud/l10n'
import { formatNumber, PLAIN_TEXT } from './l10n.ts'

/** The words of one menu entry: its name and the line under it. */
export interface EntryText {
	readonly name: string
	readonly description: string
}

/** A count for the catalogue's placeholders. */
const counted = (count: number) => formatNumber(count)

/** The menu's heading: how the selection splits into series and loose photos (SERIES-005, Grid). */
export function seriesCaption<P>({ selected, touched, inSeries, loose }: SeriesOffer<P>): string {
	if (touched.length === 0) {
		return n('honeycomb', '{count} photo, none in a series', '{count} photos, none in a series', selected.length, { count: counted(selected.length) }, PLAIN_TEXT)
	}
	const split = touched.length === 1
		? n('honeycomb', '{count} photo in series ⧉ {size}', '{count} photos in series ⧉ {size}', inSeries.length, { count: counted(inSeries.length), size: counted(touched[0]!.members.length) }, PLAIN_TEXT)
		: n('honeycomb', '{count} photo in {series} series', '{count} photos in {series} series', inSeries.length, { count: counted(inSeries.length), series: counted(touched.length) }, PLAIN_TEXT)
	return loose.length === 0
		? split
		: n('honeycomb', '{split} · {count} loose', '{split} · {count} loose', loose.length, { split, count: counted(loose.length) }, PLAIN_TEXT)
}

/** The words of each edit, given the selection and why the entry does not fit, if it does not. */
const ENTRY_TEXT: { readonly [E in SelectionEdit]: (offer: SeriesOffer<unknown>, blocked: MenuEntry['blocked']) => EntryText } = {
	new: ({ selected, inSeries }, blocked) => ({
		name: n('honeycomb', 'New series from {count} photo', 'New series from {count} photos', selected.length, { count: counted(selected.length) }, PLAIN_TEXT),
		description: blocked !== null
			? t('honeycomb', 'Select two photos or more')
			: inSeries.length === 0
				? t('honeycomb', 'They stay one series from now on')
				: n('honeycomb', 'Takes it out of its series', 'Takes them out of their series', inSeries.length),
	}),
	add: ({ touched, loose }, blocked) => {
		if (blocked === 'noSeries') {
			return { name: t('honeycomb', 'Add to a series'), description: t('honeycomb', 'Select a photo of the series too') }
		}
		const size = counted(touched[0]!.members.length)
		return blocked === 'noLoose'
			? { name: t('honeycomb', 'Add to series ⧉ {size}', { size }, undefined, PLAIN_TEXT), description: t('honeycomb', 'Select photos outside the series too') }
			: {
					name: n('honeycomb', 'Add {count} photo to series ⧉ {size}', 'Add {count} photos to series ⧉ {size}', loose.length, { count: counted(loose.length), size }, PLAIN_TEXT),
					description: n('honeycomb', 'It stays in the series from now on', 'They stay in the series from now on', loose.length),
				}
	},
	merge: ({ touched, loose }) => {
		const count = touched.reduce((sum, { members }) => sum + members.length, loose.length)
		return {
			name: n('honeycomb', 'Merge {series} series · {count} photo', 'Merge {series} series · {count} photos', count, { series: counted(touched.length), count: counted(count) }, PLAIN_TEXT),
			description: loose.length === 0
				? t('honeycomb', 'Their whole series become one')
				: n('honeycomb', 'Their whole series and {count} loose photo', 'Their whole series and {count} loose photos', loose.length, { count: counted(loose.length) }, PLAIN_TEXT),
		}
	},
	done: ({ touched }, blocked) => {
		const name = t('honeycomb', 'Series done')
		if (blocked !== null) {
			return { name, description: blocked === 'noSeries' ? t('honeycomb', 'Select a photo of the series') : t('honeycomb', 'Select photos of one series only') }
		}
		return touched[0]!.stored?.status === 'done'
			? { name: t('honeycomb', 'Reopen series'), description: t('honeycomb', 'Its unflagged photos count as undecided again') }
			: { name, description: t('honeycomb', 'Its unflagged photos count as decided') }
	},
	remove: ({ inSeries }, blocked) => (blocked !== null
		? { name: t('honeycomb', 'Remove from their series'), description: t('honeycomb', 'None of them is in a series') }
		: {
				name: n('honeycomb', 'Remove {count} photo from its series', 'Remove {count} photos from their series', inSeries.length, { count: counted(inSeries.length) }, PLAIN_TEXT),
				description: n('honeycomb', 'It is never grouped again automatically', 'They are never grouped again automatically', inSeries.length),
			}),
}

/** The name and the line under one entry of the *Series…* menu. */
export function entryText<P>(entry: MenuEntry, offer: SeriesOffer<P>): EntryText {
	return ENTRY_TEXT[entry.edit](offer, entry.blocked)
}
