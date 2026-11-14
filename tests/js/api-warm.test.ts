// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { warmPreviews } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({
	generateUrl: (url: string) => `/index.php${url}`,
}))

describe('warmPreviews', () => {
	beforeEach(() => {
		vi.mocked(axios.post).mockReset()
	})
	const URL = '/index.php/apps/honeycomb/api/v1/previews'
	const flush = async (): Promise<void> => {
		for (let i = 0; i < 10; i++) {
			await Promise.resolve()
		}
	}
	const ids = (count: number): number[] => Array.from({ length: count }, (_, i) => i + 1)

	// spec: IMAGES-001.10
	it('asks the server to render the previews of the files in display order', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: null })

		await warmPreviews([3, 1, 2])

		expect(axios.post).toHaveBeenCalledOnce()
		expect(axios.post).toHaveBeenCalledWith(URL, { fileIds: [3, 1, 2] }, {})
	})

	// spec: IMAGES-001.10
	it('sends chunks of four files with at most four requests in flight, in order', async () => {
		const open: Array<() => void> = []
		let inFlight = 0
		let peak = 0
		vi.mocked(axios.post).mockImplementation(() => {
			inFlight++
			peak = Math.max(peak, inFlight)
			return new Promise((resolve) => open.push(() => {
				inFlight--
				resolve({ data: null })
			}))
		})

		const done = warmPreviews(ids(10 * 4 + 1))
		await flush()
		expect(open).toHaveLength(4)
		expect(vi.mocked(axios.post).mock.calls.map(([, body]) => body)).toEqual([
			{ fileIds: [1, 2, 3, 4] },
			{ fileIds: [5, 6, 7, 8] },
			{ fileIds: [9, 10, 11, 12] },
			{ fileIds: [13, 14, 15, 16] },
		])
		while (open.length > 0) {
			open.shift()?.()
			await flush()
		}
		await done

		expect(peak).toBe(4)
		expect(vi.mocked(axios.post).mock.calls.at(-1)?.[1]).toEqual({ fileIds: [41] })
	})

	// spec: IMAGES-001.11
	it('stops sending and fails when a request fails', async () => {
		vi.mocked(axios.post).mockRejectedValue(new Error('down'))

		await expect(warmPreviews(ids(100))).rejects.toThrow('down')

		expect(vi.mocked(axios.post).mock.calls.length).toBeLessThanOrEqual(4)
	})

	// spec: IMAGES-001.15
	it('reports each chunk the server rendered, and not a failed one', async () => {
		vi.mocked(axios.post).mockResolvedValueOnce({ data: null }).mockRejectedValueOnce(new Error('down'))
		const warmed: number[][] = []

		await expect(warmPreviews(ids(8), { onWarmed: (chunk) => warmed.push([...chunk]) })).rejects.toThrow('down')

		expect(warmed).toEqual([[1, 2, 3, 4]])
	})

	// spec: IMAGES-001.14
	it('aborts the requests in flight, sends no more and resolves once the signal aborts', async () => {
		const pending: Array<(error: Error) => void> = []
		vi.mocked(axios.post).mockImplementation((_url, _body, config) => new Promise((_resolve, reject) => {
			pending.push(reject)
			config?.signal?.addEventListener?.('abort', () => reject(new Error('canceled')))
		}))
		const controller = new AbortController()
		const warmed: number[][] = []

		const done = warmPreviews(ids(100), { signal: controller.signal, onWarmed: (chunk) => warmed.push([...chunk]) })
		await flush()
		controller.abort()
		await done

		expect(pending).toHaveLength(4)
		expect(vi.mocked(axios.post).mock.calls.every(([, , config]) => config?.signal === controller.signal)).toBe(true)
		expect(warmed).toEqual([])
	})

	// spec: IMAGES-001.14
	it('sends nothing once the signal aborted', async () => {
		const controller = new AbortController()
		controller.abort()

		await warmPreviews(ids(8), { signal: controller.signal })

		expect(axios.post).not.toHaveBeenCalled()
	})

	it('sends nothing for no files', async () => {
		await warmPreviews([])

		expect(axios.post).not.toHaveBeenCalled()
	})
})
