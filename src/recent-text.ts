// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSet } from './logic/folder-set.ts'

import { n, t } from '@nextcloud/l10n'
import { formatNumber, PLAIN_TEXT } from './l10n.ts'

/** A folder set's name under *Recent*: "Trip", "Trip + subfolders", "3 folders"; the root is *Home*. */
export function folderSetName({ paths, subfolders }: FolderSet): string {
	if (paths.length === 1) {
		const name = paths[0]!.split('/').pop() || t('honeycomb', 'Home')
		return subfolders ? t('honeycomb', '{name} + subfolders', { name }, undefined, PLAIN_TEXT) : name
	}
	const count = { count: formatNumber(paths.length) }
	return subfolders
		? n('honeycomb', '{count} folder + subfolders', '{count} folders + subfolders', paths.length, count)
		: n('honeycomb', '{count} folder', '{count} folders', paths.length, count)
}
