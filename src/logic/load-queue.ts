// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** A load waiting in or running through a `LoadQueue`. */
export interface QueuedLoad {
	/** Moves a waiting load to a new priority, lowest first; a started one keeps going. */
	prioritise(priority: number): void
	/** Drops a waiting load; a running one keeps its slot until it settles, unreported. */
	cancel(): void
}

/** Runs image loads a few at a time (GRID-001.15). */
export interface LoadQueue {
	/** Queues the load of `url`; `settled` hears whether it loaded, before the next load starts. */
	enqueue(url: string, priority: number, settled: (loaded: boolean) => void): QueuedLoad
}

interface Entry {
	readonly url: string
	readonly order: number
	readonly settled: (loaded: boolean) => void
	priority: number
	cancelled: boolean
}

/** A queue with at most `limit` loads in flight that starts the lowest priority, then the oldest. */
export function createLoadQueue(load: (url: string) => Promise<void>, limit: number): LoadQueue {
	const waiting: Entry[] = []
	let running = 0
	let requested = 0

	const before = (a: Entry, b: Entry) => a.priority < b.priority || (a.priority === b.priority && a.order < b.order)

	/** Starts waiting loads while slots are free. */
	function startNext(): void {
		while (running < limit && waiting.length > 0) {
			const first = waiting.reduce((best, entry) => (before(entry, best) ? entry : best))
			waiting.splice(waiting.indexOf(first), 1)
			void run(first)
		}
	}

	/** Runs one load in a slot, reports it unless cancelled, then frees the slot. */
	async function run(entry: Entry): Promise<void> {
		running++
		const loaded = await load(entry.url).then(() => true, () => false)
		running--
		try {
			if (!entry.cancelled) {
				entry.settled(loaded)
			}
		} finally {
			startNext()
		}
	}

	return {
		enqueue(url, priority, settled) {
			const entry: Entry = { url, order: requested++, settled, priority, cancelled: false }
			waiting.push(entry)
			startNext()
			return {
				prioritise(next) {
					entry.priority = next
				},
				cancel() {
					entry.cancelled = true
					const index = waiting.indexOf(entry)
					if (index >= 0) {
						waiting.splice(index, 1)
					}
				},
			}
		},
	}
}
