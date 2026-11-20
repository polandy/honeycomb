// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { asRateLimited } from '../logic/retry-after.ts'
import { API, ApiResponseError, isRecord } from './core.ts'

/** Puts `body` to the endpoint at `path` and answers the file ids it saved; a `429` rejects with `RateLimitedError`, `what` names the rows in the error of a wrong answer. */
export async function putSavedRows(path: string, body: Record<string, unknown>, what: string): Promise<number[]> {
	const data = await axios.put<unknown>(generateUrl(`${API}/${path}`), body).then((response) => response.data, (error: unknown) => {
		throw asRateLimited(error)
	})
	if (!isRecord(data) || !Array.isArray(data.saved) || !data.saved.every((fileId) => typeof fileId === 'number')) {
		throw new ApiResponseError(`The saved ${what} came without a saved array of file ids; check the server's version.`)
	}
	return data.saved
}
