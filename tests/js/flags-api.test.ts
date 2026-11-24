// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiResponseError } from '../../src/api.ts'
import { saveFlags, saveSidecarEtags, takeOverFlags } from '../../src/flags-api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { post: vi.fn(), put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

const ITEMS = [{ fileId: 3, flag: 'picked', keepRaw: true }] as const
const ANSWER = { saved: [3], skipped: [{ fileId: 4, reason: 'notPermitted' }] }

beforeEach(() => {
	vi.clearAllMocks()
})

describe('saveFlags', () => {
	// spec: XMP-003.38
	it('puts the whole states and answers what was saved and skipped', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: ANSWER })

		await expect(saveFlags(ITEMS)).resolves.toEqual(ANSWER)
		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/flags', { flags: ITEMS })
	})

	// spec: XMP-003.38
	it('sends nothing for no flags', async () => {
		await expect(saveFlags([])).resolves.toEqual({ saved: [], skipped: [] })
		expect(axios.put).not.toHaveBeenCalled()
	})

	// spec: XMP-008.17
	it.each([['no object', 'oops'], ['no saved array', { skipped: [] }], ['no skipped array', { saved: [] }]])('rejects an answer with %s', async (_case, data) => {
		vi.mocked(axios.put).mockResolvedValue({ data })

		await expect(saveFlags(ITEMS)).rejects.toThrow(ApiResponseError)
	})
})

describe('takeOverFlags', () => {
	// spec: XMP-003.34
	it('posts the states to the take-over', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: ANSWER })

		await expect(takeOverFlags(ITEMS)).resolves.toEqual(ANSWER)
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/flags/take-over', { flags: ITEMS })
	})

	// spec: XMP-003.34
	it('sends nothing for no flags', async () => {
		await expect(takeOverFlags([])).resolves.toEqual({ saved: [], skipped: [] })
		expect(axios.post).not.toHaveBeenCalled()
	})
})

describe('saveSidecarEtags', () => {
	// spec: XMP-003.45
	it('puts the ETags and answers what was set and skipped', async () => {
		const etags = [{ fileId: 3, sidecarEtag: 'e2' }, { fileId: 4, sidecarEtag: null }]
		vi.mocked(axios.put).mockResolvedValue({ data: ANSWER })

		await expect(saveSidecarEtags(etags)).resolves.toEqual(ANSWER)
		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/flags/sidecar-etags', { etags })
	})

	// spec: XMP-003.45
	it('sends nothing for no ETags and rejects an answer of another shape', async () => {
		await expect(saveSidecarEtags([])).resolves.toEqual({ saved: [], skipped: [] })
		expect(axios.put).not.toHaveBeenCalled()

		vi.mocked(axios.put).mockResolvedValue({ data: 'oops' })
		await expect(saveSidecarEtags([{ fileId: 3, sidecarEtag: 'e2' }])).rejects.toThrow(ApiResponseError)
	})
})
