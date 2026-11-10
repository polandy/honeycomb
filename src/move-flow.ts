// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ref } from 'vue'
import type { LoupeSnapshot } from './delete-flow.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { MtimeOffset } from './logic/move-candidates.ts'
import type { ConflictChoice, ExistingFile, MoveRequestFile, TargetFolder } from './logic/move-plan.ts'
import type { MoveReport, MoveResponseFile } from './logic/move-report.ts'
import type { Picture } from './logic/pairing.ts'
import type { Settings } from './logic/settings.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref, shallowRef, toRaw } from 'vue'
import { logger } from './logger.ts'
import { browserOffset, inViewOrder, moveCounts, nameCandidates } from './logic/move-candidates.ts'
import { existingFiles, moveRequest, planMove, probeFolders } from './logic/move-plan.ts'
import { gotNewFileIds, moveReport, undoneEntries, undoRequest } from './logic/move-report.ts'
import { addRecent, targetChips, toggleFavourite as toggled } from './logic/move-targets.ts'
import { parseNameTemplate } from './logic/name-template/parse.ts'
import { DEFAULT_NAME_TEMPLATE } from './logic/name-template/presets.ts'
import { followReplaced } from './logic/trash-report.ts'
import { movedBackText, movedText, moveFailedText } from './move-text.ts'

type Pictures = readonly Picture<ListingEntry>[]

/** What a move reads and changes in the cull. */
export interface MoveFlowContext {
	readonly view: () => Pictures
	readonly settings: () => Settings
	readonly updateSettings: (patch: Partial<Settings>) => void
	readonly probe: (folders: readonly string[]) => Promise<TargetFolder[]>
	readonly move: (pictures: readonly (readonly MoveRequestFile[])[]) => Promise<MoveResponseFile[][]>
	/** Takes the files out of the listing; returns what each affected picture became. */
	readonly removeFiles: (fileIds: ReadonlySet<number>) => ReadonlyMap<Picture<ListingEntry>, Picture<ListingEntry> | null>
	readonly restoreFiles: (entries: readonly ListingEntry[]) => void
	/** Identifies the open listing; an undo restores files only into the one the move left. */
	readonly listing?: () => unknown
	readonly loupe: Ref<LoupeSnapshot | null>
	readonly toast: (message: string, action?: ToastAction | null) => void
	/** The name template's text; the default until the setting arrives (M7.4). */
	readonly template?: () => string
	readonly offset?: MtimeOffset
}

/** The endpoints a move uses (ADR 0018). */
export interface MoveApi {
	readonly probeTargets: MoveFlowContext['probe']
	readonly movePictures: MoveFlowContext['move']
}

