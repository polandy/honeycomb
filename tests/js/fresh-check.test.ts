// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FreshCheckApi } from '../../src/fresh-check.ts'
import type { Decision } from '../../src/logic/decision.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { Tag } from '../../src/logic/tag.ts'

import { describe, expect, it, vi } from 'vitest'
import { freshCheck, sidecarSaver } from '../../src/fresh-check.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { DEFAULT_PAIRING_SETTINGS } from '../../src/logic/pairing.ts'
import { logger } from '../../src/logger.ts'
import { listingEntry, pictureOf, picturesOf } from './logic/listing-entries.ts'

const RAW = listingEntry(1, '/Trip/IMG_1.NEF', { mime: 'image/x-dcraw' })
const JPEG = listingEntry(2, '/Trip/IMG_1.JPG')
const RAW_SIDECAR = listingEntry(11, '/Trip/IMG_1.NEF.xmp', { mime: 'application/octet-stream' })
const OTHER = listingEntry(3, '/Trip/IMG_2.JPG')
const OTHER_SIDECAR = listingEntry(13, '/Trip/IMG_2.JPG.xmp', { mime: 'application/octet-stream' })

/** An API whose listing answers `entries`, failing for the folders given; it records the calls. */
function api(entries: readonly ListingEntry[], failing: readonly string[] = []) {
	const calls: unknown[] = []
	const seam: FreshCheckApi = {
		listEntries: async (path, subfolders) => {
			calls.push(['list', path, subfolders])
			return failing.includes(path) ? Promise.reject(new Error('offline')) : { entries }
		},
	}
	return { seam, calls }
}

/** A context that pairs by default, shows `decision` and `tags` for every picture, with the writability and the save's answer given. */
function context(decision: Decision = UNDECIDED, tags: readonly Tag[] = [], writable = true, saved = true) {
	const written: unknown[] = []
	return {
		written,
		context: {
			pairing: () => DEFAULT_PAIRING_SETTINGS,
			writable: () => writable,
			decisionOf: (_: Picture<ListingEntry>) => decision,
			tagsOf: (_: Picture<ListingEntry>) => tags,
			writeSidecar: async (...args: unknown[]) => {
				written.push(args)
				return saved
			},
		},
	}
}

