// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Flag } from './logic/decision.ts'
import type { PictureId } from './logic/picture-id.ts'
import type { SidecarEtagItem } from './logic/sidecar-etags.ts'
import type { StatsCounts } from './logic/stats-counts.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { API, ApiResponseError, isRecord } from './api.ts'

/** The state of one file in `honeycomb_decisions` (DECISIONS-001). */
export interface FlagItem {
	readonly fileId: PictureId
	readonly flag: Flag
	readonly keepRaw: boolean
	/** What the change counts (STATS-001); a save only. */
	readonly counts?: StatsCounts
	/** The ETag of the member's sidecar the flag was taken from; a take-over only (DECISIONS-001.41). */
	readonly sidecarEtag?: string | null
}

export type { SidecarEtagItem }

/** What a save or take-over stored, and the ids it skipped with the reason. */
export interface FlagAnswer {
	readonly saved: readonly number[]
	readonly skipped: readonly { readonly fileId: PictureId, readonly reason: string }[]
}

/** The flag endpoints the cull calls (DECISIONS-001.23, .27). */
export interface FlagApi {
	readonly save: (items: readonly FlagItem[]) => Promise<FlagAnswer>
	readonly takeOver: (items: readonly FlagItem[]) => Promise<FlagAnswer>
	readonly saveSidecarEtags: (etags: readonly SidecarEtagItem[]) => Promise<FlagAnswer>
}

/** Saves whole states of the files; the server skips those the user may not set (DECISIONS-001.23, .24). */
export async function saveFlags(items: readonly FlagItem[]): Promise<FlagAnswer> {
	return items.length === 0 ? { saved: [], skipped: [] } : answerOf((await axios.put<unknown>(generateUrl(`${API}/flags`), { flags: items })).data)
}

/** Stores the states of the files that have no row yet (DECISIONS-001.27). */
export async function takeOverFlags(items: readonly FlagItem[]): Promise<FlagAnswer> {
	return items.length === 0 ? { saved: [], skipped: [] } : answerOf((await axios.post<unknown>(generateUrl(`${API}/flags/take-over`), { flags: items })).data)
}

/** Records the ETags of the members' sidecars on their rows (DECISIONS-001.40). */
export async function saveSidecarEtags(etags: readonly SidecarEtagItem[]): Promise<FlagAnswer> {
	return etags.length === 0 ? { saved: [], skipped: [] } : answerOf((await axios.put<unknown>(generateUrl(`${API}/flags/sidecar-etags`), { etags })).data)
}

/** The answer of a save or take-over, or an error when it has another shape. */
function answerOf(data: unknown): FlagAnswer {
	if (!isRecord(data) || !Array.isArray(data.saved) || !Array.isArray(data.skipped)) {
		throw new ApiResponseError('The flag save came without saved and skipped arrays; check the server\'s version.')
	}
	return { saved: data.saved as number[], skipped: data.skipped as FlagAnswer['skipped'] }
}
