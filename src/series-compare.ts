// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HotkeyHandlers } from './hotkeys.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision } from './logic/decision.ts'
import type { HotkeyIntent } from './logic/hotkeys.ts'

import { computed, ref, shallowRef } from 'vue'
import { stepRating } from './logic/hotkeys.ts'

/** What the series compare reads from the cull and hands to it. */
export interface SeriesCompareContext<P> {
	readonly series: () => readonly (readonly P[])[]
	readonly decisionOf: (picture: P) => Decision
	readonly decide: (intent: DecisionIntent, picture: P) => void
	readonly pickRest: (picked: P, rest: readonly P[]) => void
}

/** The series compare dialog's state: which series it shows, which picture is active, and its keys (SERIES-001). */
export function useSeriesCompare<P>(context: SeriesCompareContext<P>) {
	const open = ref(false)
	const index = ref(0)
	const activeIndex = ref(0)
	const anchor = shallowRef<readonly P[]>([])

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

	function setActive(at: number) {
		anchor.value = current.value ?? []
		activeIndex.value = Math.max(0, Math.min(at, anchor.value.length - 1))
	}

	function show(at: number) {
		index.value = at
		setActive(0)
	}

	function start() {
		open.value = true
		show(0)
	}

	function close() {
		open.value = false
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

	const hotkeys: HotkeyHandlers = {
		decide: decideByKey,
		previous: () => setActive(active.value - 1),
		next: () => setActive(active.value + 1),
		'pick-rest': () => pickRest(),
		close,
	}

	return { open, current, position, count, active, setActive, start, close, skip, decide, pickRest, hotkeys }
}
