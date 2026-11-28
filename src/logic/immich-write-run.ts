// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AssetChange, CheckedAsset, WriteCandidate, WritePlan, WriteResult } from './immich-write-plan.ts'
import type { SendProgress } from './request-chunks.ts'

import { isPending, WRITE_BLOCK } from './immich-write-plan.ts'
import { sendInChunks } from './request-chunks.ts'

/** One asset's change as `write` takes it, with the rating Immich holds afterwards (IMMICH-004.19). */
export interface WriteRequest extends AssetChange {
	readonly immichRating: number | null
}

/** The write's result per asset and the error of the request that stopped it, if any. */
export interface WriteRun {
	readonly results: WriteResult[]
	readonly failure: { readonly error: unknown } | null
}

/** One asset per request item, so the chunks are blocks of `WRITE_BLOCK` assets. */
const BLOCK_LIMITS = { pictures: WRITE_BLOCK, files: WRITE_BLOCK }

/** Immich's state of the pending candidates, checked block by block; a failed block throws its error (IMMICH-004.23). */
export async function checkPending(
	candidates: readonly WriteCandidate[],
	check: (assetIds: readonly string[]) => Promise<CheckedAsset[]>,
	progress: (step: SendProgress) => void,
): Promise<Map<string, CheckedAsset>> {
	const pending = candidates.filter(isPending).map(({ assetId }) => [assetId])
	const { answers, failure } = await sendInChunks(
		pending,
		async (block) => [await check(block.flat())],
		(done) => progress({ done, total: pending.length }),
		BLOCK_LIMITS,
	)
	if (failure !== null) {
		throw failure.error
	}
	return new Map(answers.flat().map((asset) => [asset.assetId, asset]))
}

/** The plan's changes and done assets as `write` takes them; skipped and gone assets send nothing (IMMICH-004.24). */
export function writeRequests(plan: WritePlan, checks: ReadonlyMap<string, CheckedAsset>): WriteRequest[] {
	const held = (assetId: string) => checks.get(assetId)?.rating || null
	return [
		...plan.changes.map((change) => ({ ...change, immichRating: change.rating === undefined ? held(change.assetId) : change.rating })),
		...plan.done.map((assetId) => ({ assetId, immichRating: held(assetId) })),
	]
}

/** Writes the plan block by block; once a block's request fails, it and the unsent ones fail (IMMICH-004.24). */
export async function runWrite(
	plan: WritePlan,
	checks: ReadonlyMap<string, CheckedAsset>,
	write: (requests: readonly WriteRequest[]) => Promise<WriteResult[]>,
	progress: (step: SendProgress) => void,
): Promise<WriteRun> {
	const requests = writeRequests(plan, checks).map((request) => [request])
	const { answers, unsent, failure } = await sendInChunks(
		requests,
		async (block) => [await write(block.flat())],
		(done) => progress({ done, total: requests.length }),
		BLOCK_LIMITS,
	)
	const results: WriteResult[] = [
		...answers.flat(),
		...unsent.flat().map(({ assetId }): WriteResult => ({ assetId, state: 'failed' })),
		...plan.skipped.map((assetId): WriteResult => ({ assetId, state: 'skipped' })),
	]
	return { results, failure }
}

/** The block a progress step is in and how many there are, for *block 2 of 3* (IMMICH-004.25). */
export function writeBlockOf({ done, total }: SendProgress): { readonly block: number, readonly blocks: number } {
	const blocks = Math.max(1, Math.ceil(total / WRITE_BLOCK))
	return { block: Math.min(blocks, Math.floor(done / WRITE_BLOCK) + 1), blocks }
}
