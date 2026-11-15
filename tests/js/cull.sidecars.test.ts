// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { CullSidecars } from '../../src/cull-seams.ts'
import type { Decision, StoredDecision } from '../../src/logic/decision.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { Settings, SidecarWrite } from '../../src/logic/settings.ts'
import type { StoredTags, Tag, TagChange } from '../../src/logic/tag.ts'
import type { FolderAccess, ListedAccess, WriteLock } from '../../src/logic/writability.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { useCull } from '../../src/cull.ts'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { ENTRIES, fakeStorage, NO_SERIES, SET, stored } from './app-cull.ts'

const THREE_REJECTED: Decision = { ...UNDECIDED, rating: 3, flag: 'rejected' }

/** The listing's access of `/Trip` opened as file id 7, with the given folders changed from plain and writable. */
function access(changed: Record<string, Partial<FolderAccess>> = {}): ListedAccess {
	const folder = (path: string): FolderAccess => ({ path, shared: false, permissions: 31, versions: true, ...changed[path] })
	return { folders: ['/Trip/A', '/Trip/B'].map(folder), opened: [{ path: '/Trip', fileId: 7 }] }
}

/** A cull whose sidecar take-over answers `takenOver` and whose writes and saves are recorded. */
function cullWith(options: { stored?: StoredDecision[], takenOver?: Promise<Map<string, Decision>>, saveFails?: boolean, storedTags?: StoredTags[], tagsTakenOver?: Map<string, Tag[]>, tagLookupFails?: boolean, sidecarWrite?: SidecarWrite } = {}) {
	const locks: WriteLock[] = []
	const saved: StoredDecision[][] = []
	const takeOvers: { names: string[], stored: number[], tagged: number[] | null }[] = []
	const tagWrites: { names: string[], change: TagChange }[] = []
	const savedTags: StoredTags[][] = []
	const tagLookups: number[][] = []
	const writes: { name: string, decision: Decision, fields: readonly string[] }[][] = []
	const settings = shallowRef<Settings>({ ...DEFAULT_SETTINGS, sidecarWrite: options.sidecarWrite ?? 'on' })
	const sidecars: CullSidecars = {
		takeOver: async (pictures, storedIds, taggedIds) => {
			takeOvers.push({ names: pictures.map((picture) => picture.baseName), stored: [...storedIds].sort((a, b) => a - b), tagged: taggedIds && [...taggedIds].sort((a, b) => a - b) })
			const decisions = await (options.takenOver ?? Promise.resolve(new Map<string, Decision>()))
			const tags = options.tagsTakenOver ?? new Map<string, Tag[]>()
			return {
				decided: pictures.filter((picture) => decisions.has(picture.baseName)).map((picture) => ({ picture, decision: decisions.get(picture.baseName)! })),
				tagged: pictures.filter((picture) => tags.has(picture.baseName)).map((picture) => ({ picture, tags: tags.get(picture.baseName)! })),
			}
		},
		write: async (pictures, decisionOf, fields) => {
			writes.push(pictures.map((picture) => ({ name: picture.baseName, decision: decisionOf(picture), fields })))
			return { written: pictures.length, failed: [] }
		},
		writeTags: async (pictures, change) => {
			tagWrites.push({ names: pictures.map((picture) => picture.baseName), change })
			return { written: pictures.length, failed: [] }
		},
	}
	const cull = useCull({
		hashImage: () => new Promise(() => undefined),
		saveVisualHashes: async () => undefined,
		warmPreviews: async () => undefined,
		lookupDecisions: async () => options.stored ?? [],
		lookupSeries: NO_SERIES,
		saveDecisions: async (rows) => {
			saved.push([...rows])
			if (options.saveFails) {
				throw new Error('offline')
			}
		},
		tags: {
			lookupTags: async (fileIds) => {
				tagLookups.push([...fileIds])
				if (options.tagLookupFails) {
					throw new Error('down')
				}
				return (options.storedTags ?? []).filter((row) => fileIds.includes(row.fileId))
			},
			saveTags: async (rows) => { savedTags.push([...rows]) },
			loadTagList: async () => [],
		},
	}, fakeStorage(), () => settings.value, sidecars, (lock) => locks.push(lock))
	const picture = (name: string): Picture<ListingEntry> => cull.pictures.value.find((each) => each.baseName === name)!
	return { cull, saved, takeOvers, writes, settings, picture, tagWrites, savedTags, tagLookups, locks }
}

