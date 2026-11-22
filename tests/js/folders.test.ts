// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { LibraryPage, LibraryScanning } from '../../src/api.ts'
import type { LibraryApi } from '../../src/folders.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useFolders } from '../../src/folders.ts'
import { logger } from '../../src/logger.ts'
import { row } from './logic/folder-fixtures.ts'

const A = row({ fileId: 1, root: '/Photos', path: '/Photos/a' })
const B = row({ fileId: 2, root: '/Photos', path: '/Photos/b' })
const C = row({ fileId: 3, root: '/Phone', path: '/Phone/c' })

/** A page of the folders with no further page and nothing to scan. */
function page(folders: LibraryPage['folders'], nextCursor: number | null = null, scanning: LibraryScanning | null = null): LibraryPage {
	return { folders, nextCursor, scanning }
}

/** A library API over the pages of each root by `after`, recording every call. */
function fakeLibrary(pages: Record<string, Record<number, LibraryPage>>, scans: Record<string, LibraryScanning[]> = {}) {
	const calls: string[] = []
	const api: LibraryApi = {
		listLibraryFolders: async (root, after = 0, limit) => {
			calls.push(`list ${root} ${after}${limit === undefined ? '' : ` ${limit}`}`)
			const answer = pages[root]?.[after]
			if (answer === undefined) {
				throw new Error('no such page')
			}
			return answer
		},
		scanLibrary: async (root) => {
			calls.push(`scan ${root}`)
			const answer = scans[root]?.shift()
			if (answer === undefined) {
				throw new Error('no scan')
			}
			return answer
		},
	}
	return { api, calls }
}

function mountFolders(api: LibraryApi, roots: readonly string[] | null = ['/Photos']) {
	const shownRoots = ref<readonly string[] | null>(roots)
	const errors: string[] = []
	const flush = vi.fn(async () => undefined)
	const folders = useFolders(api, { roots: () => shownRoots.value, flush, toastError: (message) => errors.push(message) })
	return { folders, roots: shownRoots, errors, flush }
}

