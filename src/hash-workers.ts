// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { hashWorkerCount } from './logic/hash-workers.ts'

/** A preview URL a worker should hash, under the id of its answer. */
export interface WorkerRequest {
	readonly id: number
	readonly url: string
}

/** A worker's answer: the hash, or the text of what failed. */
export type WorkerAnswer = { readonly id: number, readonly hash: string } | { readonly id: number, readonly error: unknown }

/** The part of a Web Worker the pool uses. */
export interface HashWorker {
	onmessage: ((event: MessageEvent<WorkerAnswer>) => void) | null
	onerror: ((event: ErrorEvent) => void) | null
	postMessage(request: WorkerRequest): void
	terminate(): void
}

/** A preview waiting for a worker, and how to settle its hash. */
interface Job {
	readonly url: string
	readonly settle: (answer: WorkerAnswer) => void
}

/**
 * A pool of at most `count` workers made by `create` when needed, each hashing one preview URL at a time; a crashed
 * worker fails its preview and is ended (SERIES-004.5, .15, .16).
 */
export function createHashWorkers(count: number, create: () => HashWorker) {
	const idle: HashWorker[] = []
	const waiting: Job[] = []
	const busy = new Map<HashWorker, Job & { readonly id: number }>()
	let started = 0
	let nextId = 0

	/** Starts one more worker. */
	function start(): HashWorker {
		const worker = create()
		started++
		worker.onmessage = ({ data }) => {
			busy.get(worker)?.settle(data)
			busy.delete(worker)
			idle.push(worker)
			dispatch()
		}
		worker.onerror = ({ message }) => {
			worker.terminate()
			started--
			if (idle.includes(worker)) {
				idle.splice(idle.indexOf(worker), 1)
			}
			const job = busy.get(worker)
			busy.delete(worker)
			job?.settle({ id: job.id, error: new Error(`The hash worker crashed: ${message}`) })
			dispatch()
		}
		return worker
	}

	/** Hands the waiting previews to the idle workers, starting workers up to the count. */
	function dispatch() {
		while (waiting.length > 0 && (idle.length > 0 || started < count)) {
			const worker = idle.shift() ?? start()
			const job = { ...waiting.shift()!, id: nextId++ }
			busy.set(worker, job)
			worker.postMessage({ id: job.id, url: job.url })
		}
	}

	/** The visual hash of the preview at `url`, from the next free worker. */
	async function hash(url: string): Promise<string> {
		const answer = await new Promise<WorkerAnswer>((settle) => {
			waiting.push({ url, settle })
			dispatch()
		})
		if ('error' in answer) {
			throw answer.error instanceof Error ? answer.error : new Error('The hash worker failed', { cause: answer.error })
		}
		return answer.hash
	}

	/** Ends every started worker. */
	function terminate() {
		[...idle, ...busy.keys()].forEach((worker) => worker.terminate())
	}

	return { hash, terminate, size: count }
}

/** The page's pool of hash workers, as many as its cores allow (SERIES-004.6). */
export function browserHashWorkers() {
	return createHashWorkers(hashWorkerCount(navigator.hardwareConcurrency), () => new Worker(new URL('./hash-worker.ts', import.meta.url), { type: 'module' }))
}
