// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FreshCheckApi } from '../../src/fresh-check.ts'
import type { EmbeddedXmpAnswer } from '../../src/logic/embedded-xmp.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { SidecarLookupAnswer } from '../../src/logic/sidecar-sync.ts'

import { describe, expect, it } from 'vitest'
import { freshCheck, sidecarSaver } from '../../src/fresh-check.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { DEFAULT_PAIRING_SETTINGS } from '../../src/logic/pairing.ts'
import { listingEntry, pictureOf, picturesOf } from './logic/listing-entries.ts'
import { read, xmp } from './logic/sidecar-answers.ts'

const RAW = listingEntry(1, '/Trip/IMG_1.NEF', { mime: 'image/x-dcraw' })
const JPEG = listingEntry(2, '/Trip/IMG_1.JPG')
const RAW_SIDECAR = listingEntry(11, '/Trip/IMG_1.NEF.xmp', { mime: 'application/octet-stream' })
const OTHER = listingEntry(3, '/Trip/IMG_2.JPG')
const OTHER_SIDECAR = listingEntry(13, '/Trip/IMG_2.JPG.xmp', { mime: 'application/octet-stream' })

/** An API whose listing answers `entries` and whose lookups answer from the maps; it records the calls. */
function api(entries: readonly ListingEntry[], sidecars: Map<number, SidecarLookupAnswer>, embedded = new Map<number, EmbeddedXmpAnswer>()) {
	const calls: unknown[] = []
	const seam: FreshCheckApi = {
		listEntries: async (path, subfolders) => {
			calls.push(['list', path, subfolders])
			return { entries }
		},
		lookupSidecars: async (fileIds) => {
			calls.push(['sidecars', fileIds])
			return fileIds.map((fileId) => sidecars.get(fileId) ?? { result: 'notFound' })
		},
		lookupEmbeddedXmp: async (fileIds) => {
			calls.push(['embedded', fileIds])
			return fileIds.map((fileId) => embedded.get(fileId) ?? { result: 'none' })
		},
	}
	return { seam, calls }
}

/** A context that pairs by default, with the writability and the save's answer given. */
function context(writable = true, saved = true) {
	const written: unknown[] = []
	return {
		written,
		context: {
			pairing: () => DEFAULT_PAIRING_SETTINGS,
			writable: () => writable,
			writeSidecar: async (...args: unknown[]) => {
				written.push(args)
				return saved
			},
		},
	}
}

describe('freshCheck', () => {
	// spec: DELETE-002.15
	it('lists the folders again, reads every sidecar and passes the fresh picture every sidecar rejects', async () => {
		const listed = picturesOf([JPEG, OTHER])
		const fresh = [JPEG, OTHER, listingEntry(12, '/Trip/IMG_1.JPG.xmp', { mime: 'application/octet-stream' }), OTHER_SIDECAR]
		const { seam, calls } = api(fresh, new Map([[12, read(xmp({ 'digiKam:PickLabel': '1' }))], [13, read(xmp({ 'digiKam:PickLabel': '3' }))]]))

		const { passed, skipped } = await freshCheck(seam, context().context)(listed, 'rejects')

		expect(passed).toEqual([pictureOf(JPEG, fresh[2]!)])
		expect(skipped).toEqual([{ picture: listed[1], reason: 'notRejected' }])
		expect(calls).toEqual([['list', '/Trip', false], ['sidecars', [12, 13]]])
	})

	// spec: DELETE-002.15
	it('fails when the listing fails, so nothing is deleted', async () => {
		const seam: FreshCheckApi = { ...api([], new Map()).seam, listEntries: async () => Promise.reject(new Error('offline')) }

		await expect(freshCheck(seam, context().context)([pictureOf(JPEG)], 'rejects')).rejects.toThrow('offline')
	})

	// spec: DELETE-003.9
	it('writes the JPEG sidecar of a pair whose RAW sidecar holds the values before its RAW goes', async () => {
		const listed = picturesOf([RAW, JPEG, RAW_SIDECAR])
		const { seam } = api([RAW, JPEG, RAW_SIDECAR], new Map([[11, read(xmp({ 'xmp:Rating': '4' }))]]))
		const { written, context: writing } = context()

		const { passed, skipped } = await freshCheck(seam, writing)(listed, 'raws')

		expect(passed).toEqual(listed)
		expect(skipped).toEqual([])
		expect(written).toEqual([[listed[0], '/Trip/IMG_1.JPG.xmp', { ...UNDECIDED, rating: 4 }, []]])
	})

	// spec: DELETE-003.9
	it('skips the pair whose JPEG sidecar may not or could not be written', async () => {
		const listed = picturesOf([RAW, JPEG, RAW_SIDECAR])
		const { seam } = api([RAW, JPEG, RAW_SIDECAR], new Map([[11, read(xmp({ 'xmp:Rating': '4' }))]]))
		const locked = context(false)
		const failing = context(true, false)

		expect(await freshCheck(seam, locked.context)(listed, 'raws')).toEqual({ passed: [], skipped: [{ picture: listed[0], reason: 'jpegSidecar' }] })
		expect(locked.written).toEqual([])
		expect(await freshCheck(seam, failing.context)(listed, 'raws')).toEqual({ passed: [], skipped: [{ picture: listed[0], reason: 'jpegSidecar' }] })
	})

	// spec: DELETE-002.15
	it('asks nothing for no pictures', async () => {
		const { seam, calls } = api([], new Map())

		expect(await freshCheck(seam, context().context)([], 'rejects')).toEqual({ passed: [], skipped: [] })
		expect(calls).toEqual([])
	})
})

describe('sidecarSaver', () => {
	// spec: DELETE-003.9
	it('writes the decision, then the tags, to the one sidecar and says whether both saved', async () => {
		const picture = pictureOf(RAW, JPEG, RAW_SIDECAR)
		const calls: unknown[] = []
		const failure = { path: '/Trip/IMG_1.JPG.xmp', picture, reason: 'locked' as const }
		const save = (failed: boolean) => sidecarSaver({
			write: async (pictures, decisionOf, fields, paths) => {
				calls.push(['write', pictures, decisionOf(picture), fields, paths])
				return { written: 1, failed: [] }
			},
			writeTags: async (pictures, change, paths) => {
				calls.push(['tags', pictures, change, paths])
				return { written: 0, failed: failed ? [failure] : [] }
			},
		})
		const decision = { ...UNDECIDED, rating: 4 }
		const paths = new Map([[picture, new Set(['/Trip/IMG_1.JPG.xmp'])]])

		expect(await save(false)(picture, '/Trip/IMG_1.JPG.xmp', decision, ['Places/Lisbon'])).toBe(true)
		expect(calls).toEqual([
			['write', [picture], decision, ['rating', 'colourLabel', 'flag', 'keepRaw'], paths],
			['tags', [picture], { added: ['Places/Lisbon'], removed: [] }, paths],
		])
		expect(await save(true)(picture, '/Trip/IMG_1.JPG.xmp', decision, ['Places/Lisbon'])).toBe(false)
		calls.length = 0
		expect(await save(true)(picture, '/Trip/IMG_1.JPG.xmp', decision, [])).toBe(true)
		expect(calls).toHaveLength(1)
	})
})
