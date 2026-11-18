// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The base path of honeycomb's endpoints. */
export const API = '/apps/honeycomb/api/v1'

/** Thrown when an endpoint answers with a body of the wrong shape. */
export class ApiResponseError extends Error {}

/** Whether a response body is a JSON object. */
export function isRecord(data: unknown): data is Record<string, unknown> {
	return typeof data === 'object' && data !== null
}
