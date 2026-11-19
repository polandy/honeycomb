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

	// spec: XMP-003.2
	it('shows a stored decision over the sidecars\'', async () => {
		const { cull, picture } = cullWith({ stored: [stored(4, 'picked')], takenOver: Promise.resolve(new Map([['IMG_9', THREE_REJECTED], ['IMG_2', THREE_REJECTED]])) })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(cull.decisionOf(picture('IMG_9')).flag).toBe('picked')
		expect(cull.decisionOf(picture('IMG_2'))).toEqual(THREE_REJECTED)
		expect(cull.writabilityOf(picture('IMG_9'))).toBe('writable')
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

	// spec: XMP-008.12
	it('decides and writes through in every folder that grants update and create, without asking', async () => {
		const { cull, writes, tagWrites, picture } = cullWith()
		cull.open(SET, ENTRIES, access({ '/Trip/A': 7 }))
		await flushPromises()

		expect(cull.decide({ kind: 'rating', rating: 4 }, [picture('IMG_2'), picture('IMG_10')])?.names).toEqual(['IMG_2', 'IMG_10'])
		cull.tags.change([picture('IMG_9')], { added: ['Anna'], removed: [] })
		await flushPromises()

		expect(writes.map((write) => write.map(({ name, decision }) => [name, decision.rating]))).toEqual([[['IMG_2', 4], ['IMG_10', 4]]])
		expect(tagWrites.map(({ names }) => names)).toEqual([['IMG_9']])
		expect(cull.takeSkipped()).toEqual([])
	})

	// spec: XMP-008.3, XMP-008.14
	it('takes nothing when every picture of a step is read-only, nor when the picked one is, and names why', async () => {
		const { cull, writes, picture } = cullWith()
		cull.open(SET, ENTRIES, access({ '/Trip/A': 1, '/Trip/B': 3 }))
		await flushPromises()

		expect(cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_2'), picture('IMG_10')])).toBeNull()
		expect(cull.takeSkipped().map(({ picture, reason }) => [picture.baseName, reason])).toEqual([['IMG_2', 'readOnly'], ['IMG_10', 'readOnly']])
		expect(cull.tag({ added: ['Anna'], removed: [] }, [picture('IMG_2')])).toBeNull()
		expect(cull.takeSkipped().map(({ reason }) => reason)).toEqual(['readOnly'])
		cull.open(SET, ENTRIES, access({ '/Trip/A': 1 }))
		await flushPromises()
		expect(cull.pickRest(picture('IMG_10'), [picture('IMG_2')])).toBeNull()
		expect(cull.takeSkipped().map(({ picture }) => picture.baseName)).toEqual(['IMG_10'])
		await flushPromises()

		expect(cull.takeSkipped()).toEqual([])
		expect(writes).toEqual([])
	})

	// spec: XMP-008.14, XMP-008.10
	it('decides the writable pictures of a step as one undo step and leaves the locked ones', async () => {
		const { cull, writes, picture } = cullWith()
		cull.open(SET, ENTRIES, access({ '/Trip/A': 1 }))
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
})
