// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ref } from 'vue'
import type { LoupeSnapshot } from './delete-flow.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { MtimeOffset } from './logic/move-candidates.ts'
import type { MoveRequestFile, Probe } from './logic/move-plan.ts'
import type { MoveResponseFile } from './logic/move-report.ts'
import type { Picture } from './logic/pairing.ts'
import type { ChunkLimits } from './logic/request-chunks.ts'
import type { Settings } from './logic/settings.ts'
import type { ToastAction } from './toast.ts'

type Pictures = readonly Picture<ListingEntry>[]

/** What a move reads and changes in the cull. */
export interface MoveFlowContext {
	readonly view: () => Pictures
	readonly settings: () => Settings
	readonly updateSettings: (patch: Partial<Settings>) => void
	readonly probe: (folders: readonly string[], sources: readonly string[]) => Promise<Probe>
	readonly move: (pictures: readonly (readonly MoveRequestFile[])[]) => Promise<MoveResponseFile[][]>
	/** Writes the waiting sidecars and waits for every write in flight (XMP-003.30). */
	readonly flush: () => Promise<void>
	/** The picture with its sidecars as honeycomb last saved them since the listing (MOVE-004.19). */
	readonly current: (picture: Picture<ListingEntry>) => Picture<ListingEntry>
	/** Takes the files out of the listing; returns what each affected picture became. */
	readonly removeFiles: (fileIds: ReadonlySet<number>) => ReadonlyMap<Picture<ListingEntry>, Picture<ListingEntry> | null>
	readonly restoreFiles: (entries: readonly ListingEntry[]) => void
	/** Identifies the open listing; an undo restores files only into the one the move left. */
	readonly listing?: () => unknown
	readonly loupe: Ref<LoupeSnapshot | null>
	readonly toast: (message: string, action?: ToastAction | null) => void
	/** Says a failure and keeps it until the user closes it. */
	readonly error: (message: string, action?: ToastAction | null) => void
	/** Lists the open folder set again; the failure messages offer it. */
	readonly reload?: () => void
	readonly offset?: MtimeOffset
	/** Overrides the request size of ADR 0029, for tests. */
	readonly chunks?: ChunkLimits | undefined
}

/** The endpoints a move uses (ADR 0018). */
export interface MoveApi {
	readonly probeTargets: MoveFlowContext['probe']
	readonly movePictures: MoveFlowContext['move']
}
