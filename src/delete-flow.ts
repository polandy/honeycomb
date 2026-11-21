// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ref } from 'vue'
import type { FreshCheckResult } from './fresh-check.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision } from './logic/decision.ts'
import type { DecisionFlow, SkippedPicture } from './logic/fresh-check.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { ChunkLimits, SendProgress } from './logic/request-chunks.ts'
import type { TrashBatch, TrashExpectation, TrashReport, TrashRequestFile, TrashResponseFile, UnkeptFile } from './logic/trash-report.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref, shallowRef, toRaw } from 'vue'
import { TrashBinOffError } from './api.ts'
import { logger } from './logger.ts'
import { rejectedPictures } from './logic/delete-summary.ts'
import { rawBatch, rawRemoval } from './logic/raw-removal.ts'
import { sendInChunks } from './logic/request-chunks.ts'
import { decisionChanges, followReplaced, mergeReports, permanentBatch, retryBatch, trashReport, trashRequest, unkeptFiles, wholePictures } from './logic/trash-report.ts'
import { reloadAction } from './reload-action.ts'
import { deletedPermanentlyText, deletedText, deleteFailedText, removedRawsText, skippedText } from './trash-text.ts'

type Pictures = readonly Picture<ListingEntry>[]

/** The state the server checks each flow's pictures against (ADR 0040). */
const EXPECTATIONS: Readonly<Record<DecisionFlow, TrashExpectation>> = { rejects: 'rejected', raws: 'rawRemovable' }

/** The fresh pictures a delete by decision may send, and those it skips. */
export type FreshCheck = FreshCheckResult

/** What a delete sends, once the waiting sidecars are written, the pictures it skipped and the state the server checks them against. */
type Plan = () => Promise<{ readonly batch: TrashBatch, readonly skipped: readonly SkippedPicture[], readonly expect: TrashExpectation | null }>

/** The toast's words for what a delete did. */
type Done = (report: TrashReport) => string

/** The open step of a delete: the reject review, the delete summary, the *Remove RAWs* summary of a view, the warning before deleting for good or the report of failed and skipped files. */
export type DeleteDialog
	= | { readonly kind: 'review' }
		| { readonly kind: 'summary', readonly pictures: Pictures, readonly fromReview: boolean }
		| { readonly kind: 'raws', readonly pictures: Pictures }
		| { readonly kind: 'permanent', readonly files: readonly UnkeptFile[], readonly report: TrashReport, readonly skipped: readonly SkippedPicture[], readonly done: Done, readonly expect: TrashExpectation | null }
		| { readonly kind: 'report', readonly report: TrashReport, readonly skipped: readonly SkippedPicture[], readonly expect: TrashExpectation | null }

/** The loupe's snapshot of pictures and the shown one. */
export interface LoupeSnapshot {
	readonly pictures: Pictures
	readonly index: number
}

/** What a delete reads and changes in the cull. */
export interface DeleteFlowContext {
	readonly pictures: () => Pictures
	/** The grid's pictures under the filters, which *Remove RAWs* acts on. */
	readonly view: () => Pictures
	readonly decisionOf: (picture: Picture<ListingEntry>) => Decision
	readonly decide: (intent: DecisionIntent, chosen: Pictures) => void
	/** Writes the waiting sidecars and waits for every write in flight (XMP-003.30). */
	readonly flush: () => Promise<void>
	/** The picture with its sidecars as honeycomb last saved them since the listing (DELETE-002.17). */
	readonly current: (picture: Picture<ListingEntry>) => Picture<ListingEntry>
	/** Lists the pictures afresh and keeps those whose members are unchanged (ADR 0032, ADR 0040). */
	readonly check: (pictures: Pictures, flow: DecisionFlow) => Promise<FreshCheck>
	/** Sends one chunk; the server deletes a picture only while its rows say `expect`. */
	readonly trash: (pictures: readonly (readonly TrashRequestFile[])[], expect: TrashExpectation | null) => Promise<TrashResponseFile[][]>
	/** Takes the files out of the listing; returns what each affected picture became. */
	readonly removeFiles: (fileIds: ReadonlySet<number>) => ReadonlyMap<Picture<ListingEntry>, Picture<ListingEntry> | null>
	readonly loupe: Ref<LoupeSnapshot | null>
	readonly toast: (message: string, action?: ToastAction | null) => void
	/** Says a failure and keeps it until the user closes it. */
	readonly error: (message: string, action?: ToastAction | null) => void
	/** Lists the open folder set again; the failure messages offer it. */
	readonly reload?: () => void
	/** Overrides the request size of ADR 0029, for tests. */
	readonly chunks?: ChunkLimits | undefined
	/** Hears what each request round took out, with the state the server checked (STATS-001.20). */
	readonly onDeleted?: ((report: TrashReport, expect: TrashExpectation | null) => void) | undefined
}

