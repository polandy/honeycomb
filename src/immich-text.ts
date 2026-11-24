// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ConnectionState, ConnectionStatus, ImmichConnection } from './logic/immich-connections.ts'
import type { ImmichOnlyOffer } from './logic/immich-only.ts'

import { n, t } from '@nextcloud/l10n'
import { formatNumber, PLAIN_TEXT } from './l10n.ts'

/** The admin page on the Immich connections (IMMICH-001.26). */
export const IMMICH_ADMIN_URL = 'https://github.com/polandy/honeycomb/blob/main/docs/user/admin/immich.md'

/** The admin page's section on the connections file and the key's scopes (IMMICH-001.27). */
export const IMMICH_SCOPES_URL = `${IMMICH_ADMIN_URL}#api-key-scopes`

/** What a state that does not work says (IMMICH-001). */
function stateText(state: Exclude<ConnectionState, 'ok'>): string {
	switch (state) {
		case 'unreachable':
			return t('honeycomb', 'Immich unreachable')
		case 'refused':
			return t('honeycomb', 'The API key is refused')
		case 'key':
			return t('honeycomb', 'The API key cannot be read')
		case 'version':
			return t('honeycomb', 'This Immich version is not supported')
	}
}

/** A state that needs the user or their admin to act: a failed connection or a broken connections file. */
export type HelpState = Exclude<ConnectionState, 'ok'> | 'configuration'

/** What to do about a state that does not work, and the admin page's section on it (IMMICH-001.26). */
export function stateHelp(state: HelpState): { todo: string; url: string } {
	switch (state) {
		case 'unreachable':
			return { todo: t('honeycomb', 'Try again in a moment. If it stays, ask your admin to check that Immich is running and reachable from Nextcloud.'), url: `${IMMICH_ADMIN_URL}#immich-unreachable` }
		case 'refused':
			return { todo: t('honeycomb', 'Ask your admin to replace the API key. It may have been deleted or revoked in Immich.'), url: `${IMMICH_ADMIN_URL}#the-api-key-is-refused` }
		case 'key':
			return { todo: t('honeycomb', 'Ask your admin to check that the key file exists, is readable and holds the API key.'), url: `${IMMICH_ADMIN_URL}#the-api-key-cannot-be-read` }
		case 'version':
			return { todo: t('honeycomb', 'This version is not supported. Ask your admin to update Immich or honeycomb.'), url: `${IMMICH_ADMIN_URL}#this-immich-version-is-not-supported` }
		case 'configuration':
			return { todo: t('honeycomb', 'Ask your Nextcloud admin to check the connections file.'), url: `${IMMICH_ADMIN_URL}#the-connections-file` }
	}
}

/** The connection's status line: who is connected, else its label, or why it does not work. */
export function connectionLine(connection: ImmichConnection, status: ConnectionStatus | null): string {
	if (status === null) {
		return t('honeycomb', 'Checking the connection…')
	}
	if (status.state !== 'ok') {
		return stateText(status.state)
	}
	return status.account === null ? connection.label : t('honeycomb', 'Connected as {account}', { account: status.account }, undefined, PLAIN_TEXT)
}

/** "Immich 2.3.1 · 3,660 phone uploads", leaving out what the key may not read. */
export function connectionFacts(status: ConnectionStatus): string {
	const facts = []
	if (status.version !== null) {
		facts.push(t('honeycomb', 'Immich {version}', { version: status.version }, undefined, PLAIN_TEXT))
	}
	if (status.total !== null) {
		facts.push(n('honeycomb', '{count} phone upload', '{count} phone uploads', status.total, { count: formatNumber(status.total) }, PLAIN_TEXT))
	}
	return facts.join(' · ')
}

/** One connection as the connection switcher lists it. */
export interface ConnectionLine {
	readonly id: string
	readonly label: string
	readonly line: string
	/** Whether it works, null while its status is asked. */
	readonly working: boolean | null
}

/** The connection switcher's entries with their status lines (IMMICH-001.14). */
export function connectionLines(connections: readonly ImmichConnection[], statusOf: (connectionId: string) => ConnectionStatus | null): ConnectionLine[] {
	return connections.map((connection) => {
		const status = statusOf(connection.id)
		return { id: connection.id, label: connection.label, line: connectionLine(connection, status), working: status === null ? null : status.state === 'ok' }
	})
}

/** Why the folder picker's *I only use Immich* is disabled, null while it can be chosen (IMMICH-001.21). */
export function immichOnlyReason(offer: ImmichOnlyOffer): string | null {
	switch (offer) {
		case 'none':
		case 'ok':
			return null
		case 'asked':
			return t('honeycomb', 'Checking the Immich connection…')
		case 'broken':
			return t('honeycomb', 'Immich is unavailable because of the server configuration.')
		case 'unreachable':
			return t('honeycomb', 'Immich is unreachable.')
		case 'refused':
			return t('honeycomb', 'Immich refuses the API key.')
		case 'key':
			return t('honeycomb', 'The Immich API key cannot be read.')
		case 'version':
			return t('honeycomb', 'This Immich version is not supported.')
	}
}
