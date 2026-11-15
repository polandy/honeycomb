// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HotkeyHandlers } from './hotkeys.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision } from './logic/decision.ts'
import type { HotkeyIntent } from './logic/hotkeys.ts'
import type { Series } from './logic/series.ts'
import type { Settings } from './logic/settings.ts'
import type { SeriesStatus } from './logic/stored-series.ts'
import type { Toast } from './toast.ts'

import { computed, ref, shallowRef, watch } from 'vue'
import { rowStep } from './logic/compare-grid.ts'
import { stepRating } from './logic/hotkeys.ts'
import { seriesNeighbours, visibleMembers } from './logic/series.ts'
import { useSeriesViewer } from './series-viewer.ts'

/** What the series compare reads from the cull and hands to it. */
export interface SeriesCompareContext<P> {
	readonly series: () => readonly Series<P>[]
	readonly decisionOf: (picture: P) => Decision
	/** `inViewer` when the series viewer decided, whose pick offers to reject the rest (SERIES-002.11). */
	readonly decide: (intent: DecisionIntent, picture: P, inViewer: boolean) => void
	readonly pickRest: (picked: P, rest: readonly P[]) => void
	readonly removeFromSeries: (series: Series<P>, picture: P) => void
	readonly dissolve: (series: Series<P>) => void
	/** Every series of the folder set, decided or not, whose neighbours a series merges with (SERIES-005.8). */
	readonly everySeries: () => readonly Series<P>[]
	/** Merges the series, in capture-time order, into one. */
	readonly merge: (series: readonly Series<P>[]) => void
	/** Marks the series done or reopens it (SERIES-005.14, .15). */
	readonly markSeries: (series: Series<P>, status: SeriesStatus) => void
	readonly settings: () => Settings
	readonly updateSettings: (patch: Partial<Settings>) => void
	readonly toast: (toast: Toast) => void
	readonly holdHashes: (hold: boolean) => void
}

/** Which neighbour of the shown series a merge takes. */
export type MergeDirection = 'previous' | 'next'

/** The series with their rejected pictures left out, those with fewer than two pictures left gone. */
function shownSeries<P>(series: readonly Series<P>[], decisionOf: (picture: P) => Decision): Series<P>[] {
	return series.map((each) => ({ ...each, members: visibleMembers(each.members, decisionOf) })).filter(({ members }) => members.length > 1)
}

/** Where the loupe lands once a compare opened from it closes: on a picture, or after a series (SERIES-001.24). */
export type CompareLanding<P> = { readonly kind: 'on', readonly picture: P } | { readonly kind: 'after', readonly series: Series<P>, readonly picked: P }

