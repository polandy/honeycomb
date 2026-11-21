// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SavedSidecar, SidecarLookupAnswer, SidecarSaveAnswer, SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'

import { describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { readXmp } from '../../src/logic/xmp/parse.ts'
import { useSidecarSync } from '../../src/sidecar-sync.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'
import { read, xmp } from './logic/sidecar-answers.ts'
import { CANONICAL_TIME, key, textOf } from './logic/xmp/xmp-builders.ts'

const RAW_SIDECAR = listingEntry(11, '/P/IMG_0001.NEF.xmp')
const PAIR = pictureOf(listingEntry(1, '/P/IMG_0001.NEF'), listingEntry(2, '/P/IMG_0001.JPG'), RAW_SIDECAR)
const JPEG_SIDECAR = '/P/IMG_0001.JPG.xmp'

/** A sync whose lookup answers `lookup` (a thrown error when null) and whose saves answer `answer`; it records both. */
function sync(lookup: SidecarLookupAnswer | null, answer: SidecarSaveAnswer = { result: 'saved', fileId: 30, etag: 'e', size: 1, mtime: 1 }) {
	const lookups: number[][] = []
	const saves: SidecarSaveItem[][] = []
	const savedSidecars: SavedSidecar[][] = []
	const sidecars = useSidecarSync({
		lookupXmpCache: async () => [],
		saveXmpCache: async () => undefined,
		lookupSidecars: async (fileIds) => {
			lookups.push([...fileIds])
			if (lookup === null) {
				throw new Error('offline')
			}
			return fileIds.map(() => lookup)
		},
		lookupEmbeddedXmp: async (fileIds) => fileIds.map(() => ({ result: 'none' })),
		saveSidecars: async (items) => {
			saves.push([...items])
			return items.map(() => answer)
		},
	}, () => CANONICAL_TIME, () => {}, (saved) => savedSidecars.push([...saved]))
	return { sidecars, lookups, saves, savedSidecars }
}

describe('useSidecarSync: seed', () => {
	// spec: DELETE-003.12
	it('reads the RAW sidecar again and creates the JPEG sidecar from it, which a delete then sends', async () => {
		const { sidecars, lookups, saves, savedSidecars } = sync(read(xmp({ 'xmp:Rating': '3', 'digiKam:PickLabel': '3', 'honeycomb:KeepRaw': 'True' })))

		expect(await sidecars.seed(PAIR, JPEG_SIDECAR, RAW_SIDECAR)).toBe(true)

		expect(lookups).toEqual([[11]])
		expect(saves).toHaveLength(1)
		const item = saves[0]![0]!
		expect('path' in item && item.path).toBe(JPEG_SIDECAR)
		const packet = readXmp(item.bytes)
		expect(textOf(packet, 'xmp:Rating')).toBe('3')
		expect(textOf(packet, 'digiKam:PickLabel')).toBe('3')
		expect(packet.properties.has(key('honeycomb:KeepRaw'))).toBe(false)
		expect(savedSidecars).toEqual([[{ path: JPEG_SIDECAR, created: true }]])
		expect(sidecars.known.value.get(JPEG_SIDECAR)?.fileId).toBe(30)
	})

	// spec: DELETE-003.12
	it('creates nothing for a RAW sidecar without fields to take over', async () => {
		const { sidecars, saves } = sync(read(xmp({ 'honeycomb:KeepRaw': 'True' })))

		expect(await sidecars.seed(PAIR, JPEG_SIDECAR, RAW_SIDECAR)).toBe(true)
		expect(saves).toEqual([])
	})

	// spec: DELETE-003.9
	it('says no, logged, when the RAW sidecar cannot be read again or the JPEG sidecar not saved', async () => {
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const offline = sync(null)
		const locked = sync({ result: 'locked' })
		const full = sync(read(xmp({ 'xmp:Rating': '3' })), { result: 'noSpace' })

		expect(await offline.sidecars.seed(PAIR, JPEG_SIDECAR, RAW_SIDECAR)).toBe(false)
		expect(await locked.sidecars.seed(PAIR, JPEG_SIDECAR, RAW_SIDECAR)).toBe(false)
		expect(await full.sidecars.seed(PAIR, JPEG_SIDECAR, RAW_SIDECAR)).toBe(false)
		expect([...offline.saves, ...locked.saves]).toEqual([])
		expect(error).toHaveBeenCalledOnce()
		expect(warn).toHaveBeenCalledTimes(3)
		warn.mockRestore()
		error.mockRestore()
	})
})
