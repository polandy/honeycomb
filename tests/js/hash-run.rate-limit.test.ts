// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useHashRun } from '../../src/hash-run.ts'
import { RateLimitedError } from '../../src/logic/retry-after.ts'
import { deferred, pictures, seams, TWO_PAGES } from './hash-run-fakes.ts'

vi.mock('../../src/logger.ts', () => ({ logger: { warn: vi.fn() } }))

const ids = (calls: readonly (readonly [readonly { fileId: number }[]])[]) => calls.map(([batch]) => batch.map((each) => each.fileId).sort((a, b) => a - b))

describe('useHashRun when the server limits the saves', () => {
	// spec: SERIES-004.14
	it('waits as long as the server asks and sends the same batch again', async () => {
		const wait = deferred<void>()
		const fake = seams(TWO_PAGES, { wait: vi.fn(() => wait.promise) })
		fake.save.mockRejectedValueOnce(new RateLimitedError(42))
		const run = useHashRun(fake)

		run.start('/Photos')
		await flushPromises()
		expect(fake.wait).toHaveBeenCalledWith(42)
		expect(run.waiting.value).toBe(42)
		expect(run.status.value).toBe('running')
		expect(run.problem.value).toBeNull()
		expect(run.progress.value).toEqual({ phase: 'done', hashed: 5, failed: 0, total: 5 })

		wait.resolve()
		await flushPromises()
		const sent = ids(fake.save.mock.calls)
		expect(sent[1]).toEqual(sent[0])
		expect(new Set(sent.flat())).toEqual(new Set([1, 2, 3, 4, 5]))
		expect(run.waiting.value).toBeNull()
		expect(run.status.value).toBe('done')
	})

	// spec: SERIES-004.14
	it('keeps hashing while it waits and saves no other batch', async () => {
		const wait = deferred<void>()
		const fake = seams({ '': { pictures: pictures(1, 4), next: null } }, { workers: 1, saveBatch: 2, wait: vi.fn(() => wait.promise) })
		fake.save.mockRejectedValueOnce(new RateLimitedError(60))
		const run = useHashRun(fake)

		run.start('/Photos')
		await flushPromises()
		expect(fake.hash).toHaveBeenCalledTimes(4)
		expect(fake.save).toHaveBeenCalledTimes(1)

		wait.resolve()
		await flushPromises()
		expect(ids(fake.save.mock.calls)).toEqual([[1, 2], [1, 2], [3, 4]])
		expect(run.status.value).toBe('done')
	})

	// spec: SERIES-004.14
	it('waits again when the server limits the batch once more', async () => {
		const fake = seams({ '': { pictures: pictures(1, 2), next: null } })
		fake.save.mockRejectedValueOnce(new RateLimitedError(60)).mockRejectedValueOnce(new RateLimitedError(5))
		const run = useHashRun(fake)

		run.start('/Photos')
		await flushPromises()

		expect(fake.wait.mock.calls).toEqual([[60], [5]])
		expect(ids(fake.save.mock.calls)).toEqual([[1, 2], [1, 2], [1, 2]])
		expect(run.status.value).toBe('done')
	})

	// spec: SERIES-004.8, SERIES-004.14
	it('pauses once the waiting batch is saved', async () => {
		const wait = deferred<void>()
		const fake = seams({ '': { pictures: pictures(1, 2), next: null } }, { wait: vi.fn(() => wait.promise) })
		fake.save.mockRejectedValueOnce(new RateLimitedError(60))
		const run = useHashRun(fake)
		run.start('/Photos')
		await flushPromises()

		run.pause()
		expect(run.status.value).toBe('pausing')
		wait.resolve()
		await flushPromises()

		expect(ids(fake.save.mock.calls)).toEqual([[1, 2], [1, 2]])
		expect(run.waiting.value).toBeNull()
		expect(run.status.value).toBe('paused')
	})

	// spec: SERIES-004.14
	it('drops the waiting batch of an earlier run', async () => {
		const wait = deferred<void>()
		const fake = seams({ '': { pictures: pictures(1, 1), next: null } }, { wait: vi.fn(() => wait.promise) })
		fake.save.mockRejectedValueOnce(new RateLimitedError(60))
		const run = useHashRun(fake)
		run.start('/Photos')
		await flushPromises()

		run.start('/Other')
		await flushPromises()
		expect(run.waiting.value).toBeNull()
		wait.resolve()
		await flushPromises()

		expect(ids(fake.save.mock.calls)).toEqual([[1], [1]])
		expect(run.status.value).toBe('done')
	})
})
