// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ConnectionState, ConnectionStatus, ImmichAvailability } from './immich-connections.ts'

/** Whether the folder picker offers *I only use Immich*: not without a connection, else `ok` or why it does not work (IMMICH-001.21). */
export type ImmichOnlyOffer = 'none' | 'ok' | 'asked' | 'broken' | Exclude<ConnectionState, 'ok'>

/** What a start without a folder set opens, undecided until the settings and Immich have answered (IMMICH-001.23). */
export type StartSource = 'undecided' | 'nextcloud' | 'immich'

/** The offer from the user's connections and the status of the one to open; null until the connections are listed. */
export function immichOnlyOffer(availability: ImmichAvailability | null, status: ConnectionStatus | null): ImmichOnlyOffer | null {
	if (availability === null) {
		return null
	}
	if (availability.kind === 'broken') {
		return 'broken'
	}
	if (availability.kind === 'none' || availability.connections.length === 0) {
		return 'none'
	}
	return status?.state ?? 'asked'
}

/** Opens Immich only with the stored choice and a working connection; null while the settings are read (IMMICH-001.24). */
export function startSource(immichOnly: boolean | null, offer: ImmichOnlyOffer | null): StartSource {
	if (immichOnly === null || (immichOnly && (offer === null || offer === 'asked'))) {
		return 'undecided'
	}
	return immichOnly && offer === 'ok' ? 'immich' : 'nextcloud'
}
