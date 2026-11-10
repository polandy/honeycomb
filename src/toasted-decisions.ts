// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionIntent } from './logic/decision-change.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { UndoEntry } from './logic/undo.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { changeText, redoneText, undoneText } from './decision-text.ts'

interface Decisions {
	decide: (intent: DecisionIntent, chosen: readonly Picture<ListingEntry>[]) => UndoEntry | null
	undo: () => UndoEntry | null
	redo: () => UndoEntry | null
}

/** Decide, undo and redo that each say in a toast what changed. */
export function useToastedDecisions(cull: Decisions, show: (message: string, action?: ToastAction | null) => void) {
	/** Decides the pictures and says what changed, with Undo. */
	function decide(intent: DecisionIntent, chosen: readonly Picture<ListingEntry>[]) {
		const entry = cull.decide(intent, chosen)
		if (entry !== null) {
			show(changeText(entry), { label: t('honeycomb', 'Undo'), run: undo })
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

	return { decide, undo, redo }
}
