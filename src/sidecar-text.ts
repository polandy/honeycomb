// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SidecarFailureReason } from './logic/sidecar-sync.ts'

import { n, t } from '@nextcloud/l10n'
import { formatNumber, PLAIN_TEXT } from './l10n.ts'

/** Why a sidecar was not written, in the user's words. */
export function sidecarFailureReason(reason: SidecarFailureReason): string {
	switch (reason) {
		case 'malformed':
			return t('honeycomb', 'The sidecar is not well-formed XML; honeycomb leaves it as it is')
		case 'not-utf-8':
			return t('honeycomb', 'The sidecar is not UTF-8 text; honeycomb leaves it as it is')
		case 'doctype':
			return t('honeycomb', 'The sidecar declares a document type; honeycomb leaves it as it is')
		case 'conflict':
			return t('honeycomb', 'The sidecar states a value twice in different ways; honeycomb leaves it as it is')
		case 'not-xmp':
			return t('honeycomb', 'The file is not an XMP sidecar; honeycomb leaves it as it is')
		case 'notFound':
			return t('honeycomb', 'The sidecar is gone; reload the folder')
		case 'tooLarge':
			return t('honeycomb', 'The sidecar is too large to read')
		case 'notPermitted':
			return t('honeycomb', 'You may not change this sidecar or create files in its folder')
		case 'locked':
			return t('honeycomb', 'The sidecar is locked (another process is writing to it)')
		case 'changed':
			return t('honeycomb', 'The sidecar changed again while honeycomb wrote it')
		case 'noVersions':
			return t('honeycomb', 'File versions are off, so honeycomb does not overwrite an existing sidecar')
		case 'unreachable':
			return t('honeycomb', 'Could not reach the server')
		default:
			return t('honeycomb', 'The server could not write the sidecar')
	}
}

/** "Could not write 2 sidecars", the toast of a write with failures. */
export const notWrittenText = (count: number) => n('honeycomb', 'Could not write {count} sidecar', 'Could not write {count} sidecars', count, { count: formatNumber(count) }, PLAIN_TEXT)

/** "Wrote the decisions of 2 photos to sidecars", the toast of an explicit write. */
export const writtenText = (count: number) => n('honeycomb', 'Wrote the decisions of {count} photo to sidecars', 'Wrote the decisions of {count} photos to sidecars', count, { count: formatNumber(count) }, PLAIN_TEXT)

/** "Could not write 1 of 2 photos", the result of a migration run with failures (XMP-007.12). */
export const photosNotWrittenText = (failed: number, count: number) => n('honeycomb', 'Could not write {failed} of {count} photo', 'Could not write {failed} of {count} photos', count, { failed: formatNumber(failed), count: formatNumber(count) }, PLAIN_TEXT)

/** The result of a migration run without photos (XMP-007.12). */
export const nothingToWriteText = () => t('honeycomb', 'No stored decisions to write here')

/** A migration run's result and how many photos it skipped in shared folders not confirmed (XMP-007.13). */
export const withSkippedText = (result: string, skipped: number) => (skipped === 0
	? result
	: n('honeycomb', '{result}; skipped {count} photo in a shared folder not confirmed', '{result}; skipped {count} photos in shared folders not confirmed', skipped, { result, count: formatNumber(skipped) }, PLAIN_TEXT))

/** "1 photo in a shared folder you have not confirmed is skipped.", the migration dialog's note (XMP-007.13). */
export const skippedNoteText = (skipped: number) => n('honeycomb', '{count} photo in a shared folder you have not confirmed is skipped.', '{count} photos in shared folders you have not confirmed are skipped.', skipped, { count: formatNumber(skipped) }, PLAIN_TEXT)
