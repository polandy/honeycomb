// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** How many pictures and files one move or trash request carries at most. */
export interface ChunkLimits {
	readonly pictures: number
	readonly files: number
}

/** 50 pictures, and the endpoints' 500 files, so a request ends well inside a timeout (ADR 0029). */
export const CHUNK_LIMITS: ChunkLimits = { pictures: 50, files: 500 }

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
		if (last !== undefined && last.length < limits.pictures && files + picture.length <= limits.files) {
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
