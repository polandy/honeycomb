// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Forecast } from '../logic/stats-library.ts'

import { n, t } from '@nextcloud/l10n'
import { FORECAST_DAYS } from '../logic/stats-library.ts'
import { PLAIN_TEXT } from '../shared/l10n.ts'

/** The forecast's figure: how long the rest takes, or that the backlog grows (STATS-001.84). */
export function forecastText(forecast: Forecast): string {
	switch (forecast.kind) {
		case 'grows':
			return t('honeycomb', 'At this pace the backlog grows')
		case 'days':
			return n('honeycomb', 'About %n day', 'About %n days', forecast.count, undefined, PLAIN_TEXT)
		case 'weeks':
			return n('honeycomb', 'About %n week', 'About %n weeks', forecast.count, undefined, PLAIN_TEXT)
		case 'months':
			return n('honeycomb', 'About %n month', 'About %n months', forecast.count, undefined, PLAIN_TEXT)
	}
}

/** The line below the forecast's figure: the days its pace is read from. */
export function forecastNote(forecast: Forecast): string {
	return forecast.kind === 'grows'
		? t('honeycomb', 'as many photos added as decided or more (last {days} days)', { days: FORECAST_DAYS }, undefined, PLAIN_TEXT)
		: t('honeycomb', 'at your pace (last {days} days)', { days: FORECAST_DAYS }, undefined, PLAIN_TEXT)
}
