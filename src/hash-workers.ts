// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
	postMessage(request: WorkerRequest): void
	terminate(): void
}

/** A pool of `count` workers made by `create`, each hashing one preview URL at a time (SERIES-004.5). */
export function createHashWorkers(count: number, create: () => HashWorker) {
	const idle: HashWorker[] = []
	const waiting: { url: string, settle: (answer: WorkerAnswer) => void }[] = []
	const answers = new Map<number, (answer: WorkerAnswer) => void>()
	let nextId = 0

	const workers = Array.from({ length: count }, () => {
		const worker = create()
		worker.onmessage = ({ data }) => {
			answers.get(data.id)?.(data)
			answers.delete(data.id)
			idle.push(worker)
			dispatch()
		}
		idle.push(worker)
		return worker
	})

	/** Hands the waiting previews to the idle workers. */
	function dispatch() {
		while (idle.length > 0 && waiting.length > 0) {
			const { url, settle } = waiting.shift()!
			const id = nextId++
			answers.set(id, settle)
			idle.shift()!.postMessage({ id, url })
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

	/** Ends every worker. */
	function terminate() {
		workers.forEach((worker) => worker.terminate())
	}

	return { hash, terminate }
}
