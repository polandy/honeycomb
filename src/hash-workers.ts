// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Sharpness } from './logic/sharpness.ts'

import { hashWorkerCount } from './logic/hash-workers.ts'

/** What a worker does with a URL: hash the small preview or run the quality measure of that id on the loupe tier. */
export type WorkerJobKind = 'hash' | (string & {})

/** A URL a worker should hash or measure, under the id of its answer. */
export interface WorkerRequest {
	readonly id: number
	readonly kind: WorkerJobKind
	readonly url: string
}

/** A worker's answer: the hash, the sharpness, or the text of what failed. */
export type WorkerAnswer = { readonly id: number, readonly hash: string } | { readonly id: number, readonly measured: Sharpness } | { readonly id: number, readonly error: unknown }

/** The part of a Web Worker the pool uses. */
export interface HashWorker {
	onmessage: ((event: MessageEvent<WorkerAnswer>) => void) | null
	onerror: ((event: ErrorEvent) => void) | null
	postMessage(request: WorkerRequest): void
	terminate(): void
}

/** A URL waiting for a worker, and how to settle its answer. */
interface Job {
	readonly kind: WorkerJobKind
	readonly url: string
	readonly settle: (answer: WorkerAnswer) => void
}

/**
 * A pool of at most `count` workers made by `create` when needed, each hashing or measuring one URL at a time; a crashed
 * worker fails its job and is ended (SERIES-004.5, .15, .16, SERIES-006.19).
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
			worker.postMessage({ id: job.id, kind: job.kind, url: job.url })
		}
	}

	/** The answer of the next free worker to a job of `kind` at `url`; a failure rejects. */
	async function run(kind: WorkerJobKind, url: string): Promise<WorkerAnswer> {
		const answer = await new Promise<WorkerAnswer>((settle) => {
			waiting.push({ kind, url, settle })
			dispatch()
		})
		if ('error' in answer) {
			throw answer.error instanceof Error ? answer.error : new Error('The hash worker failed', { cause: answer.error })
		}
		return answer
	}

	/** The visual hash of the preview at `url`, from the next free worker. */
	async function hash(url: string): Promise<string> {
		const answer = await run('hash', url)
		if (!('hash' in answer)) {
			throw new Error('The hash worker answered another job')
		}
		return answer.hash
	}

	/** The value of the quality measure `measureId` of the photo at `url`, from the next free worker (SERIES-006.19). */
	async function measure(measureId: string, url: string): Promise<Sharpness> {
		const answer = await run(measureId, url)
		if (!('measured' in answer)) {
			throw new Error('The hash worker answered another job')
		}
		return answer.measured
	}

	/** Ends every started worker. */
	function terminate() {
		[...idle, ...busy.keys()].forEach((worker) => worker.terminate())
	}

	return { hash, measure, terminate, size: count }
}

/** The page's pool of hash workers, as many as its cores allow (SERIES-004.6). */
export function browserHashWorkers() {
	return createHashWorkers(hashWorkerCount(navigator.hardwareConcurrency), () => new Worker(new URL('./hash-worker.ts', import.meta.url), { type: 'module' }))
}
