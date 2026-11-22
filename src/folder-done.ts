// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderDone, FolderRow } from './logic/folder-row.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { readonly, shallowRef } from 'vue'
import { PLAIN_TEXT } from './l10n.ts'
import { logger } from './logger.ts'
import { folderName } from './logic/folder-row.ts'

/** How long the *Mark done* toast offers *Undo*, as in the mockup (FOLDERS-008.3). */
export const UNDO_MS = 8000

/** The server seams of the done status (FOLDERS-006). */
export interface FolderDoneApi {
	markFolderDone(fileId: number, photos: number): Promise<FolderDone>
	reopenFolder(fileId: number): Promise<void>
}

/** What marking a folder done needs of the list and the app. */
export interface FolderDoneOptions {
	/** Shows the row of `fileId` with its new status. */
	setDone(fileId: number, done: FolderDone | null): void
	toast(message: string, action?: ToastAction | null, offer?: ToastAction, details?: readonly string[], duration?: number): () => void
	toastError(message: string): void
}

/** *Mark done*, its *Undo* and *Reopen*, each without a dialog (FOLDERS-008). */
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
		const undo = { label: t('honeycomb', 'Undo'), run: () => void write(row) }
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

	return { changed: readonly(changed), markDone, reopen }
}
