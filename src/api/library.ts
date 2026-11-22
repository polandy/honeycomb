// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderRow } from '../logic/folder-row.ts'

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
	readonly next: number | null
	readonly scanning: LibraryScanning | null
}

const ROW_NUMBERS = ['fileId', 'photos', 'bytes', 'rawBytes', 'picked', 'rejected', 'undecided', 'bursts', 'permissions'] as const
const ROW_TIMES = ['oldest', 'newest', 'lastActivity'] as const

/** The page of the folders below `root` after the folder `after`, `limit` folders at most when given. */
export async function listLibraryFolders(root: string, after = 0, limit?: number): Promise<LibraryPage> {
	const params = limit === undefined ? { root, after } : { root, after, limit }
	const { data } = await axios.get<unknown>(generateUrl(`${API}/library/folders`), { params })
	if (!isRecord(data) || !Array.isArray(data.folders) || !data.folders.every(isFolderRow) || !(data.next === null || typeof data.next === 'number') || !(data.scanning === null || isScanning(data.scanning))) {
		throw new ApiResponseError('The library folders came without a folders array, next cursor and scanning state; check the server\'s version.')
	}
	return { folders: data.folders, next: data.next, scanning: data.scanning }
}

/** Summarises the next batch of the stale folders below `root` and answers how far the root is. */
export async function scanLibrary(root: string): Promise<LibraryScanning> {
	const { data } = await axios.post<unknown>(generateUrl(`${API}/library/scan`), { root })
	if (!isRecord(data) || !isScanning(data.scanning)) {
		throw new ApiResponseError('The library scan came without its progress; check the server\'s version.')
	}
	return data.scanning
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
		&& (value.done === null || (isRecord(value.done) && typeof value.done.by === 'string' && typeof value.done.at === 'number' && typeof value.done.photos === 'number'))
}
