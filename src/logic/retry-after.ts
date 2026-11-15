// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from './long-press.ts'

/** How long to wait when a limited answer names no seconds: the period of the save limit (ADR 0026). */
export const DEFAULT_RETRY_AFTER_SECONDS = 60

/** Converts the seconds of a wait for the schedule. */
const MILLISECONDS_PER_SECOND = 1000

/** The status of an answer the server limited. */
const TOO_MANY_REQUESTS = 429
/** Delta seconds of a `Retry-After` header; the HTTP-date form would need the clock. */
const SECONDS = /^\d+$/

/** Thrown when the server limits a request (`429`); `seconds` is how long to wait before the next try. */
export class RateLimitedError extends Error {
	constructor(readonly seconds: number) {
		super(`The server limits the requests; try again in ${seconds} s.`)
	}
}

/** The seconds to wait by a `Retry-After` header, at least one, else the period of the save limit. */
export function retryAfterSeconds(header: unknown): number {
	if (typeof header !== 'string' || !SECONDS.test(header.trim())) {
		return DEFAULT_RETRY_AFTER_SECONDS
	}
	return Math.max(1, Number(header.trim()))
}

/** A `429` failure of axios as a `RateLimitedError`, any other failure as it is. */
export function asRateLimited(error: unknown): unknown {
	const response = field(error, 'response')
	return field(response, 'status') === TOO_MANY_REQUESTS ? new RateLimitedError(retryAfterSeconds(field(field(response, 'headers'), 'retry-after'))) : error
}

/**
 * Sends with `send` until the server no longer limits it, waiting as long as each limited answer asks; `waiting` hears the
 * seconds and `null` when sent again, and a send no longer `wanted` fails on the limit or resolves `null` after the wait (ADR 0026).
 */
export async function sendLimited<T>(send: () => Promise<T>, wait: (seconds: number) => Promise<void>, waiting: (seconds: number | null) => void = () => {}, wanted: () => boolean = () => true): Promise<T | null> {
	for (;;) {
		try {
			return await send()
		} catch (error) {
			if (!(error instanceof RateLimitedError) || !wanted()) {
				throw error
			}
			waiting(error.seconds)
			await wait(error.seconds)
			if (!wanted()) {
				return null
			}
			waiting(null)
		}
	}
}

/** A wait of the given seconds through `schedule`. */
export function waitSeconds(schedule: Schedule): (seconds: number) => Promise<void> {
	return (seconds) => new Promise((resume) => {
		schedule(resume, seconds * MILLISECONDS_PER_SECOND)
	})
}

/** The field `key` of a value that is an object, else `undefined`. */
function field(value: unknown, key: string): unknown {
	return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined
}
