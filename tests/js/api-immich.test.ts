// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { ApiResponseError, immichAssets, immichCounts, immichFailureState, immichImageUrl, immichStatus, listImmichConnections, saveImmichDecisions, saveImmichPosition } from '../../src/api/index.ts'
import { immichEntry } from './logic/immich-fixtures.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
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
	it('answers no connections when it is not configured', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { connections: [] } })

		await expect(listImmichConnections()).resolves.toEqual({ kind: 'connections', connections: [] })
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

const FILTERS = { takenAfter: null, takenBefore: null, devices: [], kinds: [], flags: [], rating: null, colourLabels: [] }
const BASE = '/index.php/apps/honeycomb/api/v1/immich/andy-phone'

describe('immichAssets', () => {
	// spec: IMMICH-002.6
	it('asks one page at the cursor and answers its entries and cursors', async () => {
		const page = { entries: [immichEntry('a1')], nextCursor: 'c2', previousCursor: null }
		vi.mocked(axios.post).mockResolvedValue({ data: page })

		await expect(immichAssets('andy-phone', { filters: FILTERS, cursor: 'c1', size: 100 })).resolves.toEqual(page)
		expect(axios.post).toHaveBeenCalledWith(`${BASE}/assets`, { filters: FILTERS, cursor: 'c1', size: 100 })
	})

	it('refuses a page without an entries array', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: { entries: null } })
		await expect(immichAssets('andy-phone', { filters: FILTERS, cursor: null, size: 100 })).rejects.toThrow(ApiResponseError)
	})
})

describe('immichCounts', () => {
	// spec: IMMICH-002.13
	it('asks the counts of the filters and the periods', async () => {
		const counts = { total: 3, undecided: 3, decided: 0, matching: 3, flags: { picked: 0, rejected: 0, unflagged: 3 }, ratings: {}, colourLabels: {}, devices: [], kinds: { photo: 3, live: 0, video: 0 }, periods: [3] }
		const periods = [{ takenAfter: 1, takenBefore: 2 }]
		vi.mocked(axios.post).mockResolvedValue({ data: counts })

		await expect(immichCounts('andy-phone', { filters: FILTERS, periods })).resolves.toEqual(counts)
		expect(axios.post).toHaveBeenCalledWith(`${BASE}/counts`, { filters: FILTERS, periods })
	})

	it('refuses counts without a total', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: {} })
		await expect(immichCounts('andy-phone', { filters: FILTERS, periods: [] })).rejects.toThrow(ApiResponseError)
	})
})

describe('saveImmichDecisions', () => {
	// spec: IMMICH-003.4
	it('saves the rows and answers the saved asset ids', async () => {
		const row = { assetId: 'a1', rating: 2, colourLabel: null, flag: 'picked', keepRaw: false, takenAt: 1, cameraModel: null, kind: 'photo', assetUpdatedAt: 'u' } as const
		vi.mocked(axios.put).mockResolvedValue({ data: { saved: ['a1'] } })

		await expect(saveImmichDecisions('andy-phone', [row])).resolves.toEqual(['a1'])
		expect(axios.put).toHaveBeenCalledWith(`${BASE}/decisions`, { decisions: [row] })
	})

	it('refuses an answer without the saved ids', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: {} })
		await expect(saveImmichDecisions('andy-phone', [])).rejects.toThrow(ApiResponseError)
	})
})

describe('immichImageUrl', () => {
	// spec: IMMICH-002.16
	it('names the asset\'s image at the size and its version', () => {
		expect(immichImageUrl('andy-phone', 'a1', 'thumbnail', '2026-11-20T12:00:00.000Z')).toBe(`${BASE}/assets/a1/image?size=thumbnail&v=2026-11-20T12%3A00%3A00.000Z`)
	})
})

describe('saveImmichPosition', () => {
	// spec: IMMICH-003.14
	it('puts the connection\'s position under its id', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: {} })

		await saveImmichPosition({ connectionId: 'andy-phone', assetId: 'a6', takenAt: 60, decided: 2, total: 9 })

		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/positions', { immich: 'andy-phone', assetId: 'a6', takenAt: 60, decided: 2, total: 9 })
	})
})

describe('immichFailureState', () => {
	// spec: IMMICH-002.19
	it('answers the connection state a failed request names, null for any other failure', () => {
		expect(immichFailureState(failure(502, 'unreachable'))).toBe('unreachable')
		expect(immichFailureState(failure(502, 'refused'))).toBe('refused')
		expect(immichFailureState(failure(502, 'key'))).toBe('key')
		expect(immichFailureState(failure(502, 'version'))).toBe('version')
		expect(immichFailureState(failure(400, 'request'))).toBeNull()
		expect(immichFailureState(failure(502, 'ok'))).toBeNull()
		expect(immichFailureState(new Error('offline'))).toBeNull()
	})
})
