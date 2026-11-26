// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** One of the user's connections as the connections route lists it (ADR 0044). */
export interface ImmichConnection {
	readonly id: string
	readonly label: string
	readonly url: string
}

/** A connection's state; every state but `ok` names why it does not work (IMMICH-001). */
export type ConnectionState = 'ok' | 'key' | 'unreachable' | 'refused' | 'version'

/** A state in which the connection does not work. */
export type FailedState = Exclude<ConnectionState, 'ok'>

/** The states the status route answers. */
export const CONNECTION_STATES: readonly ConnectionState[] = ['ok', 'key', 'unreachable', 'refused', 'version']

/** A connection's status; what the key may not read is null (IMMICH-001.10, IMMICH-001.17). */
export interface ConnectionStatus {
	readonly state: ConnectionState
	readonly account: string | null
	readonly version: string | null
	readonly total: number | null
}

/** Whether the user has Immich: not configured, a broken connections file, or their connections. */
export type ImmichAvailability
	= | { readonly kind: 'none' }
		| { readonly kind: 'broken' }
		| { readonly kind: 'connections', readonly connections: readonly ImmichConnection[] }

/** Immich not configured. */
export const NO_IMMICH: ImmichAvailability = { kind: 'none' }

/** The status a failed status request counts as (IMMICH-001.19). */
export const FAILED_STATUS: ConnectionStatus = { state: 'unreachable', account: null, version: null, total: null }

/** Whether the source switcher shows *Immich*: with a connection, or as unavailable with a broken file. */
export function offersImmich(availability: ImmichAvailability): boolean {
	return availability.kind === 'broken' || (availability.kind === 'connections' && availability.connections.length > 0)
}

/** The connection opened last if the file still names it, else the first one, none without any (IMMICH-001.14). */
export function openedConnection(connections: readonly ImmichConnection[], remembered: string | null): ImmichConnection | null {
	return connections.find(({ id }) => id === remembered) ?? connections[0] ?? null
}
