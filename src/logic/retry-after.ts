// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** How long to wait when a limited answer names no seconds: the period of the save limit (ADR 0026). */
export const DEFAULT_RETRY_AFTER_SECONDS = 60

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

/** The field `key` of a value that is an object, else `undefined`. */
function field(value: unknown, key: string): unknown {
	return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined
}
