// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LockedPicture, LockReason } from '../logic/writability.ts'

import { n, t } from '@nextcloud/l10n'
import { formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

/** Why a photo was not changed, after a count or a name (XMP-008.14). */
const LOCK_REASON: Readonly<Record<LockReason, () => string>> = {
	readOnly: () => t('honeycomb', 'read only'),
}

/** "2 photos not changed: read only". */
function notChangedText(locked: readonly LockedPicture[]): string {
	return n('honeycomb', '{count} photo not changed: {reason}', '{count} photos not changed: {reason}', locked.length, { count: formatNumber(locked.length), reason: LOCK_REASON.readOnly() }, PLAIN_TEXT)
}

/** The toast of a step that changed nothing because its photos are read only; it names no count (XMP-008.3, .14). */
export function lockedText(): string {
	return t('honeycomb', 'Not changed: read only')
}

/** What a step changed, and how many of its photos it left locked: "Rejected IMG_2; 2 photos not changed: …" (XMP-008.14). */
export function partialText(change: string, locked: readonly LockedPicture[]): string {
	return locked.length === 0 ? change : t('honeycomb', '{change}; {notChanged}', { change, notChanged: notChangedText(locked) }, undefined, PLAIN_TEXT)
}

/** Each locked photo with its reason, for the toast's details. */
export function lockDetails(locked: readonly LockedPicture[]): string[] {
	return locked.map(({ picture, reason }) => t('honeycomb', '{name}: {reason}', { name: picture.baseName, reason: LOCK_REASON[reason]() }, undefined, PLAIN_TEXT))
}
