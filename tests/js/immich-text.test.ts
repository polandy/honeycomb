// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { connectionFacts, connectionLine, IMMICH_ADMIN_URL, pageFailedText, stateHelp } from '../../src/immich/immich-text.ts'
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

	// spec: IMMICH-001.26
	it('says what to do per state and where the admin page explains it', () => {
		expect(stateHelp('unreachable').todo).toBe(`${MARK}Try again in a moment. If it stays, ask your admin to check that Immich is running and reachable from Nextcloud.`)
		expect(stateHelp('refused').todo).toBe(`${MARK}Ask your admin to replace the API key. It may have been deleted or revoked in Immich.`)
		expect(stateHelp('key').todo).toBe(`${MARK}Ask your admin to check that the key file exists, is readable and holds the API key.`)
		expect(stateHelp('version').todo).toBe(`${MARK}This version is not supported. Ask your admin to update Immich or honeycomb.`)
		expect(stateHelp('configuration').todo).toBe(`${MARK}Ask your Nextcloud admin to check the connections file.`)
		for (const state of ['unreachable', 'refused', 'key', 'version', 'configuration'] as const) {
			expect(stateHelp(state).url).toMatch(new RegExp(`^${IMMICH_ADMIN_URL}#[a-z-]+$`))
		}
		expect(new Set(['unreachable', 'refused', 'key', 'version', 'configuration'].map((state) => stateHelp(state as 'key').url)).size).toBe(5)
	})

	// spec: IMMICH-002.19
	it('says why a page failed by its connection state, and that the photos above stay', () => {
		expect(pageFailedText('unreachable')).toBe(`${MARK}${MARK}Immich unreachable. The photos above stay.`)
		expect(pageFailedText('refused')).toBe(`${MARK}${MARK}The API key is refused. The photos above stay.`)
		expect(pageFailedText(null)).toBe(`${MARK}Could not load more photos.`)
	})
})
