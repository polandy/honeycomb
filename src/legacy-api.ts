// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { StoredDecision } from './logic/decision.ts'
import type { LegacyExport, LegacyInventory } from './logic/legacy.ts'
import type { StoredTags } from './logic/tag.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { API, ApiResponseError, isRecord } from './api.ts'

/** The folders still holding legacy rows, and the count of unreachable file ids (XMP-007.1). */
export async function loadLegacyInventory(): Promise<LegacyInventory> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/legacy/folders`))
	if (!isRecord(data) || !Array.isArray(data.folders) || typeof data.unreachable !== 'number') {
		throw new ApiResponseError('The legacy inventory came without a folders array and unreachable count; check the server\'s version.')
	}
	return { folders: data.folders as LegacyInventory['folders'], unreachable: data.unreachable }
}

/** The legacy rows of the file ids the user no longer reaches (XMP-007.2). */
export async function loadLegacyExport(): Promise<LegacyExport> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/legacy/export`))
	if (!isRecord(data) || !Array.isArray(data.decisions) || !Array.isArray(data.tags)) {
		throw new ApiResponseError('The legacy export came without a decisions and a tags array; check the server\'s version.')
	}
	return { decisions: data.decisions as StoredDecision[], tags: data.tags as StoredTags[] }
}

/** Removes the user's legacy rows of `fileIds`; asks nothing for none (XMP-007.3). */
export async function acknowledgeLegacy(fileIds: readonly number[]): Promise<void> {
	if (fileIds.length > 0) {
		await axios.delete(generateUrl(`${API}/legacy`), { data: { fileIds } })
	}
}
