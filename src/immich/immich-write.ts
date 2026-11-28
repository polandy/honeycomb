// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichImageSize } from '../logic/immich-asset.ts'
import type { ImmichConnection } from '../logic/immich-connections.ts'
import type { CheckedAsset, RatingChoice, RejectAs, SharedChoice, WriteCandidate, WritePlan, WriteResult, WriteTally } from '../logic/immich-write-plan.ts'
import type { WriteRequest } from '../logic/immich-write-run.ts'
import type { SendProgress } from '../logic/request-chunks.ts'

import { computed, shallowRef } from 'vue'
import { planWrite, writeTally } from '../logic/immich-write-plan.ts'
import { checkPending, runWrite } from '../logic/immich-write-run.ts'
import { logger } from '../shared/logger.ts'

/** What *Write to Immich* asks of the server (IMMICH-004). */
export interface ImmichWriteApi {
	candidates: (connectionId: string) => Promise<WriteCandidate[]>
	check: (connectionId: string, assetIds: readonly string[]) => Promise<CheckedAsset[]>
	write: (connectionId: string, requests: readonly WriteRequest[]) => Promise<WriteResult[]>
	imageUrl: (connectionId: string, assetId: string, size: ImmichImageSize, version: string) => string
}

/** Where the dialog is: closed, checking, Immich not answering, ready, writing or showing the result. */
export type WriteStep
	= | { readonly kind: 'closed' }
		| { readonly kind: 'checking', readonly progress: SendProgress | null }
		| { readonly kind: 'down' }
		| { readonly kind: 'ready' }
		| { readonly kind: 'writing', readonly progress: SendProgress }
		| { readonly kind: 'finished', readonly tally: WriteTally }

const CLOSED: WriteStep = { kind: 'closed' }

/** *Write to Immich* on the opened connection: the check, the plan the dialog shows, the write and its result (IMMICH-004.25, .26). */
export function useImmichWrite(api: ImmichWriteApi, connection: () => ImmichConnection | null) {
	const step = shallowRef<WriteStep>(CLOSED)
	const candidates = shallowRef<readonly WriteCandidate[]>([])
	const checks = shallowRef<ReadonlyMap<string, CheckedAsset>>(new Map())
	const rejectAs = shallowRef<RejectAs>('trash')
	const ratingChoices = shallowRef<ReadonlyMap<string, RatingChoice>>(new Map())
	const sharedChoices = shallowRef<ReadonlyMap<string, SharedChoice>>(new Map())
	const picksAsFavorites = computed(() => connection()?.picksAsFavorites ?? false)
	// Each open and close starts a new run, so an answer of a closed dialog changes nothing.
	let run = 0

	const plan = computed<WritePlan | null>(() => step.value.kind === 'ready'
		? planWrite(candidates.value, checks.value, { rejectAs: rejectAs.value, picksAsFavorites: picksAsFavorites.value, canDelete: true }, { rating: ratingChoices.value, shared: sharedChoices.value })
		: null)

	/** Opens the dialog and checks the pending candidates with Immich (IMMICH-004.23). */
	async function open() {
		const id = connection()?.id
		if (id === undefined || step.value.kind === 'checking' || step.value.kind === 'writing') {
			return
		}
		const mine = ++run
		step.value = { kind: 'checking', progress: null }
		ratingChoices.value = new Map()
		sharedChoices.value = new Map()
		try {
			const loaded = await api.candidates(id)
			const answered = await checkPending(loaded, (assetIds) => api.check(id, assetIds), (progress) => mine === run && (step.value = { kind: 'checking', progress }))
			if (mine === run) {
				candidates.value = loaded
				checks.value = answered
				step.value = { kind: 'ready' }
			}
		} catch (error) {
			logger.error('Could not check the changes with Immich', { error })
			if (mine === run) {
				step.value = { kind: 'down' }
			}
		}
	}

	/** Writes the plan block by block and shows the result (IMMICH-004.24, .26). */
	async function write() {
		const id = connection()?.id
		const planned = plan.value
		if (id === undefined || planned === null || planned.counts.assets === 0) {
			return
		}
		const mine = ++run
		step.value = { kind: 'writing', progress: { done: 0, total: planned.changes.length + planned.done.length } }
		const { results, failure } = await runWrite(planned, checks.value, (requests) => api.write(id, requests), (progress) => (step.value = { kind: 'writing', progress }))
		if (failure !== null) {
			logger.error('Could not write every change to Immich', { error: failure.error })
		}
		if (mine === run) {
			step.value = { kind: 'finished', tally: writeTally(results) }
		}
	}

	/** Closes the dialog, unless it is writing. */
	function close() {
		if (step.value.kind !== 'writing') {
			run += 1
			step.value = CLOSED
		}
	}

	/** Chooses what the rejects become (IMMICH-004.3). */
	function chooseRejectAs(choice: RejectAs) {
		rejectAs.value = choice
	}

	/** Resolves a rating changed in Immich (IMMICH-004.7). */
	function chooseRating(assetId: string, choice: RatingChoice) {
		ratingChoices.value = new Map([...ratingChoices.value, [assetId, choice]])
	}

	/** Resolves a reject in a shared album (IMMICH-004.8). */
	function chooseShared(assetId: string, choice: SharedChoice) {
		sharedChoices.value = new Map([...sharedChoices.value, [assetId, choice]])
	}

	/** The thumbnail of a checked asset, versioned by Immich's `updatedAt`. */
	function thumbnailUrl(assetId: string): string {
		return api.imageUrl(connection()?.id ?? '', assetId, 'thumbnail', checks.value.get(assetId)?.updatedAt ?? '')
	}

	return { step, plan, picksAsFavorites, ratingChoices, sharedChoices, open, write, close, chooseRejectAs, chooseRating, chooseShared, thumbnailUrl }
}

/** The *Write to Immich* state the dialog shows. */
export type ImmichWrite = ReturnType<typeof useImmichWrite>
