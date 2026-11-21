// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { connectionFacts, connectionLine } from '../../src/immich-text.ts'
import { installMarkedCatalogue, TRANSLATED_MARK as MARK, uninstallMarkedCatalogue } from './l10n/marked-catalogue.ts'

const PHONE = { id: 'andy-phone', label: 'Andy · Phone', url: 'https://immich.example' }
const OK = { state: 'ok', account: 'andy', version: '2.3.1', total: 3660 } as const

describe('immich-text', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: IMMICH-001.10
	it('says who is connected, else the label, while checking that it checks', () => {
		expect(connectionLine(PHONE, OK)).toBe(`${MARK}Connected as andy`)
		expect(connectionLine(PHONE, { ...OK, account: null })).toBe('Andy · Phone')
		expect(connectionLine(PHONE, null)).toBe(`${MARK}Checking the connection…`)
	})

	// spec: IMMICH-001.7, IMMICH-001.8, IMMICH-001.11
	it('names each state that does not work', () => {
		expect(connectionLine(PHONE, { ...OK, state: 'unreachable' })).toBe(`${MARK}Immich unreachable`)
		expect(connectionLine(PHONE, { ...OK, state: 'refused' })).toBe(`${MARK}The API key is refused`)
		expect(connectionLine(PHONE, { ...OK, state: 'key' })).toBe(`${MARK}The API key cannot be read`)
		expect(connectionLine(PHONE, { ...OK, state: 'version' })).toBe(`${MARK}This Immich version is not supported`)
	})

	// spec: IMMICH-001.17
	it('gives the version and the number of phone uploads when known', () => {
		expect(connectionFacts(OK)).toBe(`${MARK}Immich 2.3.1 · ${MARK}${MARK}3,660 phone uploads`)
		expect(connectionFacts({ ...OK, total: null })).toBe(`${MARK}Immich 2.3.1`)
		expect(connectionFacts({ ...OK, version: null, total: 1 })).toBe(`${MARK}${MARK}1 phone upload`)
		expect(connectionFacts({ ...OK, version: null, total: null })).toBe('')
	})
})