describe('useFolders', () => {
	// spec: FOLDERS-007.2
	it('reads nothing while the settings are unread or there is no root', async () => {
		const { api, calls } = fakeLibrary({})
		const { folders, roots } = mountFolders(api, null)
		await flushPromises()
		roots.value = []
		await flushPromises()

		expect(calls).toEqual([])
		expect(folders.state.value).toBe('idle')
		expect(folders.rows.value).toEqual([])
	})

	// spec: FOLDERS-007.1, FOLDERS-007.6
	it('reads every page of every root, in the roots\' order', async () => {
		const { api, calls } = fakeLibrary({ '/Photos': { 0: page([A], 1), 1: page([B]) }, '/Phone': { 0: page([C]) } })
		const { folders } = mountFolders(api, ['/Photos', '/Phone'])
		expect(folders.state.value).toBe('loading')
		await flushPromises()

		expect(calls).toEqual(['list /Photos 0', 'list /Phone 0', 'list /Photos 1'])
		expect(folders.rows.value).toEqual([A, B, C])
		expect(folders.state.value).toBe('ready')
		expect(folders.updating.value).toBeNull()
	})

	// spec: FOLDERS-008.1, FOLDERS-008.3
	it('shows a folder\'s new done status in its row alone', async () => {
		const { api } = fakeLibrary({ '/Photos': { 0: page([A, B]) } })
		const { folders } = mountFolders(api)
		await flushPromises()
		const done = { by: 'andy', at: 9, photos: 100 }

		folders.setDone(B.fileId, done)
		expect(folders.rows.value).toEqual([A, { ...B, done }])
		folders.setDone(B.fileId, null)
		expect(folders.rows.value).toEqual([A, { ...B, done: null }])
	})

	// spec: FOLDERS-007.5
	it('reads the list again when the roots change', async () => {
		const { api, calls } = fakeLibrary({ '/Photos': { 0: page([A]) }, '/Phone': { 0: page([C]) } })
		const { folders, roots } = mountFolders(api)
		await flushPromises()

		roots.value = ['/Photos', '/Phone']
		await flushPromises()

		expect(calls).toEqual(['list /Photos 0', 'list /Photos 0', 'list /Phone 0'])
		expect(folders.rows.value).toEqual([A, C])
	})

	// spec: FOLDERS-007.7
	it('scans a stale root until every folder is fresh, then reads it again', async () => {
		const pages = { '/Photos': { 0: page([A], null, { done: 7, total: 12 }) } }
		const { api, calls } = fakeLibrary(pages)
		const answers: ((value: LibraryScanning) => void)[] = []
		api.scanLibrary = (root) => {
			calls.push(`scan ${root}`)
			return new Promise((resolve) => answers.push(resolve))
		}
		const { folders } = mountFolders(api)
		await flushPromises()
		expect(folders.rows.value).toEqual([A])
		expect(folders.updating.value).toEqual({ done: 7, total: 12 })

		answers.shift()!({ done: 10, total: 12 })
		await flushPromises()
		expect(folders.updating.value).toEqual({ done: 10, total: 12 })
		pages['/Photos'][0] = page([A, B])
		answers.shift()!({ done: 12, total: 12 })
		await flushPromises()

		expect(calls).toEqual(['list /Photos 0', 'scan /Photos', 'scan /Photos', 'list /Photos 0'])
		expect(folders.updating.value).toBeNull()
		expect(folders.rows.value).toEqual([A, B])
	})

	// spec: FOLDERS-007.7
	it('ends the scan when a call brings no progress', async () => {
		const { api, calls } = fakeLibrary({ '/Photos': { 0: page([A], null, { done: 7, total: 12 }) } }, { '/Photos': [{ done: 7, total: 12 }] })
		const { folders } = mountFolders(api)
		await flushPromises()

		expect(calls).toEqual(['list /Photos 0', 'scan /Photos', 'list /Photos 0'])
		expect(folders.updating.value).toBeNull()
	})

	// spec: FOLDERS-007.8
	it('says so when the list cannot be read and reads it again on request', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const pages: Record<string, Record<number, LibraryPage>> = {}
		const { api } = fakeLibrary(pages)
		const { folders } = mountFolders(api)
		await flushPromises()
		expect(folders.state.value).toBe('failed')
		expect(error).toHaveBeenCalledOnce()

		pages['/Photos'] = { 0: page([A]) }
		await folders.refresh()

		expect(folders.state.value).toBe('ready')
		expect(folders.rows.value).toEqual([A])
	})

	// spec: FOLDERS-007.8
	it('keeps the rows and ends the strip when a scan fails', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { api } = fakeLibrary({ '/Photos': { 0: page([A], null, { done: 7, total: 12 }) } })
		const { folders, errors } = mountFolders(api)
		await flushPromises()

		expect(folders.rows.value).toEqual([A])
		expect(folders.state.value).toBe('ready')
		expect(folders.updating.value).toBeNull()
		expect(errors).toEqual(['Could not update the folders.'])
	})

	it('drops the answer of a read the next one overtook', async () => {
		let answer: (value: LibraryPage) => void = () => undefined
		const api: LibraryApi = {
			listLibraryFolders: (root) => (root === '/Photos' ? new Promise((resolve) => (answer = resolve)) : Promise.resolve(page([C]))),
			scanLibrary: async () => ({ done: 0, total: 0 }),
		}
		const { folders, roots } = mountFolders(api)
		roots.value = ['/Phone']
		await flushPromises()
		answer(page([A]))
		await flushPromises()

		expect(folders.rows.value).toEqual([C])
	})

	// spec: FOLDERS-007.13, FOLDERS-007.14
	it('remembers whether a cull left the list, and shows it again with its rows read after the writes', async () => {
		const { api, calls } = fakeLibrary({ '/Photos': { 0: page([A]) } })
		const { folders, flush } = mountFolders(api)
		await flushPromises()
		expect(folders.shown.value).toBe(true)

		folders.leave(true)
		expect(folders.shown.value).toBe(false)
		expect(folders.fromList.value).toBe(true)
		await folders.show()

		expect(folders.shown.value).toBe(true)
		expect(flush).toHaveBeenCalledOnce()
		expect(calls).toEqual(['list /Photos 0', 'list /Photos 0'])
		folders.leave(false)
		expect(folders.fromList.value).toBe(false)
	})

	// spec: FOLDERS-007.14
	it('keeps the rows while it reads them again', async () => {
		const pages = { '/Photos': { 0: page([A]) } }
		const { api } = fakeLibrary(pages)
		const { folders } = mountFolders(api)
		await flushPromises()

		pages['/Photos'][0] = page([A, B])
		const read = folders.refresh()
		expect(folders.state.value).toBe('ready')
		expect(folders.rows.value).toEqual([A])
		await read

		expect(folders.rows.value).toEqual([A, B])
	})

	// spec: FOLDERS-007.14
	it('logs a failed write before the list shows again and reads it all the same', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { api, calls } = fakeLibrary({ '/Photos': { 0: page([A]) } })
		const { folders, flush } = mountFolders(api)
		await flushPromises()
		flush.mockRejectedValueOnce(new Error('down'))

		await folders.show()

		expect(error).toHaveBeenCalledOnce()
		expect(calls).toHaveLength(2)
	})

	// spec: FOLDERS-007.4
	it('checks a root by a page of one: the server refuses one that is not of the user\'s own storage', async () => {
		const refused = { response: { status: 400 } }
		const api: LibraryApi = {
			listLibraryFolders: vi.fn(async (root: string) => {
				if (root === '/Shared') {
					throw refused
				}
				if (root === '/Locked') {
					throw { response: { status: 403 } }
				}
				if (root === '/Down') {
					throw new Error('down')
				}
				return page([])
			}),
			scanLibrary: async () => ({ done: 0, total: 0 }),
		}
		const { folders } = mountFolders(api, [])

		await expect(folders.check('/Photos')).resolves.toBe(true)
		await expect(folders.check('/Shared')).resolves.toBe(false)
		await expect(folders.check('/Locked')).resolves.toBe(false)
		await expect(folders.check('/Down')).rejects.toThrow('down')
		expect(api.listLibraryFolders).toHaveBeenCalledWith('/Photos', 0, 1)
	})
})
