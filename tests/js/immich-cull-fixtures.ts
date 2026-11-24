// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AssetsRequest, CountsRequest, ImmichCullApi } from '../../src/immich-cull.ts'
import type { DecisionRow, ImmichEntry } from '../../src/logic/immich-asset.ts'
import type { ImmichCounts } from '../../src/logic/immich-counts.ts'
import type { Page } from '../../src/logic/immich-paging.ts'

import { vi } from 'vitest'
import { useImmichCull } from '../../src/immich-cull.ts'
import { imageMember } from '../../src/logic/image-tiers.ts'
import { immichEntry, NOW, UTC_CALENDAR } from './logic/immich-fixtures.ts'

export const COUNTS: ImmichCounts = { total: 1000, undecided: 1000, decided: 0, matching: 1000, flags: { picked: 0, rejected: 0, unflagged: 1000 }, ratings: {}, colourLabels: {}, devices: [], kinds: { photo: 1000, live: 0, video: 0 }, periods: [] }

/** A page of entries named by their ids. */
export const page = (ids: readonly string[], nextCursor: string | null = null): Page => ({ entries: ids.map((id) => immichEntry(id)), nextCursor, previousCursor: null })

/** The Immich cull over a fake server; each request waits until the test answers it. */
export function cullOn() {
	const assets: { request: AssetsRequest, answer: (page: Page) => void, fail: (error: Error) => void }[] = []
	const counts: { request: CountsRequest, answer: (counts: ImmichCounts) => void }[] = []
	const saves: { rows: readonly DecisionRow[], answer: () => void, fail: (error: Error) => void }[] = []
	const api: ImmichCullApi = {
		assets: (_id, request) => new Promise((answer, fail) => assets.push({ request, answer, fail })),
		counts: (_id, request) => new Promise((answer) => counts.push({ request, answer })),
		saveDecisions: (_id, rows) => new Promise((answer, fail) => saves.push({ rows, answer: () => answer(rows.map((row) => row.assetId)), fail })),
		imageUrl: (id, assetId, size, version) => `${id}/${assetId}/${size}?v=${version}`,
	}
	const toast = { show: vi.fn(), showError: vi.fn() }
	const saveFilters = vi.fn()
	const cull = useImmichCull({ api, now: () => NOW, calendar: UTC_CALENDAR, dayLabel: (seconds) => `day ${seconds}`, toast, saveFilters })
	return { cull, assets, counts, saves, toast, saveFilters }
}

/** The asset ids of the cull's pictures. */
export const assetIds = (cull: ReturnType<typeof useImmichCull>) => cull.pictures.value.map((picture) => (imageMember(picture) as unknown as { asset: ImmichEntry }).asset.assetId)
