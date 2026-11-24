// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../src/logic/decision.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { SidecarSaveAnswer } from '../../src/logic/sidecar-sync.ts'
import type { XmpCacheRow } from '../../src/logic/xmp-cache.ts'
import type { ToastAction } from '../../src/shared/toast.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { sidecarValues } from '../../src/logic/xmp/decision.ts'
import { readXmp } from '../../src/logic/xmp/parse.ts'
import { useSidecarFlow } from '../../src/sidecars/sidecar-flow.ts'
import { useXmpExport } from '../../src/sidecars/xmp-export.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'
import { xmp } from './logic/sidecar-answers.ts'
import { CANONICAL_TIME } from './logic/xmp/xmp-builders.ts'

const PICKED: Decision = { ...UNDECIDED, flag: 'picked' }
const REJECTED: Decision = { ...UNDECIDED, flag: 'rejected' }
const NOT_PERMITTED = 'You may not change this sidecar or create files in its folder'

/** A JPEG with its sidecar stating `properties`. */
const stating = (fileId: number, properties: Record<string, string>) => ({ picture: pictureOf(listingEntry(fileId, `/P/IMG_${fileId}.JPG`), listingEntry(fileId + 100, `/P/IMG_${fileId}.JPG.xmp`)), bytes: xmp(properties) })

/** An export over a server holding the sidecars (by file id) and the decisions the user took; `refuse` names the sidecars a save answers `notPermitted` for. */
function exportOf(sources: readonly { picture: Picture<ListingEntry>, bytes: Uint8Array }[], decisions: Map<Picture<ListingEntry>, Decision>, refuse: readonly number[] = []) {
	const files = new Map(sources.flatMap(({ picture, bytes }) => picture.sidecars.map((entry): [number, Uint8Array] => [entry.fileId, bytes])))
	const created = new Map<string, number>()
	const cache = new Map<number, XmpCacheRow>()
	const toasts: { message: string, action: ToastAction | null }[] = []
	const errors: { message: string, action: ToastAction | null }[] = []
	const flushed: string[] = []
	const flow = useSidecarFlow({
		lookupSidecars: async (fileIds) => fileIds.map((fileId) => ({ result: 'read', bytes: files.get(fileId)!, etag: `e${fileId}`, size: files.get(fileId)!.length, mtime: 1 })),
		lookupXmpCache: async (fileIds) => fileIds.flatMap((fileId) => cache.get(fileId) ?? []),
		saveXmpCache: async (rows) => rows.forEach((row) => cache.set(row.fileId, row)),
		lookupEmbeddedXmp: async (fileIds) => fileIds.map(() => ({ result: 'none' })),
		saveSidecars: async (items): Promise<SidecarSaveAnswer[]> => items.map((item) => {
			const fileId = 'fileId' in item ? item.fileId : 900 + created.size
			if (refuse.includes(fileId)) {
				return { result: 'notPermitted' }
			}
			files.set(fileId, item.bytes)
			if ('path' in item) {
				created.set(item.path, fileId)
			}
			return { result: 'saved', fileId, etag: `e${fileId}`, size: item.bytes.length, mtime: 2 }
		}),
		now: () => CANONICAL_TIME,
	}, (message, action) => void toasts.push({ message, action: action ?? null }), (message, action) => void errors.push({ message, action: action ?? null }))
	const pictures = sources.map(({ picture }) => picture)
	const writing = useXmpExport(flow, { pictures: () => pictures, decisionOf: (picture) => decisions.get(picture) ?? UNDECIDED, flush: async () => void flushed.push('flushed') })
	const valuesOf = (fileId: number) => sidecarValues(readXmp(files.get(fileId)!))
	const load = async () => void await flow.sync.read(pictures)
	return { flow, writing, toasts, errors, flushed, files, created, valuesOf, load }
}

