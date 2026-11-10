import type { Decided, DecisionChange } from './decision-change.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { StoredDecision } from './decision.ts'

import { changedRows } from './decision-change.ts'

/** How many steps the undo history keeps (`docs/plan.md` M3.2). */
export const UNDO_LIMIT = 50

/** One step of the undo history: the change, the pictures it altered, and the rows it wrote and replaced. */
export interface UndoEntry {
	readonly change: DecisionChange
	readonly names: readonly string[]
	readonly after: readonly StoredDecision[]
	readonly before: readonly StoredDecision[]
}

/** The undo step of a change to the pictures, or null when it alters none. */
export function undoEntry(pictures: readonly Decided[], change: DecisionChange): UndoEntry | null {
	const altered = pictures.map((decided) => ({ decided, rows: changedRows([decided], change) })).filter(({ rows }) => rows.length > 0)
	if (altered.length === 0) {
		return null
	}
	return {
		change,
		names: altered.map(({ decided }) => decided.picture.baseName),
		after: altered.flatMap(({ rows }) => rows),
		before: altered.flatMap(({ decided, rows }) => rows.map(({ fileId }) => ({ fileId, ...decided.decision }))),
	}
}

/** The history with the entry added last, keeping the most recent UNDO_LIMIT steps. */
export function pushUndo(history: readonly UndoEntry[], entry: UndoEntry): UndoEntry[] {
	return [...history, entry].slice(-UNDO_LIMIT)
}
