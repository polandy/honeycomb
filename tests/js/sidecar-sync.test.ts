// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../src/logic/decision.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { SidecarFailure, SidecarLookupAnswer, SidecarSaveAnswer, SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'
import type { TagChange } from '../../src/logic/tag.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
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

/** A sync whose lookups answer `read` with BYTES unless told otherwise, and whose saves answer as `answer` says. */
function sync(answer: (item: SidecarSaveItem, call: number) => SidecarSaveAnswer | Promise<never> = () => saved(40)) {
	const lookups: number[][] = []
	const saves: SidecarSaveItem[][] = []
	const failures: SidecarFailure[][] = []
	const lookupAnswer = { current: (_fileId: number): SidecarLookupAnswer => ({ result: 'read', bytes: BYTES, etag: `etag-${lookups.length}`, size: BYTES.length, mtime: 100 }) }
	const sidecars = useSidecarSync({
		lookupSidecars: async (fileIds) => {
			lookups.push([...fileIds])
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
	return { sidecars, lookups, saves, failures, lookupAnswer }
}

/** A `saved` answer for the file id. */
function saved(fileId: number): SidecarSaveAnswer {
	return { result: 'saved', fileId, etag: `saved-${fileId}`, size: 1, mtime: 1 }
}

const decisionOf = (decision: Decision) => () => decision

describe('useSidecarSync: write', () => {
	// spec: XMP-003.6, XMP-003.7
	it('saves the looked-up and the created sidecars, then saves over both without a lookup', async () => {
		const { sidecars, lookups, saves } = sync((item) => saved('fileId' in item ? item.fileId : 30))

		expect(await sidecars.write([PAIR], decisionOf({ ...UNDECIDED, flag: 'picked' }))).toEqual({ written: 1, failed: [] })
		await sidecars.write([PAIR], decisionOf({ ...UNDECIDED, rating: 4 }))

		expect(lookups).toEqual([[11]])
		expect(saves[0]!.map((item) => ('fileId' in item ? [item.fileId, item.etag] : item.path))).toEqual([[11, 'etag-1'], '/P/IMG_0001.JPG.xmp'])
		expect(saves[1]!.map((item) => ('fileId' in item ? [item.fileId, item.etag] : item.path))).toEqual([[11, 'saved-11'], [30, 'saved-30']])
		expect(textOf(readXmp(saves[1]![1]!.bytes), 'xmp:Rating')).toBe('4')
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
		expect(failed).toEqual([{ path: '/P/IMG_0001.NEF.xmp', picture: PAIR, reason: 'changed' }])
		expect(failures).toEqual([failed])
	})

	// spec: XMP-003.9
	it('starts a write after the one before, with the decision of that moment', async () => {
		const first = deferred<SidecarSaveAnswer>()
		const { sidecars, saves } = sync((item, call) => (call === 1 ? first.promise as Promise<never> : saved('fileId' in item ? item.fileId : 30)))
		let decision: Decision = { ...UNDECIDED, rating: 1 }

		const writing = sidecars.write([PAIR], () => decision)
		const next = sidecars.write([PAIR], () => decision)
		await flushPromises()
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
		const after = sidecars.write([PAIR], decisionOf(UNDECIDED))

		await expect(broken).rejects.toThrow('broken')
		expect((await after).written).toBe(1)
	})

	// spec: XMP-003.13
	it('reports the sidecars of a failed lookup without saving them', async () => {
		const { sidecars, saves, lookupAnswer } = sync(() => saved(30))
		lookupAnswer.current = () => {
			throw new Error('offline')
		}
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)

		const { failed } = await sidecars.write([PAIR], decisionOf(UNDECIDED))

		expect(failed).toEqual([{ path: '/P/IMG_0001.NEF.xmp', picture: PAIR, reason: 'unreachable' }])
		expect(saves[0]!.map((item) => 'path' in item && item.path)).toEqual(['/P/IMG_0001.JPG.xmp'])
	})
})

describe('useSidecarSync: takeOver', () => {
	const NOTHING = { decided: [], tagged: [] }
	const single = (id: number): Picture<ListingEntry> => pictureOf(listingEntry(id, `/P/S${id}.JPG`), listingEntry(id + 100, `/P/S${id}.JPG.xmp`))

	// spec: XMP-003.1, XMP-003.2
	it('returns the decision of the sidecars of each picture without a stored one', async () => {
		const { sidecars, lookups } = sync()

		const { decided } = await sidecars.takeOver([single(1), single(2)], new Set([2]), null)

		expect(lookups).toEqual([[101]])
		expect(decided).toEqual([{ picture: single(1), decision: { ...UNDECIDED, rating: 3 } }])
	})

	// spec: XMP-003.4
	it('warns about what it could not take over', async () => {
		const { sidecars, lookupAnswer } = sync()
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
		lookupAnswer.current = () => ({ result: 'notPermitted' })

		expect(await sidecars.takeOver([single(1)], new Set(), new Set())).toEqual(NOTHING)
		expect(warn).toHaveBeenCalledWith('Could not take over the decision of a sidecar', { path: '/P/S1.JPG.xmp', reason: 'notPermitted' })

		lookupAnswer.current = () => {
			throw new Error('offline')
		}
		expect(await sidecars.takeOver([single(1)], new Set(), new Set())).toEqual(NOTHING)
		expect(warn).toHaveBeenCalledWith('Could not look up the sidecars; nothing is taken over', expect.anything())
	})

	it('looks nothing up without sidecars to take over', async () => {
		const { sidecars, lookups } = sync()

		expect(await sidecars.takeOver([single(1)], new Set([1]), new Set())).toEqual(NOTHING)
		expect(lookups).toEqual([])
	})

	// spec: TAGS-002.2, TAGS-002.3
	it('returns the tags of the looked-up pictures without stored tags, and none when the stored tags are unknown', async () => {
		const { sidecars, lookupAnswer } = sync()
		const bytes = serializeXmp(packetOf({ 'digiKam:TagsList': seq(['Anna']) }), CANONICAL_TIME)
		lookupAnswer.current = () => ({ result: 'read', bytes, etag: 'e', size: bytes.length, mtime: 1 })

		expect((await sidecars.takeOver([single(1), single(2)], new Set(), new Set([2]))).tagged).toEqual([{ picture: single(1), tags: ['Anna'] }])
		expect((await sidecars.takeOver([single(1)], new Set(), null)).tagged).toEqual([])
	})

	// spec: TAGS-002.5
	it('warns about each sidecar tag the storage cannot hold', async () => {
		const { sidecars, lookupAnswer } = sync()
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
		const long = 'x'.repeat(256)
		const bytes = serializeXmp(packetOf({ 'digiKam:TagsList': seq(['Anna', long]) }), CANONICAL_TIME)
		lookupAnswer.current = () => ({ result: 'read', bytes, etag: 'e', size: bytes.length, mtime: 1 })

		expect((await sidecars.takeOver([single(1)], new Set(), new Set())).tagged).toEqual([{ picture: single(1), tags: ['Anna'] }])
		expect(warn).toHaveBeenCalledWith('A sidecar tag cannot be stored; it is left out', { tag: long })
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
	it('reports a failed sidecar with the change, and a retry writes the same change', async () => {
		const { sidecars, saves, failures } = sync((item, call) => (call === 1 && 'fileId' in item ? { result: 'notPermitted' } : saved('fileId' in item ? item.fileId : 30)))

		const { failed } = await sidecars.writeTags([PAIR], WEDDING)
		await sidecars.retry(failed, decisionOf(UNDECIDED))

		expect(failures).toEqual([[{ path: '/P/IMG_0001.NEF.xmp', picture: PAIR, reason: 'notPermitted', tags: WEDDING }]])
		expect(saves[1]!.map((item) => 'fileId' in item && item.fileId)).toEqual([11])
		expect(itemsOf(readXmp(saves[1]![0]!.bytes), 'digiKam:TagsList')).toEqual(['Events/Wedding'])
		expect(textOf(readXmp(saves[1]![0]!.bytes), 'xmp:Rating')).toBe('3')
	})

	// spec: XMP-003.13
	it('retries a decision\'s failed sidecars with the decision of that moment', async () => {
		const { sidecars, saves } = sync((item, call) => (call === 1 && 'fileId' in item ? { result: 'locked' } : saved(11)))

		const { failed } = await sidecars.write([PAIR], decisionOf(UNDECIDED))
		await sidecars.retry(failed, decisionOf({ ...UNDECIDED, rating: 5 }))

		expect(saves[1]!.map((item) => 'fileId' in item && item.fileId)).toEqual([11])
		expect(textOf(readXmp(saves[1]![0]!.bytes), 'xmp:Rating')).toBe('5')
	})
})
