// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IconName } from './components/AppIcon.vue'
import type { Flag } from './logic/decision.ts'

import { t } from '@nextcloud/l10n'

/** The icon of each flag in the action bar, the flag filter and the thumbnail badges. */
export const FLAG_ICONS: Readonly<Record<Flag, IconName>> = {
	picked: 'flagPick',
	rejected: 'flagX',
	unflagged: 'flagOutline',
}

/** The word of each flag's button and swipe hint. */
export function flagLabel(flag: Flag): string {
	return { picked: t('honeycomb', 'Pick'), rejected: t('honeycomb', 'Reject'), unflagged: t('honeycomb', 'Unflag') }[flag]
}
