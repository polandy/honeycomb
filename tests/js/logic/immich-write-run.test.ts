// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SendProgress } from '../../../src/logic/request-chunks.ts'
import type { CheckedAsset, WritePlan, WriteResult } from '../../../src/logic/immich-write-plan.ts'
import type { WriteRequest } from '../../../src/logic/immich-write-run.ts'

import { describe, expect, it, vi } from 'vitest'
import { checkPending, runWrite, writeRequests } from '../../../src/logic/immich-write-run.ts'
import { candidate, checked } from './immich-fixtures.ts'

const ids = (count: number) => Array.from({ length: count }, (_, index) => `a${index}`)
const EMPTY_PLAN: WritePlan = { rejectAs: 'trash', counts: { assets: 0, rejects: 0, restores: 0, picks: 0, ratings: 0 }, conflicts: [], changes: [], done: [], skipped: [], gone: [], adopted: [] }

function checks(...assets: CheckedAsset[]): ReadonlyMap<string, CheckedAsset> {
	return new Map(assets.map((asset) => [asset.assetId, asset]))
}

/** A write endpoint that writes every asset it is sent. */
function writesAll(requests: readonly WriteRequest[]): Promise<WriteResult[]> {
	return Promise.resolve(requests.map(({ assetId }) => ({ assetId, state: 'written' })))
}

describe('checkPending', () => {
	// spec: IMMICH-004.23
	it('checks the pending candidates only, in blocks of 100, 100 and 50, with the progress after each', async () => {
		const pending = ids(250)
		const check = vi.fn((assetIds: readonly string[]) => Promise.resolve(assetIds.map((assetId) => checked(assetId))))
		const progress: SendProgress[] = []

		const answered = await checkPending([candidate('undecided', {}), ...pending.map((id) => candidate(id, { flag: 'rejected' }))], check, (step) => progress.push(step))

		expect(check.mock.calls.map(([assetIds]) => assetIds)).toEqual([pending.slice(0, 100), pending.slice(100, 200), pending.slice(200)])
		expect(progress).toEqual([{ done: 0, total: 250 }, { done: 100, total: 250 }, { done: 200, total: 250 }, { done: 250, total: 250 }])
		expect([...answered.keys()]).toEqual(pending)
		expect(answered.get('a7')).toEqual(checked('a7'))
	})

	// spec: IMMICH-004.23
	it('leaves out an asset Immich no longer holds', async () => {
		const answered = await checkPending([candidate('a1', { rating: 2 }), candidate('a2', { rating: 3 })], () => Promise.resolve([checked('a2')]), () => {})

		expect([...answered.keys()]).toEqual(['a2'])
	})

	// spec: IMMICH-004.23
	it('asks nothing without a pending candidate', async () => {
		const check = vi.fn(() => Promise.resolve([]))

		await expect(checkPending([candidate('a1', {})], check, () => {})).resolves.toEqual(new Map())
		expect(check).not.toHaveBeenCalled()
	})

	// spec: IMMICH-004.23, IMMICH-004.13
	it('stops at a failed block with its error and asks no further block', async () => {
		const down = new Error('unreachable')
		const check = vi.fn((assetIds: readonly string[]) => assetIds[0] === 'a100' ? Promise.reject(down) : Promise.resolve([]))

		await expect(checkPending(ids(250).map((id) => candidate(id, { rating: 1 })), check, () => {})).rejects.toBe(down)
		expect(check).toHaveBeenCalledTimes(2)
	})
})

describe('writeRequests', () => {
	// spec: IMMICH-004.24
	it('sends each change with the rating Immich holds afterwards: the one it sets, else Immich\'s own', () => {
		const plan: WritePlan = { ...EMPTY_PLAN, changes: [{ assetId: 'rated', rating: 4 }, { assetId: 'cleared', rating: null }, { assetId: 'trashed', trash: true }, { assetId: 'favoured', favorite: true }] }

		expect(writeRequests(plan, checks(checked('rated', { rating: 2 }), checked('cleared', { rating: 3 }), checked('trashed', { rating: 5 }), checked('favoured')))).toEqual([
			{ assetId: 'rated', rating: 4, immichRating: 4 },
			{ assetId: 'cleared', rating: null, immichRating: null },
			{ assetId: 'trashed', trash: true, immichRating: 5 },
			{ assetId: 'favoured', favorite: true, immichRating: null },
		])
	})

	// spec: IMMICH-004.24, IMMICH-004.9
	it('sends a done asset without a field, so honeycomb stores it as written, and leaves out the skipped and the gone', () => {
		const plan: WritePlan = { ...EMPTY_PLAN, done: ['done'], skipped: ['skipped'], gone: ['gone'] }

		expect(writeRequests(plan, checks(checked('done', { rating: -1, trashed: true }), checked('skipped')))).toEqual([{ assetId: 'done', immichRating: -1 }])
	})

	// spec: IMMICH-004.24
	it('sends Immich\'s rating 0 as none, the only form the write takes, as for an asset the check did not answer', () => {
		expect(writeRequests({ ...EMPTY_PLAN, done: ['a1', 'a2'] }, checks(checked('a1', { rating: 0 })))).toEqual([{ assetId: 'a1', immichRating: null }, { assetId: 'a2', immichRating: null }])
	})
})

