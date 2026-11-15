// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InjectionKey, Ref } from 'vue'
import type { useCull } from './cull.ts'
import type { DeleteFlow } from './delete-flow.ts'
import type { Legacy } from './legacy.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { MoveFlow } from './move-flow.ts'
import type { useResume } from './resume.ts'
import type { useSelectionMode } from './selection-mode.ts'
import type { SeriesCompareFlow } from './series-compare.ts'
import type { SidecarFlow } from './sidecar-flow.ts'
import type { useTagEntryTargets } from './tag-entry-targets.ts'
import type { useToastedDecisions } from './toasted-decisions.ts'

import { inject, provide } from 'vue'

/** What the cull's screens share: App provides it once instead of passing it down as props (ADR 0028). */
export interface CullContext {
	readonly cull: ReturnType<typeof useCull>
	readonly selection: ReturnType<typeof useSelectionMode>
	readonly decide: ReturnType<typeof useToastedDecisions>['decide']
	readonly deleting: Pick<DeleteFlow, 'rejected' | 'rawRemovable' | 'review' | 'removeRaws' | 'summarise'>
	readonly moving: Pick<MoveFlow, 'open'>
	readonly resume: Pick<ReturnType<typeof useResume>, 'resumeName' | 'resume' | 'dismiss'>
	readonly seriesCompare: Pick<SeriesCompareFlow<Picture<ListingEntry>>, 'start'>
	readonly sidecars: Pick<SidecarFlow, 'ask'>
	readonly legacy: Legacy
	readonly tagEntry: Pick<ReturnType<typeof useTagEntryTargets>, 'open'>
	/** Whether the toolbar and the filter bar show above the grid. */
	readonly headerShown: Ref<boolean>
	openLoupe(index: number): void
	openSettings(): void
}

const CULL_CONTEXT: InjectionKey<CullContext> = Symbol('honeycomb cull context')

/** Provides the context to the screens below the calling component. */
export function provideCullContext(context: CullContext): void {
	provide(CULL_CONTEXT, context)
}

/** The context a parent provided; throws when a screen is mounted without one. */
export function useCullContext(): CullContext {
	const context = inject(CULL_CONTEXT, null)
	if (context === null) {
		throw new Error('The cull context is missing: mount the screen below a component that provides it')
	}
	return context
}
