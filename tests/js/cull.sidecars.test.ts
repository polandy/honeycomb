// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { CullSidecars } from '../../src/cull.ts'
import type { Decision, StoredDecision } from '../../src/logic/decision.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { Settings } from '../../src/logic/settings.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { useCull } from '../../src/cull.ts'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { ENTRIES, fakeStorage, SET, stored } from './app-cull.ts'

const THREE_REJECTED: Decision = { ...UNDECIDED, rating: 3, flag: 'rejected' }

/** A cull whose sidecar take-over answers `takenOver` and whose writes and saves are recorded. */
function cullWith(options: { stored?: StoredDecision[], takenOver?: Promise<Map<string, Decision>>, saveFails?: boolean } = {}) {
	const saved: StoredDecision[][] = []
	const takeOvers: { names: string[], stored: number[] }[] = []
	const writes: { name: string, decision: Decision }[][] = []
	const settings = shallowRef<Settings>(DEFAULT_SETTINGS)
	const sidecars: CullSidecars = {
		takeOver: async (pictures, storedIds) => {
			takeOvers.push({ names: pictures.map((picture) => picture.baseName), stored: [...storedIds].sort((a, b) => a - b) })
			const decisions = await (options.takenOver ?? Promise.resolve(new Map<string, Decision>()))
			return pictures.filter((picture) => decisions.has(picture.baseName)).map((picture) => ({ picture, decision: decisions.get(picture.baseName)! }))
		},
		write: async (pictures, decisionOf) => {
			writes.push(pictures.map((picture) => ({ name: picture.baseName, decision: decisionOf(picture) })))
			return { written: pictures.length, failed: [] }
		},
	}
	const cull = useCull({
		warmPreviews: async () => undefined,
		lookupDecisions: async () => options.stored ?? [],
		saveDecisions: async (rows) => {
			saved.push([...rows])
			if (options.saveFails) {
				throw new Error('offline')
			}
		},
	}, fakeStorage(), () => settings.value, sidecars)
	const picture = (name: string): Picture<ListingEntry> => cull.pictures.value.find((each) => each.baseName === name)!
	return { cull, saved, takeOvers, writes, settings, picture }
}

describe('useCull: taking over the sidecars\' decision', () => {
	// spec: XMP-003.1, XMP-003.2
	it('shows and stores the decision of pictures without a stored one, in one save', async () => {
		const { cull, saved, takeOvers, picture } = cullWith({ stored: [stored(4, 'picked')], takenOver: Promise.resolve(new Map([['IMG_10', THREE_REJECTED]])) })

		cull.open(SET, ENTRIES, [])
		await flushPromises()

		expect(takeOvers).toEqual([{ names: ['IMG_2', 'IMG_10', 'IMG_9'], stored: [4] }])
		expect(cull.decisionOf(picture('IMG_10'))).toEqual(THREE_REJECTED)
		expect(saved).toEqual([[{ fileId: 3, ...THREE_REJECTED }, { fileId: 2, ...THREE_REJECTED }]])
	})

	// spec: XMP-003.3
	it('keeps a decision the user made while the sidecars were looked up', async () => {
		let answer!: (decisions: Map<string, Decision>) => void
		const { cull, saved, picture } = cullWith({
			takenOver: new Promise((resolve) => {
				answer = resolve
			}),
		})
		cull.open(SET, ENTRIES, [])
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

		cull.open(SET, ENTRIES, [])
		await flushPromises()

		expect(saved).toEqual([])
	})

	// spec: XMP-003.5
	it('is neither an undo step nor written back to the sidecars', async () => {
		const { cull, writes } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_9', THREE_REJECTED]])) })

		cull.open(SET, ENTRIES, [])
		await flushPromises()

		expect(cull.undo()).toBeNull()
		expect(writes).toEqual([])
	})

	it('takes over again when the pairing settings change, and not for a closed cull', async () => {
		const { cull, takeOvers, settings, saved } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_9', THREE_REJECTED]])) })
		cull.open(SET, ENTRIES, [])
		settings.value = { ...DEFAULT_SETTINGS, showSingles: false, rawExtensions: ['cr3', 'nef'] }
		await flushPromises()

		expect(takeOvers).toHaveLength(2)
		expect(saved).toHaveLength(1)
	})

	it('logs a failed save of the taken-over decision', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { cull } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_9', THREE_REJECTED]])), saveFails: true })

		cull.open(SET, ENTRIES, [])
		await flushPromises()

		expect(error).toHaveBeenCalledWith('Could not save the decisions taken over from the sidecars', expect.anything())
	})
})

describe('useCull: writing through to the sidecars', () => {
	// spec: XMP-003.6, XMP-003.9
	it('writes each picture of a stored step with its decision when the save is done', async () => {
		const { cull, writes, picture } = cullWith()
		cull.open(SET, ENTRIES, [])
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
	})

	// spec: XMP-003.15
	it.each([
		{ kind: 'flag', flag: 'rejected' },
		{ kind: 'rating', rating: 2 },
		{ kind: 'colourLabel', colourLabel: 'red' },
		{ kind: 'keepRaw' },
	] as const)('writes the picture a $kind step touched and no other', async (intent) => {
		const { cull, writes, picture } = cullWith()
		cull.open(SET, ENTRIES, [])
		await flushPromises()

		cull.decide(intent, [picture('IMG_10')])
		await flushPromises()

		expect(writes.map((write) => write.map(({ name }) => name))).toEqual([['IMG_10']])
	})

	// spec: XMP-003.10
	it('writes nothing when the save fails', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { cull, writes, picture } = cullWith({ saveFails: true })
		cull.open(SET, ENTRIES, [])
		await flushPromises()

		cull.decide({ kind: 'rating', rating: 4 }, [picture('IMG_9')])
		await flushPromises()

		expect(writes).toEqual([])
	})

	// spec: XMP-003.11, XMP-003.14
	it('writes nothing for a picture in a shared folder and lists the decided ones there', async () => {
		const { cull, writes, picture } = cullWith({ stored: [stored(1, 'picked')] })
		cull.open(SET, ENTRIES, ['/Trip/A', '/Trip/B'])
		await flushPromises()

		cull.decide({ kind: 'rating', rating: 4 }, [picture('IMG_9')])
		await flushPromises()

		expect(writes).toEqual([])
		expect(cull.sharedPictures.value.map((each) => each.baseName)).toEqual(['IMG_2', 'IMG_10', 'IMG_9'])
		expect(cull.sharedDecided().map((each) => each.baseName)).toEqual(['IMG_2', 'IMG_9'])

		cull.open(SET, ENTRIES, [])
		expect(cull.sharedPictures.value).toEqual([])
	})
})
