// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { XmpCacheRow } from './logic/xmp-cache.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { API, ApiResponseError, isRecord } from './api.ts'

/** The cache rows of the files that have one (ADR 0032). */
export async function lookupXmpCache(fileIds: readonly number[]): Promise<XmpCacheRow[]> {
	if (fileIds.length === 0) {
		return []
	}
	const { data } = await axios.post<unknown>(generateUrl(`${API}/xmp-cache/lookup`), { fileIds })
	if (!isRecord(data) || !Array.isArray(data.entries)) {
		throw new ApiResponseError('The XMP cache lookup came without an entries array; check the server\'s version.')
	}
	return data.entries as XmpCacheRow[]
}

/** Stores the rows, each replacing the file's row (ADR 0032). */
export async function saveXmpCache(rows: readonly XmpCacheRow[]): Promise<void> {
	if (rows.length > 0) {
		await axios.put(generateUrl(`${API}/xmp-cache`), { entries: rows })
	}
}

/** Clears the user's XMP cache and visual hashes; sidecars and decisions stay (ADR 0032). */
export async function clearCache(): Promise<void> {
	await axios.delete(generateUrl(`${API}/xmp-cache`))
}
