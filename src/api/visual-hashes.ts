// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MissingPage, MissingPicture } from '../hash-run.ts'
import type { StoredVisualHash } from '../logic/visual-hash.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { asRateLimited } from '../logic/retry-after.ts'
import { API, ApiResponseError, isRecord } from './core.ts'

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
