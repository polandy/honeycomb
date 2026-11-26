// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IconName } from '../components/AppIcon.vue'
import type { SeriesStatus } from '../logic/stored-series.ts'

import { n, t } from '@nextcloud/l10n'
import { formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

/** A tile's place in its series, on the first tile of a run the run's length, and a stored series' status (SERIES-002.10, SERIES-005.17). */
export interface TileSeriesPlace {
	readonly position: number
	readonly size: number
	readonly run: number | null
	readonly stored?: SeriesStatus | null
}

/** The tile's place in its series as the label says it (SERIES-002.10). */
export function seriesLabelParts(series: TileSeriesPlace | null, open: boolean): string[] {
	return series === null
		? []
		: [
				t('honeycomb', 'Series, photo {position} of {size}', { position: formatNumber(series.position), size: formatNumber(series.size) }, undefined, PLAIN_TEXT),
				...(open ? [t('honeycomb', 'Series may still change')] : []),
				...(series.stored === 'open' ? [t('honeycomb', 'Series edited by hand')] : []),
				...(series.stored === 'done' ? [t('honeycomb', 'Series done')] : []),
			]
}

/** The badge on the first tile of a run: the series' size, or the run's length of it when the series is split. */
export function seriesBadge(series: TileSeriesPlace | null): { text: string, icon: IconName | null, label: string } | null {
	if (series === null || series.run === null) {
		return null
	}
	const size = formatNumber(series.size)
	return {
		text: series.run < series.size ? t('honeycomb', '⧉ {run} of {size}', { run: formatNumber(series.run), size }, undefined, PLAIN_TEXT) : `⧉ ${size}`,
		icon: series.stored === 'done' ? 'check' : series.stored === 'open' ? 'pin' : null,
		label: n('honeycomb', 'Series of {count} – compare', 'Series of {count} – compare', series.size, { count: size }, PLAIN_TEXT),
	}
}
