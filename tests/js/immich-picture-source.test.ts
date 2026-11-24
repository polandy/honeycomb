// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ImmichCullApi } from '../../src/immich/immich-picture-source.ts'

import { describe, expect, it, vi } from 'vitest'
import { immichPictureSource, PAGE_SIZE } from '../../src/immich/immich-picture-source.ts'
import { GRID_TIERS } from '../../src/logic/image-tiers.ts'
import { decisionRow } from '../../src/logic/immich-asset.ts'
import { defaultImmichFilters, requestFilters } from '../../src/logic/immich-filters.ts'
import { DECISIONS_ONLY } from '../../src/logic/opened-source.ts'
import { COUNTS, page } from './immich-cull-fixtures.ts'
import { immichEntry, NOW, UTC_CALENDAR } from './logic/immich-fixtures.ts'

/** A fake server that answers each request at once. */
function serverApi() {
	return {
		assets: vi.fn<ImmichCullApi['assets']>().mockResolvedValue(page(['a1'], 'c2')),
		counts: vi.fn<ImmichCullApi['counts']>().mockResolvedValue(COUNTS),
		saveDecisions: vi.fn<ImmichCullApi['saveDecisions']>().mockResolvedValue(['a1']),
		imageUrl: vi.fn<ImmichCullApi['imageUrl']>((id, assetId, size, version) => `${id}/${assetId}/${size}?v=${version}`),
	}
}

const FILTERS = requestFilters(defaultImmichFilters(NOW, UTC_CALENDAR), NOW, UTC_CALENDAR)

describe('immichPictureSource', () => {
	// spec: IMMICH-002.17
	it('allows deciding only', () => {
		expect(immichPictureSource(serverApi(), 'andy-phone').capabilities).toBe(DECISIONS_ONLY)
	})

	// spec: IMMICH-002.6
	it('lists a page of the connection after the cursor, a page size at a time', async () => {
		const api = serverApi()

		const answer = await immichPictureSource(api, 'andy-phone').list(FILTERS, 'c1')

		expect(api.assets).toHaveBeenCalledWith('andy-phone', { filters: FILTERS, cursor: 'c1', size: PAGE_SIZE })
		expect(answer.nextCursor).toBe('c2')
	})

	// spec: IMMICH-002.13
	it('counts on the connection', async () => {
		const api = serverApi()
		const request = { filters: FILTERS, periods: [] }

		await expect(immichPictureSource(api, 'andy-phone').counts(request)).resolves.toBe(COUNTS)
		expect(api.counts).toHaveBeenCalledWith('andy-phone', request)
	})

	// spec: IMMICH-002.16
	it('names the thumbnail for the grid\'s tiers and the preview above and for no size, by the entry\'s version', () => {
		const source = immichPictureSource(serverApi(), 'andy-phone')
		const entry = immichEntry('a1', { updatedAt: 'v7' })

		expect(source.imageUrl(entry, GRID_TIERS[0]!)).toBe('andy-phone/a1/thumbnail?v=v7')
		expect(source.imageUrl(entry, GRID_TIERS.at(-1)!)).toBe('andy-phone/a1/thumbnail?v=v7')
		expect(source.imageUrl(entry, GRID_TIERS.at(-1)! + 1)).toBe('andy-phone/a1/preview?v=v7')
		expect(source.imageUrl(entry, 0)).toBe('andy-phone/a1/preview?v=v7')
	})

	// spec: IMMICH-003.4
	it('saves the decision rows on the connection and fails when the server does', async () => {
		const api = serverApi()
		const rows = [decisionRow(immichEntry('a1'), { flag: 'picked', rating: 0, colourLabel: null, keepRaw: false })]
		const source = immichPictureSource(api, 'andy-phone')

		await expect(source.decide(rows)).resolves.toBeUndefined()
		expect(api.saveDecisions).toHaveBeenCalledWith('andy-phone', rows)
		api.saveDecisions.mockRejectedValueOnce(new Error('database down'))
		await expect(source.decide(rows)).rejects.toThrow('database down')
	})
})
