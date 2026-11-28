// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { NO_IMMICH, offersImmich, openedConnection } from '../../../src/logic/immich-connections.ts'

const PHONE = { id: 'andy-phone', label: 'Andy · Phone', url: 'https://immich.example', picksAsFavorites: false }
const KIDS = { id: 'kids', label: 'Kids', url: 'https://immich.example', picksAsFavorites: false }

describe('offersImmich', () => {
	// spec: IMMICH-001.1, IMMICH-001.18
	it('offers the Immich source with a connection or a broken file, not without either', () => {
		expect(offersImmich(NO_IMMICH)).toBe(false)
		expect(offersImmich({ kind: 'connections', connections: [] })).toBe(false)
		expect(offersImmich({ kind: 'connections', connections: [PHONE] })).toBe(true)
		expect(offersImmich({ kind: 'broken' })).toBe(true)
	})
})

describe('openedConnection', () => {
	// spec: IMMICH-001.14
	it('opens the remembered connection again, else the first one', () => {
		expect(openedConnection([PHONE, KIDS], 'kids')).toBe(KIDS)
		expect(openedConnection([PHONE, KIDS], null)).toBe(PHONE)
	})

	// spec: IMMICH-001.12
	it('opens the first one when the remembered connection left the file, none without any', () => {
		expect(openedConnection([PHONE, KIDS], 'gone')).toBe(PHONE)
		expect(openedConnection([], 'kids')).toBeNull()
	})
})
