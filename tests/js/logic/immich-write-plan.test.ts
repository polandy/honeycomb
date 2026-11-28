// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CheckedAsset, WriteChoices, WriteOptions, WrittenState } from '../../../src/logic/immich-write-plan.ts'

import { describe, expect, it } from 'vitest'
import { isPending, planWrite, WRITE_BLOCK, writeBlocks, writeTally } from '../../../src/logic/immich-write-plan.ts'
import { candidate, checked } from './immich-fixtures.ts'

const CHANGED_AT = '2026-11-21T08:30:00.000Z'
const TRASH: WriteOptions = { rejectAs: 'trash', picksAsFavorites: false, canDelete: true }
const NO_CHOICES: WriteChoices = { rating: new Map(), shared: new Map() }

function checks(...assets: CheckedAsset[]): ReadonlyMap<string, CheckedAsset> {
	return new Map(assets.map((asset) => [asset.assetId, asset]))
}

describe('isPending', () => {
	// spec: IMMICH-004.15
	it('is pending once decided and nothing was written, and not while undecided', () => {
		expect(isPending(candidate('a', { flag: 'rejected' }))).toBe(true)
		expect(isPending(candidate('a', { rating: 2 }))).toBe(true)
		expect(isPending(candidate('a', {}))).toBe(false)
	})

	// spec: IMMICH-004.15
	it('compares the flag and the rating with what was written, never the colour label or Keep RAW', () => {
		const written: WrittenState = { flag: 'picked', rating: 3, immichRating: 3 }

		expect(isPending(candidate('a', { flag: 'picked', rating: 3, colourLabel: 'red', keepRaw: true }, written))).toBe(false)
		expect(isPending(candidate('a', { flag: 'picked', rating: 4 }, written))).toBe(true)
		expect(isPending(candidate('a', { flag: 'unflagged', rating: 3 }, written))).toBe(true)
	})
})

