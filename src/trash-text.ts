// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TrashFailure, TrashReport } from './logic/trash-report.ts'

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
		case 'locked':
			return t('honeycomb', 'File is locked (another process is writing to it)')
		case 'skipped':
			return t('honeycomb', 'Not tried, because another file of this photo failed')
		default:
			return t('honeycomb', 'Could not move the file to the trash bin')
	}
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
