// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { OrphanedSidecar, OrphanedSidecarAnswer, OrphanedSidecarPage } from '../logic/orphaned-sidecars.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { API, ApiResponseError, isRecord } from './core.ts'

/** One page of the orphaned sidecars below `path`, after the folder `cursor` names (XMP-009). */
export async function listOrphanedSidecars(path: string, cursor: string): Promise<OrphanedSidecarPage> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/sidecars/orphaned`), { params: { path, cursor } })
	if (!isRecord(data) || !Array.isArray(data.sidecars) || !data.sidecars.every(isOrphanedSidecar) || !(data.nextCursor === null || typeof data.nextCursor === 'string')) {
		throw new ApiResponseError('The orphaned sidecars came without a sidecars array and nextCursor; check the server\'s version.')
	}
	return { sidecars: data.sidecars, nextCursor: data.nextCursor }
}

/** Moves the confirmed sidecars to the trash bin and answers each one's result in the order sent (XMP-009). */
export async function trashOrphanedSidecars(sidecars: readonly Pick<OrphanedSidecar, 'fileId' | 'etag'>[]): Promise<OrphanedSidecarAnswer[]> {
	const { data } = await axios.post<unknown>(generateUrl(`${API}/sidecars/orphaned/trash`), { sidecars })
	const answers = isRecord(data) ? data.sidecars : undefined
	if (!Array.isArray(answers) || answers.length !== sidecars.length) {
		throw new ApiResponseError('The trash of orphaned sidecars came without an answer for each sidecar; check the server\'s version.')
	}
	return answers as OrphanedSidecarAnswer[]
}

/** Whether a value is one sidecar of a page of the scan. */
function isOrphanedSidecar(value: unknown): value is OrphanedSidecar {
	return isRecord(value) && typeof value.fileId === 'number' && typeof value.etag === 'string' && typeof value.path === 'string' && typeof value.size === 'number'
}