describe('useCull: taking over the sidecars\' decision', () => {
	// spec: XMP-003.1, XMP-003.2
	it('shows and stores the decision of pictures without a stored one, in one save', async () => {
		const { cull, saved, takeOvers, picture } = cullWith({ stored: [stored(4, 'picked')], takenOver: Promise.resolve(new Map([['IMG_10', THREE_REJECTED]])) })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(takeOvers).toEqual([{ names: ['IMG_2', 'IMG_10', 'IMG_9'], stored: [4], tagged: [] }])
		expect(cull.decisionOf(picture('IMG_10'))).toEqual(THREE_REJECTED)
		expect(saved).toEqual([[{ fileId: 3, ...THREE_REJECTED }, { fileId: 2, ...THREE_REJECTED }]])
	})

	// spec: XMP-003.3, XMP-008.8
	it('keeps a decision the user made while the sidecars were looked up', async () => {
		let answer!: (decisions: Map<string, Decision>) => void
		const { cull, saved, picture } = cullWith({
			takenOver: new Promise((resolve) => {
				answer = resolve
			}),
		})
		cull.open(SET, ENTRIES)
		await flushPromises()

		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_10')])
		answer(new Map([['IMG_10', THREE_REJECTED], ['IMG_9', THREE_REJECTED]]))
		await flushPromises()

		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('picked')
		expect(saved.at(-1)).toEqual([{ fileId: 4, ...THREE_REJECTED }])
	})

	// spec: XMP-003.4
	it('stores nothing when there is nothing to take over', async () => {
		const { cull, saved } = cullWith()

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(saved).toEqual([])
	})

	// spec: XMP-003.5
	it('is neither an undo step nor written back to the sidecars', async () => {
		const { cull, writes } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_9', THREE_REJECTED]])) })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(cull.undo()).toBeNull()
		expect(writes).toEqual([])
	})

	it('takes over again when the pairing settings change, and not for a closed cull', async () => {
		const { cull, takeOvers, settings, saved } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_9', THREE_REJECTED]])) })
		cull.open(SET, ENTRIES)
		await flushPromises()
		settings.value = { ...DEFAULT_SETTINGS, showSingles: false, rawExtensions: ['cr3', 'nef'] }
		await flushPromises()

		expect(takeOvers).toHaveLength(2)
		expect(saved).toHaveLength(1)
	})

	it('logs a failed save of the taken-over decision', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { cull } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_9', THREE_REJECTED]])), saveFails: true })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(error).toHaveBeenCalledWith('Could not save the decisions taken over from the sidecars', expect.anything())
	})
})

describe('useCull: writing through to the sidecars', () => {
	// spec: XMP-003.6, XMP-003.9, XMP-003.20
	it('writes each picture of a stored step with its decision and changed fields when the save is done', async () => {
		const { cull, writes, picture } = cullWith()
		cull.open(SET, ENTRIES)
		await flushPromises()

		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_10'), picture('IMG_2')])
		expect(writes).toEqual([])
		await flushPromises()
		cull.undo()
		await flushPromises()

		expect(writes.map((write) => write.map(({ name, decision }) => [name, decision.flag]))).toEqual([
			[['IMG_2', 'picked'], ['IMG_10', 'picked']],
			[['IMG_2', 'unflagged'], ['IMG_10', 'unflagged']],
		])
		expect(writes.map((write) => write.map(({ fields }) => fields))).toEqual([[['flag'], ['flag']], [['flag'], ['flag']]])
	})

	// spec: XMP-003.15
	it.each([
		{ kind: 'flag', flag: 'rejected' },
		{ kind: 'rating', rating: 2 },
		{ kind: 'colourLabel', colourLabel: 'red' },
		{ kind: 'keepRaw' },
	] as const)('writes the picture a $kind step touched and no other', async (intent) => {
		const { cull, writes, picture } = cullWith()
		cull.open(SET, ENTRIES)
		await flushPromises()

		cull.decide(intent, [picture('IMG_10')])
		await flushPromises()

		expect(writes.map((write) => write.map(({ name }) => name))).toEqual([['IMG_10']])
	})

	// spec: XMP-003.10
	it('writes nothing when the save fails', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { cull, writes, picture } = cullWith({ saveFails: true })
		cull.open(SET, ENTRIES)
		await flushPromises()

		cull.decide({ kind: 'rating', rating: 4 }, [picture('IMG_9')])
		await flushPromises()

		expect(writes).toEqual([])
	})

	// spec: XMP-003.18, XMP-008.7
	it('decides nothing and writes neither decisions nor tags with writing to sidecars off, and still takes over', async () => {
		const { cull, writes, tagWrites, takeOvers, settings, picture, saved, locks } = cullWith({ sidecarWrite: 'off' })
		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(cull.decide({ kind: 'rating', rating: 4 }, [picture('IMG_10')])).toBeNull()
		await cull.tags.change([picture('IMG_10')], { added: ['Anna'], removed: [] })
		await flushPromises()
		expect(writes).toEqual([])
		expect(tagWrites).toEqual([])
		expect(saved).toEqual([])
		expect(takeOvers).toHaveLength(1)
		expect(locks.map(({ reason, folders }) => [reason, folders])).toEqual([['off', []]])

		settings.value = { ...settings.value, sidecarWrite: 'on' }
		locks[0]!.retry()
		await flushPromises()
		expect(writes.map((write) => write.map(({ name, decision }) => [name, decision.rating]))).toEqual([[['IMG_10', 4]]])
	})

	// spec: XMP-003.11, XMP-003.14, XMP-008.4, XMP-008.7
	it('asks to confirm a shared folder before deciding there, then writes through', async () => {
		const { cull, writes, picture, settings, locks } = cullWith({ stored: [stored(1, 'picked')] })
		cull.open(SET, ENTRIES, access({ '/Trip/A': { shared: true }, '/Trip/B': { shared: true } }))
		await flushPromises()

		expect(cull.decide({ kind: 'rating', rating: 4 }, [picture('IMG_9')])).toBeNull()
		await flushPromises()
		expect(writes).toEqual([])
		expect(locks.map(({ reason, folders }) => [reason, folders])).toEqual([['shared', [{ path: '/Trip', fileId: 7 }]]])
		expect(cull.sharedPictures.value.map((each) => each.baseName)).toEqual(['IMG_2', 'IMG_10', 'IMG_9'])
		expect(cull.legacy.value.map(({ picture, shared }) => [picture.baseName, shared])).toEqual([['IMG_2', true]])

		settings.value = { ...settings.value, confirmedSharedFolders: [7] }
		locks[0]!.retry()
		await flushPromises()
		expect(writes.map((write) => write.map(({ name }) => name))).toEqual([['IMG_9']])

		cull.open(SET, ENTRIES)
		expect(cull.sharedPictures.value).toEqual([])
	})

	// spec: XMP-008.3, XMP-008.5, XMP-008.7
	it('names why a picture of a step cannot be decided, and decides none of the step', async () => {
		const { cull, writes, saved, picture, locks } = cullWith()
		cull.open(SET, ENTRIES, access({ '/Trip/A': { permissions: 1 }, '/Trip/B': { versions: false } }))
		await flushPromises()

		expect(cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_2'), picture('IMG_10')])).toBeNull()
		expect(cull.pickRest(picture('IMG_2'), [picture('IMG_9')])).toBeNull()
		expect(cull.tag({ added: ['Anna'], removed: [] }, [picture('IMG_2')])).toBeNull()
		await flushPromises()

		expect(locks.map(({ reason }) => reason)).toEqual(['readOnly', 'readOnly', 'noVersions'])
		expect(cull.writabilityOf(picture('IMG_2'))).toBe('noVersions')
		expect(writes).toEqual([])
		expect(saved).toEqual([])
	})

	// spec: XMP-008.6
	it('locks a picture once a write refused one of its sidecars', async () => {
		const { cull, picture } = cullWith()
		cull.open(SET, ENTRIES)
		await flushPromises()

		cull.refuse([{ path: '/Trip/B/IMG_2.JPG.xmp', picture: picture('IMG_2'), reason: 'malformed' }, { path: '/Trip/A/IMG_9.JPG.xmp', picture: picture('IMG_9'), reason: 'notPermitted' }])

		expect(cull.writabilityOf(picture('IMG_2'))).toBe('refused')
		expect(cull.writabilityOf(picture('IMG_9'))).toBe('writable')
		cull.open(SET, ENTRIES)
		expect(cull.writabilityOf(cull.pictures.value.find((each) => each.baseName === 'IMG_2')!)).toBe('writable')
	})
})

