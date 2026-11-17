// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../src/logic/decision.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { ENTRIES, SET, stored } from './app-cull.ts'
import { access, cullWith, THREE_REJECTED } from './cull-sidecars-fake.ts'

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
