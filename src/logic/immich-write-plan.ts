// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, Flag } from './decision.ts'

import { packRequests } from './request-chunks.ts'

/** How many assets one `write/check` or `write` request carries at most (IMMICH-004.5). */
export const WRITE_BLOCK = 100

/** What a reject becomes in Immich: its trash bin, its archive or the rating “rejected” only. */
export type RejectAs = 'trash' | 'archive' | 'rating'

/** How a rating changed in Immich since the decision is resolved. */
export type RatingChoice = 'honeycomb' | 'immich'

/** How a reject in a shared album is written: *Trash anyway*, *Archive instead* or *Skip*. */
export type SharedChoice = 'trash' | 'archive' | 'skip'

/** What honeycomb last wrote to Immich for an asset: its flag and rating, and the rating Immich got. */
export interface WrittenState {
	readonly flag: Flag
	readonly rating: number
	readonly immichRating: number | null
}

/** An asset's decision, what was last written for it and Immich's `updatedAt` when it was decided. */
export interface WriteCandidate {
	readonly assetId: string
	readonly decision: Decision
	readonly written: WrittenState | null
	readonly decidedUpdatedAt: string
}

/** A shared album an asset is in, with how many other people it is shared with. */
export interface SharedAlbum {
	readonly name: string
	readonly others: number
}

/** An asset as the check reloads it from Immich; a rating of `null` is none. */
export interface CheckedAsset {
	readonly assetId: string
	readonly updatedAt: string
	readonly rating: number | null
	readonly favorite: boolean
	readonly trashed: boolean
	readonly archived: boolean
	readonly sharedAlbum: SharedAlbum | null
	readonly stackSize: number | null
}

/** The dialog's reject choice and what the connection and its key allow. */
export interface WriteOptions {
	readonly rejectAs: RejectAs
	readonly picksAsFavorites: boolean
	readonly canDelete: boolean
}

/** The user's answers to the conflicts, per asset id; an asset without one takes the first option. */
export interface WriteChoices {
	readonly rating: ReadonlyMap<string, RatingChoice>
	readonly shared: ReadonlyMap<string, SharedChoice>
}

/** What the dialog lists before writing (IMMICH-004.7, .8, .9 and the stack top). */
export type WriteConflict
	= | { readonly kind: 'rating', readonly assetId: string, readonly immichRating: number | null, readonly honeycombRating: number }
		| { readonly kind: 'shared', readonly assetId: string, readonly album: SharedAlbum }
		| { readonly kind: 'trashed', readonly assetId: string }
		| { readonly kind: 'stack', readonly assetId: string, readonly stackSize: number }

/** The fields one asset's write sets in Immich; `restore` takes it out of the trash bin. */
export interface AssetChange {
	readonly assetId: string
	readonly trash?: true
	readonly restore?: true
	readonly archived?: boolean
	readonly favorite?: boolean
	readonly rating?: number | null
}

/** The dialog's counts per kind of change (IMMICH-004.6). */
export interface WriteCounts {
	readonly assets: number
	readonly rejects: number
	readonly restores: number
	readonly picks: number
	readonly ratings: number
}

/** What a write sends, what it leaves and what the dialog shows. */
export interface WritePlan {
	readonly rejectAs: RejectAs
	readonly counts: WriteCounts
	readonly conflicts: WriteConflict[]
	readonly changes: AssetChange[]
	/** Already as decided in Immich: nothing is sent, the asset counts as written. */
	readonly done: string[]
	/** Skipped as the user chose. */
	readonly skipped: string[]
	/** Not answered by the check, so nothing is sent. */
	readonly gone: string[]
	/** Ratings kept from Immich, as honeycomb saves them. */
	readonly adopted: { readonly assetId: string, readonly rating: number }[]
}

/** How one asset's write ended. */
export interface WriteResult {
	readonly assetId: string
	readonly state: 'written' | 'skipped' | 'failed'
}

/** The counts of a write's results and the failed assets, offered again next time (IMMICH-004.10). */
export interface WriteTally {
	readonly written: number
	readonly skipped: number
	readonly failed: number
	readonly failedIds: string[]
}

const REJECTED_RATING = -1

/** What a new reject became: its choice, the rating −1, or done as already in the trash bin. */
type RejectOutcome = SharedChoice | 'rating' | 'done'

/** How a checked asset was planned: its reject and whether its rating is sent as a rating. */
interface AssetOutcome {
	readonly reject: RejectOutcome | null
	readonly rated: boolean
}

/** Whether the asset's flag or rating differs from what was last written; colour label and *Keep RAW* are never written. */
export function isPending({ decision, written }: WriteCandidate): boolean {
	if (written === null) {
		return decision.flag !== 'unflagged' || decision.rating > 0
	}
	return decision.flag !== written.flag || decision.rating !== written.rating
}

/** The write of the pending candidates against Immich's answer to the check (IMMICH-004). */
export function planWrite(candidates: readonly WriteCandidate[], checks: ReadonlyMap<string, CheckedAsset>, options: WriteOptions, choices: WriteChoices): WritePlan {
	const rejectAs: RejectAs = options.rejectAs === 'trash' && !options.canDelete ? 'archive' : options.rejectAs
	const plan: WritePlan = { rejectAs, counts: { assets: 0, rejects: 0, restores: 0, picks: 0, ratings: 0 }, conflicts: [], changes: [], done: [], skipped: [], gone: [], adopted: [] }
	const counts = { ...plan.counts }
	for (const candidate of candidates.filter(isPending)) {
		const asset = checks.get(candidate.assetId)
		if (asset === undefined) {
			plan.gone.push(candidate.assetId)
		}
		countChange(counts, candidate, asset === undefined ? null : planAsset(plan, candidate, asset, rejectAs, options, choices))
	}
	return { ...plan, counts }
}