/** The series compare dialog's state: which series it shows, which picture is active, and its keys (SERIES-001). */
export function useSeriesCompare<P>(context: SeriesCompareContext<P>) {
	const open = ref(false)
	const index = ref(0)
	const shownKey = ref<number | null>(null)
	const activeIndex = ref(0)
	const anchor = shallowRef<readonly P[]>([])
	const columns = ref(1)
	const single = shallowRef<Series<P> | null>(null)
	let land: ((landing: CompareLanding<P>) => void) | null = null

	const oneSeries = computed(() => single.value !== null)
	const all = computed(() => shownSeries(single.value === null ? context.series() : [single.value], context.decisionOf))
	const count = computed(() => all.value.length)
	const keyed = computed(() => all.value.findIndex(({ key }) => key === shownKey.value))
	// By key while its series is listed, else by place: a decided series gives way to the next.
	const position = computed(() => (keyed.value >= 0 ? keyed.value : index.value < count.value ? index.value : 0))
	const current = computed(() => all.value[position.value] ?? null)
	const active = computed(() => {
		const members = current.value?.members ?? []
		return members.some((picture) => anchor.value.includes(picture)) ? Math.min(activeIndex.value, members.length - 1) : 0
	})
	const activePicture = () => current.value?.members[active.value] ?? null
	const neighbours = computed(() => seriesNeighbours(shownSeries(context.everySeries(), context.decisionOf), current.value?.key ?? null))

	/** Makes the picture at `at` of the shown series active, clamped. */
	function setActive(at: number) {
		anchor.value = current.value?.members ?? []
		activeIndex.value = Math.max(0, Math.min(at, anchor.value.length - 1))
	}

	/** Takes the grid's column count, which `↑` `↓` step by (SERIES-001.10). */
	function setColumns(count: number) {
		columns.value = count
	}

	/** Makes the picture a row above (-1) or below (1) active. */
	function stepRow(step: -1 | 1) {
		setActive(rowStep(active.value, step, columns.value, current.value?.members.length ?? 0))
	}

	/** Shows the series at `at` with its first picture active. */
	function show(at: number) {
		index.value = at
		shownKey.value = all.value[at]?.key ?? null
		setActive(0)
	}

	/** Opens the compare on the first series. */
	function start() {
		open.value = true
		context.holdHashes(true)
		show(0)
	}

	/** Opens the compare from the loupe on one series, the picture active; `onLand` gets where the loupe lands on closing (SERIES-001.24). */
	function startOn(series: Series<P>, picture: P, onLand: (landing: CompareLanding<P>) => void) {
		single.value = series
		land = onLand
		start()
		setActive(Math.max(0, current.value?.members.indexOf(picture) ?? 0))
	}

	/** Closes the compare; opened from the loupe, the loupe lands on the active picture or the given landing. */
	function close(landing: CompareLanding<P> | null = activeLanding()) {
		if (!open.value) {
			return
		}
		const onLand = land
		open.value = false
		single.value = null
		land = null
		context.holdHashes(false)
		if (onLand !== null && landing !== null) {
			onLand(landing)
		}
	}

	/** The landing on the active picture, none once the series is gone. */
	function activeLanding(): CompareLanding<P> | null {
		const picture = activePicture()
		return picture === null ? null : { kind: 'on', picture }
	}

	// The place a series shown by key falls back to once a rejected first picture re-keys it.
	watch(keyed, (at) => at >= 0 && (index.value = at), { flush: 'sync' })

	// Opened from the loupe, a series left with fewer than two pictures ends the compare.
	watch(current, (series) => series === null && single.value !== null && close(null), { flush: 'sync' })

	/** The next series, the first after the last (SERIES-001.11). */
	function skip() {
		show(count.value === 0 ? 0 : (position.value + 1) % count.value)
	}

	/** Decides the given or the active picture. */
	function decide(intent: DecisionIntent, picture = activePicture()) {
		if (picture !== null) {
			context.decide(intent, picture, false)
		}
	}

	/** Decides the series viewer's picture. */
	function decideInViewer(intent: DecisionIntent, picture: P) {
		context.decide(intent, picture, true)
	}

	/** Picks the given or the active picture and rejects the rest of the series as one step (SERIES-001.9). */
	function pickRest(picked = activePicture()) {
		const series = current.value
		if (picked !== null && series !== null) {
			const onLand = land
			land = null
			if (onLand === null) {
				context.pickRest(picked, series.members.filter((picture) => picture !== picked))
				return
			}
			close(null)
			pickRestAndLand(series, picked, onLand)
		}
	}

	/** Picks the picture, rejects the rest of its series as one step and lands after the series (SERIES-001.24, LOUPE-002.15). */
	function pickRestAndLand(series: Series<P>, picked: P, onLand: (landing: CompareLanding<P>) => void) {
		context.pickRest(picked, series.members.filter((picture) => picture !== picked))
		onLand({ kind: 'after', series, picked })
	}

	/** Takes the given or the active picture out of the shown series (SERIES-005.10); opened from the loupe, it follows the series that is left. */
	function removeFromSeries(picture = activePicture()) {
		const series = current.value
		if (picture === null || series === null) {
			return
		}
		context.removeFromSeries(series, picture)
		if (single.value !== null) {
			const rest = series.members.filter((member) => member !== picture)
			single.value = context.series().find(({ members }) => members.some((member) => rest.includes(member)))
				?? { ...single.value, members: single.value.members.filter((member) => member !== picture) }
		}
	}

	/** Dissolves the shown series and moves on as after Skip (SERIES-005.13); opened from the loupe, it closes on the active picture. */
	function dissolve() {
		const series = current.value
		if (series === null) {
			return
		}
		context.dissolve(series)
		if (single.value !== null) {
			close()
		}
	}

	/** Merges the shown series with its previous or next one and shows the merged series, the active picture still active (SERIES-005.8). */
	function merge(direction: MergeDirection) {
		const series = current.value
		const other = neighbours.value[direction]
		const picture = activePicture()
		if (series === null || other === null || picture === null) {
			return
		}
		context.merge(direction === 'next' ? [series, other] : [other, series])
		const merged = context.everySeries().find(({ members }) => members.includes(picture))
		if (merged !== undefined) {
			if (single.value !== null) {
				single.value = merged
			}
			shownKey.value = merged.key
			setActive(current.value?.members.indexOf(picture) ?? 0)
		}
	}

	/** Marks the shown series done, moving on as after Skip, or reopens it; opened from the loupe, it keeps showing it (SERIES-005.14, .15). */
	function markDone(done: boolean) {
		const series = current.value
		if (series === null) {
			return
		}
		context.markSeries(series, done ? 'done' : 'open')
		if (single.value !== null) {
			single.value = context.everySeries().find(({ key }) => key === series.key) ?? single.value
		}
	}

	/** Decides the active picture by a key; a star step counts from its rating, `advance` moves on unless it left (SERIES-001.10). */
	function decideByKey(intent: HotkeyIntent, advance: boolean) {
		const picture = activePicture()
		if (picture === null) {
			return
		}
		decide(intent.kind === 'ratingStep' ? { kind: 'rating', rating: stepRating(context.decisionOf(picture).rating, intent.step) } : intent, picture)
		if (advance && current.value?.members.includes(picture)) {
			setActive(active.value + 1)
		}
	}

	const viewer = useSeriesViewer<P>({
		decisionOf: context.decisionOf,
		closed: (picture) => {
			const at = current.value?.members.indexOf(picture) ?? -1
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
		close: () => close(),
	}

	const { settings, updateSettings, toast } = context
	return { open, oneSeries, current, position, count, active, neighbours, setActive, setColumns, start, startOn, close, skip, decide, decideInViewer, pickRest, pickRestAndLand, removeFromSeries, dissolve, merge, markDone, hotkeys, viewer, view, settings, updateSettings, toast }
}

export type SeriesCompareFlow<P> = ReturnType<typeof useSeriesCompare<P>>
