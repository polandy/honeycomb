// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Component } from 'vue'
import type { CullContext } from '../../src/cull-context.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, ref } from 'vue'
import { provideCullContext } from '../../src/cull-context.ts'
import { useCull } from '../../src/cull.ts'
import { useLegacy } from '../../src/legacy.ts'
import { useSelectionMode } from '../../src/selection-mode.ts'
import { ENTRIES, fakeStorage, NO_LEGACY, NO_SERIES, NO_SIDECARS, NO_TAGS, SET, WRITING_ON } from './app-cull.ts'

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
 * are fakes that record each call in `calls`.
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
		warmPreviews: async () => undefined,
		lookupDecisions: async () => [],
		saveDecisions: async () => undefined,
		lookupSeries: NO_SERIES,
		tags: NO_TAGS,
	}, fakeStorage(), () => WRITING_ON, NO_SIDECARS, () => undefined)
	cull.open(SET, entries)
	await flushPromises()
	const context: CullContext = {
		cull,
		selection: useSelectionMode(() => cull.view.value, cull.pictures),
		decide: record('decide'),
		deleting: { rejected: computed(() => counts.value.rejected), rawRemovable: computed(() => counts.value.rawRemovable), review: record('review'), removeRaws: record('removeRaws'), summarise: record('summarise') },
		moving: { open: record('move') },
		resume: { resumeName: computed(() => counts.value.resumeName), resume: record('resume'), dismiss: record('dismissResume') },
		seriesCompare: { start: record('compareSeries') },
		sidecars: { ask: record('writeSidecars') },
		tagEntry: { open: (chosen) => {
			calls.push(['tag', chosen])
			return true
		} },
		legacy: useLegacy(NO_LEGACY, record('saveFile'), record('toast'), () => false),
		headerShown: ref(true),
		openLoupe: record('openLoupe'),
		openSettings: record('openSettings'),
	}
	return { context, calls, counts }
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
