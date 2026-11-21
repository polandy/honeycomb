// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from './long-press.ts'

/** How long a listing, or the probe of the move targets, may take (ADR 0029, amendment 2026-11-21). */
export const LISTING_TIMEOUT_MS = 30_000
/** How long one move or trash request may take: three times the slowest measured one (ADR 0029). */
export const CHUNK_TIMEOUT_MS = 90_000
const MS_PER_SECOND = 1000

/** Thrown when the server did not answer a request in time; the request was aborted. */
export class RequestTimeoutError extends Error {
	/** The seconds the request was given. */
	readonly seconds: number

	constructor(ms: number) {
		super(`The server did not answer within ${ms / MS_PER_SECOND} s.`)
		this.seconds = ms / MS_PER_SECOND
	}
}

/** Runs the request with an abort signal and aborts it with a `RequestTimeoutError` after `ms`. */
export async function withTimeout<T>(request: (signal: AbortSignal) => Promise<T>, ms: number, schedule: Schedule): Promise<T> {
	const controller = new AbortController()
	let cancel = () => {}
	const timedOut = new Promise<never>((_, reject) => {
		cancel = schedule(() => {
			reject(new RequestTimeoutError(ms))
			controller.abort()
		}, ms)
	})
	try {
		return await Promise.race([request(controller.signal), timedOut])
	} finally {
		cancel()
	}
}
