// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision, StoredDecision } from './logic/decision.ts'
import type { SourceEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { PictureId } from './logic/picture-id.ts'
import type { SaveResult } from './logic/save-queue.ts'
import type { DecisionStep } from './logic/undo.ts'
import type { useToast } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { computed, shallowRef } from 'vue'
import { useCullHistory } from './cull-history.ts'
import { changeText } from './decision-text.ts'
import { fireAndLog } from './fire-and-log.ts'
import { logger } from './logger.ts'
import { resolveChange } from './logic/decision-change.ts'
import { decisionsByFileId } from './logic/decision.ts'
import { imageMember } from './logic/image-tiers.ts'
import { saveQueue } from './logic/save-queue.ts'
import { undoEntry } from './logic/undo.ts'
import { useToastedUndo } from './toasted-decisions.ts'

/** A decision before and after a change, as the cull's counts move along. */
export type DecisionMove = readonly [Decision, Decision]

/** What the cull core is given: how a source's pictures and rows look, who hears the shown decisions, and the toast. */
export interface CullCoreContext<Row> {
	/** The decision a picture carries before any of this cull. */
	readonly storedOf: (id: PictureId) => Decision
	/** The row that saves a picture's decision. */
	readonly rowOf: (id: PictureId, decision: Decision) => Row
	/** Names a row's picture, so a save sends the newest row per picture and a failed one finds what to put back. */
	readonly keyOf: (row: Row) => string
	/** Hears the decisions just shown, one move each, so the cull moves its counts along. */
	readonly shown: (moves: readonly DecisionMove[]) => void
	readonly toast: Pick<ReturnType<typeof useToast>, 'show' | 'showError'>
}

/** One picture's decision before and after a change. */
interface Change {
	readonly id: PictureId
	readonly before: Decision
	readonly after: Decision
}

/** The decisions of a cull whatever its source: shown at once, saved one save at a time with roll back, undone as steps (ADR 0058). */
export function useCullCore<Row>(context: CullCoreContext<Row>) {
	const decided = shallowRef<ReadonlyMap<PictureId, Decision>>(new Map())
	let generation = 0
	let save: ((rows: readonly Row[]) => Promise<SaveResult<Row>>) | null = null
	// Undo saves the rows a step replaced, redo the rows it wrote (IMMICH-003.19).
	const history = useCullHistory<DecisionStep>((step, back) => fireAndLog(apply(back ? changesBetween(step.after, step.before) : changesBetween(step.before, step.after)), 'Could not apply the decision change'))
	const { undo, redo } = useToastedUndo(history, context.toast.show)

	/** Saves to the source from now on, one save at a time, with no decision and no step (IMMICH-003.20). */
	function open(source: { readonly decide: (rows: readonly Row[]) => Promise<void> }) {
		save = saveQueue<Row, string>((rows) => source.decide(rows), { key: context.keyOf })
		history.reset()
		clear()
	}

	/** Forgets the decisions shown; a save asked before leaves them alone when it fails. */
	function clear() {
		generation += 1
		decided.value = new Map()
	}

	/** The decision the picture carries now. */
	function decisionOf(picture: Picture<SourceEntry>): Decision {
		const id = imageMember(picture).fileId
		return decided.value.get(id) ?? context.storedOf(id)
	}

	/** The changes that take the pictures from the `from` rows to the `to` rows. */
	function changesBetween(from: readonly StoredDecision[], to: readonly StoredDecision[]): Change[] {
		const before = decisionsByFileId(from)
		return [...decisionsByFileId(to)].map(([id, after]) => ({ id, before: before.get(id)!, after }))
	}

	/** Shows the decisions at once and saves them; puts back what no later save stored (IMMICH-003.21). */
	async function apply(changes: readonly Change[]) {
		const asked = generation
		show(changes.map(({ id, after }) => [id, after]), changes.map(({ before, after }) => [before, after]))
		const result = await save!(changes.map(({ id, after }) => context.rowOf(id, after)))
		if (result.ok) {
			return
		}
		logger.error('Could not save the decisions', { error: result.error })
		if (asked !== generation) {
			return
		}
		const unsaved = new Set(result.unsaved.map(context.keyOf))
		const back = changes.filter(({ id, after }) => unsaved.has(context.keyOf(context.rowOf(id, after))))
		if (back.length > 0) {
			show(back.map(({ id, before }) => [id, before]), back.map(({ before, after }) => [after, before]))
			context.toast.showError(t('honeycomb', 'Could not save the decision; it is back as it was'))
		}
	}

	/** Puts the decisions in place and tells their moves. */
	function show(next: readonly [PictureId, Decision][], moves: readonly DecisionMove[]) {
		decided.value = new Map([...decided.value, ...next])
		context.shown(moves)
	}

	/** Decides on the pictures as one undo step and toasts the change with *Undo* (IMMICH-003.4, IMMICH-003.19). */
	function decide(intent: DecisionIntent, targets: readonly Picture<SourceEntry>[]) {
		const current = targets.map((picture) => ({ picture, decision: decisionOf(picture) }))
		const step = history.record(undoEntry(current, resolveChange(intent, current)))
		if (step !== null) {
			context.toast.show(changeText(step), { label: t('honeycomb', 'Undo'), run: undo })
		}
	}

	return { decided: computed(() => decided.value), open, clear, decisionOf, decide, undo, redo }
}
