// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { RateLimitedError } from './retry-after.ts'

/** How a queued save ended; `unsaved` are its rows that no later save stored. */
export type SaveResult<Row> = { readonly ok: true } | { readonly ok: false, readonly error: unknown, readonly unsaved: readonly Row[] }

/** How a queue tells its rows apart, and how it waits out a save the server limits. */
export interface SaveQueueOptions<Row, Key> {
	/** Rows with the same key replace each other; the newest wins. */
	readonly key: (row: Row) => Key
	/** Resolves after the given seconds; without it a limited save fails like any other. */
	readonly wait?: (seconds: number) => Promise<void>
}

/** The key of a row stored per file. */
export function byFileId(row: { readonly fileId: number }): number {
	return row.fileId
}

interface Waiting<Row> {
	readonly rows: readonly Row[]
	readonly answer: (result: SaveResult<Row>) => void
}

interface Failed<Row> {
	readonly waiting: Waiting<Row>
	readonly error: unknown
	unsaved: readonly Row[]
}

/**
 * Sends saves one at a time; rows given meanwhile go in the next save together, the newest per key
 * (DECISIONS-001.14). A failed save is answered once nothing is in flight or waiting, newest first, so
 * putting each back in turn restores what the server holds (DECISIONS-001.15). With `wait`, a save the
 * server limits waits the seconds it asks for and is sent again.
 */
export function saveQueue<Row, Key>(send: (rows: readonly Row[]) => Promise<void>, { key, wait }: SaveQueueOptions<Row, Key>): (rows: readonly Row[]) => Promise<SaveResult<Row>> {
	let sending = false
	let waiting: Waiting<Row>[] = []
	let failed: Failed<Row>[] = []

	/** Sends the rows, and again after each wait a limited save asks for. */
	async function sendWaiting(rows: readonly Row[]): Promise<void> {
		for (;;) {
			try {
				return await send(rows)
			} catch (error) {
				if (wait === undefined || !(error instanceof RateLimitedError)) {
					throw error
				}
				await wait(error.seconds)
			}
		}
	}

	/** Sends what waits, or answers the failed saves once nothing does. */
	function next() {
		if (waiting.length === 0) {
			const answered = failed.reverse()
			failed = []
			answered.forEach(({ waiting: { answer }, error, unsaved }) => answer({ ok: false, error, unsaved }))
			return
		}
		const batch = waiting
		waiting = []
		const rows = new Map(batch.flatMap((entry) => entry.rows.map((row) => [key(row), row] as const)))
		sending = true
		void sendWaiting([...rows.values()]).then(() => {
			failed.forEach((entry) => {
				entry.unsaved = entry.unsaved.filter((row) => !rows.has(key(row)))
			})
			batch.forEach(({ answer }) => answer({ ok: true }))
		}, (error: unknown) => {
			failed.push(...batch.map((entry) => ({ waiting: entry, error, unsaved: entry.rows })))
		}).finally(() => {
			sending = false
			next()
		})
	}

	return (rows) => new Promise((answer) => {
		waiting.push({ rows, answer })
		if (!sending) {
			next()
		}
	})
}
