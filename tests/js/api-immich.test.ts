// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { ApiResponseError, immichStatus, listImmichConnections } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string, params: Record<string, string> = {}) => `/index.php${url.replace(/\{(\w+)\}/g, (_match, key: string) => params[key]!)}` }))

const PHONE = { id: 'andy-phone', label: 'Andy · Phone', url: 'https://immich.example' }
const failure = (status: number, error: string) => Object.assign(new Error(`status ${status}`), { response: { status, data: { error } } })

describe('listImmichConnections', () => {
	// spec: IMMICH-001.2
	it('answers the user\'s connections', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { connections: [PHONE] } })

		await expect(listImmichConnections()).resolves.toEqual({ kind: 'connections', connections: [PHONE] })
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/immich/connections')
	})

	// spec: IMMICH-001.1
	it('answers no Immich when it is not configured', async () => {
		vi.mocked(axios.get).mockRejectedValue(failure(404, 'not-configured'))

		await expect(listImmichConnections()).resolves.toEqual({ kind: 'none' })
	})

	// spec: IMMICH-001.3, IMMICH-001.4
	it('answers a broken file', async () => {
		vi.mocked(axios.get).mockRejectedValue(failure(503, 'connections-file'))

		await expect(listImmichConnections()).resolves.toEqual({ kind: 'broken' })
	})

	it('throws any other failure and an answer of the wrong shape', async () => {
		vi.mocked(axios.get).mockRejectedValue(failure(500, 'boom'))
		await expect(listImmichConnections()).rejects.toThrow('status 500')

		vi.mocked(axios.get).mockRejectedValue(new Error('offline'))
		await expect(listImmichConnections()).rejects.toThrow('offline')

		vi.mocked(axios.get).mockResolvedValue({ data: { connections: {} } })
		await expect(listImmichConnections()).rejects.toThrow(ApiResponseError)
	})
})

describe('immichStatus', () => {
	// spec: IMMICH-001.10
	it('answers the connection\'s status', async () => {
		const status = { state: 'ok', account: null, version: '2.3.1', total: 3660 }
		vi.mocked(axios.get).mockResolvedValue({ data: status })

		await expect(immichStatus('andy-phone')).resolves.toEqual(status)
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/immich/andy-phone/status')
	})

	it('refuses an answer without a known state', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { state: 'odd' } })
		await expect(immichStatus('andy-phone')).rejects.toThrow(ApiResponseError)

		vi.mocked(axios.get).mockResolvedValue({ data: null })
		await expect(immichStatus('andy-phone')).rejects.toThrow(ApiResponseError)
	})
})
