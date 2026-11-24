// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ImmichApi } from '../../src/immich/immich-source.ts'
import type { ConnectionStatus, ImmichAvailability } from '../../src/logic/immich-connections.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IMMICH_CONNECTION_KEY, useImmichSource } from '../../src/immich/immich-source.ts'
import { logger } from '../../src/shared/logger.ts'
import { fakeStorage } from './app-cull.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

const PHONE = { id: 'andy-phone', label: 'Andy · Phone', url: 'https://immich.example' }
const KIDS = { id: 'kids', label: 'Kids', url: 'https://immich.example' }
const OK: ConnectionStatus = { state: 'ok', account: 'andy', version: '2.3.1', total: 3660 }
const TWO: ImmichAvailability = { kind: 'connections', connections: [PHONE, KIDS] }

/** The Immich source over a fake server; each status request waits until the test answers it. */
function sourceOn(availability: () => Promise<ImmichAvailability>, stored: Record<string, string> = {}) {
	const asked: { id: string, answer: (status: ConnectionStatus) => void, fail: (error: Error) => void }[] = []
	const api: ImmichApi = {
		listConnections: availability,
		status: (id) => new Promise((answer, fail) => asked.push({ id, answer, fail })),
	}
	return { immich: useImmichSource(api, fakeStorage(stored)), asked }
}

describe('useImmichSource', () => {
	// spec: IMMICH-001.1
	it('starts on Nextcloud and offers no Immich until the connections came', async () => {
		const { immich } = sourceOn(async () => TWO)
		expect(immich.source.value).toBe('nextcloud')
		expect(immich.offered.value).toBe(false)

		await immich.load()

		expect(immich.offered.value).toBe(true)
		expect(immich.connections.value).toEqual([PHONE, KIDS])
		expect(immich.connection.value).toEqual(PHONE)
	})

	it('logs a failed connections request and offers no Immich', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { immich } = sourceOn(async () => {
			throw new Error('offline')
		})

		await immich.load()

		expect(immich.offered.value).toBe(false)
		expect(error).toHaveBeenCalledOnce()
	})

	// spec: IMMICH-001.14
	it('asks the status of every connection on opening Immich and remembers the opened one', async () => {
		const stored: Record<string, string> = {}
		const { immich, asked } = sourceOn(async () => TWO, stored)
		await immich.load()

		immich.choose('immich')
		expect(asked.map(({ id }) => id)).toEqual(['andy-phone', 'kids'])
		expect(immich.statusOf('andy-phone')).toBeNull()
		asked[0]!.answer(OK)
		await flushPromises()
		expect(immich.statusOf('andy-phone')).toEqual(OK)

		immich.open('kids')
		expect(immich.connection.value).toEqual(KIDS)
		expect(stored[IMMICH_CONNECTION_KEY]).toBe('kids')
		const reloaded = sourceOn(async () => TWO, stored).immich
		await reloaded.load()
		expect(reloaded.connection.value).toEqual(KIDS)
	})

	// spec: IMMICH-001.18
	it('asks no status for a broken file', async () => {
		const { immich, asked } = sourceOn(async () => ({ kind: 'broken' }))
		await immich.load()

		immich.choose('immich')

		expect(immich.source.value).toBe('immich')
		expect(immich.connection.value).toBeNull()
		expect(asked).toEqual([])
	})

	// spec: IMMICH-001.19
	it('counts a failed status request as unreachable and logs it', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { immich, asked } = sourceOn(async () => TWO)
		await immich.load()

		void immich.check('kids')
		asked[0]!.fail(new Error('offline'))
		await flushPromises()

		expect(immich.statusOf('kids')).toEqual({ state: 'unreachable', account: null, version: null, total: null })
		expect(error).toHaveBeenCalledOnce()
	})

	// spec: IMMICH-001.19
	it('keeps the answer of the newest request when an older one comes late', async () => {
		const { immich, asked } = sourceOn(async () => TWO)
		await immich.load()

		void immich.check('kids')
		void immich.check('kids')
		asked[1]!.answer(OK)
		asked[0]!.answer({ ...OK, state: 'refused' })
		await flushPromises()

		expect(immich.statusOf('kids')).toEqual(OK)
	})

	it('goes back to Nextcloud', async () => {
		const { immich } = sourceOn(async () => TWO)
		await immich.load()
		immich.choose('immich')

		immich.choose('nextcloud')

		expect(immich.source.value).toBe('nextcloud')
	})
})
