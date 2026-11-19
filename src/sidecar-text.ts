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
		case 'noSpace':
			return t('honeycomb', 'No storage space left for the sidecar; free some space or ask the folder\'s owner')
		case 'unreachable':
			return t('honeycomb', 'Could not reach the server')
		case 'failed':
			return t('honeycomb', 'The server failed on the sidecar; the Nextcloud log names the cause')
	}
}

/** The message with the reason of most failures, and a pointer to *Details* when they differ (XMP-003.13, .33). */
function withReasonText(message: string, reasons: readonly SidecarFailureReason[]): string {
	const counts = new Map<SidecarFailureReason, number>()
	reasons.forEach((reason) => counts.set(reason, (counts.get(reason) ?? 0) + 1))
	const [main] = [...counts].reduce((most, each) => (each[1] > most[1] ? each : most))
	const text = t('honeycomb', '{message}. {reason}', { message, reason: sidecarFailureReason(main) }, undefined, PLAIN_TEXT)
	return counts.size === 1 ? text : t('honeycomb', '{text}. More reasons in Details.', { text }, undefined, PLAIN_TEXT)
}

/** "Could not write 2 sidecars. You may not …", the toast of a write with failures, naming their reason. */
export const notWrittenText = (reasons: readonly SidecarFailureReason[]) => withReasonText(n('honeycomb', 'Could not write {count} sidecar', 'Could not write {count} sidecars', reasons.length, { count: formatNumber(reasons.length) }, PLAIN_TEXT), reasons)