describe('useXmpExport', () => {
	// spec: GRID-001.21, XMP-003.39
	it('counts the sidecars that differ, and none once they are written', async () => {
		const first = stating(1, { 'digiKam:PickLabel': '3' })
		const second = stating(2, { 'digiKam:PickLabel': '3' })
		const { writing, load } = exportOf([first, second], new Map([[first.picture, REJECTED], [second.picture, PICKED]]))
		expect(writing.count.value).toBe(0)

		await load()
		expect(writing.count.value).toBe(1)

		await writing.run()
		expect(writing.count.value).toBe(0)
	})

	// spec: XMP-003.39, XMP-003.42
	it('writes the flag fields where they differ after the writes waiting, and says how many it wrote', async () => {
		const first = stating(1, { 'xmp:Rating': '4', 'digiKam:PickLabel': '3', 'xmpDM:pick': '1' })
		const second = stating(2, { 'digiKam:PickLabel': '3' })
		const { writing, toasts, flushed, valuesOf, load } = exportOf([first, second], new Map([[first.picture, REJECTED], [second.picture, PICKED]]))
		await load()

		await writing.run()

		expect(flushed).toEqual(['flushed'])
		expect(valuesOf(101)).toMatchObject({ rating: 4, flag: 'rejected' })
		expect(toasts.map(({ message }) => message)).toEqual(['1 XMP file written'])
	})

	// spec: XMP-003.40
	it('removes the flag fields of an unflagged picture and keeps PickLabel 2', async () => {
		const stated = stating(1, { 'xmpDM:pick': '1', 'digiKam:PickLabel': '3' })
		const pending = stating(2, { 'digiKam:PickLabel': '2' })
		const { writing, files, valuesOf, load } = exportOf([stated, pending], new Map())
		const before = files.get(102)
		await load()

		await writing.run()

		expect(valuesOf(101).flag).toBeNull()
		expect(files.get(102)).toBe(before)
	})

	// spec: XMP-003.41
	it('creates the sidecars of a picked pair with the flag fields and Keep RAW, and none for an unflagged pair', async () => {
		const pair = pictureOf(listingEntry(1, '/P/IMG_1.NEF', { mime: 'image/x-nikon-nef' }), listingEntry(2, '/P/IMG_1.JPG'))
		const other = pictureOf(listingEntry(3, '/P/IMG_3.NEF', { mime: 'image/x-nikon-nef' }), listingEntry(4, '/P/IMG_3.JPG'))
		const { writing, created, valuesOf, toasts } = exportOf([{ picture: pair, bytes: xmp({}) }, { picture: other, bytes: xmp({}) }], new Map([[pair, { ...PICKED, keepRaw: true }]]))
		expect(writing.count.value).toBe(2)

		await writing.run()

		expect([...created.keys()].sort()).toEqual(['/P/IMG_1.JPG.xmp', '/P/IMG_1.NEF.xmp'])
		expect([...created.values()].map(valuesOf)).toEqual([{ rating: 0, flag: 'picked', colourLabel: null, keepRaw: true }, { rating: 0, flag: 'picked', colourLabel: null, keepRaw: true }].map((values) => expect.objectContaining(values)))
		expect(toasts.map(({ message }) => message)).toEqual(['2 XMP files written'])
		expect(writing.count.value).toBe(0)
	})

	// spec: XMP-003.42
	it('says all are up to date when nothing differs', async () => {
		const only = stating(1, { 'digiKam:PickLabel': '3' })
		const { writing, toasts, load } = exportOf([only], new Map([[only.picture, PICKED]]))
		await load()

		await writing.run()

		expect(toasts.map(({ message, action }) => [message, action])).toEqual([['All XMP files are up to date', null]])
	})

	// spec: XMP-003.42, XMP-003.33
	it('reports the sidecars it could not write in one toast with Details', async () => {
		const sources = [1, 2, 3].map((fileId) => stating(fileId, { 'digiKam:PickLabel': '3' }))
		const { writing, errors, flow, load } = exportOf(sources, new Map(sources.map(({ picture }) => [picture, REJECTED])), [103])
		await load()

		await writing.run()
		await flushPromises()

		const last = errors.at(-1)!
		expect([last.message, last.action?.label]).toEqual([`2 XMP files written, 1 not written. ${NOT_PERMITTED}`, 'Details'])
		last.action!.run()
		expect(flow.report.value?.map(({ path, reason }) => [path, reason])).toEqual([['/P/IMG_3.JPG.xmp', 'notPermitted']])
	})
})
