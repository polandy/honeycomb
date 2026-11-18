// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from './long-press.ts'

/** How long a picture's writes wait for a further step before they start (ADR 0032). */
export const BUNDLE_IDLE_MS = 2000

/** The picture whose writes wait, the writes in order and the cancel of its idle timer. */
interface Waiting<P> {
	readonly picture: P
	readonly writes: (() => void)[]
	cancel: () => void
}

/** Holds the writes of one picture until the user leaves it or it stays idle; a write of several pictures, or of none, starts at once (ADR 0032). */
export function pictureBundle<P>(schedule: Schedule, onWaiting: (picture: P | null) => void = () => {}, idleMs = BUNDLE_IDLE_MS) {
	let waiting: Waiting<P> | null = null
	const inFlight = new Set<Promise<unknown>>()

	/** Starts the write and keeps it in flight until it settles. */
	function start<T>(write: () => Promise<T>): Promise<T> {
		const running = write()
		inFlight.add(running)
		const settled = () => inFlight.delete(running)
		running.then(settled, settled)
		return running
	}

	/** Starts the waiting writes together, in order. */
	function release() {
		if (waiting === null) {
			return
		}
		const { writes, cancel } = waiting
		waiting = null
		cancel()
		onWaiting(null)
		writes.forEach((write) => write())
	}

	/** Queues the write of the pictures; it answers once it ran. */
	function add<T>(pictures: readonly P[], write: () => Promise<T>): Promise<T> {
		const [only] = pictures
		if (pictures.length !== 1 || only === undefined) {
			release()
			return start(write)
		}
		if (waiting !== null && waiting.picture !== only) {
			release()
		}
		return new Promise<T>((resolve, reject) => {
			const run = () => void start(write).then(resolve, reject)
			if (waiting === null) {
				waiting = { picture: only, writes: [run], cancel: () => {} }
				onWaiting(only)
			} else {
				waiting.cancel()
				waiting.writes.push(run)
			}
			waiting.cancel = schedule(release, idleMs)
		})
	}

	/** Starts the waiting writes unless their picture is still the one shown. */
	function leave(shown: P | null) {
		if (waiting !== null && waiting.picture !== shown) {
			release()
		}
	}

	/** Starts the waiting writes and resolves once every write started, and every write those lead to, has settled. */
	async function flush() {
		release()
		while (inFlight.size > 0) {
			await Promise.allSettled([...inFlight])
			release()
		}
	}

	return { add, leave, flush }
}
