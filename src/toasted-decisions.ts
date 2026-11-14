// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullStep } from './cull.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { TagChange } from './logic/tag.ts'
import type { TagStep, UndoEntry } from './logic/undo.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { changeText, redoneText, undoneText } from './decision-text.ts'

interface Decisions {
	decide: (intent: DecisionIntent, chosen: readonly Picture<ListingEntry>[]) => UndoEntry | null
	pickRest: (picked: Picture<ListingEntry>, rest: readonly Picture<ListingEntry>[]) => UndoEntry | null
	tag: (change: TagChange, chosen: readonly Picture<ListingEntry>[]) => TagStep<Picture<ListingEntry>> | null
	undo: () => CullStep | null
	redo: () => CullStep | null
}

/** Decide, pick-rest, tag, undo and redo that each say in a toast what changed. */
export function useToastedDecisions(cull: Decisions, show: (message: string, action?: ToastAction | null, offer?: ToastAction) => void) {
	/** Decides the pictures and says what changed, with Undo and the offer `offer` makes once they are decided. */
	function decide(intent: DecisionIntent, chosen: readonly Picture<ListingEntry>[], offer: () => ToastAction | null = () => null) {
		toastChange(cull.decide(intent, chosen), offer)
	}

	/** Picks one picture, rejects the rest and says so, with Undo. */
	function pickRest(picked: Picture<ListingEntry>, rest: readonly Picture<ListingEntry>[]) {
		toastChange(cull.pickRest(picked, rest))
	}

	/** Changes the pictures' tags and says what changed, with Undo (TAGS-003.10). */
	function tag(change: TagChange, chosen: readonly Picture<ListingEntry>[]) {
		toastChange(cull.tag(change, chosen))
	}

	/** Toasts a recorded step with Undo and the offer, if any. */
	function toastChange(entry: CullStep | null, offer: () => ToastAction | null = () => null) {
		if (entry !== null) {
			show(changeText(entry), { label: t('honeycomb', 'Undo'), run: undo }, offer() ?? undefined)
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

	return { decide, pickRest, tag, undo, redo }
}
