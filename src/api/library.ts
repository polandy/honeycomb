// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderDone, FolderRow } from '../logic/folder-row.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { API, ApiResponseError, isRecord } from './core.ts'

/** How many folders below a root are summarised (`done`) of all of them (`total`). */
export interface LibraryScanning {
	readonly done: number
	readonly total: number
}

/** One page of the folders below a root (FOLDERS-005); `scanning` is null once every folder is summarised. */
export interface LibraryPage {
	readonly folders: FolderRow[]
	readonly nextCursor: number | null
	readonly scanning: LibraryScanning | null
}

const ROW_NUMBERS = ['fileId', 'photos', 'bytes', 'rawBytes', 'picked', 'rejected', 'undecided', 'bursts', 'permissions'] as const
const ROW_TIMES = ['oldest', 'newest', 'lastActivity'] as const

/** The page of the folders below `root` after the folder `cursor` names, `limit` folders at most when given. */
export async function listLibraryFolders(root: string, cursor = 0, limit?: number): Promise<LibraryPage> {
	const params = limit === undefined ? { root, cursor } : { root, cursor, limit }
	const { data } = await axios.get<unknown>(generateUrl(`${API}/library/folders`), { params })
	if (!isRecord(data) || !Array.isArray(data.folders) || !data.folders.every(isFolderRow) || !(data.nextCursor === null || typeof data.nextCursor === 'number') || !(data.scanning === null || isScanning(data.scanning))) {
		throw new ApiResponseError('The library folders came without a folders array, nextCursor and scanning state; check the server\'s version.')
	}
	return { folders: data.folders, nextCursor: data.nextCursor, scanning: data.scanning }
}

/** Every folder below `root`, read page by page; the statistics read what is summarised so far. */
export async function listAllLibraryFolders(root: string): Promise<FolderRow[]> {
	const rows: FolderRow[] = []
	for (let cursor: number | null = 0; cursor !== null;) {
		const page: LibraryPage = await listLibraryFolders(root, cursor)
		rows.push(...page.folders)
		cursor = page.nextCursor
	}
	return rows
}

/** Summarises the next batch of the stale folders below `root` and answers how far the root is. */
export async function scanLibrary(root: string): Promise<LibraryScanning> {
	const { data } = await axios.post<unknown>(generateUrl(`${API}/library/scan`), { root })
	if (!isRecord(data) || !isScanning(data.scanning)) {
		throw new ApiResponseError('The library scan came without its progress; check the server\'s version.')
	}
	return data.scanning
}

/** Marks the folder done by the user as of `photos` photos and answers the stored status (FOLDERS-006.1). */
export async function markFolderDone(fileId: number, photos: number): Promise<FolderDone> {
	const { data } = await axios.put<unknown>(generateUrl(`${API}/library/folders/${fileId}/done`), { photos })
	if (!isRecord(data) || !isFolderDone(data.done)) {
		throw new ApiResponseError('The done status came without its user, time and photos; check the server\'s version.')
	}
	return data.done
}

/** Removes the folder's done status (FOLDERS-006.3). */
export async function reopenFolder(fileId: number): Promise<void> {
	await axios.delete(generateUrl(`${API}/library/folders/${fileId}/done`))
}

/** Whether a value is a scan's progress. */
function isScanning(value: unknown): value is LibraryScanning {
	return isRecord(value) && typeof value.done === 'number' && typeof value.total === 'number'
}

/** Whether a value is one folder of a page. */
function isFolderRow(value: unknown): value is FolderRow {
	return isRecord(value)
		&& ROW_NUMBERS.every((key) => typeof value[key] === 'number')
		&& ROW_TIMES.every((key) => value[key] === null || typeof value[key] === 'number')
		&& typeof value.root === 'string' && typeof value.path === 'string'
		&& (value.done === null || isFolderDone(value.done))
}

/** Whether a value is a folder's done status. */
function isFolderDone(value: unknown): value is FolderDone {
	return isRecord(value) && (value.by === null || typeof value.by === 'string') && typeof value.at === 'number' && typeof value.photos === 'number'
}
