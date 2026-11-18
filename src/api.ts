// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MissingPage, MissingPicture } from './hash-run.ts'
import type { Listing } from './logic/cull.ts'
import type { StoredDecision } from './logic/decision.ts'
import type { EmbeddedXmpAnswer } from './logic/embedded-xmp.ts'
import type { TreeFolder } from './logic/folder-tree.ts'
import type { MoveRequestFile, Probe } from './logic/move-plan.ts'
import type { MoveResponseFile } from './logic/move-report.ts'
import type { ResumePosition } from './logic/resume-position.ts'
import type { SidecarLookupAnswer, SidecarSaveAnswer, SidecarSaveItem } from './logic/sidecar-sync.ts'
import type { StoredTags, Tag } from './logic/tag.ts'
import type { TrashRequestFile, TrashResponseFile } from './logic/trash-report.ts'
import type { ViewState } from './logic/view-state.ts'
import type { StoredVisualHash } from './logic/visual-hash.ts'
import type { WarmOptions } from './preview-warmer.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { packRequests } from './logic/request-chunks.ts'
import { asRateLimited } from './logic/retry-after.ts'
import { listedFolders } from './logic/writability.ts'

/** The base path of honeycomb's endpoints. */
export const API = '/apps/honeycomb/api/v1'
/** The most bytes handed to `String.fromCharCode` at once, well under the engines' argument limits. */
const CHARACTER_CHUNK = 0x8000

/** A child folder as the folder endpoint returns it (ADR 0011). */
export type Folder = TreeFolder

/** Thrown when an endpoint answers with a body of the wrong shape. */
export class ApiResponseError extends Error {}

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

/** The stored view state of the user as it came, checked by `parseViewState` (ADR 0019). */
export async function loadViewState(): Promise<unknown> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/view-state`))
	if (!isRecord(data) || !isRecord(data.viewState)) {
		throw new ApiResponseError('The view state came without a viewState object; check the server\'s version.')
	}
	return data.viewState
}

/** Stores only the keys of the view state given (ADR 0019). */
export async function saveViewState(viewState: Partial<ViewState>): Promise<void> {
	await axios.put(generateUrl(`${API}/view-state`), { viewState })
}

/** The stored tags of the files; a file without a row has no tags (ADR 0022). */
export async function lookupTags(fileIds: readonly number[]): Promise<StoredTags[]> {
	if (fileIds.length === 0) {
		return []
	}
	const { data } = await axios.post<unknown>(generateUrl(`${API}/tags/lookup`), { fileIds })
	if (!isRecord(data) || !Array.isArray(data.tags)) {
		throw new ApiResponseError('The tag lookup came without a tags array; check the server\'s version.')
	}
	return data.tags as StoredTags[]
}

/** Stores visual hashes with the etags they were taken from and answers the file ids stored; the server skips those of changed files (ADR 0024), a `429` rejects with `RateLimitedError`. */
export async function saveVisualHashes(hashes: readonly StoredVisualHash[]): Promise<number[]> {
	if (hashes.length === 0) {
		return []
	}
	const data = await axios.put<unknown>(generateUrl(`${API}/visual-hashes`), { hashes }).then((response) => response.data, (error: unknown) => {
		throw asRateLimited(error)
	})
	if (!isRecord(data) || !Array.isArray(data.saved) || !data.saved.every((fileId) => typeof fileId === 'number')) {
		throw new ApiResponseError('The saved visual hashes came without a saved array of file ids; check the server\'s version.')
	}
	return data.saved
}

/** The next page of the user's photos below `path` without a hash of their current version, after the cursor `after` (ADR 0025). */
export async function listMissingVisualHashes(path: string, after: string): Promise<MissingPage> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/visual-hashes/missing`), { params: { path, after } })
	if (!isRecord(data) || !Array.isArray(data.pictures) || !data.pictures.every(isMissingPicture) || !(data.next === null || typeof data.next === 'string')) {
		throw new ApiResponseError('The missing visual hashes came without a pictures array and next cursor; check the server\'s version.')
	}
	return { pictures: data.pictures, next: data.next }
}

/** Whether a value is one picture of a page of missing hashes. */
function isMissingPicture(value: unknown): value is MissingPicture {
	return isRecord(value) && typeof value.fileId === 'number' && typeof value.etag === 'string' && typeof value.mtime === 'number' && typeof value.path === 'string'
}

/** Every tag the user has had, sorted (ADR 0022). */
export async function loadTagList(): Promise<Tag[]> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/tags/list`))
	if (!isRecord(data) || !Array.isArray(data.tagList) || !data.tagList.every((tag) => typeof tag === 'string')) {
		throw new ApiResponseError('The tag list came without a tagList array of texts; check the server\'s version.')
	}
	return data.tagList
}

/** The stored resume positions of the user, newest first, as they came, checked by `parsePositions` (ADR 0012). */
export async function loadPositions(): Promise<unknown[]> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/positions`))
	if (!isRecord(data) || !Array.isArray(data.positions)) {
		throw new ApiResponseError('The resume positions came without a positions array; check the server\'s version.')
	}
	return data.positions
}

