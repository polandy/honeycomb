// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ConnectionState, ConnectionStatus } from '../../../src/logic/immich-connections.ts'

import { describe, expect, it } from 'vitest'
import { NO_IMMICH } from '../../../src/logic/immich-connections.ts'
import { immichOnlyOffer, startSource } from '../../../src/logic/immich-only.ts'

const PHONE = { id: 'andy-phone', label: 'Andy · Phone', url: 'https://immich.example', picksAsFavorites: false }
const CONNECTED = { kind: 'connections', connections: [PHONE] } as const
const FAILING: readonly Exclude<ConnectionState, 'ok'>[] = ['unreachable', 'refused', 'key', 'version']

/** A status in the state, with nothing the key may not read. */
function status(state: ConnectionState): ConnectionStatus {
	return { state, account: null, version: null, total: null }
}

describe('immichOnlyOffer', () => {
	// spec: IMMICH-001.21
	it('offers nothing without a connection and is unknown until the connections are listed', () => {
		expect(immichOnlyOffer(NO_IMMICH, null)).toBe('none')
		expect(immichOnlyOffer({ kind: 'connections', connections: [] }, null)).toBe('none')
		expect(immichOnlyOffer(null, null)).toBeNull()
	})

	// spec: IMMICH-001.21
	it('works only while the connection to open answers ok', () => {
		expect(immichOnlyOffer(CONNECTED, status('ok'))).toBe('ok')
		expect(immichOnlyOffer(CONNECTED, null)).toBe('asked')
		expect(immichOnlyOffer({ kind: 'broken' }, null)).toBe('broken')
	})

	// spec: IMMICH-001.21
	it.each(FAILING)('names the state %s as the reason it does not work', (state) => {
		expect(immichOnlyOffer(CONNECTED, status(state))).toBe(state)
	})
})

describe('startSource', () => {
	// spec: IMMICH-001.23
	it('opens Immich once the choice is stored and the connection answers ok', () => {
		expect(startSource(true, 'ok')).toBe('immich')
	})

	// spec: IMMICH-001.23
	it('waits for the settings, the connections and the status', () => {
		expect(startSource(null, 'ok')).toBe('undecided')
		expect(startSource(true, null)).toBe('undecided')
		expect(startSource(true, 'asked')).toBe('undecided')
	})

	// spec: IMMICH-001.24
	it.each(['none', 'broken', ...FAILING] as const)('opens Nextcloud when Immich is %s', (offer) => {
		expect(startSource(true, offer)).toBe('nextcloud')
	})

	// spec: IMMICH-001.24
	it('opens Nextcloud without the choice, whatever Immich answers', () => {
		expect(startSource(false, 'ok')).toBe('nextcloud')
		expect(startSource(false, null)).toBe('nextcloud')
	})
})
