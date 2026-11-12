// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { warmPreviews } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({
	generateUrl: (url: string) => `/index.php${url}`,
}))

describe('warmPreviews', () => {
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
		expect(axios.post).toHaveBeenCalledWith(URL, { fileIds: [3, 1, 2] })
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

	it('sends nothing for no files', async () => {
		await warmPreviews([])

		expect(axios.post).not.toHaveBeenCalled()
	})
})