/** The items cut, in order, into requests of at most `WRITE_BLOCK`. */
export function writeBlocks<T>(items: readonly T[]): T[][] {
	return packRequests(items, () => 0, { items: WRITE_BLOCK, bytes: 0 })
}

/** The counts of the write's results and the ids of the failed assets. */
export function writeTally(results: readonly WriteResult[]): WriteTally {
	const of = (state: WriteResult['state']) => results.filter((result) => result.state === state)
	return { written: of('written').length, skipped: of('skipped').length, failed: of('failed').length, failedIds: of('failed').map(({ assetId }) => assetId) }
}

/** Whether the candidate is rejected and was not written as a reject. */
function isNewReject({ decision, written }: WriteCandidate): boolean {
	return decision.flag === 'rejected' && written?.flag !== 'rejected'
}

/** Whether the candidate was written as a reject and is no longer one. */
function isTakenBack({ decision, written }: WriteCandidate): boolean {
	return decision.flag !== 'rejected' && written?.flag === 'rejected'
}

/** Adds what the candidate sends to the dialog's counts; unchecked, its decision says what it would send. */
function countChange(counts: { -readonly [K in keyof WriteCounts]: number }, candidate: WriteCandidate, outcome: AssetOutcome | null): void {
	const { decision, written } = candidate
	if (outcome?.reject === 'skip') {
		return
	}
	counts.assets++
	if (isNewReject(candidate) && outcome?.reject !== 'done') {
		counts.rejects++
	}
	if (isTakenBack(candidate)) {
		counts.restores++
	}
	if (decision.flag === 'picked' && written?.flag !== 'picked') {
		counts.picks++
	}
	if (outcome === null ? decision.rating !== (written?.rating ?? 0) : outcome.rated) {
		counts.ratings++
	}
}

/** Puts the checked asset's change, or why none is sent, into the plan, and says what it became. */
function planAsset(plan: WritePlan, candidate: WriteCandidate, asset: CheckedAsset, rejectAs: RejectAs, options: WriteOptions, choices: WriteChoices): AssetOutcome {
	const { assetId } = candidate
	const reject = isNewReject(candidate) ? rejectChoice(plan, asset, rejectAs, choices) : null
	if (reject === 'skip') {
		plan.skipped.push(assetId)
		return { reject, rated: false }
	}
	if ((reject === 'trash' || reject === 'archive') && asset.stackSize !== null) {
		plan.conflicts.push({ kind: 'stack', assetId, stackSize: asset.stackSize })
	}
	const change: AssetChange = reject === 'trash' ? { assetId, trash: true } : { assetId, ...fieldChanges(plan, candidate, asset, reject, options, choices) }
	if (Object.keys(change).length > 1) {
		plan.changes.push(change)
	} else {
		plan.done.push(assetId)
	}
	return { reject, rated: change.rating !== undefined && reject !== 'rating' }
}

/** What a new reject becomes, after Immich's trash bin and a shared album. */
function rejectChoice(plan: WritePlan, asset: CheckedAsset, rejectAs: RejectAs, choices: WriteChoices): RejectOutcome {
	if (asset.trashed) {
		plan.conflicts.push({ kind: 'trashed', assetId: asset.assetId })
		return 'done'
	}
	if (rejectAs !== 'trash' || asset.sharedAlbum === null) {
		return rejectAs
	}
	plan.conflicts.push({ kind: 'shared', assetId: asset.assetId, album: asset.sharedAlbum })
	return choices.shared.get(asset.assetId) ?? 'trash'
}

/** The archive, favourite and rating fields that differ from Immich. */
function fieldChanges(plan: WritePlan, candidate: WriteCandidate, asset: CheckedAsset, reject: RejectOutcome | null, options: WriteOptions, choices: WriteChoices): Omit<AssetChange, 'assetId'> {
	if (reject === 'done') {
		return {}
	}
	const { decision, written } = candidate
	const takenBack = isTakenBack(candidate)
	const fields: { -readonly [K in keyof AssetChange]?: AssetChange[K] } = {}
	if (takenBack && asset.trashed) {
		fields.restore = true
	}
	if (reject === 'archive' && !asset.archived) {
		fields.archived = true
	}
	if (takenBack && asset.archived) {
		fields.archived = false
	}
	if (options.picksAsFavorites && decision.flag === 'picked' && !asset.favorite) {
		fields.favorite = true
	}
	if (options.picksAsFavorites && decision.flag !== 'picked' && written?.flag === 'picked' && asset.favorite) {
		fields.favorite = false
	}
	const rating = reject === 'rating' ? REJECTED_RATING : decision.rating || null
	if (ratingKept(plan, candidate, asset, choices)) {
		return fields
	}
	if (rating !== asset.rating) {
		fields.rating = rating
	}
	return fields
}

/** Whether Immich's changed rating is kept, after naming the conflict. */
function ratingKept(plan: WritePlan, { assetId, decision, written, decidedUpdatedAt }: WriteCandidate, asset: CheckedAsset, choices: WriteChoices): boolean {
	const changedInImmich = asset.updatedAt !== decidedUpdatedAt && asset.rating !== (written?.immichRating ?? null) && asset.rating !== (decision.rating || null)
	if (!changedInImmich) {
		return false
	}
	plan.conflicts.push({ kind: 'rating', assetId, immichRating: asset.rating, honeycombRating: decision.rating })
	if (choices.rating.get(assetId) !== 'immich') {
		return false
	}
	plan.adopted.push({ assetId, rating: Math.max(asset.rating ?? 0, 0) })
	return true
}
