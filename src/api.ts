// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { StoredDecision } from './logic/decision.ts'
import type { ListingEntry } from './logic/listing.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

const API = '/apps/honeycomb/api/v1'

/** A child folder as the folder endpoint returns it (ADR 0011). */
export interface Folder {
	readonly name: string
	readonly path: string
	readonly hasSubfolders: boolean
}

/** Thrown when an endpoint answers with a body of the wrong shape. */
export class ApiResponseError extends Error {}

/** The image files of a folder, with every folder below it when `subfolders` (ADR 0009). */
export async function listEntries(path: string, subfolders: boolean): Promise<{ entries: ListingEntry[], truncated: boolean }> {
	const params = subfolders ? { path, subfolders: 1 } : { path }
	const { data } = await axios.get<unknown>(generateUrl(`${API}/entries`), { params })
	if (!isRecord(data) || !Array.isArray(data.entries) || typeof data.truncated !== 'boolean') {
		throw new ApiResponseError(`The listing of "${path}" has no entries array and truncated flag; check the server's version.`)
	}
	return { entries: data.entries as ListingEntry[], truncated: data.truncated }
}

/** The direct child folders of a folder (ADR 0011). */
export async function listFolders(path: string): Promise<Folder[]> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/folders`), { params: { path } })
	if (!isRecord(data) || !Array.isArray(data.folders)) {
		throw new ApiResponseError(`The folders of "${path}" came without a folders array; check the server's version.`)
	}
	return data.folders as Folder[]
}

/** Queues the rendering of every preview tier of the files in the background (ADR 0010). */
export async function warmPreviews(fileIds: readonly number[]): Promise<void> {
	if (fileIds.length > 0) {
		await axios.post(generateUrl(`${API}/previews`), { fileIds })
	}
}

/** The stored decisions of the files; a file without one is undecided (ADR 0012). */
export async function lookupDecisions(fileIds: readonly number[]): Promise<StoredDecision[]> {
	if (fileIds.length === 0) {
		return []
	}
	const { data } = await axios.post<unknown>(generateUrl(`${API}/decisions/lookup`), { fileIds })
	if (!isRecord(data) || !Array.isArray(data.decisions)) {
		throw new ApiResponseError('The decision lookup came without a decisions array; check the server\'s version.')
	}
	return data.decisions as StoredDecision[]
}

/** Stores the whole decision of each file in one transaction (ADR 0012). */
export async function saveDecisions(decisions: readonly StoredDecision[]): Promise<void> {
	if (decisions.length > 0) {
		await axios.put(generateUrl(`${API}/decisions`), { decisions })
	}
}

/** The immutable URL of a preview tier of a file (ADR 0010). */
export function imageUrl(fileId: number, size: number, mtime: number): string {
	return `${generateUrl(`${API}/images/{fileId}`, { fileId })}?size=${size}&v=${mtime}`
}

/** Whether a response body is a JSON object. */
function isRecord(data: unknown): data is Record<string, unknown> {
	return typeof data === 'object' && data !== null
}
