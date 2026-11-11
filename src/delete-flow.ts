// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ref } from 'vue'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision } from './logic/decision.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { TrashBatch, TrashReport, TrashRequestFile, TrashResponseFile } from './logic/trash-report.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref, shallowRef, toRaw } from 'vue'
import { TrashBinOffError } from './api.ts'
import { logger } from './logger.ts'
import { rejectedPictures } from './logic/delete-summary.ts'
import { rawBatch, rawRemoval } from './logic/raw-removal.ts'
import { followReplaced, retryBatch, trashReport, trashRequest, wholePictures } from './logic/trash-report.ts'
import { deletedText, removedRawsText } from './trash-text.ts'

type Pictures = readonly Picture<ListingEntry>[]

/** The open step of a delete: the reject review, the delete summary, the *Remove RAWs* summary of a view or the report of failed files. */
export type DeleteDialog
	= | { readonly kind: 'review' }
		| { readonly kind: 'summary', readonly pictures: Pictures, readonly fromReview: boolean }
		| { readonly kind: 'raws', readonly pictures: Pictures }
		| { readonly kind: 'report', readonly report: TrashReport }

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
	readonly trash: (pictures: readonly (readonly TrashRequestFile[])[]) => Promise<TrashResponseFile[][]>
	/** Takes the files out of the listing; returns what each affected picture became. */
	readonly removeFiles: (fileIds: ReadonlySet<number>) => ReadonlyMap<Picture<ListingEntry>, Picture<ListingEntry> | null>
	readonly loupe: Ref<LoupeSnapshot | null>
	readonly toast: (message: string, action?: ToastAction | null) => void
}

/** Reject review, delete summary, *Remove RAWs* and delete report (`docs/plan.md` Culling workflow, Keep RAW and Remove RAWs, Q11). */
export function useDeleteFlow(context: DeleteFlowContext) {
	const dialog = shallowRef<DeleteDialog | null>(null)
	const busy = ref(false)
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

	/** Sends the batch, takes the trashed files out of the listing and the loupe, and reports. */
	async function send(batch: TrashBatch, done: (report: TrashReport) => string) {
		busy.value = true
		try {
			const report = trashReport(batch, await context.trash(trashRequest(batch)))
			const replaced = context.removeFiles(new Set(report.trashed.map((file) => file.entry.fileId)))
			const loupe = toRaw(context.loupe.value)
			context.loupe.value = loupe === null ? null : followReplaced(loupe.pictures, loupe.index, replaced)
			dialog.value = report.failed.length > 0 ? { kind: 'report', report } : null
			context.toast(done(report))
		} catch (error) {
			logger.error('Could not move the files to the trash bin', { error })
			dialog.value = null
			context.toast(error instanceof TrashBinOffError
				? t('honeycomb', 'The Nextcloud trash bin is off, so nothing was deleted. honeycomb deletes only into the trash bin.')
				: t('honeycomb', 'Could not delete the photos; reload the folder to see what changed.'))
		} finally {
			busy.value = false
		}
	}

	/** Moves every file of the summary's pictures, or the RAWs *Remove RAWs* takes, to the trash bin. */
	function confirm() {
		if (busy.value) {
			return Promise.resolve()
		}
		if (dialog.value?.kind === 'summary') {
			return send(wholePictures(dialog.value.pictures), (report) => deletedText(report, false))
		}
		return removal.value === null ? Promise.resolve() : send(rawBatch(removal.value.removed), removedRawsText)
	}

	/** Sends the failed and skipped files of the report again. */
	function retry() {
		const open = dialog.value
		return open?.kind === 'report' && !busy.value ? send(retryBatch(open.report), (report) => deletedText(report, true)) : Promise.resolve()
	}

	/** Says the loupe left nothing undecided, and offers the reject review. */
	function allDecided() {
		context.toast(t('honeycomb', 'All photos decided'), rejected.value.length > 0 ? { label: t('honeycomb', 'Review rejects'), run: review } : null)
	}

	return {
		dialog,
		busy,
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
		close: () => {
			dialog.value = null
		},
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
