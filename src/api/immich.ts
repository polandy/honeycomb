// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ConnectionState, ConnectionStatus, ImmichAvailability, ImmichConnection } from '../logic/immich-connections.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { CONNECTION_STATES } from '../logic/immich-connections.ts'
import { API, ApiResponseError, isRecord } from './core.ts'

/** The error code of a failed Immich request, null for any other failure. */
function immichError(error: unknown): unknown {
	return isRecord(error) && isRecord(error.response) && isRecord(error.response.data) ? error.response.data.error : null
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
