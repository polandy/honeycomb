// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiResponseError, loadTagList, lookupTags, saveTags } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

const TAGGED = { fileId: 3, tags: ['People/Anna', 'Places/Italy'] }

beforeEach(() => {
	vi.clearAllMocks()
})

describe('lookupTags', () => {
	// spec: TAGS-001.13
	it('reads the stored tags of the files', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: { tags: [TAGGED] } })

		await expect(lookupTags([3, 1])).resolves.toEqual([TAGGED])
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/tags/lookup', { fileIds: [3, 1] })
	})

	// spec: TAGS-001.13
	it('asks nothing for no file ids', async () => {
		await expect(lookupTags([])).resolves.toEqual([])
		expect(axios.post).not.toHaveBeenCalled()
	})

	// spec: TAGS-001.13
	it.each([['no object', 'oops'], ['no tags array', { tags: {} }]])('rejects an answer with %s', async (_case, data) => {
		vi.mocked(axios.post).mockResolvedValue({ data })

		await expect(lookupTags([1])).rejects.toThrow(ApiResponseError)
	})
})

describe('saveTags', () => {
	// spec: TAGS-001.13
	it('stores the whole tag list of each file', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: '' })

		await saveTags([TAGGED, { fileId: 4, tags: [] }])

		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/tags', { tags: [TAGGED, { fileId: 4, tags: [] }] })
	})

	// spec: TAGS-001.13
	it('sends nothing for no files', async () => {
		await saveTags([])

		expect(axios.put).not.toHaveBeenCalled()
	})
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
