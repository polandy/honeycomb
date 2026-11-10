// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Listing } from './logic/cull.ts'
import type { StoredDecision } from './logic/decision.ts'
import type { SidecarLookupAnswer, SidecarSaveAnswer, SidecarSaveItem } from './logic/sidecar-sync.ts'
import type { TrashRequestFile, TrashResponseFile } from './logic/trash-report.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

const API = '/apps/honeycomb/api/v1'
/** The most sidecars one request reads or saves (ADR 0017). */
const SIDECAR_BATCH = 1000
/** The most bytes handed to `String.fromCharCode` at once, well under the engines' argument limits. */
const CHARACTER_CHUNK = 0x8000

/** A child folder as the folder endpoint returns it (ADR 0011). */
export interface Folder {
	readonly name: string
	readonly path: string
	readonly hasSubfolders: boolean
}

/** Thrown when an endpoint answers with a body of the wrong shape. */
export class ApiResponseError extends Error {}

/** The image files of a folder, with every folder below it when `subfolders` (ADR 0009), and the folders that are shared (ADR 0017). */
export async function listEntries(path: string, subfolders: boolean): Promise<Required<Listing>> {
	const params = subfolders ? { path, subfolders: 1 } : { path }
	const { data } = await axios.get<unknown>(generateUrl(`${API}/entries`), { params })
	if (!isRecord(data) || !Array.isArray(data.entries) || typeof data.truncated !== 'boolean') {
		throw new ApiResponseError(`The listing of "${path}" has no entries array and truncated flag; check the server's version.`)
	}
	const folders = Array.isArray(data.folders) ? data.folders as { path: string, shared: boolean }[] : []
	return { entries: data.entries as Listing['entries'], truncated: data.truncated, sharedFolders: folders.filter((folder) => folder.shared).map((folder) => folder.path) }
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

/** The stored settings of the user as they came, checked by `parseSettings` (ADR 0014). */
export async function loadSettings(): Promise<unknown> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/settings`))
	if (!isRecord(data)) {
		throw new ApiResponseError('The settings came without a settings object; check the server\'s version.')
	}
	return data.settings
}

/** Stores the whole settings of the user (ADR 0014). */
export async function saveSettings(settings: object): Promise<void> {
	await axios.put(generateUrl(`${API}/settings`), { settings })
}

/** Stores the whole decision of each file in one transaction (ADR 0012). */
export async function saveDecisions(decisions: readonly StoredDecision[]): Promise<void> {
	if (decisions.length > 0) {
		await axios.put(generateUrl(`${API}/decisions`), { decisions })
	}
}

/** The bytes, ETag, size and mtime of each sidecar, or why it could not be read, in the order asked (ADR 0017). */
export async function lookupSidecars(fileIds: readonly number[]): Promise<SidecarLookupAnswer[]> {
	const answers = await inBatches(fileIds, async (batch) => sidecarAnswers(await axios.post<unknown>(generateUrl(`${API}/sidecars/lookup`), { fileIds: batch }), batch.length))
	return answers.map((answer) => (answer.result === 'read' ? { result: 'read', bytes: fromBase64(answer.content as string), etag: answer.etag, size: answer.size, mtime: answer.mtime } : { result: answer.result }) as SidecarLookupAnswer)
}

/** Saves each sidecar, existing ones only unchanged since read, and answers each one's result in order (ADR 0017). */
export async function saveSidecars(items: readonly SidecarSaveItem[]): Promise<SidecarSaveAnswer[]> {
	const answers = await inBatches(items, async (batch) => {
		const sidecars = batch.map(({ bytes, ...item }) => ({ ...item, content: toBase64(bytes) }))
		return sidecarAnswers(await axios.put<unknown>(generateUrl(`${API}/sidecars`), { sidecars }), batch.length)
	})
	return answers as SidecarSaveAnswer[]
}

/** Thrown when the trash bin app is off for the user; nothing was deleted (ADR 0013). */
export class TrashBinOffError extends Error {}

/** Moves each picture's files to the trash bin and returns the result of every file (ADR 0013). */
export async function trashPictures(pictures: readonly (readonly TrashRequestFile[])[]): Promise<TrashResponseFile[][]> {
	const data = await axios.post<unknown>(generateUrl(`${API}/trash`), { pictures }).then((response) => response.data, (error: unknown) => {
		throw isRecord(error) && isRecord(error.response) && error.response.status === 409 ? new TrashBinOffError('The trash bin is off; nothing was deleted.') : error
	})
	if (!isRecord(data) || !Array.isArray(data.pictures)) {
		throw new ApiResponseError('The trash response came without a pictures array; check the server\'s version.')
	}
	return data.pictures as TrashResponseFile[][]
}

/** The immutable URL of a preview tier of a file (ADR 0010). */
export function imageUrl(fileId: number, size: number, mtime: number): string {
	return `${generateUrl(`${API}/images/{fileId}`, { fileId })}?size=${size}&v=${mtime}`
}

/** The items sent in requests of at most SIDECAR_BATCH, one after another, their answers joined. */
async function inBatches<T, A>(items: readonly T[], send: (batch: readonly T[]) => Promise<A[]>): Promise<A[]> {
	const answers: A[] = []
	for (let start = 0; start < items.length; start += SIDECAR_BATCH) {
		answers.push(...await send(items.slice(start, start + SIDECAR_BATCH)))
	}
	return answers
}

/** The sidecar answers of a response, one per item sent. */
function sidecarAnswers({ data }: { data: unknown }, sent: number): Record<string, unknown>[] {
	if (!isRecord(data) || !Array.isArray(data.sidecars) || data.sidecars.length !== sent) {
		throw new ApiResponseError('The sidecar response came without an answer for each sidecar; check the server\'s version.')
	}
	return data.sidecars as Record<string, unknown>[]
}

/** The bytes in base64, as the sidecar endpoints carry them. */
function toBase64(bytes: Uint8Array): string {
	let binary = ''
	for (let start = 0; start < bytes.length; start += CHARACTER_CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(start, start + CHARACTER_CHUNK))
	}
	return btoa(binary)
}

/** The bytes of base64 text. */
function fromBase64(text: string): Uint8Array {
	return Uint8Array.from(atob(text), (character) => character.charCodeAt(0))
}

/** Whether a response body is a JSON object. */
function isRecord(data: unknown): data is Record<string, unknown> {
	return typeof data === 'object' && data !== null
}
