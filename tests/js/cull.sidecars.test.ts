// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../src/logic/decision.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { ENTRIES, SET, stored } from './app-cull.ts'
import { access, cullWith, THREE_REJECTED } from './cull-sidecars-fake.ts'

describe('useCull: reading the sidecars\' decision', () => {
	// spec: XMP-003.1, XMP-007.14
	it('reads every picture\'s sidecars and shows their decision without storing it', async () => {
		const { cull, reads, writes, picture } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_10', THREE_REJECTED]])) })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(reads).toEqual([['IMG_2', 'IMG_10', 'IMG_9']])
		expect(cull.decisionOf(picture('IMG_10'))).toEqual(THREE_REJECTED)
		expect(writes).toEqual([])
	})

	// spec: XMP-003.2, XMP-008.11
	it('shows a legacy decision over the sidecars\' and locks its picture', async () => {
		const { cull, picture } = cullWith({ stored: [stored(4, 'picked')], takenOver: Promise.resolve(new Map([['IMG_9', THREE_REJECTED], ['IMG_2', THREE_REJECTED]])) })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(cull.decisionOf(picture('IMG_9')).flag).toBe('picked')
		expect(cull.decisionOf(picture('IMG_2'))).toEqual(THREE_REJECTED)
		expect(cull.writabilityOf(picture('IMG_9'))).toBe('legacy')
		expect(cull.writabilityOf(picture('IMG_2'))).toBe('writable')
	})

	// spec: XMP-003.3, XMP-008.8
	it('keeps a decision the user made while the sidecars were read', async () => {
		let answer!: (decisions: Map<string, Decision>) => void
		const { cull, picture } = cullWith({
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
		expect(cull.decisionOf(picture('IMG_9'))).toEqual(THREE_REJECTED)
	})

	// spec: XMP-003.5
	it('is neither an undo step nor written back to the sidecars', async () => {
		const { cull, writes } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_9', THREE_REJECTED]])) })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(cull.undo()).toBeNull()
		expect(writes).toEqual([])
	})

	it('reads again when the pairing settings change', async () => {
		const { cull, reads, settings } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_9', THREE_REJECTED]])) })
		cull.open(SET, ENTRIES)
		await flushPromises()
		settings.value = { ...DEFAULT_SETTINGS, showSingles: false, rawExtensions: ['cr3', 'nef'] }
		await flushPromises()

		expect(reads).toHaveLength(2)
	})
})

describe('useCull: writing through to the sidecars', () => {
	// spec: XMP-003.6, XMP-003.9, XMP-003.20
	it('writes each picture of a step with its decision and changed fields at once', async () => {
		const { cull, writes, picture } = cullWith()
		cull.open(SET, ENTRIES)
		await flushPromises()

		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_10'), picture('IMG_2')])
		expect(writes).toHaveLength(1)
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

	// spec: XMP-003.18, XMP-008.7
	it('decides nothing and writes neither decisions nor tags with writing to sidecars off, and still reads', async () => {
		const { cull, writes, tagWrites, reads, settings, picture, locks } = cullWith({ sidecarWrite: 'off' })
		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(cull.decide({ kind: 'rating', rating: 4 }, [picture('IMG_10')])).toBeNull()
		cull.tags.change([picture('IMG_10')], { added: ['Anna'], removed: [] })
		await flushPromises()
		expect(writes).toEqual([])
		expect(tagWrites).toEqual([])
		expect(reads).toHaveLength(1)
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
		expect(cull.legacy.value.map(({ picture }) => [picture.baseName, cull.unconfirmedOf(picture)])).toEqual([['IMG_2', true]])

		settings.value = { ...settings.value, confirmedSharedFolders: [7] }
		expect(cull.unconfirmedOf(picture('IMG_2'))).toBe(false)
		locks[0]!.retry()
		await flushPromises()
		expect(writes.map((write) => write.map(({ name }) => name))).toEqual([['IMG_9']])

		cull.open(SET, ENTRIES)
		expect(cull.sharedPictures.value).toEqual([])
	})

	// spec: XMP-008.3, XMP-008.5, XMP-008.9
	it('takes nothing when every picture of a step is locked, nor when the picked one is, and names why', async () => {
		const { cull, writes, picture, locks } = cullWith()
		cull.open(SET, ENTRIES, access({ '/Trip/A': { permissions: 1 }, '/Trip/B': { versions: false } }))
		await flushPromises()

		expect(cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_2'), picture('IMG_10')])).toBeNull()
		expect(cull.takeSkipped().map(({ picture, reason }) => [picture.baseName, reason])).toEqual([['IMG_2', 'noVersions'], ['IMG_10', 'readOnly']])
		expect(cull.tag({ added: ['Anna'], removed: [] }, [picture('IMG_2')])).toBeNull()
		expect(cull.takeSkipped().map(({ reason }) => reason)).toEqual(['noVersions'])
		cull.open(SET, ENTRIES, access({ '/Trip/A': { permissions: 1 } }))
		await flushPromises()
		expect(cull.pickRest(picture('IMG_10'), [picture('IMG_2')])).toBeNull()
		expect(cull.takeSkipped().map(({ picture }) => picture.baseName)).toEqual(['IMG_10'])
		await flushPromises()

		expect(cull.takeSkipped()).toEqual([])
		expect(locks).toEqual([])
		expect(writes).toEqual([])
	})

	// spec: XMP-008.9, XMP-008.10
	it('decides the writable pictures of a step as one undo step and leaves the locked ones', async () => {
		const { cull, writes, picture } = cullWith()
		cull.open(SET, ENTRIES, access({ '/Trip/A': { permissions: 1 } }))
		await flushPromises()

		const step = cull.decide({ kind: 'flag', flag: 'rejected' }, [picture('IMG_2'), picture('IMG_10'), picture('IMG_9')])
		await flushPromises()

		expect(step?.names).toEqual(['IMG_2'])
		expect(cull.takeSkipped().map(({ picture, reason }) => [picture.baseName, reason])).toEqual([['IMG_10', 'readOnly'], ['IMG_9', 'readOnly']])
		expect(writes.map((write) => write.map(({ name }) => name))).toEqual([['IMG_2']])
		expect(cull.pickRest(picture('IMG_2'), [picture('IMG_9')])?.names).toEqual(['IMG_2'])

		cull.undo()
		await flushPromises()
		cull.undo()
		await flushPromises()
		expect(writes.slice(2).map((write) => write.map(({ name, decision }) => [name, decision.flag]))).toEqual([[['IMG_2', 'rejected']], [['IMG_2', 'unflagged']]])
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('unflagged')
		expect(cull.undo()).toBeNull()
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
