// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SkipReason } from './logic/fresh-check.ts'
import type { SendProgress } from './logic/request-chunks.ts'
import type { TrashFailure, TrashReport, UnkeptFailure } from './logic/trash-report.ts'

import { n, t } from '@nextcloud/l10n'
import { formatFileSize, formatNumber, PLAIN_TEXT } from './l10n.ts'

/** Why a file stayed, in the user's words. */
export function failureReason(result: TrashFailure): string {
	switch (result) {
		case 'notFound':
			return t('honeycomb', 'File is gone or no longer a photo; reload the folder')
		case 'changed':
			return t('honeycomb', 'File changed since the folder was listed; reload the folder, then delete again')
		case 'notPermitted':
			return t('honeycomb', 'You may not delete this file')
		case 'noTrashBin':
		case 'tooLarge':
			return unkeptReason(result)
		case 'locked':
			return t('honeycomb', 'File is locked (another process is writing to it)')
		case 'skipped':
			return t('honeycomb', 'Not tried, because another file of this photo failed')
		default:
			return t('honeycomb', 'Could not move the file to the trash bin')
	}
}

/** Why the trash bin would not keep a file, as the warning before deleting for good lists it. */
export function unkeptReason(result: UnkeptFailure): string {
	return result === 'tooLarge'
		? t('honeycomb', 'Larger than the trash bin allows')
		: t('honeycomb', 'No trash bin on this storage')
}

/** "%n file deleted permanently", the toast's part on the files deleted for good (ADR 0036). */
export function deletedPermanentlyText(count: number): string {
	return n('honeycomb', '{count} file deleted permanently', '{count} files deleted permanently', count, { count: formatNumber(count) }, PLAIN_TEXT)
}

/** The summaries' note on where deleted files go and how long the trash bin keeps them. */
export function trashBinNote(): string {
	return t('honeycomb', 'Files move to the Nextcloud trash bin and can be restored from there until it empties itself: after its retention time, or sooner when space runs short. Keep a backup of photos you cannot afford to lose.')
}

/** The held confirm button of a running delete: checking the photos until the first request goes, then moving them. */
export function runningText(progress: SendProgress | null | undefined): string {
	return progress ? t('honeycomb', 'Moving to trash…') : t('honeycomb', 'Checking the photos…')
}

/** "%n file" with the count formatted. */
const filesText = (count: number) => n('honeycomb', '{count} file', '{count} files', count, { count: formatNumber(count) }, PLAIN_TEXT)

/** "%n photo" with the count formatted. */
const photosText = (count: number) => n('honeycomb', '{count} photo', '{count} photos', count, { count: formatNumber(count) }, PLAIN_TEXT)

/** "Moved 3 files to trash · 1 failed", when files of a delete failed. */
function partlyText(report: TrashReport): string {
	const moved = report.trashed.length
	const failed = n('honeycomb', '{count} failed', '{count} failed', report.failed.length, { count: formatNumber(report.failed.length) }, PLAIN_TEXT)
	return `${n('honeycomb', 'Moved {count} file to trash', 'Moved {count} files to trash', moved, { count: formatNumber(moved) }, PLAIN_TEXT)} · ${failed}`
}

/** The photos, files and bytes a delete moved, as the toasts name them. */
function movedParts(report: TrashReport) {
	return { photos: photosText(report.removed), files: filesText(report.trashed.length), size: formatFileSize(report.bytes) }
}

/** The toast after a delete: what moved and was freed, or how many files failed. */
export function deletedText(report: TrashReport, retry: boolean): string {
	const moved = report.trashed.length
	if (report.failed.length > 0) {
		return partlyText(report)
	}
	if (retry) {
		return n('honeycomb', 'Moved {count} remaining file to the Nextcloud trash bin', 'Moved {count} remaining files to the Nextcloud trash bin', moved, { count: formatNumber(moved) }, PLAIN_TEXT)
	}
	return t('honeycomb', 'Moved {photos} · {files} · {size} freed to the Nextcloud trash bin', movedParts(report), undefined, PLAIN_TEXT)
}

/** The toast after *Remove RAWs*: whose RAWs went and what was freed, or how many files failed. */
export function removedRawsText(report: TrashReport): string {
	return report.failed.length > 0
		? partlyText(report)
		: t('honeycomb', 'Removed the RAWs of {photos} · {files} · {size} freed to the Nextcloud trash bin', movedParts(report), undefined, PLAIN_TEXT)
}

/** "%n photo skipped", the toast's part on the photos a delete by decision skipped. */
export function skippedText(count: number): string {
	return n('honeycomb', '{count} photo skipped', '{count} photos skipped', count, { count: formatNumber(count) }, PLAIN_TEXT)
}

/** "Fresh check not possible for %n photo", the question before a delete by decision sends photos unchecked (DELETE-002.25). */
export function uncheckedText(count: number): string {
	return n('honeycomb', 'Fresh check not possible for {count} photo', 'Fresh check not possible for {count} photos', count, { count: formatNumber(count) }, PLAIN_TEXT)
}

/** Why a delete by decision skipped a photo, in the user's words (DELETE-002.16). */
export function skipReason(reason: SkipReason): string {
	switch (reason) {
		case 'changed':
			return t('honeycomb', 'Its files changed since the folder was listed; reload the folder')
		case 'unread':
			return t('honeycomb', 'A sidecar could not be read')
		case 'refused':
			return t('honeycomb', 'A sidecar is not valid XMP')
		case 'notRejected':
			return t('honeycomb', 'No longer rejected')
		case 'notRemovable':
			return t('honeycomb', 'Now rejected or kept with Keep RAW')
		default:
			return t('honeycomb', 'The JPEG sidecar could not be written, so the RAW stays')
	}
}
