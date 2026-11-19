// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../src/logic/decision.ts'
import type { SidecarFailure, SidecarLookupAnswer, SidecarSaveAnswer, SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'
import type { TagChange } from '../../src/logic/tag.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { DECISION_FIELDS, UNDECIDED } from '../../src/logic/decision.ts'
import { readXmp } from '../../src/logic/xmp/parse.ts'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { useSidecarSync } from '../../src/sidecar-sync.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'
import { CANONICAL_TIME, itemsOf, packetOf, seq, textOf } from './logic/xmp/xmp-builders.ts'

const PAIR = pictureOf(listingEntry(1, '/P/IMG_0001.NEF'), listingEntry(2, '/P/IMG_0001.JPG'), listingEntry(11, '/P/IMG_0001.NEF.xmp'))
const BYTES = serializeXmp(packetOf({ 'xmp:Rating': '3' }), CANONICAL_TIME)

/** A promise and the functions that settle it. */
function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((settle, fail) => {
		resolve = settle
		reject = fail
	})
	return { promise, resolve, reject }
}

/** A sync whose lookups answer `read` with BYTES unless told otherwise and whose saves answer as `answer` says. */
function sync(answer: (item: SidecarSaveItem, call: number) => SidecarSaveAnswer | Promise<never> = () => saved(40)) {
	const lookups: number[][] = []
	const sized: [number, number][][] = []
	const saves: SidecarSaveItem[][] = []
	const failures: SidecarFailure[][] = []
	const lookupAnswer = { current: (_fileId: number): SidecarLookupAnswer => ({ result: 'read', bytes: BYTES, etag: `etag-${lookups.length}`, size: BYTES.length, mtime: 100 }) }
	const sidecars = useSidecarSync({
		lookupXmpCache: async () => [],
		saveXmpCache: async () => undefined,
		lookupSidecars: async (fileIds, sizes) => {
			lookups.push([...fileIds])
			sized.push([...sizes ?? []])
			return fileIds.map((fileId) => lookupAnswer.current(fileId))
		},
		lookupEmbeddedXmp: async (fileIds) => fileIds.map(() => ({ result: 'none' })),
		saveSidecars: async (items) => {
			saves.push([...items])
			const call = saves.length
			const answers = items.map((item) => answer(item, call))
			return Promise.all(answers)
		},
	}, () => CANONICAL_TIME, (failed) => failures.push([...failed]))
	return { sidecars, lookups, sized, saves, failures, lookupAnswer }
}

/** A `saved` answer for the file id. */
function saved(fileId: number): SidecarSaveAnswer {
	return { result: 'saved', fileId, etag: `saved-${fileId}`, size: 1, mtime: 1 }
}

const decisionOf = (decision: Decision) => () => decision

