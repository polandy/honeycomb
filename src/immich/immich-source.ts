import type { ConnectionStatus, ImmichAvailability } from '../logic/immich-connections.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from '../shared/browser-storage.ts'

import { computed, ref } from 'vue'
import { FAILED_STATUS, NO_IMMICH, offersImmich, openedConnection } from '../logic/immich-connections.ts'
import { readStored, writeStored } from '../shared/browser-storage.ts'
import { fireAndLog } from '../shared/fire-and-log.ts'
import { logger } from '../shared/logger.ts'

/** Where the connection opened last stays (IMMICH-001.14). */
export const IMMICH_CONNECTION_KEY = 'honeycomb.immichConnection'

/** The source the page shows. */
export type SourceKind = 'nextcloud' | 'immich'

/** The server seams of the Immich source. */
export interface ImmichApi {
	listConnections: () => Promise<ImmichAvailability>
	status: (connectionId: string) => Promise<ConnectionStatus>
}

/** The source switcher's state: the user's connections, the opened one and their statuses (IMMICH-001). */
export function useImmichSource(api: ImmichApi, storage: BrowserStorage) {
	const availability = ref<ImmichAvailability | null>(null)
	const source = ref<SourceKind>('nextcloud')
	const remembered = ref(readStored(storage, IMMICH_CONNECTION_KEY))
	const statuses = ref<Readonly<Record<string, ConnectionStatus | null>>>({})
	const asked = new Map<string, number>()
	const connections = computed(() => (availability.value?.kind === 'connections' ? availability.value.connections : []))

	/** Reads the user's connections; a failed request offers no Immich and the Nextcloud source works as before. */
	async function load() {
		try {
			availability.value = await api.listConnections()
		} catch (error) {
			logger.error('The Immich connections could not be listed.', { error })
			availability.value = NO_IMMICH
		}
	}

	/** Asks the connection's status again; only the newest answer counts, a failed request as unreachable. */
	async function check(connectionId: string) {
		const request = (asked.get(connectionId) ?? 0) + 1
		asked.set(connectionId, request)
		statuses.value = { ...statuses.value, [connectionId]: null }
		let status: ConnectionStatus
		try {
			status = await api.status(connectionId)
		} catch (error) {
			logger.error('The Immich status could not be asked.', { error })
			status = FAILED_STATUS
		}
		if (asked.get(connectionId) === request) {
			statuses.value = { ...statuses.value, [connectionId]: status }
		}
	}

	/** Shows the source; opening Immich asks the status of every connection. */
	function choose(kind: SourceKind) {
		source.value = kind
		if (kind === 'immich') {
			connections.value.forEach(({ id }) => fireAndLog(check(id), 'Could not check the Immich connection'))
		}
	}

	/** Opens the connection and remembers it for the next visit. */
	function open(connectionId: string) {
		remembered.value = connectionId
		writeStored(storage, IMMICH_CONNECTION_KEY, connectionId)
	}

	return {
		source,
		/** The user's connections or why there are none, null until they are listed. */
		availability: computed(() => availability.value),
		connections,
		connection: computed(() => openedConnection(connections.value, remembered.value)),
		offered: computed(() => availability.value !== null && offersImmich(availability.value)),
		/** The connection's last status, null while it is asked. */
		statusOf: (connectionId: string): ConnectionStatus | null => statuses.value[connectionId] ?? null,
		load,
		check,
		choose,
		open,
	}
}
