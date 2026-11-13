// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UndoHistory } from './logic/undo.ts'

import { NO_HISTORY, recordStep, redoStep, undoStep } from './logic/undo.ts'

/** The cull's undo history; `apply` puts a step into effect, or takes it back when `back`. */
export function useCullHistory<E>(apply: (entry: E, back: boolean) => void) {
	let history: UndoHistory<E> = NO_HISTORY

	/** Forgets every step. */
	function reset() {
		history = NO_HISTORY
	}

	/** Records the step and puts it into effect; returns it, or null for none. */
	function record<S extends E>(entry: S | null): S | null {
		if (entry !== null) {
			history = recordStep(history, entry)
			apply(entry, false)
		}
		return entry
	}

	/** Takes back the latest step and returns it, or null when there is none. */
	function undo(): E | null {
		const step = undoStep(history)
		if (step === null) {
			return null
		}
		history = step.history
		apply(step.entry, true)
		return step.entry
	}

	/** Puts the latest undone step into effect again and returns it, or null when there is none. */
	function redo(): E | null {
		const step = redoStep(history)
		if (step === null) {
			return null
		}
		history = step.history
		apply(step.entry, false)
		return step.entry
	}

	return { reset, record, undo, redo }
}
