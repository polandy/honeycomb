// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { t } from '@nextcloud/l10n'
import { keyCap } from '../shared/hotkeys.ts'
import { PLAIN_TEXT } from '../shared/l10n.ts'

/** The short hint Shift+P gives on a photo outside a series, naming the key (KEYS-001.13). */
export function notInSeriesHint(): string {
	return t('honeycomb', 'Not in a series · {key} picks a photo and rejects the rest of its series', { key: keyCap('pick-rest') }, undefined, PLAIN_TEXT)
}
