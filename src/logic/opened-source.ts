// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSet } from './folder-set.ts'

import { folderSetKey } from './folder-set.ts'

/** What an opened source allows beside deciding; the Immich source allows none of it in Phase 1 (ADR 0041, IMMICH-002.17). */
export interface SourceCapabilities {
	readonly series: boolean
	readonly similarity: boolean
	readonly tags: boolean
	readonly delete: boolean
	readonly move: boolean
	readonly removeRaws: boolean
	readonly keepRaw: boolean
	readonly xmp: boolean
}

/** The confirmed folders of a Nextcloud cull. */
export interface FolderSource {
	readonly kind: 'folders'
	/** Names the source whatever the order of its paths, for *Recent* and the position. */
	readonly key: string
	readonly set: FolderSet
	readonly capabilities: SourceCapabilities
}

/** One connection's upload library (ADR 0041). */
export interface ImmichSource {
	readonly kind: 'immich'
	readonly key: string
	/** The connection's id from the connections file (ADR 0042). */
	readonly connection: string
	readonly capabilities: SourceCapabilities
}

/** The source a cull shows. */
export type OpenedSource = FolderSource | ImmichSource

/** What a folder source offers: everything. */
export const EVERYTHING: SourceCapabilities = { series: true, similarity: true, tags: true, delete: true, move: true, removeRaws: true, keepRaw: true, xmp: true }
const DECISIONS_ONLY: SourceCapabilities = { series: false, similarity: false, tags: false, delete: false, move: false, removeRaws: false, keepRaw: false, xmp: false }

/** The folder set as a source that allows everything. */
export function folderSource(set: FolderSet): FolderSource {
	return { kind: 'folders', key: `folders:${folderSetKey(set)}`, set, capabilities: EVERYTHING }
}

/** The connection as a source that allows deciding only. */
export function immichSource(connection: string): ImmichSource {
	return { kind: 'immich', key: `immich:${connection}`, connection, capabilities: DECISIONS_ONLY }
}

/** Whether both name the same source, or both none. */
export function sameSource(first: OpenedSource | null, second: OpenedSource | null): boolean {
	return first?.key === second?.key
}

/** The folder set of a folder source, null for any other or none. */
export function folderSetOf(source: OpenedSource | null): FolderSet | null {
	return source?.kind === 'folders' ? source.set : null
}
