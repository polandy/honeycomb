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
	it('sends the folders and returns the children of each', async () => {
		const folders = [{ path: '/Out', children: [{ name: 'a.RAF', fileId: 9, etag: 'e9' }] }]
		vi.mocked(axios.post).mockResolvedValue({ data: { folders } })

		expect(await probeTargets(['/Out'])).toEqual(folders)
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/move/targets', { folders: ['/Out'] })
	})

	it('refuses a response without a folders array', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: {} })

		await expect(probeTargets(['/Out'])).rejects.toBeInstanceOf(ApiResponseError)
	})
})

describe('movePictures', () => {
	const pictures = [[{ fileId: 7, etag: 'e7', path: '/Out/A.JPG', replace: { fileId: 9, etag: 'e9' } }]]

	// spec: MOVE-002.2
	it('sends the pictures and returns the result of each file', async () => {
		const results = [[{ fileId: 7, result: 'moved', replaced: true, path: '/Out/A.JPG', newFileId: 7, etag: 'e7b' }]]
		vi.mocked(axios.post).mockResolvedValue({ data: { pictures: results } })

		expect(await movePictures(pictures)).toEqual(results)
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/move', { pictures })
	})

	it('refuses a response without a pictures array', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: {} })

		await expect(movePictures(pictures)).rejects.toBeInstanceOf(ApiResponseError)
	})

	// spec: MOVE-002.7
	it('turns a 409 into the trash bin error, since a replace needs it and nothing was touched', async () => {
		vi.mocked(axios.post).mockRejectedValue(Object.assign(new Error('Conflict'), { response: { status: 409 } }))

		await expect(movePictures(pictures)).rejects.toBeInstanceOf(TrashBinOffError)
	})

	it('passes any other error on', async () => {
		const error = Object.assign(new Error('Bad'), { response: { status: 400 } })
		vi.mocked(axios.post).mockRejectedValue(error)

		await expect(movePictures(pictures)).rejects.toBe(error)
	})
})
