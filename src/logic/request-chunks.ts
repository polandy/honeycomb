// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** How many pictures and files one move or trash request carries at most. */
export interface ChunkLimits {
	/** The pictures of the first request, doubled for each next one up to `pictures`; `pictures` from the start without it. */
	readonly first?: number
	readonly pictures: number
	readonly files: number
}

/** 5 pictures first, doubling up to 50, and the endpoints' 500 files, so a request ends well inside a timeout and the count moves early (ADR 0029). */
export const CHUNK_LIMITS: ChunkLimits = { first: 5, pictures: 50, files: 500 }

/** How many of the pictures of a running send were answered. */
export interface SendProgress {
	readonly done: number
	readonly total: number
}

/** The answers in the order sent, the pictures not sent and the error that stopped the send, if any. */
export interface ChunkedAnswer<F, R> {
	readonly answers: R[][]
	readonly unsent: (readonly F[])[]
	readonly failure: { readonly error: unknown } | null
}

/** The pictures cut into requests of whole pictures within the limits; a picture over the file limit goes alone. */
export function requestChunks<F>(pictures: readonly (readonly F[])[], limits: ChunkLimits = CHUNK_LIMITS): (readonly F[])[][] {
	const chunks: (readonly F[])[][] = []
	let files = 0
	for (const picture of pictures) {
		const last = chunks.at(-1)
		const most = Math.min(limits.pictures, (limits.first ?? limits.pictures) * 2 ** Math.max(chunks.length - 1, 0))
		if (last !== undefined && last.length < most && files + picture.length <= limits.files) {
			last.push(picture)
			files += picture.length
		} else {
			chunks.push([picture])
			files = picture.length
		}
	}
	return chunks
}

/** Sends the chunks one after another and stops at the first failed request (ADR 0029). */
export async function sendInChunks<F, R>(
	pictures: readonly (readonly F[])[],
	send: (chunk: readonly (readonly F[])[]) => Promise<R[][]>,
	progress: (done: number) => void,
	limits: ChunkLimits = CHUNK_LIMITS,
): Promise<ChunkedAnswer<F, R>> {
	const answers: R[][] = []
	const chunks = requestChunks(pictures, limits)
	let done = 0
	progress(done)
	for (const [index, chunk] of chunks.entries()) {
		try {
			answers.push(...await send(chunk))
		} catch (error) {
			return { answers, unsent: chunks.slice(index).flat(), failure: { error } }
		}
		done += chunk.length
		progress(done)
	}
	return { answers, unsent: [], failure: null }
}

/** How many items and bytes one sidecar request carries at most (ADR 0032). */
export const PACK_LIMITS = { items: 1000, bytes: 8 * 1024 * 1024 }

/** The items cut, in order, into requests within the limits; an item over the bytes goes alone. */
export function packRequests<T>(items: readonly T[], sizeOf: (item: T) => number, limits = PACK_LIMITS): T[][] {
	const packs: T[][] = []
	let bytes = 0
	for (const item of items) {
		const size = sizeOf(item)
		const last = packs.at(-1)
		if (last !== undefined && last.length < limits.items && bytes + size <= limits.bytes) {
			last.push(item)
			bytes += size
		} else {
			packs.push([item])
			bytes = size
		}
	}
	return packs
}
