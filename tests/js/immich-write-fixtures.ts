// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichWriteApi } from '../../src/immich/immich-write.ts'
import type { Decision } from '../../src/logic/decision.ts'
import type { ImmichConnection } from '../../src/logic/immich-connections.ts'
import type { CheckedAsset, WriteCandidate, WriteResult } from '../../src/logic/immich-write-plan.ts'
import type { WriteRequest } from '../../src/logic/immich-write-run.ts'

import { candidate } from './logic/immich-fixtures.ts'

/** No decision made since the candidates were loaded. */
export const NO_DECISIONS = (): ReadonlyMap<string, Decision> => new Map()

export const FAMILY: ImmichConnection = { id: 'family', label: 'Family phones', url: 'http://immich.local', picksAsFavorites: true }
export const PENDING = [candidate('r1', { flag: 'rejected' }), candidate('r2', { flag: 'rejected', rating: 3 }), candidate('p1', { flag: 'picked' }), candidate('s1', { rating: 4 }), candidate('u1', {})]

/** A fake server whose requests wait until the test answers them. */
export function fakeApi() {
	const candidates: { answer: (rows: WriteCandidate[]) => void, fail: (error: Error) => void }[] = []
	const checks: { assetIds: readonly string[], answer: (rows: CheckedAsset[]) => void, fail: (error: Error) => void }[] = []
	const writes: { requests: readonly WriteRequest[], answer: (rows: WriteResult[]) => void }[] = []
	const api: ImmichWriteApi = {
		candidates: () => new Promise((answer, fail) => candidates.push({ answer, fail })),
		check: (_id, assetIds) => new Promise((answer, fail) => checks.push({ assetIds, answer, fail })),
		write: (_id, requests) => new Promise((answer) => writes.push({ requests, answer })),
		imageUrl: (id, assetId, size, version) => `/${id}/${assetId}/${size}?v=${version}`,
	}
	return { api, candidates, checks, writes }
}
