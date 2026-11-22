// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MissingPage, MissingPicture } from '../hash-run.ts'
import type { StoredVisualHash } from '../logic/visual-hash.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { API, ApiResponseError, isRecord } from './core.ts'
import { putSavedRows } from './saved-rows.ts'

/** Stores visual hashes with the etags they were taken from and answers the file ids stored; the server skips those of changed files (ADR 0024), a `429` rejects with `RateLimitedError`. */
export async function saveVisualHashes(hashes: readonly StoredVisualHash[]): Promise<number[]> {
	if (hashes.length === 0) {
		return []
	}
	return putSavedRows('visual-hashes', { hashes }, 'visual hashes')
}

/** The next page of the user's photos below `path` without a hash of their current version, after the `cursor` (ADR 0025). */
export async function listMissingVisualHashes(path: string, cursor: string): Promise<MissingPage> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/visual-hashes/missing`), { params: { path, cursor } })
	if (!isRecord(data) || !Array.isArray(data.pictures) || !data.pictures.every(isMissingPicture) || !(data.nextCursor === null || typeof data.nextCursor === 'string')) {
		throw new ApiResponseError('The missing visual hashes came without a pictures array and nextCursor; check the server\'s version.')
	}
	return { pictures: data.pictures, nextCursor: data.nextCursor }
}

/** Whether a value is one picture of a page of missing hashes. */
function isMissingPicture(value: unknown): value is MissingPicture {
	return isRecord(value) && typeof value.fileId === 'number' && typeof value.etag === 'string' && typeof value.mtime === 'number' && typeof value.path === 'string'
}
