import type { ListingEntry } from '../../src/logic/listing.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FreshCheckApi } from '../../src/shared/fresh-check.ts'

import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PAIRING_SETTINGS } from '../../src/logic/pairing.ts'
import { freshCheck } from '../../src/shared/fresh-check.ts'
import { logger } from '../../src/shared/logger.ts'
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

/** A context that pairs by default, with the writability and the seed's answer given; it records the seeds. */
function context(writable = true, seeded = true) {
	const written: unknown[] = []
	return {
		written,
		context: {
			pairing: () => DEFAULT_PAIRING_SETTINGS,
			writable: () => writable,
			seedSidecar: async (...args: unknown[]) => {
				written.push(args)
				return seeded
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
		const { written, context: writing } = context()
		vi.spyOn(logger, 'error').mockImplementationOnce(() => undefined)

		expect(await freshCheck(seam, writing)(listed, 'raws')).toEqual({ passed: [], skipped: [{ picture: listed[0], reason: 'unlisted' }] })
		expect(written).toEqual([])
	})

	// spec: DELETE-003.12
	it('seeds the JPEG sidecar from the RAW sidecar of the fresh listing before the RAW goes', async () => {
		const listed = picturesOf([RAW, JPEG, RAW_SIDECAR])
		const { seam } = api([RAW, JPEG, RAW_SIDECAR])
		const { written, context: writing } = context()

		const result = await freshCheck(seam, writing)(listed, 'raws')

		expect(result).toEqual({ passed: listed, skipped: [] })
		expect(written).toEqual([[listed[0], '/Trip/IMG_1.JPG.xmp', RAW_SIDECAR]])
	})

	// spec: DELETE-003.9
	it('seeds no JPEG sidecar while the RAW has no sidecar, or for Delete rejected', async () => {
		const withSidecar = picturesOf([RAW, JPEG, RAW_SIDECAR])
		const bare = picturesOf([RAW, JPEG])
		const { written, context: seeding } = context()

		expect(await freshCheck(api([RAW, JPEG]).seam, seeding)(bare, 'raws')).toEqual({ passed: bare, skipped: [] })
		expect(await freshCheck(api([RAW, JPEG, RAW_SIDECAR]).seam, seeding)(withSidecar, 'rejects')).toEqual({ passed: withSidecar, skipped: [] })
		expect(written).toEqual([])
	})

	// spec: DELETE-003.9
	it('skips the pair whose JPEG sidecar may not or could not be seeded', async () => {
		const listed = picturesOf([RAW, JPEG, RAW_SIDECAR])
		const { seam } = api([RAW, JPEG, RAW_SIDECAR])
		const locked = context(false)
		const failing = context(true, false)

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
