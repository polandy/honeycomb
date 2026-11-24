import type { DecisionIntent } from '../logic/decision-change.ts'
import type { ListingEntry, SourceEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { SelectionEdit } from '../logic/series-menu.ts'
import type { ReductionPlan } from '../logic/series-reduction.ts'
import type { Series } from '../logic/series.ts'
import type { SeriesStatus } from '../logic/stored-series.ts'
import type { TagChange } from '../logic/tag.ts'
import type { DescribedStep } from '../logic/undo.ts'
import type { LockedPicture } from '../logic/writability.ts'
import type { ToastAction } from '../shared/toast.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullStep } from './cull.ts'

import { t } from '@nextcloud/l10n'
import { TOAST_MS } from '../shared/toast.ts'
import { changeText, redoneText, undoneText } from './decision-text.ts'
import { lockDetails, lockedText, partialText } from './lock-text.ts'

/** How long the toast with the first-reject hint stays: longer than TOAST_MS, as it carries a second sentence. */
export const REJECT_HINT_MS = 2 * TOAST_MS

/** Whether the user was told that rejected photos are hidden, and the way to record it (LOUPE-003.9). */
export interface RejectHint {
	seen: () => boolean
	dismiss: () => void
}

/** The hint of the first reject. */
const REJECT_HINT_TEXT = () => t('honeycomb', 'Rejected photos are hidden; show them with the Rejected chip.')

/** Whether a step rejected pictures. */
function rejects(step: CullStep): boolean {
	return step.kind === 'pickRest' || step.kind === 'reduction' || (step.kind === 'decision' && 'flag' in step.change && step.change.flag === 'rejected')
}

/** The cull's recording actions; each returns the step it recorded, whatever its kind, or null. */
interface Decisions {
	decide: (intent: DecisionIntent, chosen: readonly Picture<SourceEntry>[]) => CullStep | null
	pickRest: (picked: Picture<SourceEntry>, rest: readonly Picture<SourceEntry>[]) => CullStep | null
	clearFlags: () => CullStep | null
	reduceSeries: (plan: ReductionPlan<Picture<ListingEntry>>) => CullStep | null
	tag: (change: TagChange, chosen: readonly Picture<SourceEntry>[]) => CullStep | null
	removeFromSeries: (series: Series<Picture<ListingEntry>>, picture: Picture<ListingEntry>) => CullStep | null
	dissolveSeries: (series: Series<Picture<ListingEntry>>) => CullStep | null
	mergeSeries: (series: readonly Series<Picture<ListingEntry>>[]) => CullStep | null
	editSelection: (edit: SelectionEdit, chosen: readonly Picture<ListingEntry>[]) => CullStep | null
	markSeries: (series: Series<Picture<ListingEntry>>, status: SeriesStatus) => CullStep | null
	undo: () => CullStep | null
	redo: () => CullStep | null
	takeSkipped: () => readonly LockedPicture[]
}

/** Decide, pick-rest, tag, the series edits, undo and redo that each say in a toast what changed and which photos were locked. */
export function useToastedDecisions(cull: Decisions, show: (message: string, action?: ToastAction | null, offer?: ToastAction, details?: readonly string[], duration?: number) => void, showError: (message: string, action?: ToastAction | null, details?: readonly string[]) => void, rejectHint?: RejectHint) {
	const { undo, redo } = useToastedUndo(cull, show)

	/** Decides the pictures and says what changed, with Undo and the offer `offer` makes once they are decided. */
	function decide(intent: DecisionIntent, chosen: readonly Picture<SourceEntry>[], offer: () => ToastAction | null = () => null) {
		toastChange(cull.decide(intent, chosen), offer)
	}

	/** Picks one picture, rejects the rest and says so, with Undo. */
	function pickRest(picked: Picture<SourceEntry>, rest: readonly Picture<SourceEntry>[]) {
		toastChange(cull.pickRest(picked, rest))
	}

	/** Resets every rateable picture's flag and *Keep RAW* and says so, with Undo (GRID-001.22). */
	function clearFlags() {
		toastChange(cull.clearFlags())
	}

	/** Picks the sharpest of each planned series, rejects the rest and says so, with Undo (SERIES-008.5). */
	function reduceSeries(plan: ReductionPlan<Picture<ListingEntry>>) {
		toastChange(cull.reduceSeries(plan))
	}

	/** Changes the pictures' tags and says what changed, with Undo (TAGS-003.10). */
	function tag(change: TagChange, chosen: readonly Picture<SourceEntry>[]) {
		toastChange(cull.tag(change, chosen))
	}

	/** Takes the picture out of the series and says so, with Undo (SERIES-005.10). */
	function removeFromSeries(series: Series<Picture<ListingEntry>>, picture: Picture<ListingEntry>) {
		toastChange(cull.removeFromSeries(series, picture))
	}

	/** Merges the series and says so, with Undo (SERIES-005.8). */
	function mergeSeries(series: readonly Series<Picture<ListingEntry>>[]) {
		toastChange(cull.mergeSeries(series))
	}

	/** Dissolves the series and says so, with Undo (SERIES-005.13). */
	function dissolveSeries(series: Series<Picture<ListingEntry>>) {
		toastChange(cull.dissolveSeries(series))
	}

	/** Marks the series done or reopens it and says so, with Undo (SERIES-005.14, .15). */
	function markSeries(series: Series<Picture<ListingEntry>>, status: SeriesStatus) {
		toastChange(cull.markSeries(series, status))
	}

	/** Edits series with the chosen pictures and says what changed, with Undo (SERIES-005.4–.7, .11). */
	function editSelection(edit: SelectionEdit, chosen: readonly Picture<ListingEntry>[]) {
		toastChange(cull.editSelection(edit, chosen))
	}

	/** Toasts a recorded step with Undo and the offer, if any, and the photos it left locked with their details (XMP-008.9). */
	function toastChange(entry: CullStep | null, offer: () => ToastAction | null = () => null) {
		const skipped = cull.takeSkipped()
		if (entry !== null) {
			const hinted = rejectHint !== undefined && !rejectHint.seen() && rejects(entry)
			const text = partialText(changeText(entry), skipped)
			show(hinted ? `${text}. ${REJECT_HINT_TEXT()}` : text, { label: t('honeycomb', 'Undo'), run: undo }, offer() ?? undefined, lockDetails(skipped), hinted ? REJECT_HINT_MS : undefined)
			if (hinted) {
				rejectHint.dismiss()
			}
		} else if (skipped.length > 0) {
			showError(lockedText(), null, lockDetails(skipped))
		}
	}

	return { decide, pickRest, clearFlags, reduceSeries, tag, removeFromSeries, dissolveSeries, mergeSeries, markSeries, editSelection, undo, redo }
}

/** Undo and redo of a cull's history that say in a toast what they took back or put again. */
export function useToastedUndo<E extends DescribedStep>(history: { undo: () => E | null, redo: () => E | null }, show: (message: string) => void) {
	/** Takes back the latest decision and says so. */
	function undo() {
		const entry = history.undo()
		if (entry !== null) {
			show(undoneText(entry))
		}
	}

	/** Puts back the latest undone decision and says so. */
	function redo() {
		const entry = history.redo()
		if (entry !== null) {
			show(redoneText(entry))
		}
	}

	return { undo, redo }
}