describe('freshCheck', () => {
	// spec: DELETE-002.26
	it('lists the folders again and passes the fresh pictures without reading a sidecar', async () => {
		const listed = picturesOf([JPEG, OTHER])
		const fresh = [JPEG, OTHER, listingEntry(12, '/Trip/IMG_1.JPG.xmp', { mime: 'application/octet-stream' }), OTHER_SIDECAR]
		const { seam, calls } = api(fresh)

		const result = await freshCheck(seam, context().context)(listed, 'rejects')

		expect(result).toEqual({ passed: [pictureOf(JPEG, fresh[2]!), pictureOf(OTHER, OTHER_SIDECAR)], skipped: [] })
		expect(calls).toEqual([['list', '/Trip', false]])
	})

	// spec: DELETE-002.16
	it('skips a picture whose members changed', async () => {
		const listed = picturesOf([JPEG, OTHER])
		const { seam } = api([JPEG])

		expect(await freshCheck(seam, context().context)(listed, 'rejects')).toEqual({ passed: [listed[0]], skipped: [{ picture: listed[1], reason: 'changed' }] })
	})

	// spec: DELETE-002.27
	it('skips the pictures of a folder whose listing fails, logs it and checks the others', async () => {
		const away = listingEntry(5, '/Away/IMG_5.JPG')
		const listed = picturesOf([JPEG, away])
		const { seam } = api([JPEG], ['/Away'])
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)

		const result = await freshCheck(seam, context().context)(listed, 'rejects')

		expect(result).toEqual({ passed: [listed[0]], skipped: [{ picture: listed[1], reason: 'unlisted' }] })
		expect(error).toHaveBeenCalledOnce()
		error.mockRestore()
	})

	// spec: DELETE-003.14
	it('removes nothing of a folder whose listing fails, and writes no JPEG sidecar there', async () => {
		const listed = picturesOf([RAW, JPEG, RAW_SIDECAR])
		const { seam } = api([], ['/Trip'])
		const { written, context: writing } = context({ ...UNDECIDED, rating: 3 })
		vi.spyOn(logger, 'error').mockImplementationOnce(() => undefined)

		expect(await freshCheck(seam, writing)(listed, 'raws')).toEqual({ passed: [], skipped: [{ picture: listed[0], reason: 'unlisted' }] })
		expect(written).toEqual([])
	})

	// spec: DELETE-003.12
	it('writes the JPEG sidecar with the rating, colour label and tags the cull shows before the RAW goes', async () => {
		const listed = picturesOf([RAW, JPEG, RAW_SIDECAR])
		const { seam } = api([RAW, JPEG, RAW_SIDECAR])
		const shown: Decision = { rating: 3, colourLabel: 'red', flag: 'picked', keepRaw: false }
		const { written, context: writing } = context(shown, ['Places/Lisbon'])

		const result = await freshCheck(seam, writing)(listed, 'raws')

		expect(result).toEqual({ passed: listed, skipped: [] })
		expect(written).toEqual([[listed[0], '/Trip/IMG_1.JPG.xmp', shown, ['Places/Lisbon']]])
	})

	// spec: DELETE-003.9
	it('writes no JPEG sidecar while the cull shows no rating, colour label or tag, or the RAW has no sidecar', async () => {
		const withSidecar = picturesOf([RAW, JPEG, RAW_SIDECAR])
		const bare = picturesOf([RAW, JPEG])
		const unset = context({ ...UNDECIDED, flag: 'picked' })
		const rated = context({ ...UNDECIDED, rating: 2 })

		expect(await freshCheck(api([RAW, JPEG, RAW_SIDECAR]).seam, unset.context)(withSidecar, 'raws')).toEqual({ passed: withSidecar, skipped: [] })
		expect(await freshCheck(api([RAW, JPEG]).seam, rated.context)(bare, 'raws')).toEqual({ passed: bare, skipped: [] })
		expect([...unset.written, ...rated.written]).toEqual([])
	})

	// spec: DELETE-003.9
	it('skips the pair whose JPEG sidecar may not or could not be written', async () => {
		const listed = picturesOf([RAW, JPEG, RAW_SIDECAR])
		const { seam } = api([RAW, JPEG, RAW_SIDECAR])
		const locked = context({ ...UNDECIDED, rating: 4 }, [], false)
		const failing = context({ ...UNDECIDED, rating: 4 }, [], true, false)

		expect(await freshCheck(seam, locked.context)(listed, 'raws')).toEqual({ passed: [], skipped: [{ picture: listed[0], reason: 'jpegSidecar' }] })
		expect(locked.written).toEqual([])
		expect(await freshCheck(seam, failing.context)(listed, 'raws')).toEqual({ passed: [], skipped: [{ picture: listed[0], reason: 'jpegSidecar' }] })
	})

	// spec: DELETE-002.26
	it('asks nothing for no pictures', async () => {
		const { seam, calls } = api([])

		expect(await freshCheck(seam, context().context)([], 'rejects')).toEqual({ passed: [], skipped: [] })
		expect(calls).toEqual([])
	})
})

describe('sidecarSaver', () => {
	// spec: DELETE-003.12
	it('writes the rating and colour label, then the tags, to the one sidecar, never the flag, and says whether both saved', async () => {
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
		const decision = { ...UNDECIDED, rating: 4, flag: 'picked' as const }
		const paths = new Map([[picture, new Set(['/Trip/IMG_1.JPG.xmp'])]])

		expect(await save(false)(picture, '/Trip/IMG_1.JPG.xmp', decision, ['Places/Lisbon'])).toBe(true)
		expect(calls).toEqual([
			['write', [picture], decision, ['rating', 'colourLabel'], paths],
			['tags', [picture], { added: ['Places/Lisbon'], removed: [] }, paths],
		])
		expect(await save(true)(picture, '/Trip/IMG_1.JPG.xmp', decision, ['Places/Lisbon'])).toBe(false)
		calls.length = 0
		expect(await save(true)(picture, '/Trip/IMG_1.JPG.xmp', decision, [])).toBe(true)
		expect(calls).toHaveLength(1)
	})
})