describe('useSidecarSync: write', () => {
	// spec: XMP-003.7
	it('saves the looked-up and the created sidecars, then saves over both without a lookup', async () => {
		const { sidecars, lookups, saves } = sync((item) => saved('fileId' in item ? item.fileId : 30))

		expect(await sidecars.write([PAIR], decisionOf({ ...UNDECIDED, flag: 'picked' }))).toEqual({ written: 1, failed: [] })
		await sidecars.write([PAIR], decisionOf({ ...UNDECIDED, rating: 4 }))

		expect(lookups).toEqual([[11]])
		expect(saves[0]!.map((item) => ('fileId' in item ? [item.fileId, item.etag] : item.path))).toEqual([[11, 'etag-1'], '/P/IMG_0001.JPG.xmp'])
		expect(saves[1]!.map((item) => ('fileId' in item ? [item.fileId, item.etag] : item.path))).toEqual([[11, 'saved-11'], [30, 'saved-30']])
		expect(textOf(readXmp(saves[1]![1]!.bytes), 'xmp:Rating')).toBe('4')
	})

	// spec: DELETE-002.17
	it('gives a picture the sidecars it saved and created, which a delete sends', async () => {
		const { sidecars, lookupAnswer } = sync((item) => saved('fileId' in item ? item.fileId : 30))
		lookupAnswer.current = () => ({ result: 'read', bytes: BYTES, etag: 'etag-11', size: BYTES.length, mtime: 100 })

		expect(sidecars.current(PAIR)).toBe(PAIR)
		await sidecars.write([PAIR], decisionOf({ ...UNDECIDED, flag: 'picked' }))

		expect(sidecars.current(PAIR).sidecars.map(({ fileId, path, etag }) => [fileId, path, etag])).toEqual([
			[11, '/P/IMG_0001.NEF.xmp', 'saved-11'],
			[30, '/P/IMG_0001.JPG.xmp', 'saved-30'],
		])
	})

	// spec: XMP-003.32
	it('looks the sidecars up with the sizes the listing states, so the client packs the requests', async () => {
		const listed = pictureOf(listingEntry(1, '/P/IMG_0002.NEF'), listingEntry(12, '/P/IMG_0002.NEF.xmp', { size: 4096 }))
		const { sidecars, sized } = sync()

		await sidecars.write([listed], decisionOf({ ...UNDECIDED, rating: 1 }))
		await sidecars.read([listed])

		expect(sized).toEqual([[[12, 4096]], [[12, 4096]]])
	})

	// spec: XMP-003.8
	it('reads, merges and saves a changed sidecar once more', async () => {
		const { sidecars, lookups, saves } = sync((item, call) => (call === 1 && 'fileId' in item ? { result: 'changed' } : saved(11)))

		const result = await sidecars.write([PAIR], decisionOf({ ...UNDECIDED, rating: 2 }))

		expect(result.failed).toEqual([])
		expect(lookups).toEqual([[11], [11]])
		expect(saves.map((items) => items.length)).toEqual([2, 1])
		expect(saves[1]![0]).toMatchObject({ fileId: 11, etag: 'etag-2' })
		expect(textOf(readXmp(saves[1]![0]!.bytes), 'xmp:Rating')).toBe('2')
	})

	// spec: XMP-003.8, XMP-003.13
	it('reports a sidecar that changed again', async () => {
		const { sidecars, failures } = sync((item) => ('fileId' in item ? { result: 'changed' } : saved(30)))

		const { written, failed } = await sidecars.write([PAIR], decisionOf(UNDECIDED))

		expect(written).toBe(0)
		expect(failed).toEqual([{ path: '/P/IMG_0001.NEF.xmp', picture: PAIR, reason: 'changed', fields: DECISION_FIELDS }])
		expect(failures).toEqual([failed])
	})

	// spec: XMP-003.9
	it('starts a write after the one before, with the decision of that moment', async () => {
		const first = deferred<SidecarSaveAnswer>()
		const { sidecars, saves } = sync((item, call) => (call === 1 ? first.promise as Promise<never> : saved('fileId' in item ? item.fileId : 30)))
		let decision: Decision = { ...UNDECIDED, rating: 1 }

		const writing = sidecars.write([PAIR], () => decision)
		await flushPromises()
		const next = sidecars.write([PAIR], () => decision)
		decision = { ...UNDECIDED, rating: 5 }
		expect(saves).toHaveLength(1)

		first.resolve(saved(11))
		await Promise.all([writing, next])
		expect(saves).toHaveLength(2)
		expect(textOf(readXmp(saves[1]![0]!.bytes), 'xmp:Rating')).toBe('5')
	})

	// spec: XMP-003.13
	it('reports every sidecar of a failed request and still runs the next write', async () => {
		const { sidecars, failures } = sync(() => Promise.reject(new Error('offline')) as Promise<never>)
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)

		const failed = sidecars.write([PAIR], decisionOf(UNDECIDED))
		const after = sidecars.write([], decisionOf(UNDECIDED))

		expect((await failed).failed.map(({ reason }) => reason)).toEqual(['unreachable', 'unreachable'])
		expect(await after).toEqual({ written: 0, failed: [] })
		expect(failures).toHaveLength(1)
	})

	// spec: XMP-003.9
	it('runs the next write after one that threw', async () => {
		const { sidecars } = sync()

		const broken = sidecars.write([PAIR], () => {
			throw new Error('broken')
		})

		await expect(broken).rejects.toThrow('broken')
		expect((await sidecars.write([PAIR], decisionOf(UNDECIDED))).written).toBe(1)
	})

	// spec: XMP-003.13
	it('reports the sidecars of a failed lookup without saving them', async () => {
		const { sidecars, saves, lookupAnswer } = sync(() => saved(30))
		lookupAnswer.current = () => {
			throw new Error('offline')
		}
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)

		const { failed } = await sidecars.write([PAIR], decisionOf(UNDECIDED))

		expect(failed).toEqual([{ path: '/P/IMG_0001.NEF.xmp', picture: PAIR, reason: 'unreachable', fields: DECISION_FIELDS }])
		expect(saves[0]!.map((item) => 'path' in item && item.path)).toEqual(['/P/IMG_0001.JPG.xmp'])
	})
})

