// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ExtensionRefusal } from '../logic/settings.ts'

import { t } from '@nextcloud/l10n'

/** An extension as the chips show it. */
export const shown = (extension: string) => extension.toUpperCase()

/** Why an extension was not added, in the user's words. */
export function extensionRefusalText(refusal: ExtensionRefusal, input: string): string {
	const extension = `.${shown(input.trim().replace(/^\./, ''))}`
	switch (refusal) {
		case 'empty': return t('honeycomb', 'Type an extension.')
		case 'sidecar': return t('honeycomb', 'Sidecars are paired with their photo, they cannot be a photo type.')
		case 'invalid': return t('honeycomb', 'An extension has only letters and digits.')
		case 'in-this-list': return t('honeycomb', '{extension} is already in this list.', { extension })
		case 'in-other-list': return t('honeycomb', '{extension} is already in the other list.', { extension })
	}
}
