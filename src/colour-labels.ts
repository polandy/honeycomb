// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel } from './logic/decision.ts'

import { t } from '@nextcloud/l10n'

/** The swatch colour of each label, the mockup's palette; a label's colour is data, not a theme colour. */
export const COLOUR_LABEL_SWATCHES: Record<ColourLabel, string> = {
	red: '#e5484d',
	orange: '#f08a24',
	yellow: '#f2c94c',
	green: '#3fb26b',
	blue: '#3b82f6',
	magenta: '#d946ef',
	gray: '#8b8b8b',
	black: '#1f1f1f',
	white: '#f5f5f5',
}

const NAMES: Record<ColourLabel, () => string> = {
	red: () => t('honeycomb', 'Red'),
	orange: () => t('honeycomb', 'Orange'),
	yellow: () => t('honeycomb', 'Yellow'),
	green: () => t('honeycomb', 'Green'),
	blue: () => t('honeycomb', 'Blue'),
	magenta: () => t('honeycomb', 'Magenta'),
	gray: () => t('honeycomb', 'Gray'),
	black: () => t('honeycomb', 'Black'),
	white: () => t('honeycomb', 'White'),
}

/** The colour label's name in the user's language. */
export function colourLabelName(label: ColourLabel): string {
	return NAMES[label]()
}
