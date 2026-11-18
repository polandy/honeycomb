// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FixedLock, LockedPicture } from './logic/writability.ts'

import { n, t } from '@nextcloud/l10n'
import { formatNumber, PLAIN_TEXT } from './l10n.ts'
import { firstLock } from './logic/writability.ts'

/** What a toast says when the one photo of a step is locked (XMP-008.3, .5). */
const ONE_LOCKED: Readonly<Record<FixedLock, () => string>> = {
	readOnly: () => t('honeycomb', 'Not changed: you may only read this folder'),
	noVersions: () => t('honeycomb', 'Not changed: this folder keeps no versions'),
	refused: () => t('honeycomb', 'Not changed: a sidecar of this photo was refused; see Details of the last write'),
	legacy: () => t('honeycomb', 'Not changed: this photo\'s stored decisions are not yet in its sidecars'),
}

/** Why a photo was not changed, after a count or a name (XMP-008.9). */
const LOCK_REASON: Readonly<Record<FixedLock, () => string>> = {
	readOnly: () => t('honeycomb', 'you may only read the folder'),
	noVersions: () => t('honeycomb', 'the folder keeps no versions'),
	refused: () => t('honeycomb', 'a sidecar was refused; see Details of the last write'),
	legacy: () => t('honeycomb', 'stored decisions are not yet in the sidecars'),
}

/** "2 photos not changed: you may only read the folder", naming the first reason. */
function notChangedText(locked: readonly LockedPicture[]): string {
	return n('honeycomb', '{count} photo not changed: {reason}', '{count} photos not changed: {reason}', locked.length, { count: formatNumber(locked.length), reason: LOCK_REASON[firstLock(locked)]() }, PLAIN_TEXT)
}

/** The toast of a step that changed nothing because its photos are locked (XMP-008.9). */
export function lockedText(locked: readonly LockedPicture[]): string {
	return locked.length === 1 ? ONE_LOCKED[locked[0]!.reason]() : notChangedText(locked)
}

/** What a step changed, and how many of its photos it left locked: "Rejected IMG_2; 2 photos not changed: …" (XMP-008.9). */
export function partialText(change: string, locked: readonly LockedPicture[]): string {
	return locked.length === 0 ? change : t('honeycomb', '{change}; {notChanged}', { change, notChanged: notChangedText(locked) }, undefined, PLAIN_TEXT)
}

/** Each locked photo with its reason, for the toast's details. */
export function lockDetails(locked: readonly LockedPicture[]): string[] {
	return locked.map(({ picture, reason }) => t('honeycomb', '{name}: {reason}', { name: picture.baseName, reason: LOCK_REASON[reason]() }, undefined, PLAIN_TEXT))
}
