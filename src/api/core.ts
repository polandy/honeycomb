// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

export { RequestTimeoutError } from '../logic/timed-request.ts'

/** The base path of honeycomb's endpoints. */
export const API = '/apps/honeycomb/api/v1'

/** Thrown when an endpoint answers with a body of the wrong shape. */
export class ApiResponseError extends Error {}

/** The code of an error answer's `{error}` body, `null` for anything else (APP-004). */
export function errorCodeOf(error: unknown): string | null {
	const code = isRecord(error) && isRecord(error.response) && isRecord(error.response.data) ? error.response.data.error : null
	return typeof code === 'string' ? code : null
}

/** Whether a response body is a JSON object. */
export function isRecord(data: unknown): data is Record<string, unknown> {
	return typeof data === 'object' && data !== null
}
