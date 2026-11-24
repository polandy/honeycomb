// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionRow, ImmichEntry, ImmichImageSize } from './logic/immich-asset.ts'
import type { CountsRequest, ImmichCounts } from './logic/immich-counts.ts'
import type { RequestFilters } from './logic/immich-filters.ts'
import type { AssetsRequest, Page } from './logic/immich-paging.ts'
import type { PictureSource } from './logic/picture-source.ts'

import { GRID_TIERS } from './logic/image-tiers.ts'
import { DECISIONS_ONLY } from './logic/opened-source.ts'

/** How many entries one page asks; the server allows 1 to 250 (ADR 0044). */
export const PAGE_SIZE = 100

/** What the Immich cull asks of the server (ADR 0044). */
export interface ImmichCullApi {
	assets: (connectionId: string, request: AssetsRequest) => Promise<Page>
	counts: (connectionId: string, request: CountsRequest) => Promise<ImmichCounts>
	saveDecisions: (connectionId: string, rows: readonly DecisionRow[]) => Promise<string[]>
	imageUrl: (connectionId: string, assetId: string, size: ImmichImageSize, version: string) => string
}

/** The types the Immich source works in. */
export interface ImmichShape {
	readonly entry: ImmichEntry
	readonly page: Page
	readonly listQuery: RequestFilters
	readonly countsQuery: CountsRequest
	readonly counts: ImmichCounts
	readonly row: DecisionRow
}

/** One connection's upload library as a picture source: paged and counted on the server, deciding only (ADR 0044, ADR 0058). */
export function immichPictureSource(api: ImmichCullApi, connectionId: string): PictureSource<ImmichShape> {
	return {
		capabilities: DECISIONS_ONLY,
		list: (filters, cursor) => api.assets(connectionId, { filters, cursor, size: PAGE_SIZE }),
		counts: (request) => api.counts(connectionId, request),
		imageUrl: (entry, size) => {
			const thumbnail = size > 0 && size <= GRID_TIERS.at(-1)!
			return api.imageUrl(connectionId, entry.assetId, thumbnail ? 'thumbnail' : 'preview', entry.updatedAt)
		},
		decide: async (rows) => {
			await api.saveDecisions(connectionId, rows)
		},
	}
}
