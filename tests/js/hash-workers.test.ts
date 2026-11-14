// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HashWorker, WorkerAnswer, WorkerRequest } from '../../src/hash-workers.ts'

import { describe, expect, it } from 'vitest'
import { createHashWorkers } from '../../src/hash-workers.ts'

/** A worker that keeps what it is sent and answers when the test says so. */
class FakeWorker implements HashWorker {
	onmessage: ((event: MessageEvent<WorkerAnswer>) => void) | null = null
	sent: WorkerRequest[] = []
	terminated = false

	postMessage(request: WorkerRequest) {
		this.sent.push(request)
	}

	answer(answer: Omit<WorkerAnswer, 'id'>) {
		this.onmessage!({ data: { id: this.sent.at(-1)!.id, ...answer } } as MessageEvent<WorkerAnswer>)
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
		workers[0]!.answer({ error: 'Preview answered 404' })

		await expect(failed).rejects.toThrow('Preview answered 404')
	})

	it('ends every worker', () => {
		const { hashing, workers } = pool(2)

		hashing.terminate()

		expect(workers.every((worker) => worker.terminated)).toBe(true)
	})
})
