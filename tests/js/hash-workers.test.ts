// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HashWorker, WorkerAnswer, WorkerRequest } from '../../src/hash-workers.ts'

import { describe, expect, it } from 'vitest'
import { createHashWorkers } from '../../src/hash-workers.ts'

/** A worker that keeps what it is sent and answers when the test says so. */
class FakeWorker implements HashWorker {
	onmessage: ((event: MessageEvent<WorkerAnswer>) => void) | null = null
	onerror: ((event: ErrorEvent) => void) | null = null
	sent: WorkerRequest[] = []
	terminated = false

	postMessage(request: WorkerRequest) {
		this.sent.push(request)
	}

	answer(answer: Omit<WorkerAnswer, 'id'>) {
		this.onmessage!({ data: { id: this.sent.at(-1)!.id, ...answer } } as MessageEvent<WorkerAnswer>)
	}

	crash() {
		this.onerror!({ message: 'Uncaught out of memory' } as ErrorEvent)
	}

	terminate() {
		this.terminated = true
	}
}

function pool(count: number) {
	const workers: FakeWorker[] = []
	const hashing = createHashWorkers(count, () => {
		workers.push(new FakeWorker())
		return workers.at(-1)!
	})
	return { hashing, workers }
}

describe('createHashWorkers', () => {
	// spec: SERIES-004.5
	it('hands each URL to an idle worker and answers its hash', async () => {
		const { hashing, workers } = pool(2)

		const first = hashing.hash('/a')
		const second = hashing.hash('/b')
		workers[1]!.answer({ hash: '00000000000000bb' })
		workers[0]!.answer({ hash: '00000000000000aa' })

		await expect(first).resolves.toBe('00000000000000aa')
		await expect(second).resolves.toBe('00000000000000bb')
		expect(workers.map((worker) => worker.sent.map((request) => request.url))).toEqual([['/a'], ['/b']])
	})

	// spec: SERIES-004.5
	it('queues a URL until a worker is free', async () => {
		const { hashing, workers } = pool(1)

		const first = hashing.hash('/a')
		const second = hashing.hash('/b')
		expect(workers[0]!.sent).toHaveLength(1)
		workers[0]!.answer({ hash: '00000000000000aa' })
		await first
		workers[0]!.answer({ hash: '00000000000000bb' })

		await expect(second).resolves.toBe('00000000000000bb')
	})

	// spec: SERIES-004.10
	it('rejects the hash a worker could not compute', async () => {
		const { hashing, workers } = pool(1)

		const failed = hashing.hash('/a')
		workers[0]!.answer({ error: new Error('Preview answered 404') })

		await expect(failed).rejects.toThrow('Preview answered 404')
	})

	// spec: SERIES-004.15
	it('starts no worker before the first hash, then one per URL up to the count', () => {
		const { hashing, workers } = pool(2)
		expect(workers).toHaveLength(0)

		void hashing.hash('/a')
		expect(workers).toHaveLength(1)
		void hashing.hash('/b')
		void hashing.hash('/c')

		expect(workers).toHaveLength(2)
		expect(hashing.size).toBe(2)
	})

	// spec: SERIES-004.15
	it('reuses an idle worker before it starts another', async () => {
		const { hashing, workers } = pool(2)

		const first = hashing.hash('/a')
		workers[0]!.answer({ hash: '00000000000000aa' })
		await first
		void hashing.hash('/b')

		expect(workers).toHaveLength(1)
		expect(workers[0]!.sent.map((request) => request.url)).toEqual(['/a', '/b'])
	})

	// spec: SERIES-004.16
	it('fails only the URL of a crashed worker and hashes the next in a new one', async () => {
		const { hashing, workers } = pool(1)

		const crashed = hashing.hash('/a')
		const next = hashing.hash('/b')
		workers[0]!.crash()

		await expect(crashed).rejects.toThrow('The hash worker crashed: Uncaught out of memory')
		expect(workers[0]!.terminated).toBe(true)
		expect(workers[1]!.sent.map((request) => request.url)).toEqual(['/b'])
		workers[1]!.answer({ hash: '00000000000000bb' })
		await expect(next).resolves.toBe('00000000000000bb')
	})

	// spec: SERIES-004.16
	it('starts no worker again for a crash while idle', async () => {
		const { hashing, workers } = pool(1)
		const first = hashing.hash('/a')
		workers[0]!.answer({ hash: '00000000000000aa' })
		await first

		workers[0]!.crash()
		expect(workers).toHaveLength(1)
		void hashing.hash('/b')

		expect(workers).toHaveLength(2)
		expect(workers[1]!.sent.map((request) => request.url)).toEqual(['/b'])
	})

	// spec: SERIES-006.19
	it('measures a URL in the same workers and tells each worker the kind of its job', async () => {
		const { hashing, workers } = pool(1)

		const measured = hashing.measure('sharpness', '/loupe')
		workers[0]!.answer({ measured: { sharpness: 4.5, focusTile: 9 } })
		await expect(measured).resolves.toEqual({ sharpness: 4.5, focusTile: 9 })
		const hashed = hashing.hash('/a')
		workers[0]!.answer({ hash: '00000000000000aa' })
		await hashed

		expect(workers[0]!.sent.map((request) => [request.kind, request.url])).toEqual([['sharpness', '/loupe'], ['hash', '/a']])
	})

	it('rejects an answer that does not fit its job', async () => {
		const { hashing, workers } = pool(1)

		const measured = hashing.measure('sharpness', '/loupe')
		workers[0]!.answer({ hash: '00000000000000aa' })
		await expect(measured).rejects.toThrow('The hash worker answered another job')
		const hashed = hashing.hash('/a')
		workers[0]!.answer({ measured: { sharpness: 4.5, focusTile: 9 } })
		await expect(hashed).rejects.toThrow('The hash worker answered another job')
	})

	it('ends every worker', () => {
		const { hashing, workers } = pool(2)
		void hashing.hash('/a')
		void hashing.hash('/b')

		hashing.terminate()

		expect(workers.every((worker) => worker.terminated)).toBe(true)
	})
})