/** Reject review, delete summary, *Remove RAWs* and delete report (`docs/dev/plan.md` Culling workflow, Keep RAW and Remove RAWs, Q11). */
export function useDeleteFlow(context: DeleteFlowContext) {
	const dialog = shallowRef<DeleteDialog | null>(null)
	const busy = ref(false)
	const progress = shallowRef<SendProgress | null>(null)
	const rejected = computed(() => rejectedPictures(context.pictures(), context.decisionOf))
	const removable = computed(() => rawRemoval(context.view(), context.decisionOf).removed.length)
	const removal = computed(() => (dialog.value?.kind === 'raws' ? rawRemoval(dialog.value.pictures, context.decisionOf) : null))

	/** Opens the reject review, closing the loupe first; says so when nothing is rejected. */
	function review() {
		context.loupe.value = null
		if (rejected.value.length === 0) {
			context.toast(t('honeycomb', 'No rejected photos'))
		} else {
			dialog.value = { kind: 'review' }
		}
	}

	/** Opens the delete summary of the pictures, if any. */
	function summarise(pictures: Pictures, fromReview = false) {
		if (pictures.length > 0) {
			dialog.value = { kind: 'summary', pictures, fromReview }
		}
	}

	/** Opens the delete summary of the loupe's photo, else of the chosen pictures, else of the focused tile. */
	function summariseShown(chosen: Pictures, focused: () => number) {
		const open = context.loupe.value
		const shown = open === null ? context.view()[focused()] : toRaw(open.pictures[open.index])
		summarise(open === null && chosen.length > 0 ? chosen : [shown].filter((each) => each !== undefined))
	}

	/** Opens the *Remove RAWs* summary of the view, which keeps its pictures while Keep RAW changes. */
	function removeRaws() {
		dialog.value = { kind: 'raws', pictures: context.view() }
	}

	/** Toggles Keep RAW on a picture of the *Remove RAWs* summary, as an ordinary decision with its undo. */
	function toggleKeepRaw(picture: Picture<ListingEntry>) {
		context.decide({ kind: 'keepRaw' }, [picture])
	}

	/** Makes a rejected picture undecided again, as an ordinary decision with its undo. */
	function rescue(picture: Picture<ListingEntry>) {
		context.decide({ kind: 'flag', flag: 'unflagged' }, [picture])
	}

	/** The batch as it stands, with the pictures skipped and the state the server checks. */
	function planned(batch: TrashBatch, expect: TrashExpectation | null, skipped: readonly SkippedPicture[] = []): Plan {
		return async () => ({ batch, skipped, expect })
	}

	/** The batch of the pictures that pass the fresh check of the flow and those skipped; the server checks the flow's state. */
	function checked(pictures: Pictures, flow: DecisionFlow, toBatch: (passed: Pictures) => TrashBatch): Plan {
		return async () => {
			const { passed, skipped } = await context.check(pictures, flow)
			return { batch: toBatch(passed), skipped, expect: EXPECTATIONS[flow] }
		}
	}

	/** The report without the pictures the server kept because their rows changed, and the skipped pictures with them. */
	function withChanges(answered: TrashReport, skipped: readonly SkippedPicture[], expect: TrashExpectation | null) {
		const { report, changed } = decisionChanges(answered)
		const reason = expect === 'rawRemovable' ? 'notRemovable' : 'notRejected'
		return { report, skipped: [...skipped, ...changed.map((picture) => ({ picture, reason }) as const)] }
	}

	/** Takes the files that went out of the listing and the loupe. */
	function takeOut(report: TrashReport) {
		const replaced = context.removeFiles(new Set([...report.trashed, ...report.deleted].map((file) => file.entry.fileId)))
		const loupe = toRaw(context.loupe.value)
		context.loupe.value = loupe === null ? null : followReplaced(loupe.pictures, loupe.index, replaced)
	}

	/** Opens the report when files failed or pictures were skipped, and toasts what the delete did. */
	function finish(report: TrashReport, skipped: readonly SkippedPicture[], done: Done, sentAny: boolean, expect: TrashExpectation | null) {
		dialog.value = report.failed.length > 0 || skipped.length > 0 ? { kind: 'report', report, skipped, expect } : null
		context.toast([
			...(sentAny ? [done(report)] : []),
			...(report.deleted.length > 0 ? [deletedPermanentlyText(report.deleted.length)] : []),
			...(skipped.length > 0 ? [skippedText(skipped.length)] : []),
		].join(' · '), skipped.length > 0 ? reloadAction(context.reload) : null)
	}

	/**
	 * Writes the waiting sidecars, plans the batch, sends it in chunks with the state the server checks, takes the files that went out of
	 * the listing and the loupe, and warns about the files the trash bin would not keep or reports; counts from the planned batch. The
	 * resend after the warning passes the first report: its unkept files go marked permanent and nothing warns again (ADR 0036).
	 */
	async function send(plan: Plan, done: Done, first: TrashReport | null = null) {
		busy.value = true
		try {
			await context.flush()
			const plannedSend = await plan()
			const { batch, expect } = plannedSend
			const permanent = new Set(first === null ? [] : unkeptFiles(first).map(({ file }) => file.entry.fileId))
			const onProgress = (count: number) => (progress.value = { done: count, total: batch.length })
			const sent = batch.length === 0 ? { answers: [], failure: null } : await sendInChunks(trashRequest(batch, permanent), (pictures) => context.trash(pictures, expect), onProgress, context.chunks)
			if (sent.failure !== null && sent.answers.length === 0) {
				throw sent.failure.error
			}
			if (sent.failure !== null) {
				logger.error('Stopped the delete after a failed request', { error: sent.failure.error })
			}
			const { report: answered, skipped } = withChanges(trashReport(batch, sent.answers), plannedSend.skipped, expect)
			takeOut(answered)
			context.onDeleted?.(answered, expect)
			const report = first === null ? answered : mergeReports(first, answered)
			const unkept = first === null ? unkeptFiles(report) : []
			if (unkept.length > 0) {
				dialog.value = { kind: 'permanent', files: unkept, report, skipped, done, expect }
			} else {
				finish(report, skipped, done, batch.length > 0, expect)
			}
		} catch (error) {
			logger.error('Could not move the files to the trash bin', { error })
			dialog.value = null
			context.error(deleteFailedText(error), error instanceof TrashBinOffError ? null : reloadAction(context.reload))
		} finally {
			busy.value = false
			progress.value = null
		}
	}

	/** Moves every file of the summary's pictures, or the RAWs *Remove RAWs* takes, to the trash bin; a delete by decision checks them afresh first. After the warning, deletes its files for good. */
	function confirm() {
		if (busy.value) {
			return Promise.resolve()
		}
		const open = dialog.value
		if (open?.kind === 'permanent') {
			return send(planned(permanentBatch(open.report), open.expect, open.skipped), open.done, open.report)
		}
		if (open?.kind === 'summary') {
			const plan = open.fromReview ? checked(open.pictures, 'rejects', wholePictures) : async () => ({ batch: wholePictures(open.pictures.map(context.current)), skipped: [], expect: null })
			return send(plan, (report) => deletedText(report, false))
		}
		const removed = removal.value?.removed
		return removed === undefined ? Promise.resolve() : send(checked(removed, 'raws', rawBatch), removedRawsText)
	}

	/** Sends the failed and skipped files of the report again. */
	function retry() {
		const open = dialog.value
		if (open?.kind !== 'report' || open.report.failed.length === 0 || busy.value) {
			return Promise.resolve()
		}
		return send(planned(retryBatch(open.report), open.expect), (report) => deletedText(report, true))
	}

	/** Closes the open step; the warning before deleting for good goes on to the report and the toast, nothing more sent. */
	function close() {
		const open = dialog.value
		if (open?.kind === 'permanent') {
			finish(open.report, open.skipped, open.done, true, open.expect)
		} else {
			dialog.value = null
		}
	}

	/** Says the loupe left nothing undecided, and offers the reject review. */
	function allDecided() {
		context.toast(t('honeycomb', 'All photos decided'), rejected.value.length > 0 ? { label: t('honeycomb', 'Review rejects'), run: review } : null)
	}

	return {
		dialog,
		busy,
		progress,
		rejected,
		rawRemovable: removable,
		rawRemoval: removal,
		review,
		summarise,
		summariseShown,
		continueToSummary: () => summarise(rejected.value, true),
		backToReview: () => {
			dialog.value = { kind: 'review' }
		},
		close,
		removeRaws,
		toggleKeepRaw,
		rescue,
		confirm,
		retry,
		allDecided,
	}
}

/** The delete flow a screen opens and its dialogs show. */
export type DeleteFlow = ReturnType<typeof useDeleteFlow>
