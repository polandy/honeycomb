// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Listing } from '../logic/cull.ts'
import type { TreeFolder } from '../logic/folder-tree.ts'
import type { Schedule } from '../logic/long-press.ts'
import type { PairingSettings } from '../logic/pairing.ts'
import type { PictureId } from '../logic/picture-id.ts'
import type { WarmOptions } from '../preview-warmer.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { browserSchedule } from '../browser-schedule.ts'
import { LISTING_TIMEOUT_MS, withTimeout } from '../logic/timed-request.ts'
import { listedFolders } from '../logic/writability.ts'
import { API, ApiResponseError, isRecord } from './core.ts'

/** A child folder as the folder endpoint returns it (ADR 0011). */
export type Folder = TreeFolder

/** The extension lists the folder endpoint counts with; the server's defaults without them. */
export type PairingExtensions = Pick<PairingSettings, 'rawExtensions' | 'renderedExtensions'>

/** The image files of a folder, with every folder below it when `subfolders` (ADR 0009), and the user's permissions on each folder (LISTING-001.19). */
export async function listEntries(path: string, subfolders: boolean, excluded: readonly string[] = [], schedule: Schedule = browserSchedule): Promise<Required<Listing>> {
	const params = { path, ...(subfolders ? { subfolders: 1 } : {}), ...(excluded.length > 0 ? { excluded } : {}) }
	const { data } = await withTimeout((signal) => axios.get<unknown>(generateUrl(`${API}/entries`), { params, signal }), LISTING_TIMEOUT_MS, schedule)
	if (!isRecord(data) || !Array.isArray(data.entries) || typeof data.truncated !== 'boolean') {
		throw new ApiResponseError(`The listing of "${path}" has no entries array and truncated flag; check the server's version.`)
	}
	return { entries: data.entries as Listing['entries'], truncated: data.truncated, folders: listedFolders(data.folders) }
}

/** The direct child folders of a folder, their pictures counted with `extensions` (ADR 0011). */
export async function listFolders(path: string, extensions?: PairingExtensions): Promise<Folder[]> {
	const lists = extensions === undefined ? {} : { rawExtensions: extensions.rawExtensions, renderedExtensions: extensions.renderedExtensions }
	const { data } = await axios.get<unknown>(generateUrl(`${API}/folders`), { params: { path, ...lists } })
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
export function imageUrl(fileId: PictureId, size: number, mtime: number): string {
	return `${generateUrl(`${API}/images/{fileId}`, { fileId })}?size=${size}&v=${mtime}`
}