/** The move dialog, its move summary, the move and its undo (`docs/plan.md` Moving pictures, MOVE-004). */
export function useMoveFlow(context: MoveFlowContext) {
	const pictures = shallowRef<Pictures | null>(null)
	const browsing = ref(false)
	const target = ref<string | null>(null)
	const existing = shallowRef<ExistingFile[] | null>(null)
	const choices = shallowRef<ReadonlyMap<Picture<ListingEntry>, ConflictChoice>>(new Map())
	const report = shallowRef<MoveReport | null>(null)
	const busy = ref(false)
	let probing = 0

	const template = computed(() => {
		const text = (context.template ?? (() => DEFAULT_NAME_TEMPLATE))()
		const parsed = parseNameTemplate(text)
		if (!parsed.ok) {
			throw new Error(`The name template ${text} is invalid: ${parsed.problem}`)
		}
		return { text, parsed: parsed.template }
	})
	const named = computed(() => nameCandidates(pictures.value ?? [], template.value.parsed, context.offset ?? browserOffset))
	const candidates = computed(() => named.value.flatMap((each) => (each.candidate === null ? [] : [{ picture: each.picture, candidate: each.candidate }])))
	const plan = computed(() => (target.value === null || existing.value === null
		? null
		: planMove(target.value, candidates.value.map((each) => each.candidate), existing.value, (index) => choices.value.get(candidates.value[index]!.picture) ?? 'suffix')))
	const counts = computed(() => (plan.value === null ? { files: 0, conflicts: 0 } : moveCounts(plan.value)))
	const conflicted = computed(() => (plan.value ?? []).flatMap((planned, index) => (planned.inConflict ? [candidates.value[index]!.picture] : [])))
	const allChoice = computed(() => {
		const all = new Set(conflicted.value.map((picture) => choices.value.get(picture) ?? 'suffix'))
		return all.size === 1 ? [...all][0]! : null
	})
	const chips = computed(() => targetChips(context.settings().moveFavourites, context.settings().moveRecent))
	const favourite = computed(() => target.value !== null && context.settings().moveFavourites.includes(target.value))

	/** Opens the dialog on the pictures in view order, if any. */
	function open(chosen: Pictures) {
		if (chosen.length === 0) {
			return
		}
		pictures.value = inViewOrder(chosen, context.view())
		target.value = null
		existing.value = null
		choices.value = new Map()
		browsing.value = false
	}

	/** Opens the dialog on the loupe's photo, else on the chosen pictures, else on the focused tile. */
	function openShown(chosen: Pictures, focused: () => number) {
		const loupe = context.loupe.value
		const shown = loupe === null ? context.view()[focused()] : toRaw(loupe.pictures[loupe.index])
		open(loupe === null && chosen.length > 0 ? chosen : [shown].filter((each) => each !== undefined))
	}

	/** Closes the dialog. */
	function close() {
		pictures.value = null
		probing++
	}

	/** Makes the folder the target and probes the folders the move writes into. */
	function choose(path: string) {
		const probe = ++probing
		target.value = path
		existing.value = null
		choices.value = new Map()
		browsing.value = false
		context.probe(probeFolders(path, candidates.value.map((each) => each.candidate))).then((folders) => {
			if (probe === probing) {
				existing.value = existingFiles(folders)
			}
		}, (error: unknown) => {
			logger.error('Could not probe the move target folders', { error })
			fail(error)
		})
	}

	/** Chooses the chip with the number key, if there is one. */
	function chooseKey(key: number) {
		const chip = chips.value[key - 1]
		if (chip !== undefined) {
			choose(chip.path)
		}
	}

	/** Closes the dialog and says why nothing moved. */
	function fail(error: unknown) {
		close()
		context.toast(moveFailedText(error))
	}

	/** Sends the plan, takes the moved files out of the listing and the loupe, and offers *Undo*. */
	async function confirm() {
		const planned = plan.value
		if (busy.value || planned === null || counts.value.files === 0) {
			return
		}
		busy.value = true
		const to = target.value!
		const listing = context.listing?.()
		try {
			const sent = planned.filter((picture) => picture.sent).map((picture) => picture.files.map(({ file }) => file))
			const done = moveReport(sent, await context.move(moveRequest(planned)))
			const replaced = context.removeFiles(new Set(done.moved.filter((file) => file.path !== file.from).map((file) => file.file.entry.fileId)))
			const loupe = toRaw(context.loupe.value)
			context.loupe.value = loupe === null ? null : followReplaced(loupe.pictures, loupe.index, replaced)
			if (done.moved.length > 0) {
				context.updateSettings({ moveRecent: addRecent(context.settings().moveRecent, to) })
			}
			close()
			report.value = done.failed.length > 0 ? done : null
			context.toast(movedText(done, to, gotNewFileIds(done)), done.moved.length > 0 ? { label: t('honeycomb', 'Undo'), run: () => void undo(done, listing) } : null)
		} catch (error) {
			logger.error('Could not move the photos', { error })
			fail(error)
		} finally {
			busy.value = false
		}
	}

	/** Moves the files of the move back and shows them again, if the listing is still the one they left. */
	async function undo(done: MoveReport, listing: unknown) {
		try {
			const { entries, failed } = undoneEntries(done, await context.move(undoRequest(done)))
			if (context.listing?.() === listing) {
				context.restoreFiles(entries)
			}
			context.toast(movedBackText(entries.length, failed))
		} catch (error) {
			logger.error('Could not move the photos back', { error })
			context.toast(moveFailedText(error))
		}
	}

	return {
		pictures,
		browsing,
		target,
		named,
		plan,
		counts,
		allChoice,
		chips,
		favourite,
		report,
		busy,
		templateText: computed(() => template.value.text),
		open,
		openShown,
		close,
		choose,
		chooseKey,
		toggleFavourite: () => {
			context.updateSettings({ moveFavourites: toggled(context.settings().moveFavourites, target.value!) })
		},
		setChoice: (picture: Picture<ListingEntry>, choice: ConflictChoice) => {
			choices.value = new Map([...choices.value, [picture, choice]])
		},
		setAll: (choice: ConflictChoice) => {
			choices.value = new Map(conflicted.value.map((picture) => [picture, choice]))
		},
		confirm,
		closeReport: () => {
			report.value = null
		},
	}
}

/** The move flow a screen opens and its dialogs show. */
export type MoveFlow = ReturnType<typeof useMoveFlow>