describe('useSidecarSync: writeTags', () => {
	const WEDDING: TagChange = { added: ['Events/Wedding'], removed: ['Places/Lisbon'] }
	const tagged = (...tags: string[]) => serializeXmp(packetOf({ 'digiKam:TagsList': seq(tags), 'xmp:Rating': '3' }), CANONICAL_TIME)
	const answer = (bytes: Uint8Array, etag: string): SidecarLookupAnswer => ({ result: 'read', bytes, etag, size: bytes.length, mtime: 1 })

	// spec: TAGS-002.9
	it('writes the change to every sidecar of the picture and leaves its decision', async () => {
		const { sidecars, saves, lookupAnswer } = sync((item) => saved('fileId' in item ? item.fileId : 30))
		lookupAnswer.current = () => answer(tagged('People/Anna', 'Places/Lisbon'), 'e')

		expect(await sidecars.writeTags([PAIR], WEDDING)).toEqual({ written: 1, failed: [] })

		expect(saves[0]!.map((item) => itemsOf(readXmp(item.bytes), 'digiKam:TagsList'))).toEqual([['Events/Wedding', 'People/Anna'], ['Events/Wedding', 'People/Anna']])
		expect(textOf(readXmp(saves[0]![0]!.bytes), 'xmp:Rating')).toBe('3')
	})

	// spec: TAGS-002.11
	it('applies the change once more to a sidecar that changed meanwhile', async () => {
		const { sidecars, saves, lookupAnswer } = sync((item, call) => (call === 1 && 'fileId' in item ? { result: 'changed' } : saved('fileId' in item ? item.fileId : 30)))
		lookupAnswer.current = () => answer(saves.length === 0 ? tagged('Places/Lisbon') : tagged('Kids', 'Places/Lisbon'), 'e')

		await sidecars.writeTags([PAIR], WEDDING)

		expect(saves.map((items) => items.length)).toEqual([2, 1])
		expect(itemsOf(readXmp(saves[1]![0]!.bytes), 'digiKam:TagsList')).toEqual(['Events/Wedding', 'Kids'])
	})

	// spec: TAGS-002.13
	it('reports a failed sidecar with the change', async () => {
		const { sidecars, saves, failures } = sync((item, call) => (call === 1 && 'fileId' in item ? { result: 'notPermitted' } : saved('fileId' in item ? item.fileId : 30)))

		const { failed } = await sidecars.writeTags([PAIR], WEDDING)

		expect(failed).toEqual([{ path: '/P/IMG_0001.NEF.xmp', picture: PAIR, reason: 'notPermitted', tags: WEDDING }])
		expect(failures).toEqual([failed])
		expect(saves).toHaveLength(1)
	})
})
