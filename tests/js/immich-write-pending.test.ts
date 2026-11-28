// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../src/logic/decision.ts'
import type { ImmichConnection } from '../../src/logic/immich-connections.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { useImmichWrite } from '../../src/immich/immich-write.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { logger } from '../../src/shared/logger.ts'
import { fakeApi, FAMILY, PENDING } from './immich-write-fixtures.ts'
import { candidate, checked } from './logic/immich-fixtures.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

const TRAVEL: ImmichConnection = { ...FAMILY, id: 'travel' }

/** A write on a connection that can be switched, with the decisions the cull made since. */
function pendingOn(api = fakeApi()) {
	const connection = shallowRef<ImmichConnection | null>(FAMILY)
	const decided = shallowRef<ReadonlyMap<string, Decision>>(new Map())
	const write = useImmichWrite(api.api, () => connection.value, () => decided.value)
	return { ...api, connection, decided, write }
}

describe('useImmichWrite pending count', () => {
	// spec: IMMICH-004.27
	it('counts the pending candidates once loaded, and each decision made since, also after the cull let go of it', async () => {
		const { write, candidates, decided } = pendingOn()
		expect(write.pending.value).toBeNull()

		const refreshing = write.refreshPending()
		candidates[0]!.answer(PENDING)
		await refreshing
		expect(write.pending.value).toBe(4)

		decided.value = new Map([['u1', { ...UNDECIDED, flag: 'rejected' }], ['r1', UNDECIDED]])
		expect(write.pending.value).toBe(4)
		decided.value = new Map([['n1', { ...UNDECIDED, rating: 5 }]])
		expect(write.pending.value).toBe(5)
		decided.value = new Map()
		expect(write.pending.value).toBe(5)
	})

	// spec: IMMICH-004.27
	it('shows no number when the candidates cannot be loaded, and logs why', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { write, candidates } = pendingOn()
		const first = write.refreshPending()
		candidates[0]!.answer(PENDING)
		await first

		const second = write.refreshPending()
		candidates[1]!.fail(new Error('offline'))
		await second

		expect(write.pending.value).toBeNull()
		expect(error).toHaveBeenCalledWith('Could not count the changes not written to Immich', { error: new Error('offline') })
	})

	// spec: IMMICH-004.27
	it('starts over on another connection and ignores the late answer of the one before', async () => {
		const { write, candidates, connection, decided } = pendingOn()
		const late = write.refreshPending()
		decided.value = new Map([['f1', { ...UNDECIDED, flag: 'picked' }]])
		connection.value = TRAVEL
		const current = write.refreshPending()
		expect(write.pending.value).toBeNull()

		candidates[1]!.answer([candidate('t1', { flag: 'rejected' })])
		await current
		candidates[0]!.answer(PENDING)
		await late
		expect(write.pending.value).toBe(1)

		connection.value = null
		await write.refreshPending()
		expect(write.pending.value).toBeNull()
		expect(candidates).toHaveLength(2)
	})

	// spec: IMMICH-004.27
	it('counts again from the candidates the dialog loads and after a write', async () => {
		const { write, candidates, checks, writes } = pendingOn()
		const opening = write.open()
		candidates[0]!.answer(PENDING)
		await flushPromises()
		expect(write.pending.value).toBe(4)
		checks[0]!.answer(PENDING.map(({ assetId }) => checked(assetId)))
		await opening

		const writing = write.write()
		await flushPromises()
		writes[0]!.answer(writes[0]!.requests.map(({ assetId }) => ({ assetId, state: 'written' })))
		await writing
		expect(candidates).toHaveLength(2)
		candidates[1]!.answer([candidate('r1', { flag: 'rejected' }, { flag: 'rejected', rating: 0, immichRating: null })])
		await flushPromises()
		expect(write.pending.value).toBe(0)
	})
})
