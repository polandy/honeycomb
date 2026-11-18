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

	// spec: DELETE-002.23
	it('sends the pictures of a folder whose listing fails as known, and checks the others', async () => {
		const away = listingEntry(5, '/Away/IMG_5.JPG')
		const listed = picturesOf([JPEG, OTHER, away])
		const { seam } = api([JPEG, OTHER, OTHER_SIDECAR], new Map([[13, read(xmp({ 'digiKam:PickLabel': '3' }))]]))
		const failing: FreshCheckApi = { ...seam, listEntries: async (path, subfolders) => (path === '/Away' ? Promise.reject(new Error('offline')) : seam.listEntries(path, subfolders)) }

		const result = await freshCheck(failing, context().context)(listed, 'rejects')

		expect(result).toEqual({ passed: [], skipped: [{ picture: listed[0], reason: 'notRejected' }, { picture: listed[1], reason: 'notRejected' }], unchecked: [listed[2]] })
	})

	// spec: DELETE-002.23
	it('sends the pictures whose sidecar lookup fails as known, and keeps the verdict of those read', async () => {
		const listed = picturesOf([JPEG, OTHER, OTHER_SIDECAR])
		const { seam } = api([JPEG, OTHER, OTHER_SIDECAR], new Map(), new Map([[2, read(xmp({ 'digiKam:PickLabel': '3' }))]]))
		const failing: FreshCheckApi = { ...seam, lookupSidecars: async () => Promise.reject(new Error('offline')) }

		const result = await freshCheck(failing, context().context)(listed, 'rejects')

		expect(result).toEqual({ passed: [], skipped: [{ picture: listed[0], reason: 'notRejected' }], unchecked: [listed[1]] })
	})

	// spec: DELETE-002.23
	it('sends the pictures whose embedded XMP lookup fails as known', async () => {
		const listed = picturesOf([JPEG, OTHER, OTHER_SIDECAR])
		const { seam } = api([JPEG, OTHER, OTHER_SIDECAR], new Map([[13, read(xmp({ 'digiKam:PickLabel': '1' }))]]))
		const failing: FreshCheckApi = { ...seam, lookupEmbeddedXmp: async () => Promise.reject(new Error('offline')) }

		const result = await freshCheck(failing, context().context)(listed, 'rejects')

		expect(result).toEqual({ passed: [listed[1]], skipped: [], unchecked: [listed[0]] })
	})

	// spec: DELETE-003.10
	it('removes the RAW of an unchecked pair as known, but skips one whose values live only in the RAW sidecar', async () => {
		const bare = picturesOf([listingEntry(6, '/Trip/IMG_6.NEF', { mime: 'image/x-dcraw' }), listingEntry(7, '/Trip/IMG_6.JPG')])
		const listed = [...bare, ...picturesOf([RAW, JPEG, RAW_SIDECAR])]
		const failing: FreshCheckApi = { ...api([], new Map()).seam, listEntries: async () => Promise.reject(new Error('offline')) }
		const { written, context: writing } = context()

		const result = await freshCheck(failing, writing)(listed, 'raws')

		expect(result).toEqual({ passed: [], skipped: [{ picture: listed[1], reason: 'unread' }], unchecked: [listed[0]] })
		expect(written).toEqual([])
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

		expect(await freshCheck(seam, locked.context)(listed, 'raws')).toEqual({ passed: [], skipped: [{ picture: listed[0], reason: 'jpegSidecar' }], unchecked: [] })
		expect(locked.written).toEqual([])
		expect(await freshCheck(seam, failing.context)(listed, 'raws')).toEqual({ passed: [], skipped: [{ picture: listed[0], reason: 'jpegSidecar' }], unchecked: [] })
	})

	// spec: DELETE-002.15
	it('asks nothing for no pictures', async () => {
		const { seam, calls } = api([], new Map())

		expect(await freshCheck(seam, context().context)([], 'rejects')).toEqual({ passed: [], skipped: [], unchecked: [] })
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
