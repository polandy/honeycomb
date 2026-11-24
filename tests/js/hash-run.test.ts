// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MissingPicture } from '../../src/hash-run.ts'
import type { StoredVisualHash } from '../../src/logic/visual-hash.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { HASH_RUN_SAVE_BATCH, useHashRun } from '../../src/hash-run.ts'
import { deferred, hashOf, pictures, seams, TWO_PAGES } from './hash-run-fakes.ts'

vi.mock('../../src/logger.ts', () => ({ logger: { warn: vi.fn() } }))

describe('useHashRun', () => {
	// spec: SERIES-004.5
	it('hashes every picture of every page once and saves the hashes', async () => {
		const fake = seams(TWO_PAGES)
		const run = useHashRun(fake)

		run.start('/Photos')
		await flushPromises()

		expect(fake.listMissing.mock.calls).toEqual([['/Photos', ''], ['/Photos', '3.jpg']])
		expect(fake.hash.mock.calls.map(([each]) => each.fileId).sort()).toEqual([1, 2, 3, 4, 5])
		expect(fake.save.mock.calls.flatMap(([hashes]) => hashes)).toHaveLength(5)
		expect(fake.save.mock.calls[0]![0]).toContainEqual({ fileId: 1, etag: 'etag-1', method: 1, hash: hashOf(1) })
		expect(run.status.value).toBe('done')
		expect(run.progress.value).toEqual({ phase: 'done', hashed: 5, failed: 0, total: 5 })
	})

	// spec: SERIES-004.5
	it('saves in requests of at most one batch', async () => {
		const fake = seams({ '': { pictures: pictures(1, 600), nextCursor: null } })
		const run = useHashRun(fake)

		run.start('/Photos')
		await flushPromises()

		const sizes = fake.save.mock.calls.map(([hashes]) => hashes.length)
		expect(Math.max(...sizes)).toBeLessThanOrEqual(HASH_RUN_SAVE_BATCH)
		expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(600)
		expect(run.status.value).toBe('done')
	})

	// spec: SERIES-004.5
	it('hashes no more pictures at once than it has workers', async () => {
		const fake = seams({ '': { pictures: pictures(1, 5), nextCursor: null } }, { hash: vi.fn(() => new Promise<string>(() => {})) })
		const run = useHashRun(fake)

		run.start('/Photos')
		await flushPromises()

		expect(fake.hash).toHaveBeenCalledTimes(2)
		expect(run.progress.value).toEqual({ phase: 'running', hashed: 0, failed: 0, total: 5 })
	})

	// spec: SERIES-004.8
	it('pauses after the hashes and the save in flight and goes on when resumed', async () => {
		const hashes = new Map<number, ReturnType<typeof deferred<string>>>()
		const saves: ReturnType<typeof deferred<number[]>>[] = []
		const fake = seams({ '': { pictures: pictures(1, 3), nextCursor: null } }, {
			workers: 1,
			saveBatch: 1,
			hash: vi.fn((each: MissingPicture) => {
				hashes.set(each.fileId, deferred<string>())
				return hashes.get(each.fileId)!.promise
			}),
			save: vi.fn(() => {
				saves.push(deferred<number[]>())
				return saves.at(-1)!.promise
			}),
		})
		const run = useHashRun(fake)
		run.start('/Photos')
		await flushPromises()
		hashes.get(1)!.resolve(hashOf(1))
		await flushPromises()

		run.pause()
		hashes.get(2)!.resolve(hashOf(2))
		await flushPromises()
		expect(run.status.value).toBe('pausing')
		saves[0]!.resolve([1])
		await flushPromises()
		saves[1]!.resolve([2])
		await flushPromises()

		expect(run.status.value).toBe('paused')
		expect(fake.hash).toHaveBeenCalledTimes(2)
		expect(fake.save.mock.calls.map(([batch]) => batch.map((each) => each.fileId))).toEqual([[1], [2]])

		run.resume()
		await flushPromises()
		expect(fake.hash).toHaveBeenCalledTimes(3)
		expect(run.status.value).toBe('running')
	})

	// spec: SERIES-004.8
	it('pauses at once when nothing is in flight', async () => {
		const run = useHashRun(seams(TWO_PAGES))
		run.start('/Photos')
		run.pause()
		await flushPromises()

		expect(run.status.value).toBe('paused')
	})

	// spec: SERIES-004.9
	it('pauses on a failed save and sends the same hashes again when resumed', async () => {
		const fake = seams(TWO_PAGES)
		fake.save.mockRejectedValueOnce(new Error('offline'))
		const run = useHashRun(fake)

		run.start('/Photos')
		await flushPromises()
		expect(run.status.value).toBe('paused')
		expect(run.problem.value).toBe('save')
		expect(run.progress.value.phase).toBe('failed')

		run.resume()
		await flushPromises()
		const sent = fake.save.mock.calls.map(([batch]) => batch.map((each) => each.fileId).sort())
		expect(sent[1]).toEqual(expect.arrayContaining(sent[0]!))
		expect(run.problem.value).toBeNull()
		expect(run.status.value).toBe('done')
	})

	// spec: SERIES-004.10
	it('counts a picture that fails to hash or that the server skips as failed, once', async () => {
		const fake = seams(TWO_PAGES, {
			hash: vi.fn(async (each: MissingPicture) => {
				if (each.fileId === 2) {
					throw new Error('no preview')
				}
				return hashOf(each.fileId)
			}),
			save: vi.fn(async (hashes: readonly StoredVisualHash[]) => hashes.map((each) => each.fileId).filter((fileId) => fileId !== 3)),
		})
		const run = useHashRun(fake)

		run.start('/Photos')
		await flushPromises()

		expect(run.failedPaths.value).toEqual(['/Photos/2.jpg', '/Photos/3.jpg'])
		expect(fake.hash.mock.calls.filter(([each]) => each.fileId === 2)).toHaveLength(1)
		expect(run.progress.value).toEqual({ phase: 'failed', hashed: 3, failed: 2, total: 5 })
		expect(run.status.value).toBe('done')
	})

	// spec: SERIES-004.11
	it('knows when every page is listed', async () => {
		const second = deferred<{ pictures: MissingPicture[], nextCursor: string | null }>()
		const fake = seams(TWO_PAGES, { listMissing: vi.fn(async (_path: string, after: string) => (after === '' ? TWO_PAGES[''] : second.promise)) })
		const run = useHashRun(fake)

		run.start('/Photos')
		await flushPromises()
		expect(run.listed.value).toBe(false)
		expect(run.progress.value.total).toBe(3)

		second.resolve(TWO_PAGES['3.jpg'])
		await flushPromises()
		expect(run.listed.value).toBe(true)
		expect(run.progress.value.total).toBe(5)
	})

	// spec: SERIES-004.12
	it('pauses on a failed page and asks for it again when resumed', async () => {
		const fake = seams(TWO_PAGES)
		fake.listMissing.mockImplementationOnce(async () => TWO_PAGES['']).mockRejectedValueOnce(new Error('offline'))
		const run = useHashRun(fake)

		run.start('/Photos')
		await flushPromises()
		expect(run.status.value).toBe('paused')
		expect(run.problem.value).toBe('page')

		run.resume()
		await flushPromises()
		expect(fake.listMissing.mock.calls.at(-1)).toEqual(['/Photos', '3.jpg'])
		expect(run.status.value).toBe('done')
		expect(run.progress.value.total).toBe(5)
	})

	it('starts afresh with another folder', async () => {
		const fake = seams({ ...TWO_PAGES, '': { pictures: pictures(1, 1), nextCursor: null } })
		const run = useHashRun(fake)
		run.start('/Photos')
		await flushPromises()

		run.start('/Other')
		await flushPromises()

		expect(fake.listMissing.mock.calls.at(-1)).toEqual(['/Other', ''])
		expect(run.progress.value.total).toBe(1)
	})
})
