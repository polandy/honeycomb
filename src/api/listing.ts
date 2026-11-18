// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Listing } from '../logic/cull.ts'
import type { TreeFolder } from '../logic/folder-tree.ts'
import type { WarmOptions } from '../preview-warmer.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { listedFolders } from '../logic/writability.ts'
import { API, ApiResponseError, isRecord } from './core.ts'

/** A child folder as the folder endpoint returns it (ADR 0011). */
export type Folder = TreeFolder

/** The image files of a folder, with every folder below it when `subfolders` (ADR 0009), and the folders that are shared (ADR 0017). */
export async function listEntries(path: string, subfolders: boolean, excluded: readonly string[] = []): Promise<Required<Listing>> {
	const params = { path, ...(subfolders ? { subfolders: 1 } : {}), ...(excluded.length > 0 ? { excluded } : {}) }
	const { data } = await axios.get<unknown>(generateUrl(`${API}/entries`), { params })
	if (!isRecord(data) || !Array.isArray(data.entries) || typeof data.truncated !== 'boolean') {
		throw new ApiResponseError(`The listing of "${path}" has no entries array and truncated flag; check the server's version.`)
	}
	const opened = typeof data.fileId === 'number' ? { path, fileId: data.fileId } : null
	return { entries: data.entries as Listing['entries'], truncated: data.truncated, folders: listedFolders(data.folders), opened }
}

/** The direct child folders of a folder (ADR 0011). */
export async function listFolders(path: string): Promise<Folder[]> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/folders`), { params: { path } })
	if (!isRecord(data) || !Array.isArray(data.folders)) {
		throw new ApiResponseError(`The folders of "${path}" came without a folders array; check the server's version.`)
	}
	return data.folders as Folder[]
}

/** Files per warm-up request; the server renders them one after the other. */
const WARM_CHUNK = 4
/** Warm-up requests in flight, the number of previews core renders at a time. */
const WARM_CONCURRENCY = 4

/** Renders every preview tier of the files in display order, a few requests at a time; an abort stops it without an error (ADR 0010). */
export async function warmPreviews(fileIds: readonly number[], { signal, onWarmed }: WarmOptions = {}): Promise<void> {
	let next = 0
	let failed = false
	const aborted = () => signal?.aborted === true
	const config = signal === undefined ? {} : { signal }
	const worker = async (): Promise<void> => {
		while (next < fileIds.length && !failed && !aborted()) {
			const chunk = fileIds.slice(next, next += WARM_CHUNK)
			try {
				await axios.post(generateUrl(`${API}/previews`), { fileIds: chunk }, config)
			} catch (error) {
				if (aborted()) {
					return
				}
				failed = true
				throw error
			}
			onWarmed?.(chunk)
		}
	}
	await Promise.all(Array.from({ length: WARM_CONCURRENCY }, worker))
}

/** The immutable URL of a preview tier of a file (ADR 0010). */
export function imageUrl(fileId: number, size: number, mtime: number): string {
	return `${generateUrl(`${API}/images/{fileId}`, { fileId })}?size=${size}&v=${mtime}`
}
