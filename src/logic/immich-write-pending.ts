// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { WriteCandidate } from './immich-write-plan.ts'

import { isPending } from './immich-write-plan.ts'

/** How many assets are pending: the candidates with the decisions made since they were loaded, by asset id (IMMICH-004.27). */
export function pendingCount(candidates: readonly WriteCandidate[], decidedSince: ReadonlyMap<string, Decision>): number {
	const loaded = new Map(candidates.map((candidate) => [candidate.assetId, candidate]))
	const decisions = new Map([...candidates.map(({ assetId, decision }): [string, Decision] => [assetId, decision]), ...decidedSince])
	return [...decisions].filter(([assetId, decision]) => isPending({ assetId, decision, written: loaded.get(assetId)?.written ?? null, decidedUpdatedAt: '' })).length
}
