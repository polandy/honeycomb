// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Component } from 'vue'
import type { CullContext } from '../../src/cull-context.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, ref, shallowRef } from 'vue'
import { provideCullContext } from '../../src/cull-context.ts'
import { useCull } from '../../src/cull.ts'
import { useLegacy } from '../../src/legacy.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { useLoupeOpening } from '../../src/loupe-opening.ts'
import { useSelectionMode } from '../../src/selection-mode.ts'
import { useSeriesCompare } from '../../src/series-compare.ts'
import { ENTRIES, fakeStorage, fakeViewState, NO_LEGACY, NO_SERIES, NO_SIDECARS, NO_TAGS, SAVED_SERIES, SET } from './app-cull.ts'

/** One call of a context action: its name and arguments. */
export type ContextCall = [name: string, ...args: unknown[]]

/** What the fake flows of the context report, changed by a test before it mounts. */
export interface ContextCounts {
	rejected: Picture<ListingEntry>[]
	rawRemovable: number
	resumeName: string | null
}

/**
 * A cull context over a real cull opened on `entries` and a real selection; the flows around them
 * are fakes that record each call in `calls`. The loupe and the series compare (`flow`) open for
 * real; the compare's entry points in the context and what it hands back to the cull are recorded.
 */
export async function fakeCullContext(entries: readonly ListingEntry[] = ENTRIES) {
	const calls: ContextCall[] = []
	const record = (name: string) => (...args: unknown[]) => {
		calls.push([name, ...args])
	}
	const counts = ref<ContextCounts>({ rejected: [], rawRemovable: 0, resumeName: null })
	const cull = useCull({
		hashImage: () => new Promise(() => undefined),
		saveVisualHashes: async () => undefined,
		wait: async () => {},
		warmPreviews: async () => undefined,
		lookupDecisions: async () => [],
		saveDecisions: async () => undefined,
		lookupSeries: NO_SERIES,
		saveSeries: SAVED_SERIES,
		tags: NO_TAGS,
	}, fakeStorage(), () => DEFAULT_SETTINGS, NO_SIDECARS)
	cull.open(SET, entries, [])
	await flushPromises()
	const opening = useLoupeOpening(async (index) => record('reveal')(index), () => true)
	const flow = useSeriesCompare<Picture<ListingEntry>>({ series: () => cull.series.value, decisionOf: cull.decisionOf, decide: record('compareDecide'), pickRest: record('comparePickRest'), removeFromSeries: record('compareRemove'), dissolve: record('compareDissolve'), settings: () => DEFAULT_SETTINGS, updateSettings: record('updateSettings'), toast: (shown) => record('toast')(shown.message, shown.action), holdHashes: () => undefined })
	const context: CullContext = {
		cull,
		selection: useSelectionMode(() => cull.view.value, cull.pictures),
		decide: record('decide'),
		editSeries: record('editSeries'),
		deleting: { rejected: computed(() => counts.value.rejected), rawRemovable: computed(() => counts.value.rawRemovable), review: record('review'), removeRaws: record('removeRaws'), summarise: record('summarise'), allDecided: record('allDecided') },
		moving: { open: record('move'), openShown: record('moveShown') },
		resume: { resumeName: computed(() => counts.value.resumeName), resume: record('resume'), dismiss: record('dismissResume') },
		seriesCompare: { ...flow, start: record('compareSeries'), startOn: record('compareSeriesOn'), pickRestAndLand: record('pickRestAndLand') },
		sidecars: { ask: record('writeSidecars') },
		tagEntry: { open: (chosen) => {
			calls.push(['tag', chosen])
			return true
		} },
		legacy: useLegacy(NO_LEGACY, record('saveFile'), record('toast'), () => false),
		headerShown: ref(true),
		openLoupe: record('openLoupe'),
		openSettings: record('openSettings'),
		loupe: opening,
		restOffer: (intent, picture) => {
			calls.push(['restOffer', intent, picture])
			return null
		},
		toast: (message, action) => {
			calls.push(['toast', message, action])
			return () => undefined
		},
		settings: shallowRef(DEFAULT_SETTINGS),
		updateSettings: record('updateSettings'),
		viewState: fakeViewState(),
		storage: fakeStorage(),
	}
	return { context, calls, counts, opening, flow }
}

/** Mounts the screen under a parent that provides the context, as App provides it to its screens. */
export function mountInCullContext(screen: Component, context: CullContext, stubs: Record<string, Component | boolean> = {}) {
	const Parent = defineComponent({
		setup() {
			provideCullContext(context)
			return () => h(screen)
		},
	})
	return mount(Parent, { global: { stubs } })
}
