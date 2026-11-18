// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { EmbeddedXmpAnswer } from '../logic/embedded-xmp.ts'
import type { SidecarLookupAnswer, SidecarSaveAnswer, SidecarSaveItem } from '../logic/sidecar-sync.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { packRequests } from '../logic/request-chunks.ts'
import { API, ApiResponseError, isRecord } from './core.ts'

/** The most bytes handed to `String.fromCharCode` at once, well under the engines' argument limits. */
const CHARACTER_CHUNK = 0x8000

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
