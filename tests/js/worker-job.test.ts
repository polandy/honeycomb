// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest'
import { answerJob } from '../../src/hashes/worker-job.ts'

function runners() {
	return {
		hash: vi.fn(async () => '00000000000000aa'),
		measure: vi.fn(async (measureId: string) => {
			if (measureId !== 'sharpness') {
				throw new Error(`Unknown quality measure ${measureId}`)
			}
			return { sharpness: 4.5, focusTile: 9 }
		}),
	}
}

describe('answerJob', () => {
	// spec: SERIES-006.22
	it('hashes the URL of a hash job', async () => {
		const run = runners()
		await expect(answerJob({ id: 1, kind: 'hash', url: '/a' }, run)).resolves.toEqual({ id: 1, hash: '00000000000000aa' })
		expect(run.hash).toHaveBeenCalledWith('/a')
	})

	// spec: SERIES-006.22
	it('runs the measure a job names by its id', async () => {
		const run = runners()
		await expect(answerJob({ id: 2, kind: 'sharpness', url: '/b' }, run)).resolves.toEqual({ id: 2, measured: { sharpness: 4.5, focusTile: 9 } })
		expect(run.measure).toHaveBeenCalledWith('sharpness', '/b')
	})

	// spec: SERIES-006.22
	it('fails a job that names an unknown measure', async () => {
		await expect(answerJob({ id: 3, kind: 'blur', url: '/c' }, runners())).rejects.toThrow('Unknown quality measure blur')
	})
})
