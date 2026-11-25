// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionIntent } from '../logic/decision-change.ts'
import type { Decision, StoredDecision } from '../logic/decision.ts'
import type { SourceEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { PictureId } from '../logic/picture-id.ts'
import type { SaveResult } from '../logic/save-queue.ts'
import type { DecisionStep, DescribedStep, PickRestStep, ReductionStep } from '../logic/undo.ts'
import type { useToast } from '../shared/toast.ts'

import { t } from '@nextcloud/l10n'
import { computed, shallowRef } from 'vue'
import { resolveChange, withRows } from '../logic/decision-change.ts'
import { decisionsByFileId } from '../logic/decision.ts'
import { imageMember } from '../logic/image-tiers.ts'
import { saveQueue } from '../logic/save-queue.ts'
import { undoEntry } from '../logic/undo.ts'
import { fireAndLog } from '../shared/fire-and-log.ts'
import { logger } from '../shared/logger.ts'
import { useCullHistory } from './cull-history.ts'
import { changeText } from './decision-text.ts'
import { useToastedUndo } from './toasted-decisions.ts'

/** A decision before and after a change, as the cull's counts move along. */
export type DecisionMove = readonly [Decision, Decision]

/** A step that sets decision rows. */
export type RowStep = DecisionStep | PickRestStep | ReductionStep

/** The rows a step just showed: those it replaced and those it wrote, the decisions before and whether it was taken back. */
export interface CullWrite {
	readonly from: readonly StoredDecision[]
	readonly to: readonly StoredDecision[]
	readonly before: ReadonlyMap<PictureId, Decision>
	readonly back: boolean
}

/** What the decision steps are given: the stored decisions, how a source keeps the shown rows and what the other step kinds do. */
export interface CullStepsContext<Other> {
	/** The decision a picture carries before any of this cull. */
	readonly storedOf: (id: PictureId) => Decision
	/** Keeps the rows a step just showed in the source. */
	readonly write: (write: CullWrite) => void
	/** Puts a step of another kind into effect, or takes it back when `back`. */
	readonly effects: (step: Other, back: boolean) => void
}

const ROW_KINDS: ReadonlySet<string> = new Set<RowStep['kind']>(['decision', 'pickRest', 'reduction'])

/** Whether the step sets decision rows. */
const isRowStep = <Other extends DescribedStep>(step: RowStep | Other): step is RowStep => ROW_KINDS.has(step.kind)

/** The decisions of every cull: shown at once by file id, kept by the source, undone as steps of any kind (ADR 0058). */
export function useCullSteps<Other extends DescribedStep = never>(context: CullStepsContext<Other>) {
	const decided = shallowRef<ReadonlyMap<PictureId, Decision>>(new Map())
	const history = useCullHistory<RowStep | Other>((step, back) => (isRowStep(step) ? show(step, back) : context.effects(step, back)))

	/** Shows the rows a step wrote, or replaced when `back`, and hands them to the source. */
	function show(step: RowStep, back: boolean) {
		const [from, to] = back ? [step.after, step.before] : [step.before, step.after]
		const before = decided.value
		decided.value = withRows(before, to)
		context.write({ from, to, before, back })
	}

	/** Forgets the decisions and the steps. */
	function open() {
		history.reset()
		clear()
	}

	/** Forgets the decisions shown. */
	function clear() {
		decided.value = new Map()
	}

	/** Shows the rows with no step, as read from the source. */
	function put(rows: readonly StoredDecision[]) {
		decided.value = withRows(decided.value, rows)
	}

	/** The decision the picture carries now: its rendered member's, else its RAW's, else the stored one. */
	function decisionOf(picture: Picture<SourceEntry>): Decision {
		const id = imageMember(picture).fileId
		return decided.value.get(id) ?? (picture.raw && decided.value.get(picture.raw.fileId)) ?? context.storedOf(id)
	}

	/** Decides on the pictures as one undo step and returns it, or null when nothing changes. */
	function decide(intent: DecisionIntent, targets: readonly Picture<SourceEntry>[]): DecisionStep | null {
		const current = targets.map((picture) => ({ picture, decision: decisionOf(picture) }))
		return history.record(undoEntry(current, resolveChange(intent, current)))
	}

	return { decided: computed(() => decided.value), open, clear, put, decisionOf, decide, record: history.record, undo: history.undo, redo: history.redo }
}

/** The decisions shown, as the folder cull's writes read and take them back. */
export type ShownDecisions = Pick<ReturnType<typeof useCullSteps>, 'decided' | 'put'>

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

/** The decision steps of a source that saves whole rows: saved one save at a time with roll back, toasted with *Undo* (ADR 0058). */
export function useCullCore<Row>(context: CullCoreContext<Row>) {
	let generation = 0
	let save: ((rows: readonly Row[]) => Promise<SaveResult<Row>>) | null = null
	const steps = useCullSteps({ storedOf: context.storedOf, write: ({ from, to }) => fireAndLog(apply(changesBetween(from, to)), 'Could not apply the decision change'), effects: () => undefined })
	const { undo, redo } = useToastedUndo(steps, context.toast.show)

	/** Saves to the source from now on, one save at a time, with no decision and no step (IMMICH-003.20). */
	function open(source: { readonly decide: (rows: readonly Row[]) => Promise<void> }) {
		save = saveQueue<Row, string>((rows) => source.decide(rows), { key: context.keyOf })
		generation += 1
		steps.open()
	}

	/** Forgets the decisions shown; a save asked before leaves them alone when it fails. */
	function clear() {
		generation += 1
		steps.clear()
	}

	/** The changes that take the pictures from the `from` rows to the `to` rows. */
	function changesBetween(from: readonly StoredDecision[], to: readonly StoredDecision[]): Change[] {
		const before = decisionsByFileId(from)
		return [...decisionsByFileId(to)].map(([id, after]) => ({ id, before: before.get(id)!, after }))
	}

	/** Tells the moves of the changes just shown and saves them; puts back what no later save stored (IMMICH-003.21). */
	async function apply(changes: readonly Change[]) {
		const asked = generation
		context.shown(changes.map(({ before, after }) => [before, after]))
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
			steps.put(back.map(({ id, before }) => ({ fileId: id, ...before })))
			context.shown(back.map(({ before, after }) => [after, before]))
			context.toast.showError(t('honeycomb', 'Could not save the decision; it is back as it was'))
		}
	}

	/** Decides on the pictures as one undo step and toasts the change with *Undo* (IMMICH-003.4, IMMICH-003.19). */
	function decide(intent: DecisionIntent, targets: readonly Picture<SourceEntry>[]) {
		const step = steps.decide(intent, targets)
		if (step !== null) {
			context.toast.show(changeText(step), { label: t('honeycomb', 'Undo'), run: undo })
		}
	}

	return { decided: steps.decided, open, clear, decisionOf: steps.decisionOf, decide, undo, redo }
}
