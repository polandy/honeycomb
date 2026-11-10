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
