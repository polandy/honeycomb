// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { listEntries, movePictures, probeTargets, RequestTimeoutError, trashPictures } from '../../src/api.ts'
import { fakeScheduler } from './fake-scheduler.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

/** An axios call that never answers and fails once its signal aborts, as axios does. */
function hanging(...args: unknown[]) {
	return new Promise((_, reject) => {
		const { signal } = args.at(-1) as { signal: AbortSignal }
		signal.addEventListener('abort', () => reject(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })))
	})
}

describe('request timeouts', () => {
	// spec: LISTING-003.8, DECISIONS-002.19, DELETE-002.29
	it('aborts a listing after 30 s', async () => {
		const { timers, schedule, fire } = fakeScheduler()
		vi.mocked(axios.get).mockImplementation(hanging)

		const listing = listEntries('/Big', true, [], schedule)
		expect(timers.map(({ ms }) => ms)).toEqual([30_000])
		fire()

		await expect(listing).rejects.toEqual(new RequestTimeoutError(30_000))
	})

	// spec: MOVE-004.20
	it('aborts the probe of the move targets after 30 s and a move request after 90 s', async () => {
		const { timers, schedule, fire } = fakeScheduler()
		vi.mocked(axios.post).mockImplementation(hanging)

		const probe = probeTargets(['/Out'], ['/In'], schedule)
		const move = movePictures([[{ fileId: 7, etag: 'e7', path: '/Out/A.JPG' }]], schedule)
		expect(timers.map(({ ms }) => ms)).toEqual([30_000, 90_000])
		fire()

		await expect(probe).rejects.toBeInstanceOf(RequestTimeoutError)
		await expect(move).rejects.toEqual(new RequestTimeoutError(90_000))
	})

	// spec: DELETE-002.29
	it('aborts a trash request after 90 s', async () => {
		const { timers, schedule, fire } = fakeScheduler()
		vi.mocked(axios.post).mockImplementation(hanging)

		const trash = trashPictures([[{ fileId: 7, etag: 'e7' }]], 'rejected', schedule)
		expect(timers.map(({ ms }) => ms)).toEqual([90_000])
		fire()

		await expect(trash).rejects.toEqual(new RequestTimeoutError(90_000))
	})
})
