// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderDoneBatch } from '../api/library.ts'
import type { FolderMark, FolderNode } from '../logic/folder-hierarchy.ts'
import type { FolderDone, FolderRow } from '../logic/folder-row.ts'
import type { ToastAction } from '../shared/toast.ts'

import { t } from '@nextcloud/l10n'
import { readonly, shallowRef } from 'vue'
import { batchMarks } from '../logic/folder-hierarchy.ts'
import { folderName } from '../logic/folder-row.ts'
import { fireAndLog } from '../shared/fire-and-log.ts'
import { PLAIN_TEXT } from '../shared/l10n.ts'
import { logger } from '../shared/logger.ts'
import { markedAllText, reopenedAllText } from './folders-text.ts'

/** How long the *Mark done* toast offers *Undo*, as in the mockup (FOLDERS-008.3). */
export const UNDO_MS = 8000

/** The server seams of the done status (FOLDERS-006). */
export interface FolderDoneApi {
	markFolderDone(fileId: number, photos: number): Promise<FolderDone>
	reopenFolder(fileId: number): Promise<void>
	markFoldersDone(folders: readonly FolderMark[]): Promise<FolderDoneBatch>
	reopenFolders(fileIds: readonly number[]): Promise<void>
}

/** What marking a folder done needs of the list and the app. */
export interface FolderDoneOptions {
	/** Shows the row of `fileId` with its new status. */
	setDone(fileId: number, done: FolderDone | null): void
	toast(message: string, action?: ToastAction | null, offer?: ToastAction, details?: readonly string[], duration?: number): () => void
	toastError(message: string): void
}

/** *Mark done*, *Mark all done*, their *Undo*, *Reopen* and *Reopen all*, each without a dialog (FOLDERS-008). */
export function useFolderDone(api: FolderDoneApi, options: FolderDoneOptions) {
	/** The row whose status changed last, a new object each time, so the list moves the focus to it. */
	const changed = shallowRef<{ fileId: number } | null>(null)

	/** Marks the folder done as of its photos and offers *Undo*. */
	async function markDone(row: FolderRow): Promise<void> {
		const name = folderName(row)
		try {
			options.setDone(row.fileId, await api.markFolderDone(row.fileId, row.photos))
		} catch (error: unknown) {
			logger.error('Could not mark the folder done', { error })
			options.toastError(t('honeycomb', 'Could not mark {folder} done.', { folder: name }, undefined, PLAIN_TEXT))
			return
		}
		changed.value = { fileId: row.fileId }
		const undo = { label: t('honeycomb', 'Undo'), run: () => fireAndLog(write(row), 'Could not write the folder done row') }
		options.toast(t('honeycomb', 'Marked {folder} done', { folder: name }, undefined, PLAIN_TEXT), undo, undefined, [], UNDO_MS)
	}

	/** Reopens the folder and says so. */
	async function reopen(row: FolderRow): Promise<void> {
		if (await write(row)) {
			options.toast(t('honeycomb', 'Reopened {folder}', { folder: folderName(row) }, undefined, PLAIN_TEXT))
		}
	}

	/** Removes the folder's status; whether the server took it. */
	async function write(row: FolderRow): Promise<boolean> {
		try {
			await api.reopenFolder(row.fileId)
		} catch (error: unknown) {
			logger.error('Could not reopen the folder', { error })
			options.toastError(t('honeycomb', 'Could not reopen {folder}.', { folder: folderName(row) }, undefined, PLAIN_TEXT))
			return false
		}
		options.setDone(row.fileId, null)
		changed.value = { fileId: row.fileId }
		return true
	}

	/** Marks every rateable open folder of the subtree done in one write and offers *Undo* (FOLDERS-009.11). */
	async function markAllDone(node: FolderNode): Promise<void> {
		const { mark, readOnly } = batchMarks(node)
		if (mark.length === 0) {
			options.toast(t('honeycomb', 'No folder left to mark done'))
			return
		}
		const batch = await markBatch(mark)
		if (batch === null) {
			return
		}
		const marked = batch.done.map((each) => each.fileId)
		const skipped = readOnly + batch.skipped.filter((each) => each.reason === 'read-only').length
		const undo = { label: t('honeycomb', 'Undo'), run: () => fireAndLog(reopenBatch(marked), 'Could not undo Mark all done') }
		options.toast(markedAllText(marked.length, skipped), marked.length === 0 ? null : undo, undefined, [], UNDO_MS)
	}

	/** Reopens every done folder of the subtree in one write; *Undo* marks each again with its earlier photos (FOLDERS-009.13). */
	async function reopenAll(node: FolderNode): Promise<void> {
		const { reopen: folders } = batchMarks(node)
		if (folders.length === 0 || !(await reopenBatch(folders.map((each) => each.fileId)))) {
			return
		}
		const undo = { label: t('honeycomb', 'Undo'), run: () => fireAndLog(markBatch(folders), 'Could not undo Reopen all') }
		options.toast(reopenedAllText(folders.length), undo, undefined, [], UNDO_MS)
	}

	/** Marks the folders done and shows each written row; null when the server refused. */
	async function markBatch(folders: readonly FolderMark[]): Promise<FolderDoneBatch | null> {
		let batch: FolderDoneBatch
		try {
			batch = await api.markFoldersDone(folders)
		} catch (error: unknown) {
			logger.error('Could not mark the folders done', { error })
			options.toastError(t('honeycomb', 'Could not mark the folders done.'))
			return null
		}
		for (const each of batch.done) {
			options.setDone(each.fileId, each.done)
		}
		return batch
	}

	/** Removes the folders' status and shows them open; whether the server took it. */
	async function reopenBatch(fileIds: readonly number[]): Promise<boolean> {
		try {
			await api.reopenFolders(fileIds)
		} catch (error: unknown) {
			logger.error('Could not reopen the folders', { error })
			options.toastError(t('honeycomb', 'Could not reopen the folders.'))
			return false
		}
		for (const fileId of fileIds) {
			options.setDone(fileId, null)
		}
		return true
	}

	return { changed: readonly(changed), markDone, reopen, markAllDone, reopenAll }
}
