// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { ApiResponseError, movePictures, probeTargets, TrashBinOffError } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({
	generateUrl: (url: string, params: Record<string, number> = {}) => `/index.php${url.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key]))}`,
}))

describe('probeTargets', () => {
	// spec: MOVE-002.1
	// spec: MOVE-002.12
	it('sends the folders and the source folders and returns the children and storage of each', async () => {
		const probe = {
			folders: [{ path: '/Out', storage: '/', children: [{ name: 'a.RAF', fileId: 9, etag: 'e9' }] }],
			sources: [{ path: '/Shared/In', storage: '/Shared' }],
		}
		vi.mocked(axios.post).mockResolvedValue({ data: probe })

		expect(await probeTargets(['/Out'], ['/Shared/In'])).toEqual(probe)
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/move/targets', { folders: ['/Out'], sources: ['/Shared/In'] }, { signal: expect.any(AbortSignal) })
	})

	it('refuses a response without a folders or a sources array', async () => {
		for (const data of [{}, { folders: [] }, { sources: [] }]) {
			vi.mocked(axios.post).mockResolvedValue({ data })

			await expect(probeTargets(['/Out'], [])).rejects.toBeInstanceOf(ApiResponseError)
		}
	})
})

describe('movePictures', () => {
	const pictures = [[{ fileId: 7, etag: 'e7', path: '/Out/A.JPG', replace: { fileId: 9, etag: 'e9' } }]]

	// spec: MOVE-002.2
	it('sends the pictures and returns the result of each file', async () => {
		const results = [[{ fileId: 7, result: 'moved', replaced: true, path: '/Out/A.JPG', newFileId: 7, etag: 'e7b' }]]
		vi.mocked(axios.post).mockResolvedValue({ data: { pictures: results } })

		expect(await movePictures(pictures)).toEqual(results)
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/move', { pictures }, { signal: expect.any(AbortSignal) })
	})

	it('refuses a response without a pictures array', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: {} })

		await expect(movePictures(pictures)).rejects.toBeInstanceOf(ApiResponseError)
	})

	// spec: MOVE-002.7, APP-004.4
	it('turns a 409 into the trash bin error, since a replace needs it and nothing was touched', async () => {
		vi.mocked(axios.post).mockRejectedValue(Object.assign(new Error('Conflict'), { response: { status: 409, data: { error: 'trash-bin-disabled' } } }))

		await expect(movePictures(pictures)).rejects.toBeInstanceOf(TrashBinOffError)
	})

	it.each([Object.assign(new Error('Bad'), { response: { status: 400 } }), Object.assign(new Error('Conflict'), { response: { status: 409, data: { error: 'request' } } })])('passes any other error on', async (error) => {
		vi.mocked(axios.post).mockRejectedValue(error)

		await expect(movePictures(pictures)).rejects.toBe(error)
	})
})
