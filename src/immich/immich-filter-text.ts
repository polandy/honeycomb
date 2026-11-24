// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichKind } from '../logic/immich-asset.ts'
import type { TimeOption } from '../logic/immich-filters.ts'

import { t } from '@nextcloud/l10n'
import { formatMonth } from '../shared/l10n.ts'

/** A time option's chip: *Last 7 days*, the month or *All phone uploads* (IMMICH-002.30). */
export function timeLabel(option: TimeOption): string {
	switch (option.kind) {
		case 'last-7-days':
			return t('honeycomb', 'Last 7 days')
		case 'all':
			return t('honeycomb', 'All phone uploads')
		case 'month':
			return formatMonth(option.year, option.month)
	}
}

/** A device chip: the camera model, or *No camera data*. */
export function deviceLabel(model: string | null): string {
	return model ?? t('honeycomb', 'No camera data')
}

/** A kind chip. */
export function kindLabel(kind: ImmichKind): string {
	switch (kind) {
		case 'photo':
			return t('honeycomb', 'Photos')
		case 'live':
			return t('honeycomb', 'Motion photos')
		case 'video':
			return t('honeycomb', 'Videos')
	}
}
