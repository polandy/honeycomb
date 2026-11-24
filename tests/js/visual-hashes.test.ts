// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { WorkerAnswer, WorkerRequest } from '../../src/hashes/hash-workers.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { imageUrl } from '../../src/api/index.ts'
import { APP_SEAMS } from '../../src/app/app-seams.ts'
import { hashInWorkers, VISUAL_HASHES_KEY } from '../../src/hashes/visual-hashes.ts'
import { GRID_TIERS, smallSource } from '../../src/logic/image-tiers.ts'
import { RateLimitedError } from '../../src/logic/retry-after.ts'
import { logger } from '../../src/shared/logger.ts'
import { deferred } from './hash-run-fakes.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'
import { BURST, setUp } from './visual-hash-fakes.ts'

afterEach(() => vi.restoreAllMocks())

describe('useVisualHashes', () => {
	// spec: SERIES-001.17
	it('hashes the shown member of each picture that could form a series, one at a time', async () => {
		const { calls, hashes, byName } = setUp()

		expect(calls.map((call) => call.member.fileId)).toEqual([1])
		calls[0]!.resolve('0000000000000001')
		await flushPromises()

		expect(hashes.hashOf(byName('A'))).toBe('0000000000000001')
		expect(calls.map((call) => call.member.fileId)).toEqual([1, 3])
		expect(hashes.hashOf(byName('C'))).toBeNull()
	})

	// spec: SERIES-003.21
	it('hashes a RAW-only picture by its RAW and a pair by its JPEG', async () => {
		const { calls } = setUp()
		calls[0]!.resolve('0000000000000001')
		await flushPromises()

		expect(calls.map((call) => call.member.path)).toEqual(['/P/A.JPG', '/P/B.CR3'])
	})

	// spec: SERIES-003.13
	it('logs a failed save and keeps the hashes for this visit', async () => {
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
		const { calls, hashes, byName } = setUp(BURST, {}, 'always')
		calls[0]!.resolve('0000000000000001')
		await flushPromises()
		calls[1]!.resolve('0000000000000003')
		await flushPromises()

		expect(warn).toHaveBeenCalledWith('Could not save the visual hashes', expect.objectContaining({ count: 2 }))
		expect(hashes.hashOf(byName('A'))).toBe('0000000000000001')
		expect(hashes.progress.value.phase).toBe('failed')
	})

	// spec: SERIES-003.14
	it('removes the hashes earlier versions kept in browser storage and ignores them', () => {
		const { calls, stored } = setUp(BURST, { [VISUAL_HASHES_KEY]: JSON.stringify({ '1:etag-1': '0000000000000001' }) })

		expect(stored[VISUAL_HASHES_KEY]).toBeUndefined()
		expect(calls.map((call) => call.member.fileId)).toEqual([1])
	})

	// spec: SERIES-001.16, SERIES-001.17
	it('logs a failed hash, leaves that picture without one and goes on', async () => {
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
		const { calls, hashes, byName } = setUp()
		calls[0]!.reject(new Error('decode failed'))
		await flushPromises()

		expect(warn).toHaveBeenCalledWith('Could not hash the preview', expect.objectContaining({ fileId: 1 }))
		expect(hashes.hashOf(byName('A'))).toBeNull()
		expect(calls).toHaveLength(2)
	})

	// spec: SERIES-001.17
	it('hashes the pictures newly shown instead of the old ones', async () => {
		const { calls, pictures } = setUp()
		pictures.value = picturesOf([listingEntry(7, '/Q/X.JPG', { captureTime: 0 }), listingEntry(8, '/Q/Y.JPG', { captureTime: 1 })])
		await flushPromises()
		calls[0]!.resolve('0000000000000001')
		await flushPromises()

		expect(calls.map((call) => call.member.fileId)).toEqual([1, 7])
	})

	// spec: SERIES-001.18
	it('holds new hashes back while held and shows them on release', async () => {
		const { calls, hashes, byName } = setUp()
		hashes.hold(true)
		calls[0]!.resolve('0000000000000001')
		await flushPromises()
		expect(hashes.hashOf(byName('A'))).toBeNull()

		hashes.hold(false)
		expect(hashes.hashOf(byName('A'))).toBe('0000000000000001')
	})
})

describe('hashInWorkers', () => {
	afterEach(() => vi.unstubAllGlobals())

	// spec: SERIES-001.17, SERIES-003.26
	it('hashes the small grid tier of the member in the pool', async () => {
		const hash = vi.fn(async () => '00000000000000ff')
		const hashImage = hashInWorkers({ hash }, (fileId, size, mtime) => `/preview/${fileId}/${size}/${mtime}`)

		await expect(hashImage(listingEntry(5, '/P/A.JPG', { mtime: 9 }))).resolves.toBe('00000000000000ff')
		expect(hash).toHaveBeenCalledWith(`/preview/5/${GRID_TIERS[0]}/9`)
	})

	// spec: SERIES-003.22, SERIES-003.26
	it('sends a worker the very URL the grid tile loads first, so the browser cache serves it', async () => {
		const sent: WorkerRequest[] = []
		vi.stubGlobal('Worker', class {
			onmessage: ((event: { data: WorkerAnswer }) => void) | null = null
			onerror = null
			postMessage(request: WorkerRequest) {
				sent.push(request)
				queueMicrotask(() => this.onmessage!({ data: { id: request.id, hash: '0000000000000000' } }))
			}

			terminate() {}
		})
		const member = listingEntry(5, '/P/A.JPG', { mtime: 9 })

		await expect(APP_SEAMS.hashImage(member)).resolves.toBe('0000000000000000')
		expect(sent.map((request) => request.url)).toEqual([smallSource(member, imageUrl)])
	})
})

describe('useVisualHashes when the server limits the saves', () => {
	// spec: SERIES-003.27
	it('waits as long as asked, keeps hashing and sends the same hashes again', async () => {
		const waited = deferred<void>()
		const wait = vi.fn(() => waited.promise)
		const { calls, saves, pictures, hashes } = setUp(BURST, {}, [new RateLimitedError(42)], wait)
		calls[0]!.resolve('0000000000000001')
		await flushPromises()
		calls[1]!.resolve('0000000000000003')
		await flushPromises()
		expect(wait).toHaveBeenCalledWith(42)

		pictures.value = picturesOf([listingEntry(7, '/Q/X.JPG', { captureTime: 0 }), listingEntry(8, '/Q/Y.JPG', { captureTime: 1 })])
		await flushPromises()
		calls[2]!.resolve('0000000000000007')
		await flushPromises()
		calls[3]!.resolve('0000000000000008')
		await flushPromises()
		expect(saves).toHaveLength(1)
		expect(hashes.progress.value.phase).toBe('done')

		waited.resolve()
		await flushPromises()
		expect(saves.map((save) => save.map((each) => each.fileId))).toEqual([[1, 3], [1, 3], [7, 8]])
		expect(hashes.progress.value.phase).toBe('done')
	})
})
