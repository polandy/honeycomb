// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decided, DecisionChange } from './decision-change.ts'
import type { StoredDecision } from './decision.ts'
import type { SeriesChange, SeriesEdit } from './series-edit.ts'
import type { Tag, TagChange } from './tag.ts'

import { changedRows, CLEARED, isPair } from './decision-change.ts'
import { changedTags, sameTags } from './tag.ts'

/** How many steps the undo history keeps (`docs/dev/plan.md` M3.2). */
export const UNDO_LIMIT = 50

/** What each kind of undo step changed, by its kind. */
export interface StepChanges {
	readonly decision: { readonly change: DecisionChange }
	readonly pickRest: { readonly rejected: number }
	readonly reduction: { readonly series: number, readonly rejected: number }
	readonly tags: { readonly change: TagChange }
	readonly series: { readonly edit: SeriesEdit, readonly series: number }
}

/** The kinds of undo step. */
export type StepKind = keyof StepChanges

/** A change of the given kinds with the names of the pictures it altered, all a toast needs. */
export type DescribedStep<K extends StepKind = StepKind> = { [J in K]: { readonly kind: J, readonly names: readonly string[] } & StepChanges[J] }[K]

/** The rows a decision step wrote and the rows it replaced. */
interface DecisionRows {
	readonly after: readonly StoredDecision[]
	readonly before: readonly StoredDecision[]
}

/** A change to one field of the pictures' decisions, as an undo step. */
export type DecisionStep = DescribedStep<'decision'> & DecisionRows

/** Pick this, reject the rest by the picked picture's name, as an undo step (SERIES-001.9). */
export type PickRestStep = DescribedStep<'pickRest'> & DecisionRows

/** The series reduction by its counts, as an undo step (SERIES-008.5). */
export type ReductionStep = DescribedStep<'reduction'> & DecisionRows

/** One tag change as an undo step: the change and the pictures it altered (TAGS-003.10). */
export type TagStep<P> = DescribedStep<'tags'> & { readonly pictures: readonly P[] }

/** One series edit as an undo step: the rows it wrote and replaced (SERIES-005). */
export type SeriesStep = DescribedStep<'series'> & SeriesChange

/** One step of the undo history, tagged by its kind. */
export type UndoStep<P> = DecisionStep | PickRestStep | ReductionStep | TagStep<P> | SeriesStep

/** The undo step of each kind. */
interface StepsByKind<P> {
	readonly decision: DecisionStep
	readonly pickRest: PickRestStep
	readonly reduction: ReductionStep
	readonly tags: TagStep<P>
	readonly series: SeriesStep
}

/** What puts each kind of step into effect, or takes it back when `back`. */
export type StepEffects<P> = { readonly [K in StepKind]: (step: StepsByKind<P>[K], back: boolean) => void }

/** Puts the step into effect through the effect of its kind, or takes it back when `back`. */
export function applyStep<P, K extends StepKind>(effects: StepEffects<P>, step: StepsByKind<P>[K] & { readonly kind: K }, back: boolean): void {
	effects[step.kind](step, back)
}

/** The undo step of a change to the pictures, or null when it alters none. */
export function undoEntry(pictures: readonly Decided[], change: DecisionChange): DecisionStep | null {
	const rows = rowsOf(pictures.map((decided) => ({ decided, change })))
	return rows === null ? null : { kind: 'decision', change, ...rows }
}

/** The undo step that picks one picture and rejects the rest, counting the newly rejected, or null when it alters none (KEYS-001.13). */
export function pickRestEntry(picked: Decided, rest: readonly Decided[]): PickRestStep | null {
	const rows = rowsOf(pickRestChanges(picked, rest))
	return rows === null ? null : { kind: 'pickRest', rejected: newlyRejected(rest), ...rows }
}

/** The undo step that picks the sharpest of each series and rejects the rest, or null when it alters none (SERIES-008.5). */
export function reductionEntry(series: readonly { picked: Decided, rest: readonly Decided[] }[]): ReductionStep | null {
	const rows = rowsOf(series.flatMap(({ picked, rest }) => pickRestChanges(picked, rest)))
	const rejected = series.reduce((sum, { rest }) => sum + newlyRejected(rest), 0)
	return rows === null ? null : { kind: 'reduction', series: series.length, rejected, ...rows }
}

/** The undo step that resets the pictures to unflagged without Keep RAW, a single's flag only, or null when it alters none (GRID-001.22). */
export function clearEntry(pictures: readonly Decided[]): DecisionStep | null {
	const rows = rowsOf(pictures.map((decided) => ({ decided, change: isPair(decided) ? CLEARED : { flag: CLEARED.flag } })))
	return rows === null ? null : { kind: 'decision', change: CLEARED, ...rows }
}

/** How many of the rest a pick-rest rejects, the already rejected left out. */
function newlyRejected(rest: readonly Decided[]): number {
	return rest.filter(({ decision }) => decision.flag !== 'rejected').length
}

/** The changes that pick one picture and reject the rest. */
function pickRestChanges(picked: Decided, rest: readonly Decided[]): { decided: Decided, change: DecisionChange }[] {
	return [{ decided: picked, change: { flag: 'picked' } }, ...rest.map((decided) => ({ decided, change: { flag: 'rejected' } as const }))]
}

/** The names and rows of the changes that altered something, or null when none did. */
function rowsOf(changes: readonly { decided: Decided, change: DecisionChange }[]): DecisionRows & { readonly names: readonly string[] } | null {
	const altered = changes.map(({ decided, change }) => ({ decided, rows: changedRows([decided], change) })).filter(({ rows }) => rows.length > 0)
	if (altered.length === 0) {
		return null
	}
	return {
		names: altered.map(({ decided }) => decided.picture.baseName),
		after: altered.flatMap(({ rows }) => rows),
		before: altered.flatMap(({ decided, rows }) => rows.map(({ fileId }) => ({ fileId, ...decided.decision }))),
	}
}

/** The undo step of a tag change to the pictures, or null when it alters none. */
export function tagStep<P extends { baseName: string }>(pictures: readonly P[], tagsOf: (picture: P) => readonly Tag[], change: TagChange): TagStep<P> | null {
	const altered = pictures.filter((picture) => !sameTags(changedTags(tagsOf(picture), change), tagsOf(picture)))
	return altered.length === 0 ? null : { kind: 'tags', change, names: altered.map((picture) => picture.baseName), pictures: altered }
}

/** The undo step of a series edit to the pictures, in as many series. */
export function seriesStep(edit: SeriesEdit, pictures: readonly { readonly baseName: string }[], change: SeriesChange, series: number): SeriesStep {
	return { kind: 'series', edit, names: pictures.map((picture) => picture.baseName), series, ...change }
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
