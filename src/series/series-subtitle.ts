// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Series } from '../logic/series.ts'

import { t } from '@nextcloud/l10n'
import { captureTime } from '../logic/picture-order.ts'
import { formatTime, PLAIN_TEXT } from '../shared/l10n.ts'

/** The compare's subtitle: the first and last capture time, then whether the series is edited by hand and has members in other folders (SERIES-005.17, .18). */
export function seriesSubtitle(series: Series<Picture<ListingEntry>>): string {
	const [start, end] = [captureTime(series.members[0]!), captureTime(series.members.at(-1)!)].map(formatTime)
	return [
		start === end ? start! : t('honeycomb', '{start}–{end}', { start: start!, end: end! }, undefined, PLAIN_TEXT),
		...(series.stored === undefined ? [] : [t('honeycomb', 'edited by hand')]),
		...(series.stored?.elsewhere === true ? [t('honeycomb', 'Also in other folders')] : []),
	].join(' · ')
}
