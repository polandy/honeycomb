// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { XmpCacheRow } from '../../../src/logic/xmp-cache.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { XMP_READER } from '../../../src/logic/xmp-cache.ts'
import { exportPlan } from '../../../src/logic/xmp-export.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const PICKED: Decision = { ...UNDECIDED, flag: 'picked' }
const REJECTED: Decision = { ...UNDECIDED, flag: 'rejected' }
const KEPT: Decision = { ...UNDECIDED, keepRaw: true }

/** A read sidecar row of the file with the values, the rest stating nothing. */
function row(fileId: number, values: Partial<XmpCacheRow> = {}): XmpCacheRow {
	return { fileId, kind: 'sidecar', etag: `etag-${fileId}`, reader: XMP_READER, state: 'read', reason: null, rating: null, flag: null, colourLabel: null, keepRaw: null, tags: null, ...values }
}

const byId = (...rows: XmpCacheRow[]) => new Map(rows.map((each) => [each.fileId, each]))

/** A JPEG with its sidecar. */
const jpegWithSidecar = (fileId: number, folder = 'P') => pictureOf(listingEntry(fileId, `/${folder}/IMG_${fileId}.JPG`), listingEntry(fileId + 100, `/${folder}/IMG_${fileId}.JPG.xmp`))

/** A JPEG+NEF pair without sidecars. */
const bare = (fileId: number) => pictureOf(listingEntry(fileId, `/P/IMG_${fileId}.NEF`, { mime: 'image/x-nikon-nef' }), listingEntry(fileId + 1, `/P/IMG_${fileId}.JPG`))

function plan(decisions: Map<object, Decision>, rows: Map<number, XmpCacheRow>, known = new Map<string, { fileId: number }>()) {
	const pictures = [...decisions.keys()] as ReturnType<typeof bare>[]
	return exportPlan(pictures, (picture) => decisions.get(picture) ?? UNDECIDED, rows, known)
}

describe('exportPlan', () => {
	// spec: XMP-003.39
	it('lists the sidecars whose flag differs from the picture\'s and no other', () => {
		const rejected = jpegWithSidecar(1)
		const picked = jpegWithSidecar(2)

		const { pictures, paths, files } = plan(new Map([[rejected, REJECTED], [picked, PICKED]]), byId(row(101, { flag: 'picked' }), row(102, { flag: 'picked' })))

		expect(pictures).toEqual([rejected])
		expect(paths.get(rejected)).toEqual(new Set(['/P/IMG_1.JPG.xmp']))
		expect(files).toBe(1)
	})

	// spec: XMP-003.40
	it('counts an unflagged picture\'s sidecar with pick fields, not one stating unflagged (PickLabel 2)', () => {
		const stated = jpegWithSidecar(1)
		const pending = jpegWithSidecar(2)
		const silent = jpegWithSidecar(3)

		const { pictures, files } = plan(new Map([[stated, UNDECIDED], [pending, UNDECIDED], [silent, UNDECIDED]]), byId(row(101, { flag: 'picked' }), row(102, { flag: 'unflagged' }), row(103)))

		expect(pictures).toEqual([stated])
		expect(files).toBe(1)
	})

	// spec: XMP-003.39
	it('counts Keep RAW of a pair, and ignores it for a single', () => {
		const pair = pictureOf(listingEntry(1, '/P/IMG_1.NEF', { mime: 'image/x-nikon-nef' }), listingEntry(2, '/P/IMG_1.JPG'), listingEntry(11, '/P/IMG_1.NEF.xmp'), listingEntry(12, '/P/IMG_1.JPG.xmp'))
		const single = jpegWithSidecar(3)

		const { pictures, paths, files } = plan(new Map([[pair, KEPT], [single, KEPT]]), byId(row(11, { keepRaw: true }), row(12), row(103)))

		expect(pictures).toEqual([pair])
		expect(paths.get(pair)).toEqual(new Set(['/P/IMG_1.JPG.xmp']))
		expect(files).toBe(1)
	})

	// spec: XMP-003.41
	it('creates sidecars only for a flagged or kept picture, and then limits no sidecar', () => {
		const picked = bare(1)
		const kept = bare(3)
		const unflagged = bare(5)

		const { pictures, paths, files } = plan(new Map([[picked, PICKED], [kept, KEPT], [unflagged, UNDECIDED]]), byId())

		expect(pictures).toEqual([picked, kept])
		expect(paths.size).toBe(0)
		expect(files).toBe(4)
	})

	// spec: XMP-003.39
	it('leaves a sidecar it cannot read out of the count', () => {
		const refused = jpegWithSidecar(1)
		const unread = jpegWithSidecar(2)

		const { pictures, files } = plan(new Map([[refused, PICKED], [unread, PICKED]]), byId(row(101, { state: 'refused', reason: 'malformed' })))

		expect(pictures).toEqual([])
		expect(files).toBe(0)
	})

	// spec: GRID-001.21
	it('counts a sidecar honeycomb created as existing, by its saved row', () => {
		const picked = bare(1)
		const created = new Map([['/P/IMG_1.NEF.xmp', { fileId: 21 }], ['/P/IMG_1.JPG.xmp', { fileId: 22 }]])

		const written = plan(new Map([[picked, PICKED]]), byId(row(21, { flag: 'picked' }), row(22, { flag: 'picked' })), created)
		const stale = plan(new Map([[picked, REJECTED]]), byId(row(21, { flag: 'picked' }), row(22, { flag: 'picked' })), created)

		expect(written.files).toBe(0)
		expect(stale.files).toBe(2)
		expect([...stale.paths.get(picked) ?? []].sort()).toEqual(['/P/IMG_1.JPG.xmp', '/P/IMG_1.NEF.xmp'])
	})
})
