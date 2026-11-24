// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { WorkerAnswer, WorkerRequest } from './hash-workers.ts'
import type { Sharpness } from './logic/sharpness.ts'

/** What a worker does for a job: hash the URL, or run the quality measure its kind names (SERIES-006.22). */
export interface JobRunners {
	readonly hash: (url: string) => Promise<string>
	readonly measure: (measureId: string, url: string) => Promise<Sharpness>
}

/** The answer to `request`; an unknown measure id rejects. */
export async function answerJob({ id, kind, url }: WorkerRequest, runners: JobRunners): Promise<WorkerAnswer> {
	return kind === 'hash'
		? { id, hash: await runners.hash(url) }
		: { id, measured: await runners.measure(kind, url) }
}
