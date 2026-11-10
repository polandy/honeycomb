// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { fullLongEdge, GRID_TIERS, gridSrcset, imageMember, LOUPE_TIER, loupeSources, sharpTier, smallSource } from '../../../src/logic/image-tiers.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const urlFor = (fileId: number, size: number, mtime: number) => `/img/${fileId}?size=${size}&v=${mtime}`

describe('image tiers', () => {
	// spec: IMAGES-001.4
	it('are 256 and 512 px for the grid and 2048 px for the loupe (ADR 0010)', () => {
		expect([...GRID_TIERS, LOUPE_TIER]).toEqual([256, 512, 2048])
	})
})

describe('imageMember', () => {
	it.each([
		['the rendered member of a pair', ['/P/A.NEF', '/P/A.JPG'], 2],
		['the rendered member of a JPEG single', ['/P/A.JPG'], 1],
		['the RAW member of a RAW single', ['/P/A.NEF'], 1],
	// spec: IMAGES-001.9
	])('shows %s', (_case, paths, fileId) => {
		const picture = pictureOf(...paths.map((path, index) => listingEntry(index + 1, path)))

		expect(imageMember(picture).fileId).toBe(fileId)
	})
})

describe('grid sources', () => {
	const member = listingEntry(7, '/P/A.JPG', { mtime: 1234 })

	it('offers both grid tiers by width', () => {
		expect(gridSrcset(member, urlFor)).toBe('/img/7?size=256&v=1234 256w, /img/7?size=512&v=1234 512w')
	})

	it('loads the small tier first', () => {
		expect(smallSource(member, urlFor)).toBe('/img/7?size=256&v=1234')
	})
})

describe('sharpTier', () => {
	it.each([
		[160, 1, 256],
		[128, 2, 256],
		[160, 2, 512],
		[256, 2, 512],
		[340, 3, 512],
	])('picks for a %d px tile at %d× the tier %d', (tileCssPx, devicePixelRatio, tier) => {
		expect(sharpTier(tileCssPx, devicePixelRatio)).toBe(tier)
	})
})

describe('loupe sources', () => {
	it('are the large grid tier, the loupe tier and the full image', () => {
		const member = listingEntry(7, '/P/A.JPG', { mtime: 1234 })

		expect(loupeSources(member, urlFor)).toEqual({
			preview: '/img/7?size=512&v=1234',
			loupe: '/img/7?size=2048&v=1234',
			full: '/img/7?size=0&v=1234',
		})
	})

	it('take the full long edge from the listing, else the loupe tier', () => {
		expect(fullLongEdge(listingEntry(1, '/P/A.JPG', { width: 6000, height: 4000 }))).toBe(6000)
		expect(fullLongEdge(listingEntry(1, '/P/A.JPG', { width: 3000, height: 4500 }))).toBe(4500)
		expect(fullLongEdge(listingEntry(1, '/P/A.JPG', { width: 6000 }))).toBe(LOUPE_TIER)
	})
})
