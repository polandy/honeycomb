// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decided, DecisionChange } from './decision-change.ts'
import type { StoredDecision } from './decision.ts'
import type { Tag, TagChange } from './tag.ts'

import { changedRows } from './decision-change.ts'
import { changedTags, sameTags } from './tag.ts'

/** How many steps the undo history keeps (`docs/plan.md` M3.2). */
export const UNDO_LIMIT = 50

/** A change to the decisions, or Pick this, reject the rest by the picked picture's name. */
export type UndoChange = DecisionChange | { readonly pickRest: string }

/** One step of the undo history: the change, the pictures it altered, and the rows it wrote and replaced. */
export interface UndoEntry {
	readonly change: UndoChange
	readonly names: readonly string[]
	readonly after: readonly StoredDecision[]
	readonly before: readonly StoredDecision[]
}

/** The undo step of a change to the pictures, or null when it alters none. */
export function undoEntry(pictures: readonly Decided[], change: DecisionChange): UndoEntry | null {
	return entryOf(pictures.map((decided) => ({ decided, change })), change)
}

/** The undo step that picks one picture and rejects the rest, or null when it alters none. */
export function pickRestEntry(picked: Decided, rest: readonly Decided[]): UndoEntry | null {
	const changes = [{ decided: picked, change: { flag: 'picked' } as const }, ...rest.map((decided) => ({ decided, change: { flag: 'rejected' } as const }))]
	return entryOf(changes, { pickRest: picked.picture.baseName })
}

/** The undo step of the changes that altered something, or null when none did. */
function entryOf(changes: readonly { decided: Decided, change: DecisionChange }[], change: UndoChange): UndoEntry | null {
	const altered = changes.map(({ decided, change }) => ({ decided, rows: changedRows([decided], change) })).filter(({ rows }) => rows.length > 0)
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

/** One tag change as an undo step: the change and the pictures it altered (TAGS-003.10). */
export interface TagStep<P> {
	readonly change: TagChange
	readonly names: readonly string[]
	readonly pictures: readonly P[]
}

/** The undo step of a tag change to the pictures, or null when it alters none. */
export function tagStep<P extends { baseName: string }>(pictures: readonly P[], tagsOf: (picture: P) => readonly Tag[], change: TagChange): TagStep<P> | null {
	const altered = pictures.filter((picture) => !sameTags(changedTags(tagsOf(picture), change), tagsOf(picture)))
	return altered.length === 0 ? null : { change, names: altered.map((picture) => picture.baseName), pictures: altered }
}

/** The history with the entry added last, keeping the most recent UNDO_LIMIT steps. */
export function pushUndo<E>(history: readonly E[], entry: E): E[] {
	return [...history, entry].slice(-UNDO_LIMIT)
}

/** The steps undo can take back and the steps redo can put again, latest last. */
export interface UndoHistory<E> {
	readonly done: readonly E[]
	readonly undone: readonly E[]
}

/** Nothing to undo or redo. */
export const NO_HISTORY: UndoHistory<never> = { done: [], undone: [] }

/** The history after a new step; it clears what redo could put again. */
export function recordStep<E>(history: UndoHistory<E>, entry: E): UndoHistory<E> {
	return { done: pushUndo(history.done, entry), undone: [] }
}

/** The latest step and the history with it moved to redo, or null when there is none. */
export function undoStep<E>(history: UndoHistory<E>): { entry: E, history: UndoHistory<E> } | null {
	const entry = history.done.at(-1)
	return entry === undefined ? null : { entry, history: { done: history.done.slice(0, -1), undone: [...history.undone, entry] } }
}

/** The latest undone step and the history with it back on the undo side, or null when there is none. */
export function redoStep<E>(history: UndoHistory<E>): { entry: E, history: UndoHistory<E> } | null {
	const entry = history.undone.at(-1)
	return entry === undefined ? null : { entry, history: { done: pushUndo(history.done, entry), undone: history.undone.slice(0, -1) } }
}
