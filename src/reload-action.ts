// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'

/** The *Reload folder* button of a message about a listing gone stale; none where the flow cannot reload. */
export function reloadAction(reload: (() => void) | undefined): ToastAction | null {
	return reload === undefined ? null : { label: t('honeycomb', 'Reload folder'), run: reload }
}
