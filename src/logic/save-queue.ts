// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** How a queued save ended; `unsaved` are its rows that no later save stored. */
export type SaveResult<Row> = { readonly ok: true } | { readonly ok: false, readonly error: unknown, readonly unsaved: readonly Row[] }

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
 * Sends saves one at a time; rows given meanwhile go in the next save together, the newest per file id
 * (DECISIONS-001.14). A failed save is answered once nothing is in flight or waiting, newest first, so
 * putting each back in turn restores what the server holds (DECISIONS-001.15).
 */
export function saveQueue<Row extends { readonly fileId: number }>(send: (rows: readonly Row[]) => Promise<void>): (rows: readonly Row[]) => Promise<SaveResult<Row>> {
	let sending = false
	let waiting: Waiting<Row>[] = []
	let failed: Failed<Row>[] = []

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
		const rows = new Map(batch.flatMap((entry) => entry.rows.map((row) => [row.fileId, row] as const)))
		sending = true
		void send([...rows.values()]).then(() => {
			failed.forEach((entry) => {
				entry.unsaved = entry.unsaved.filter((row) => !rows.has(row.fileId))
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