describe('planWrite', () => {
	// spec: IMMICH-004.1
	it('trashes the rejects by default and counts them', () => {
		const plan = planWrite([candidate('a', { flag: 'rejected' }), candidate('b', { flag: 'rejected' }), candidate('c', { flag: 'rejected' })], checks(checked('a'), checked('b'), checked('c')), TRASH, NO_CHOICES)

		expect(plan.changes).toEqual([{ assetId: 'a', trash: true }, { assetId: 'b', trash: true }, { assetId: 'c', trash: true }])
		expect(plan.counts).toEqual({ assets: 3, rejects: 3, restores: 0, picks: 0, ratings: 0 })
		expect(plan.rejectAs).toBe('trash')
	})

	// spec: IMMICH-004.3
	it('archives the rejects, or rates them −1, and trashes none', () => {
		const rejects = [candidate('a', { flag: 'rejected', rating: 4 }), candidate('b', { flag: 'rejected' })]
		const immich = checks(checked('a', { rating: 4 }), checked('b', { archived: true }))

		expect(planWrite(rejects, immich, { ...TRASH, rejectAs: 'archive' }, NO_CHOICES).changes).toEqual([{ assetId: 'a', archived: true }])
		expect(planWrite(rejects, immich, { ...TRASH, rejectAs: 'rating' }, NO_CHOICES).changes).toEqual([{ assetId: 'a', rating: -1 }, { assetId: 'b', rating: -1 }])
	})

	// spec: IMMICH-004.4
	it('sets ratings 1–5, clears Immich’s for 0, and makes picks favourites only with picksAsFavorites', () => {
		const pending = [candidate('a', { flag: 'picked', rating: 5 }), candidate('b', { rating: 0 }, { flag: 'unflagged', rating: 2, immichRating: 2 })]
		const immich = checks(checked('a'), checked('b', { rating: 2 }))

		expect(planWrite(pending, immich, TRASH, NO_CHOICES).changes).toEqual([{ assetId: 'a', rating: 5 }, { assetId: 'b', rating: null }])
		expect(planWrite(pending, immich, { ...TRASH, picksAsFavorites: true }, NO_CHOICES).changes).toEqual([{ assetId: 'a', favorite: true, rating: 5 }, { assetId: 'b', rating: null }])
		expect(planWrite(pending, immich, TRASH, NO_CHOICES).counts).toEqual({ assets: 2, rejects: 0, restores: 0, picks: 1, ratings: 2 })
	})

	// spec: IMMICH-004.17
	it('takes a written pick back as a favourite, with picksAsFavorites only', () => {
		const taken = [candidate('a', { rating: 3 }, { flag: 'picked', rating: 3, immichRating: 3 })]
		const immich = checks(checked('a', { rating: 3, favorite: true }))

		expect(planWrite(taken, immich, { ...TRASH, picksAsFavorites: true }, NO_CHOICES).changes).toEqual([{ assetId: 'a', favorite: false }])
		expect(planWrite(taken, immich, TRASH, NO_CHOICES)).toMatchObject({ changes: [], done: ['a'] })
	})

	// spec: IMMICH-004.7
	it('offers a rating changed in Immich and follows the choice, keeping honeycomb’s by default', () => {
		const pending = [candidate('a', { rating: 4 }, { flag: 'unflagged', rating: 2, immichRating: 2 })]
		const immich = checks(checked('a', { updatedAt: CHANGED_AT, rating: 1 }))

		const plan = planWrite(pending, immich, TRASH, NO_CHOICES)
		const keepImmich = planWrite(pending, immich, TRASH, { ...NO_CHOICES, rating: new Map([['a', 'immich']]) })

		expect(plan.conflicts).toEqual([{ kind: 'rating', assetId: 'a', immichRating: 1, honeycombRating: 4 }])
		expect(plan.changes).toEqual([{ assetId: 'a', rating: 4 }])
		expect(keepImmich).toMatchObject({ changes: [], done: ['a'], adopted: [{ assetId: 'a', rating: 1 }] })
	})

	it('sees no rating conflict while updatedAt is unchanged or Immich keeps the written rating', () => {
		const pending = [candidate('a', { rating: 4 }, { flag: 'unflagged', rating: 2, immichRating: 2 }), candidate('b', { rating: 4 })]
		const immich = checks(checked('a', { updatedAt: CHANGED_AT, rating: 2 }), checked('b', { rating: 1 }))

		expect(planWrite(pending, immich, TRASH, NO_CHOICES).conflicts).toEqual([])
	})

	it('adopts an Immich “rejected” rating as no stars', () => {
		const pending = [candidate('a', { rating: 4 })]
		const immich = checks(checked('a', { updatedAt: CHANGED_AT, rating: -1 }))

		expect(planWrite(pending, immich, TRASH, { ...NO_CHOICES, rating: new Map([['a', 'immich']]) }).adopted).toEqual([{ assetId: 'a', rating: 0 }])
	})

	// spec: IMMICH-004.7
	it('offers a rating Immich cleared and adopts it as no stars', () => {
		const pending = [candidate('a', { rating: 4 }, { flag: 'unflagged', rating: 2, immichRating: 2 })]
		const plan = planWrite(pending, checks(checked('a', { updatedAt: CHANGED_AT })), TRASH, { ...NO_CHOICES, rating: new Map([['a', 'immich']]) })

		expect(plan).toMatchObject({ conflicts: [{ kind: 'rating', assetId: 'a', immichRating: null, honeycombRating: 4 }], adopted: [{ assetId: 'a', rating: 0 }] })
	})

	// spec: IMMICH-004.6
	it('counts what is sent: no skipped asset, and no rating for a reject going to the trash bin or rated −1', () => {
		const pending = [candidate('a', { flag: 'rejected', rating: 4 }), candidate('b', { flag: 'rejected', rating: 2 }), candidate('c', { flag: 'rejected', rating: 3 })]
		const immich = checks(checked('a'), checked('b', { sharedAlbum: { name: 'Family', others: 2 } }), checked('c', { trashed: true }))
		const skipB: WriteChoices = { ...NO_CHOICES, shared: new Map([['b', 'skip']]) }

		expect(planWrite(pending, immich, TRASH, skipB).counts).toEqual({ assets: 2, rejects: 1, restores: 0, picks: 0, ratings: 0 })
		expect(planWrite(pending, immich, { ...TRASH, rejectAs: 'rating' }, NO_CHOICES).counts).toEqual({ assets: 3, rejects: 2, restores: 0, picks: 0, ratings: 0 })
		expect(planWrite(pending, immich, { ...TRASH, rejectAs: 'archive' }, NO_CHOICES).counts).toEqual({ assets: 3, rejects: 2, restores: 0, picks: 0, ratings: 2 })
	})

	// spec: IMMICH-004.8
	it('names the shared album of a reject to trash and follows Trash anyway, Archive instead or Skip', () => {
		const pending = [candidate('a', { flag: 'rejected', rating: 2 })]
		const album = { name: 'Summer 2026', others: 3 }
		const immich = checks(checked('a', { sharedAlbum: album }))
		const choose = (choice: 'trash' | 'archive' | 'skip') => planWrite(pending, immich, TRASH, { ...NO_CHOICES, shared: new Map([['a', choice]]) })

		expect(planWrite(pending, immich, TRASH, NO_CHOICES).conflicts).toEqual([{ kind: 'shared', assetId: 'a', album }])
		expect(choose('trash').changes).toEqual([{ assetId: 'a', trash: true }])
		expect(choose('archive').changes).toEqual([{ assetId: 'a', archived: true, rating: 2 }])
		expect(choose('skip')).toMatchObject({ changes: [], skipped: ['a'] })
		expect(planWrite(pending, immich, { ...TRASH, rejectAs: 'archive' }, NO_CHOICES).conflicts).toEqual([])
	})

	// spec: IMMICH-004.9
	it('counts a reject already in Immich’s trash bin as done and sends nothing for it', () => {
		const plan = planWrite([candidate('a', { flag: 'rejected', rating: 3 })], checks(checked('a', { trashed: true })), TRASH, NO_CHOICES)

		expect(plan).toMatchObject({ changes: [], done: ['a'], conflicts: [{ kind: 'trashed', assetId: 'a' }] })
		expect(plan.counts.rejects).toBe(0)
	})

	// spec: IMMICH-004.16
	it('names the top of a stack that goes alone to the trash bin or the archive, not for a rating', () => {
		const pending = [candidate('a', { flag: 'rejected' })]
		const immich = checks(checked('a', { stackSize: 3 }))
		const plan = planWrite(pending, immich, TRASH, NO_CHOICES)

		expect(plan.conflicts).toEqual([{ kind: 'stack', assetId: 'a', stackSize: 3 }])
		expect(plan.changes).toEqual([{ assetId: 'a', trash: true }])
		expect(planWrite(pending, immich, { ...TRASH, rejectAs: 'archive' }, NO_CHOICES).conflicts).toEqual([{ kind: 'stack', assetId: 'a', stackSize: 3 }])
		expect(planWrite(pending, immich, { ...TRASH, rejectAs: 'rating' }, NO_CHOICES).conflicts).toEqual([])
	})

	// spec: IMMICH-004.11
	it('restores a reject taken back from the trash bin or the archive', () => {
		const written: WrittenState = { flag: 'rejected', rating: 0, immichRating: null }
		const pending = [candidate('a', {}, written), candidate('b', {}, written)]
		const plan = planWrite(pending, checks(checked('a', { trashed: true }), checked('b', { archived: true })), TRASH, NO_CHOICES)

		expect(plan.changes).toEqual([{ assetId: 'a', restore: true }, { assetId: 'b', archived: false }])
		expect(plan.counts).toEqual({ assets: 2, rejects: 0, restores: 2, picks: 0, ratings: 0 })
	})

	it('puts back honeycomb’s rating on a reject written as rating −1 and taken back', () => {
		const pending = [candidate('a', { rating: 3 }, { flag: 'rejected', rating: 3, immichRating: -1 })]

		expect(planWrite(pending, checks(checked('a', { rating: -1 })), TRASH, NO_CHOICES).changes).toEqual([{ assetId: 'a', rating: 3 }])
	})

	// spec: IMMICH-004.12
	it('archives the rejects instead of trashing them without asset.delete', () => {
		const plan = planWrite([candidate('a', { flag: 'rejected' })], checks(checked('a', { sharedAlbum: { name: 'Family', others: 1 } })), { ...TRASH, canDelete: false }, NO_CHOICES)

		expect(plan).toMatchObject({ rejectAs: 'archive', changes: [{ assetId: 'a', archived: true }], conflicts: [] })
	})

	// spec: IMMICH-004.13
	it('counts the pending decisions without a check and sends nothing for an asset Immich did not answer', () => {
		const plan = planWrite([candidate('a', { flag: 'rejected' }), candidate('b', {})], new Map(), TRASH, NO_CHOICES)

		expect(plan).toMatchObject({ changes: [], gone: ['a'], counts: { assets: 1, rejects: 1, restores: 0, picks: 0, ratings: 0 } })
	})

	// spec: IMMICH-004.28
	it('lists the assets of each strip as it counts them: new rejects, rejects taken back and new picks', () => {
		const rejected: WrittenState = { flag: 'rejected', rating: 0, immichRating: null }
		const pending = [candidate('r', { flag: 'rejected' }), candidate('t', { flag: 'rejected' }), candidate('s', { flag: 'rejected' }), candidate('b', {}, rejected), candidate('p', { flag: 'picked' }), candidate('n', { rating: 2 }), candidate('g', { flag: 'picked' })]
		const immich = checks(checked('r'), checked('t', { trashed: true }), checked('s', { sharedAlbum: { name: 'Family', others: 1 } }), checked('b', { trashed: true }), checked('p'), checked('n'))
		const plan = planWrite(pending, immich, TRASH, { ...NO_CHOICES, shared: new Map([['s', 'skip']]) })

		expect(plan.strips).toEqual({ rejects: ['r'], restores: ['b'], picks: ['p', 'g'] })
		expect(plan.counts).toMatchObject({ rejects: 1, restores: 1, picks: 2 })
	})
})

describe('writeBlocks', () => {
	// spec: IMMICH-004.5
	it('cuts 250 assets into blocks of 100, 100 and 50, in order', () => {
		const ids = Array.from({ length: 250 }, (_, index) => `a${index}`)
		const blocks = writeBlocks(ids)

		expect(WRITE_BLOCK).toBe(100)
		expect(blocks.map((block) => block.length)).toEqual([100, 100, 50])
		expect(blocks.flat()).toEqual(ids)
		expect(writeBlocks([])).toEqual([])
	})
})

describe('writeTally', () => {
	// spec: IMMICH-004.10
	it('counts the written, skipped and failed assets and names the failed ones', () => {
		const tally = writeTally([{ assetId: 'a', state: 'written' }, { assetId: 'b', state: 'failed' }, { assetId: 'c', state: 'written' }, { assetId: 'd', state: 'skipped' }])

		expect(tally).toEqual({ written: 2, skipped: 1, failed: 1, failedIds: ['b'] })
		expect(writeTally([])).toEqual({ written: 0, skipped: 0, failed: 0, failedIds: [] })
	})
})
