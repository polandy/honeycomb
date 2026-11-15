// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InjectionKey, Ref } from 'vue'
import type { BrowserStorage } from './browser-storage.ts'
import type { useCull } from './cull.ts'
import type { DeleteFlow } from './delete-flow.ts'
import type { Legacy } from './legacy.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { Settings } from './logic/settings.ts'
import type { useLoupeOpening } from './loupe-opening.ts'
import type { MoveFlow } from './move-flow.ts'
import type { useRestOffer } from './rest-offer.ts'
import type { useResume } from './resume.ts'
import type { useSelectionMode } from './selection-mode.ts'
import type { SeriesCompareFlow } from './series-compare.ts'
import type { SidecarFlow } from './sidecar-flow.ts'
import type { useTagEntryTargets } from './tag-entry-targets.ts'
import type { useToast } from './toast.ts'
import type { useToastedDecisions } from './toasted-decisions.ts'
import type { ViewStateStore } from './view-state.ts'

import { inject, provide } from 'vue'

/** What the cull's screens share: App provides it once instead of passing it down as props (ADR 0028). */
export interface CullContext {
	readonly cull: ReturnType<typeof useCull>
	readonly selection: ReturnType<typeof useSelectionMode>
	readonly decide: ReturnType<typeof useToastedDecisions>['decide']
	/** The grid's *Series…* menu edits, with their toasts. */
	readonly editSeries: ReturnType<typeof useToastedDecisions>['editSelection']
	readonly deleting: Pick<DeleteFlow, 'rejected' | 'rawRemovable' | 'review' | 'removeRaws' | 'summarise' | 'allDecided'>
	readonly moving: Pick<MoveFlow, 'open' | 'openShown'>
	readonly resume: Pick<ReturnType<typeof useResume>, 'resumeName' | 'resume' | 'dismiss'>
	/** Whole, as the series compare screen binds nearly all of it. */
	readonly seriesCompare: SeriesCompareFlow<Picture<ListingEntry>>
	readonly sidecars: Pick<SidecarFlow, 'ask'>
	/** The picture whose sidecar writes still wait (XMP-003.28). */
	readonly unsaved: Readonly<Ref<Picture<ListingEntry> | null>>
	readonly legacy: Legacy
	readonly tagEntry: Pick<ReturnType<typeof useTagEntryTargets>, 'open'>
	/** Whether the toolbar and the filter bar show above the grid. */
	readonly headerShown: Ref<boolean>
	openLoupe(index: number): void
	openSettings(): void
	/** The open loupe: what it shows, paging, landing a compare in it and closing it. */
	readonly loupe: Pick<ReturnType<typeof useLoupeOpening>, 'shown' | 'page' | 'land' | 'close'>
	/** Offers *Reject the other N* after a Pick in the loupe. */
	readonly restOffer: ReturnType<typeof useRestOffer<Picture<ListingEntry>>>
	readonly toast: ReturnType<typeof useToast>['show']
	readonly settings: Readonly<Ref<Settings>>
	updateSettings(patch: Partial<Settings>): void
	readonly viewState: ViewStateStore
	readonly storage: BrowserStorage
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