describe('runWrite', () => {
	// spec: IMMICH-004.24, IMMICH-004.5
	it('writes the changes in blocks of 100 one after the other, with the progress after each block', async () => {
		const changed = ids(250)
		const write = vi.fn(writesAll)
		const progress: SendProgress[] = []
		const plan: WritePlan = { ...EMPTY_PLAN, changes: changed.map((assetId) => ({ assetId, rating: 2 })) }

		const run = await runWrite(plan, checks(...changed.map((id) => checked(id))), write, (step) => progress.push(step))

		expect(write.mock.calls.map(([requests]) => requests.map(({ assetId }) => assetId))).toEqual([changed.slice(0, 100), changed.slice(100, 200), changed.slice(200)])
		expect(write.mock.calls[0]![0][0]).toEqual({ assetId: 'a0', rating: 2, immichRating: 2 })
		expect(progress).toEqual([{ done: 0, total: 250 }, { done: 100, total: 250 }, { done: 200, total: 250 }, { done: 250, total: 250 }])
		expect(run).toEqual({ results: changed.map((assetId) => ({ assetId, state: 'written' })), failure: null })
	})

	// spec: IMMICH-004.24, IMMICH-004.10
	it('answers each sent asset\'s result, a refused one with its error, and the skipped ones as skipped', async () => {
		const plan: WritePlan = { ...EMPTY_PLAN, changes: [{ assetId: 'a1', trash: true }, { assetId: 'a2', trash: true }], done: ['a3'], skipped: ['a4'], gone: ['a5'] }
		const write = (requests: readonly WriteRequest[]) => Promise.resolve(requests.map(({ assetId }): WriteResult => assetId === 'a2' ? { assetId, state: 'failed', error: 'unknown-asset' } : { assetId, state: 'written' }))

		const run = await runWrite(plan, checks(checked('a1'), checked('a2'), checked('a3')), write, () => {})

		expect(run).toEqual({
			results: [{ assetId: 'a1', state: 'written' }, { assetId: 'a2', state: 'failed', error: 'unknown-asset' }, { assetId: 'a3', state: 'written' }, { assetId: 'a4', state: 'skipped' }],
			failure: null,
		})
	})

	// spec: IMMICH-004.24
	it('fails the failed block\'s assets and every one not yet sent, and sends nothing more', async () => {
		const changed = ids(250)
		const down = new Error('unreachable')
		const write = vi.fn((requests: readonly WriteRequest[]) => requests[0]!.assetId === 'a100' ? Promise.reject(down) : writesAll(requests))
		const plan: WritePlan = { ...EMPTY_PLAN, changes: changed.map((assetId) => ({ assetId, archived: true })), skipped: ['s1'] }

		const run = await runWrite(plan, checks(...changed.map((id) => checked(id))), write, () => {})

		expect(write).toHaveBeenCalledTimes(2)
		expect(run.failure).toEqual({ error: down })
		expect(run.results).toEqual([
			...changed.slice(0, 100).map((assetId) => ({ assetId, state: 'written' })),
			...changed.slice(100).map((assetId) => ({ assetId, state: 'failed' })),
			{ assetId: 's1', state: 'skipped' },
		])
	})

	// spec: IMMICH-004.24
	it('sends nothing for a plan with nothing to write', async () => {
		const write = vi.fn(writesAll)

		await expect(runWrite({ ...EMPTY_PLAN, skipped: ['s1'] }, checks(), write, () => {})).resolves.toEqual({ results: [{ assetId: 's1', state: 'skipped' }], failure: null })
		expect(write).not.toHaveBeenCalled()
	})
})
