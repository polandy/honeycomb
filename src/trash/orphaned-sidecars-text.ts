// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { OrphanedSidecarSkip } from '../logic/orphaned-sidecars.ts'

import { n, t } from '@nextcloud/l10n'
import { formatFileSize, formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'
import { unkeptReason } from './trash-text.ts'

/** "3 orphaned sidecars, 4 kB", the total above the list (XMP-009.11). */
export function totalText(count: number, size: number): string {
	return n('honeycomb', '{count} orphaned sidecar, {size}', '{count} orphaned sidecars, {size}', count, { count: formatNumber(count), size: formatFileSize(size) }, PLAIN_TEXT)
}

/** "/Photos – 2 sidecars, 2 kB", one folder of the list. */
export function folderText(path: string, count: number, size: number): string {
	return n('honeycomb', '{path} – {count} sidecar, {size}', '{path} – {count} sidecars, {size}', count, { path, count: formatNumber(count), size: formatFileSize(size) }, PLAIN_TEXT)
}

/** "Move 3 sidecars to trash", the confirmation. */
export function moveText(count: number): string {
	return n('honeycomb', 'Move {count} sidecar to trash', 'Move {count} sidecars to trash', count, { count: formatNumber(count) }, PLAIN_TEXT)
}

/** "2 moved to the trash bin, 1 skipped", the report of a move (XMP-009.12). */
export function reportText(trashed: number, skipped: number): string {
	return t('honeycomb', '{trashed} moved to the trash bin, {skipped} skipped', { trashed: formatNumber(trashed), skipped: formatNumber(skipped) }, undefined, PLAIN_TEXT)
}

/** Why a sidecar stayed, in the user's words. */
export function skipReason(reason: OrphanedSidecarSkip): string {
	switch (reason) {
		case 'notOrphaned':
			return t('honeycomb', 'A photo or video it belongs to is in its folder now')
		case 'notFound':
			return t('honeycomb', 'File is gone; find orphaned sidecars again')
		case 'changed':
			return t('honeycomb', 'File changed since the scan; find orphaned sidecars again')
		case 'notPermitted':
			return t('honeycomb', 'You may not delete this file')
		case 'noTrashBin':
		case 'tooLarge':
			return unkeptReason(reason)
		case 'locked':
			return t('honeycomb', 'File is locked (another process is writing to it)')
		case 'notSent':
			return t('honeycomb', 'Not sent, because a request failed')
		default:
			return t('honeycomb', 'Could not move the file to the trash bin')
	}
}
