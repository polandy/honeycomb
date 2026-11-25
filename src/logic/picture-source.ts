// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SourceCapabilities } from './opened-source.ts'

/** The types one kind of source works in: its listing's entry and page, what list and counts are asked by, the counts, a decision row and what a save answers. */
export interface SourceShape {
	readonly entry: unknown
	readonly page: unknown
	readonly listQuery: unknown
	readonly countsQuery: unknown
	readonly counts: unknown
	readonly row: unknown
	readonly saved: unknown
}

/** What a cull asks of its source (ADR 0058). */
export interface PictureSource<S extends SourceShape> {
	readonly capabilities: SourceCapabilities
	/** The page of the listing after the cursor, the first for null. */
	readonly list: (query: S['listQuery'], cursor: string | null) => Promise<S['page']>
	/** The counts of the listing. */
	readonly counts: (query: S['countsQuery']) => Promise<S['counts']>
	/** The URL of an entry's image for a display size in pixels; 0 asks the largest. */
	readonly imageUrl: (entry: S['entry'], size: number) => string
	/** Saves the decision rows and answers what the source made of them. */
	readonly decide: (rows: readonly S['row'][]) => Promise<S['saved']>
}