/** Stores the resume position of a folder set (ADR 0012). */
export async function savePosition(position: ResumePosition): Promise<void> {
	await axios.put(generateUrl(`${API}/positions`), position)
}

/** The bytes, ETag, size and mtime of each sidecar, or why it could not be read, in the order asked, packed by the listed `sizes` (ADR 0017, ADR 0032). */
export async function lookupSidecars(fileIds: readonly number[], sizes: ReadonlyMap<number, number> = new Map()): Promise<SidecarLookupAnswer[]> {
	const answers = await inPacks(packRequests(fileIds, (fileId) => sizes.get(fileId) ?? 0), async (batch) => answersOf(await axios.post<unknown>(generateUrl(`${API}/sidecars/lookup`), { fileIds: batch }), 'sidecars', batch.length))
	return answers.map((answer) => (answer.result === 'read' ? { result: 'read', bytes: fromBase64(answer.content as string), etag: answer.etag, size: answer.size, mtime: answer.mtime } : { result: answer.result }) as SidecarLookupAnswer)
}

/** The XMP packet each JPEG embeds, or why there is none, in the order asked (ADR 0023). */
export async function lookupEmbeddedXmp(fileIds: readonly number[]): Promise<EmbeddedXmpAnswer[]> {
	const answers = await inPacks(packRequests(fileIds, () => 0), async (batch) => answersOf(await axios.post<unknown>(generateUrl(`${API}/embedded-xmp/lookup`), { fileIds: batch }), 'packets', batch.length))
	return answers.map((answer) => (answer.result === 'read' ? { result: 'read', bytes: fromBase64(answer.content as string) } : { result: answer.result }) as EmbeddedXmpAnswer)
}

/** Saves each sidecar, existing ones only unchanged since read, and answers each one's result in order (ADR 0017). */
export async function saveSidecars(items: readonly SidecarSaveItem[]): Promise<SidecarSaveAnswer[]> {
	const answers = await inPacks(packRequests(items, ({ bytes }) => bytes.length), async (batch) => {
		const sidecars = batch.map(({ bytes, ...item }) => ({ ...item, content: toBase64(bytes) }))
		return answersOf(await axios.put<unknown>(generateUrl(`${API}/sidecars`), { sidecars }), 'sidecars', batch.length)
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

/** What each target folder of a move already holds, and the storage of each target and source folder (ADR 0018). */
export async function probeTargets(folders: readonly string[], sources: readonly string[]): Promise<Probe> {
	const { data } = await axios.post<unknown>(generateUrl(`${API}/move/targets`), { folders, sources })
	if (!isRecord(data) || !Array.isArray(data.folders) || !Array.isArray(data.sources)) {
		throw new ApiResponseError('The move target response came without a folders and a sources array; check the server\'s version.')
	}
	return { folders: data.folders as Probe['folders'], sources: data.sources as Probe['sources'] }
}

/** Moves each picture's files to their new paths and returns the result of every file (ADR 0018). */
export async function movePictures(pictures: readonly (readonly MoveRequestFile[])[]): Promise<MoveResponseFile[][]> {
	const data = await axios.post<unknown>(generateUrl(`${API}/move`), { pictures }).then((response) => response.data, (error: unknown) => {
		throw isRecord(error) && isRecord(error.response) && error.response.status === 409 ? new TrashBinOffError('The trash bin is off; nothing was moved.') : error
	})
	if (!isRecord(data) || !Array.isArray(data.pictures)) {
		throw new ApiResponseError('The move response came without a pictures array; check the server\'s version.')
	}
	return data.pictures as MoveResponseFile[][]
}

/** The immutable URL of a preview tier of a file (ADR 0010). */
export function imageUrl(fileId: number, size: number, mtime: number): string {
	return `${generateUrl(`${API}/images/{fileId}`, { fileId })}?size=${size}&v=${mtime}`
}

/** The packs sent one after another, their answers joined. */
async function inPacks<T, A>(packs: readonly (readonly T[])[], send: (batch: readonly T[]) => Promise<A[]>): Promise<A[]> {
	const answers: A[] = []
	for (const pack of packs) {
		answers.push(...await send(pack))
	}
	return answers
}

/** The answers under `key` of a response, one per item sent. */
function answersOf({ data }: { data: unknown }, key: 'sidecars' | 'packets', sent: number): Record<string, unknown>[] {
	const answers = isRecord(data) ? data[key] : undefined
	if (!Array.isArray(answers) || answers.length !== sent) {
		throw new ApiResponseError(`The ${key} response came without an answer for each file; check the server's version.`)
	}
	return answers as Record<string, unknown>[]
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
export function isRecord(data: unknown): data is Record<string, unknown> {
	return typeof data === 'object' && data !== null
}
