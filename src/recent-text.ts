// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSet } from './logic/folder-set.ts'

import { n, t } from '@nextcloud/l10n'
import { formatNumber, PLAIN_TEXT } from './l10n.ts'
import { RequestTimeoutError } from './logic/timed-request.ts'

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

/** Why a folder set did not open, naming a timeout (DECISIONS-002.19). */
export function notOpenedText(folderSet: FolderSet, error: unknown): string {
	const name = folderSetName(folderSet)
	return error instanceof RequestTimeoutError
		? t('honeycomb', 'Could not open {name}: the server did not answer within {seconds} s.', { name, seconds: error.seconds }, undefined, PLAIN_TEXT)
		: t('honeycomb', 'Could not open {name}.', { name }, undefined, PLAIN_TEXT)
}
