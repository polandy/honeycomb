// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullStep } from './cull.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { ListingEntry, SourceEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { SelectionEdit } from './logic/series-menu.ts'
import type { Series } from './logic/series.ts'
import type { SeriesStatus } from './logic/stored-series.ts'
import type { TagChange } from './logic/tag.ts'
import type { LockedPicture } from './logic/writability.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { changeText, redoneText, undoneText } from './decision-text.ts'
import { lockDetails, lockedText, partialText } from './lock-text.ts'

/** The cull's recording actions; each returns the step it recorded, whatever its kind, or null. */
interface Decisions {
	decide: (intent: DecisionIntent, chosen: readonly Picture<SourceEntry>[]) => CullStep | null
	pickRest: (picked: Picture<SourceEntry>, rest: readonly Picture<SourceEntry>[]) => CullStep | null
	clearFlags: () => CullStep | null
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
export function useToastedDecisions(cull: Decisions, show: (message: string, action?: ToastAction | null, offer?: ToastAction, details?: readonly string[]) => void, showError: (message: string, action?: ToastAction | null, details?: readonly string[]) => void) {
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
			show(partialText(changeText(entry), skipped), { label: t('honeycomb', 'Undo'), run: undo }, offer() ?? undefined, lockDetails(skipped))
		} else if (skipped.length > 0) {
			showError(lockedText(), null, lockDetails(skipped))
		}
	}

	/** Takes back the latest decision and says so. */
	function undo() {
		const entry = cull.undo()
		if (entry !== null) {
			show(undoneText(entry))
		}
	}

	/** Puts back the latest undone decision and says so. */
	function redo() {
		const entry = cull.redo()
		if (entry !== null) {
			show(redoneText(entry))
		}
	}

	return { decide, pickRest, clearFlags, tag, removeFromSeries, dissolveSeries, mergeSeries, markSeries, editSelection, undo, redo }
}
