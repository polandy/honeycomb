// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ConnectionState, ConnectionStatus, ImmichConnection } from './logic/immich-connections.ts'

import { n, t } from '@nextcloud/l10n'
import { formatNumber, PLAIN_TEXT } from './l10n.ts'

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
