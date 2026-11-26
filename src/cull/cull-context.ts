// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InjectionKey, Ref } from 'vue'
import type { useResume } from '../folders/resume.ts'
import type { useSelectionMode } from '../grid/selection-mode.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Settings } from '../logic/settings.ts'
import type { useLoupeOpening } from '../loupe/loupe-opening.ts'
import type { MoveFlow } from '../move/move-flow.ts'
import type { useRestOffer } from '../series/rest-offer.ts'
import type { SeriesCompareFlow } from '../series/series-compare.ts'
import type { ViewStateStore } from '../settings/view-state.ts'
import type { BrowserStorage } from '../shared/browser-storage.ts'
import type { useToast } from '../shared/toast.ts'
import type { useXmpExport } from '../sidecars/xmp-export.ts'
import type { DeleteFlow } from '../trash/delete-flow.ts'
import type { useCull } from './cull.ts'
import type { useTagEntryTargets } from './tag-entry-targets.ts'
import type { useToastedDecisions } from './toasted-decisions.ts'

import { inject, provide } from 'vue'

/** What the cull's screens share: App provides it once instead of passing it down as props (ADR 0028). */
export interface CullContext {
	readonly cull: ReturnType<typeof useCull>
	readonly selection: ReturnType<typeof useSelectionMode<Picture<ListingEntry>>>
	readonly decide: ReturnType<typeof useToastedDecisions>['decide']
	readonly clearFlags: ReturnType<typeof useToastedDecisions>['clearFlags']
	readonly reduceSeries: ReturnType<typeof useToastedDecisions>['reduceSeries']
	/** Writing the picks and rejects to XMP files, with the count of files to write. */
	readonly xmpExport: ReturnType<typeof useXmpExport>
	/** The grid's *Series…* menu edits, with their toasts. */
	readonly editSeries: ReturnType<typeof useToastedDecisions>['editSelection']
	readonly deleting: Pick<DeleteFlow, 'rejected' | 'rawRemovable' | 'review' | 'removeRaws' | 'summarise' | 'allDecided'>
	readonly moving: Pick<MoveFlow, 'open' | 'openShown'>
	readonly resume: Pick<ReturnType<typeof useResume>, 'resumeName' | 'resume' | 'dismiss'>
	/** Whole, as the series compare screen binds nearly all of it. */
	readonly seriesCompare: SeriesCompareFlow<Picture<ListingEntry>>
	/** The picture whose sidecar writes still wait (XMP-003.28). */
	readonly unsaved: Readonly<Ref<Picture<ListingEntry> | null>>
	readonly tagEntry: Pick<ReturnType<typeof useTagEntryTargets>, 'open'>
	/** Whether the toolbar and the filter bar show above the grid. */
	readonly headerShown: Ref<boolean>
	/** Whether the cull was opened from *Folders*, and going back to it (FOLDERS-007.14). */
	readonly home: { readonly fromList: Readonly<Ref<boolean>>, back(): void }
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
	/** The URL of a preview tier of the opened source. */
	readonly imageUrl: ImageUrlFor
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
