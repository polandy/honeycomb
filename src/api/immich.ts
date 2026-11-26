// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionRow, ImmichImageSize } from '../logic/immich-asset.ts'
import type { ConnectionState, ConnectionStatus, FailedState, ImmichAvailability, ImmichConnection } from '../logic/immich-connections.ts'
import type { CountsRequest, ImmichCounts } from '../logic/immich-counts.ts'
import type { AssetsRequest, Page } from '../logic/immich-paging.ts'
import type { ImmichPositionSave } from '../logic/immich-position.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { CONNECTION_STATES } from '../logic/immich-connections.ts'
import { API, ApiResponseError, isRecord } from './core.ts'

/** The error code of a failed Immich request, null for any other failure. */
function immichError(error: unknown): unknown {
	return isRecord(error) && isRecord(error.response) && isRecord(error.response.data) ? error.response.data.error : null
}

/** The connection state a failed Immich request names, null for any other failure (IMMICH-002.19). */
export function immichFailureState(error: unknown): FailedState | null {
	const code = immichError(error)
	return code !== 'ok' && CONNECTION_STATES.includes(code as ConnectionState) ? code as FailedState : null
}

/** The user's connections, or why there are none to offer (IMMICH-001.1 to IMMICH-001.4). */
export async function listImmichConnections(): Promise<ImmichAvailability> {
	let data: unknown
	try {
		({ data } = await axios.get<unknown>(generateUrl(`${API}/immich/connections`)))
	} catch (error) {
		if (immichError(error) === 'connections-file') {
			return { kind: 'broken' }
		}
		throw error
	}
	if (!isRecord(data) || !Array.isArray(data.connections)) {
		throw new ApiResponseError('The Immich connections came without a connections array; check the server\'s version.')
	}
	return { kind: 'connections', connections: data.connections as ImmichConnection[] }
}

/** The connection's state, account, version and number of uploads (ADR 0044). */
export async function immichStatus(connectionId: string): Promise<ConnectionStatus> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/immich/{connectionId}/status`, { connectionId }))
	if (!isRecord(data) || !CONNECTION_STATES.includes(data.state as ConnectionState)) {
		throw new ApiResponseError('The Immich status came without a known state; check the server\'s version.')
	}
	return data as unknown as ConnectionStatus
}

/** One page of the listing at the cursor (IMMICH-002.1). */
export async function immichAssets(connectionId: string, request: AssetsRequest): Promise<Page> {
	const { data } = await axios.post<unknown>(generateUrl(`${API}/immich/{connectionId}/assets`, { connectionId }), request)
	if (!isRecord(data) || !Array.isArray(data.entries)) {
		throw new ApiResponseError('The Immich page came without an entries array; check the server\'s version.')
	}
	return data as unknown as Page
}

/** The counts of the filters and the time options (IMMICH-002.13). */
export async function immichCounts(connectionId: string, request: CountsRequest): Promise<ImmichCounts> {
	const { data } = await axios.post<unknown>(generateUrl(`${API}/immich/{connectionId}/counts`, { connectionId }), request)
	if (!isRecord(data) || typeof data.total !== 'number') {
		throw new ApiResponseError('The Immich counts came without a total; check the server\'s version.')
	}
	return data as unknown as ImmichCounts
}

/** Saves the whole decisions of the rows and answers the saved asset ids (ADR 0043). */
export async function saveImmichDecisions(connectionId: string, rows: readonly DecisionRow[]): Promise<string[]> {
	const { data } = await axios.put<unknown>(generateUrl(`${API}/immich/{connectionId}/decisions`, { connectionId }), { decisions: rows })
	if (!isRecord(data) || !Array.isArray(data.saved)) {
		throw new ApiResponseError('The Immich save came without the saved ids; check the server\'s version.')
	}
	return data.saved as string[]
}

/** Stores where the user stopped in a connection (IMMICH-003.14, ADR 0044). */
export async function saveImmichPosition({ connectionId, ...position }: ImmichPositionSave): Promise<void> {
	await axios.put(generateUrl(`${API}/positions`), { immich: connectionId, ...position })
}

/** The URL of an asset's image through honeycomb, versioned by Immich's `updatedAt` (IMMICH-002.16). */
export function immichImageUrl(connectionId: string, assetId: string, size: ImmichImageSize, version: string): string {
	return `${generateUrl(`${API}/immich/{connectionId}/assets/{assetId}/image`, { connectionId, assetId })}?size=${size}&v=${encodeURIComponent(version)}`
}
