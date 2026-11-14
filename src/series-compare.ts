// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HotkeyHandlers } from './hotkeys.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision } from './logic/decision.ts'
import type { HotkeyIntent } from './logic/hotkeys.ts'
import type { Settings } from './logic/settings.ts'
import type { Toast } from './toast.ts'

import { computed, ref, shallowRef } from 'vue'
import { rowStep } from './logic/compare-grid.ts'
import { stepRating } from './logic/hotkeys.ts'
import { useSeriesViewer } from './series-viewer.ts'

/** What the series compare reads from the cull and hands to it. */
export interface SeriesCompareContext<P> {
	readonly series: () => readonly (readonly P[])[]
	readonly decisionOf: (picture: P) => Decision
	readonly decide: (intent: DecisionIntent, picture: P) => void
	readonly pickRest: (picked: P, rest: readonly P[]) => void
	readonly settings: () => Settings
	readonly updateSettings: (patch: Partial<Settings>) => void
	readonly toast: (toast: Toast) => void
	readonly holdHashes: (hold: boolean) => void
}

/** The series compare dialog's state: which series it shows, which picture is active, and its keys (SERIES-001). */
export function useSeriesCompare<P>(context: SeriesCompareContext<P>) {
	const open = ref(false)
	const index = ref(0)
	const activeIndex = ref(0)
	const anchor = shallowRef<readonly P[]>([])
	const columns = ref(1)

	const all = computed(() => context.series()
		.map((series) => series.filter((picture) => context.decisionOf(picture).flag !== 'rejected'))
		.filter((series) => series.length > 1))
	const count = computed(() => all.value.length)
	const position = computed(() => (index.value < count.value ? index.value : 0))
	const current = computed(() => all.value[position.value] ?? null)
	const active = computed(() => {
		const series = current.value ?? []
		return series.some((picture) => anchor.value.includes(picture)) ? Math.min(activeIndex.value, series.length - 1) : 0
	})
	const activePicture = () => current.value?.[active.value] ?? null

	/** Makes the picture at `at` of the shown series active, clamped. */
	function setActive(at: number) {
		anchor.value = current.value ?? []
		activeIndex.value = Math.max(0, Math.min(at, anchor.value.length - 1))
	}

	/** Takes the grid's column count, which `↑` `↓` step by (SERIES-001.10). */
	function setColumns(count: number) {
		columns.value = count
	}

	/** Makes the picture a row above (-1) or below (1) active. */
	function stepRow(step: -1 | 1) {
		setActive(rowStep(active.value, step, columns.value, current.value?.length ?? 0))
	}

	/** Shows the series at `at` with its first picture active. */
	function show(at: number) {
		index.value = at
		setActive(0)
	}

	/** Opens the compare on the first series. */
	function start() {
		open.value = true
		context.holdHashes(true)
		show(0)
	}

	/** Closes the compare. */
	function close() {
		open.value = false
		context.holdHashes(false)
	}

	/** The next series, the first after the last (SERIES-001.11). */
	function skip() {
		show(count.value === 0 ? 0 : (position.value + 1) % count.value)
	}

	/** Decides the given or the active picture. */
	function decide(intent: DecisionIntent, picture = activePicture()) {
		if (picture !== null) {
			context.decide(intent, picture)
		}
	}

	/** Picks the given or the active picture and rejects the rest of the series as one step (SERIES-001.9). */
	function pickRest(picked = activePicture()) {
		const series = current.value
		if (picked !== null && series !== null) {
			context.pickRest(picked, series.filter((picture) => picture !== picked))
		}
	}

	/** Decides the active picture by a key; a star step counts from its rating, `advance` moves on unless it left (SERIES-001.10). */
	function decideByKey(intent: HotkeyIntent, advance: boolean) {
		const picture = activePicture()
		if (picture === null) {
			return
		}
		decide(intent.kind === 'ratingStep' ? { kind: 'rating', rating: stepRating(context.decisionOf(picture).rating, intent.step) } : intent, picture)
		if (advance && current.value?.includes(picture)) {
			setActive(active.value + 1)
		}
	}

	const viewer = useSeriesViewer<P>({
		decisionOf: context.decisionOf,
		closed: (picture) => {
			const at = current.value?.indexOf(picture) ?? -1
			if (at >= 0) {
				setActive(at)
			}
		},
	})

	/** Opens the series viewer on the picture at `at` of the shown series (SERIES-002.1). */
	function view(at = active.value) {
		if (current.value !== null) {
			viewer.openAt(current.value, at)
		}
	}

	const hotkeys: HotkeyHandlers = {
		decide: decideByKey,
		previous: () => setActive(active.value - 1),
		next: () => setActive(active.value + 1),
		up: () => stepRow(-1),
		down: () => stepRow(1),
		'pick-rest': () => pickRest(),
		close,
	}

	const { settings, updateSettings, toast } = context
	return { open, current, position, count, active, setActive, setColumns, start, close, skip, decide, pickRest, hotkeys, viewer, view, settings, updateSettings, toast }
}

export type SeriesCompareFlow<P> = ReturnType<typeof useSeriesCompare<P>>
