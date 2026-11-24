// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiResponseError, loadTagList } from '../../src/api/index.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

beforeEach(() => {
	vi.clearAllMocks()
})

describe('loadTagList', () => {
	// spec: TAGS-001.13
	it('reads the tag list', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { tagList: ['Anna', 'Places/Italy'] } })

		await expect(loadTagList()).resolves.toEqual(['Anna', 'Places/Italy'])
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/tags/list')
	})

	// spec: TAGS-001.13
	it.each([['no object', null], ['no tag list array', { tagList: 'Anna' }], ['a tag that is no text', { tagList: ['Anna', 7] }]])('rejects an answer with %s', async (_case, data) => {
		vi.mocked(axios.get).mockResolvedValue({ data })

		await expect(loadTagList()).rejects.toThrow(ApiResponseError)
	})
})
