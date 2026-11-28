// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ImmichWriteApi } from '../../src/immich/immich-write.ts'
import type { CheckedAsset, WriteCandidate } from '../../src/logic/immich-write-plan.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useImmichWrite } from '../../src/immich/immich-write.ts'
import { logger } from '../../src/shared/logger.ts'
import { fakeApi, FAMILY, NO_DECISIONS, PENDING } from './immich-write-fixtures.ts'
import { candidate, checked } from './logic/immich-fixtures.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

/** Opens the write and answers the candidates and the check with `answered`. */
async function opened(answered: CheckedAsset[] = PENDING.map(({ assetId }) => checked(assetId)), loaded: WriteCandidate[] = PENDING) {
	const server = fakeApi()
	const write = useImmichWrite(server.api, () => FAMILY, NO_DECISIONS)
	const opening = write.open()
	await flushPromises()
	server.candidates[0]?.answer(loaded)
	await flushPromises()
	server.checks[0]?.answer(answered)
	await opening
	return { ...server, write }
}

describe('useImmichWrite', () => {
	// spec: IMMICH-004.25
	it('loads the candidates, checks the pending ones with the progress, then plans the write', async () => {
		const server = fakeApi()
		const write = useImmichWrite(server.api, () => FAMILY, NO_DECISIONS)
		expect(write.step.value).toEqual({ kind: 'closed' })

		const opening = write.open()
		expect(write.step.value).toEqual({ kind: 'checking', progress: null })
		server.candidates[0]!.answer(PENDING)
		await flushPromises()
		expect(server.checks[0]!.assetIds).toEqual(['r1', 'r2', 'p1', 's1'])
		expect(write.step.value).toEqual({ kind: 'checking', progress: { done: 0, total: 4 } })
		server.checks[0]!.answer(PENDING.map(({ assetId }) => checked(assetId)))
		await opening

		expect(write.step.value).toEqual({ kind: 'ready' })
		expect(write.plan.value?.counts).toEqual({ assets: 4, rejects: 2, restores: 0, picks: 1, ratings: 1 })
		expect(write.picksAsFavorites.value).toBe(true)
	})

	// spec: IMMICH-004.25, IMMICH-004.13
	it('shows that Immich does not answer when the check fails, and plans nothing', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const server = fakeApi()
		const write = useImmichWrite(server.api, () => FAMILY, NO_DECISIONS)

		const opening = write.open()
		server.candidates[0]!.answer(PENDING)
		await flushPromises()
		server.checks[0]!.fail(new Error('unreachable'))
		await opening

		expect(write.step.value).toEqual({ kind: 'down' })
		expect(write.plan.value).toBeNull()
		expect(error).toHaveBeenCalledWith('Could not check the changes with Immich', { error: new Error('unreachable') })
	})

	// spec: IMMICH-004.25
	it('opens nothing without an opened connection, and opens once while it checks', async () => {
		const server = fakeApi()
		const none = useImmichWrite(server.api, () => null, NO_DECISIONS)
		await none.open()
		expect(none.step.value).toEqual({ kind: 'closed' })
		expect(none.picksAsFavorites.value).toBe(false)

		const write = useImmichWrite(server.api, () => FAMILY, NO_DECISIONS)
		void write.open()
		void write.open()
		expect(server.candidates).toHaveLength(1)
	})

	// spec: IMMICH-004.25
	it('ignores the answer of a closed dialog', async () => {
		const server = fakeApi()
		const write = useImmichWrite(server.api, () => FAMILY, NO_DECISIONS)
		const opening = write.open()
		write.close()
		server.candidates[0]!.answer(PENDING)
		await flushPromises()
		server.checks[0]?.answer([])
		await opening

		expect(write.step.value).toEqual({ kind: 'closed' })
	})

	// spec: IMMICH-004.25, IMMICH-004.3, IMMICH-004.7, IMMICH-004.8
	it('plans the write again on each choice', async () => {
		const { write } = await opened([checked('r1', { sharedAlbum: { name: 'Family', others: 2 } }), checked('r2'), checked('p1'), checked('s1', { rating: 2, updatedAt: '2026-12-01T00:00:00.000Z' })])
		expect(write.plan.value?.conflicts.map(({ kind }) => kind)).toEqual(['shared', 'rating'])

		write.chooseShared('r1', 'skip')
		expect(write.sharedChoices.value).toEqual(new Map([['r1', 'skip']]))
		expect(write.plan.value?.skipped).toEqual(['r1'])

		write.chooseRejectAs('archive')
		expect(write.plan.value?.rejectAs).toBe('archive')
		expect(write.plan.value?.changes.find(({ assetId }) => assetId === 'r2')).toMatchObject({ archived: true })

		write.chooseRating('s1', 'immich')
		expect(write.ratingChoices.value).toEqual(new Map([['s1', 'immich']]))
		expect(write.plan.value?.adopted).toEqual([{ assetId: 's1', rating: 2 }])
		expect(write.plan.value?.changes.find(({ assetId }) => assetId === 's1')).toBeUndefined()
	})

	// spec: IMMICH-004.26
	it('writes the plan with the progress, then shows the tally, and a new open plans again', async () => {
		const { write, writes, candidates } = await opened()

		const writing = write.write()
		expect(write.step.value).toEqual({ kind: 'writing', progress: { done: 0, total: 4 } })
		write.close()
		expect(write.step.value.kind).toBe('writing')
		await flushPromises()
		writes[0]!.answer(writes[0]!.requests.map(({ assetId }) => ({ assetId, state: assetId === 'p1' ? 'failed' : 'written' })))
		await writing

		expect(write.step.value).toEqual({ kind: 'finished', tally: { written: 3, skipped: 0, failed: 1, failedIds: ['p1'] } })
		expect(candidates).toHaveLength(2)
		write.close()
		void write.open()
		expect(candidates).toHaveLength(3)
	})

	// spec: IMMICH-004.26, IMMICH-004.10
	it('logs a failed block and shows its assets as failed', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const server = fakeApi()
		const failing: ImmichWriteApi = { ...server.api, write: () => Promise.reject(new Error('refused')) }
		const write = useImmichWrite(failing, () => FAMILY, NO_DECISIONS)
		const opening = write.open()
		server.candidates[0]!.answer(PENDING)
		await flushPromises()
		server.checks[0]!.answer(PENDING.map(({ assetId }) => checked(assetId)))
		await opening

		await write.write()

		expect(write.step.value).toEqual({ kind: 'finished', tally: { written: 0, skipped: 0, failed: 4, failedIds: ['r1', 'r2', 'p1', 's1'] } })
		expect(error).toHaveBeenCalledWith('Could not write every change to Immich', { error: new Error('refused') })
	})

	// spec: IMMICH-004.25
	it('writes nothing before the plan is ready or without a change', async () => {
		const server = fakeApi()
		const write = useImmichWrite(server.api, () => FAMILY, NO_DECISIONS)
		await write.write()
		expect(write.step.value).toEqual({ kind: 'closed' })

		const { write: empty, writes } = await opened([], [candidate('u1', {})])
		await empty.write()
		expect(empty.step.value).toEqual({ kind: 'ready' })
		expect(writes).toEqual([])
	})

	// spec: IMMICH-004.25
	it('versions a thumbnail by the updatedAt Immich answered', async () => {
		const { write } = await opened([checked('r1', { updatedAt: '2026-12-01T00:00:00.000Z' })])

		expect(write.thumbnailUrl('r1')).toBe('/family/r1/thumbnail?v=2026-12-01T00:00:00.000Z')
		expect(write.thumbnailUrl('unknown')).toBe('/family/unknown/thumbnail?v=')
	})
})