describe('useCull: tags', () => {
	// spec: TAGS-002.1, TAGS-002.2
	it('reads the stored tags, then shows and stores the sidecars\' tags of the pictures without', async () => {
		const { cull, takeOvers, savedTags, tagLookups, picture } = cullWith({ storedTags: [{ fileId: 4, tags: ['Anna'] }], tagsTakenOver: new Map([['IMG_10', ['Places/Lisbon']]]) })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(tagLookups).toEqual([[1, 3, 2, 4]])
		expect(takeOvers.map(({ tagged }) => tagged)).toEqual([[4]])
		expect(cull.tags.tagsOf(picture('IMG_9'))).toEqual(['Anna'])
		expect(cull.tags.tagsOf(picture('IMG_10'))).toEqual(['Places/Lisbon'])
		expect(savedTags).toEqual([[{ fileId: 3, tags: ['Places/Lisbon'] }, { fileId: 2, tags: ['Places/Lisbon'] }]])
	})

	// spec: TAGS-002.6
	it('takes no tags over when their read fails, and still loads the decisions', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { cull, takeOvers, picture } = cullWith({ stored: [stored(4, 'picked')], tagLookupFails: true })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(takeOvers.map(({ tagged }) => tagged)).toEqual([null])
		expect(cull.decisionOf(picture('IMG_9')).flag).toBe('picked')
	})

	// spec: TAGS-002.9, TAGS-002.12
	it('writes a tag change through outside shared folders only', async () => {
		const { cull, tagWrites, picture } = cullWith()
		const change = { added: ['Anna'], removed: [] }
		cull.open(SET, ENTRIES, access({ '/Trip/B': { shared: true } }))
		await flushPromises()

		await cull.tags.change([picture('IMG_2'), picture('IMG_10')], change)

		expect(tagWrites).toEqual([{ names: ['IMG_10'], change }])
	})

	// spec: TAGS-002.14
	it('reads the tags of files moved back', async () => {
		const { cull, tagLookups } = cullWith()
		cull.open(SET, ENTRIES)
		await flushPromises()
		const pair = cull.pictures.value.find((each) => each.baseName === 'IMG_10')!
		cull.restoreFiles([{ ...pair.raw!, fileId: 103 }])
		await flushPromises()

		expect(tagLookups.at(-1)).toEqual([103])
	})
})
