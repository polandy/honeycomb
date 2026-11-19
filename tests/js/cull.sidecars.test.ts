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

describe('useCull: reading the sidecars\' decision', () => {
	// spec: XMP-003.34
	it('shows a picture seen for the first time as its sidecars state and takes its flag over once', async () => {
		const { cull, reads, writes, flags, open, picture } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_10', THREE_REJECTED]])) })

		open(SET, ENTRIES)
		await flushPromises()

		expect(reads).toEqual([['IMG_2', 'IMG_10', 'IMG_9']])
		expect(cull.decisionOf(picture('IMG_10'))).toEqual(THREE_REJECTED)
		expect(flags.takenOver.map((items) => [...items].sort((a, b) => a.fileId - b.fileId))).toEqual([[1, 2, 3, 4].map((fileId) => ({ fileId, flag: fileId === 2 || fileId === 3 ? 'rejected' : 'unflagged', keepRaw: false }))])
		expect(writes).toEqual([])
	})

	// spec: XMP-003.35, XMP-006.12
	it('shows the row\'s flag over the sidecars\' and takes nothing over for it', async () => {
		const { cull, flags, open, picture } = cullWith({ stored: [stored(4, 'picked')], takenOver: Promise.resolve(new Map([['IMG_9', THREE_REJECTED], ['IMG_2', THREE_REJECTED]])) })

		open(SET, ENTRIES)
		await flushPromises()

		expect(cull.decisionOf(picture('IMG_9'))).toEqual({ ...THREE_REJECTED, flag: 'picked' })
		expect(cull.decisionOf(picture('IMG_2'))).toEqual(THREE_REJECTED)
		expect(flags.takenOver.flat().map(({ fileId }) => fileId).sort()).toEqual([1, 2, 3])
	})

	// spec: XMP-003.35
	it('takes nothing over when the cull opens again after the take-over', async () => {
		const { cull, flags, open, picture } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_10', THREE_REJECTED]])) })
		open(SET, ENTRIES)
		await flushPromises()

		open(SET, ENTRIES)
		await flushPromises()

		expect(flags.takenOver).toHaveLength(1)
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('rejected')
	})

	// spec: XMP-003.36
	it('takes a read-only picture over too', async () => {
		const { cull, flags, open, picture } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_9', { ...THREE_REJECTED, flag: 'picked' as const }]])) })

		open(SET, ENTRIES, access({ '/Trip/A': 1 }))
		await flushPromises()

		expect(cull.writabilityOf(picture('IMG_9'))).toBe('readOnly')
		expect(cull.decisionOf(picture('IMG_9')).flag).toBe('picked')
		expect(flags.takenOver.flat()).toContainEqual({ fileId: 4, flag: 'picked', keepRaw: false })
	})

	// spec: XMP-003.36
	it('logs a failed take-over and shows what the sidecars state', async () => {
		const warned = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
		const error = new Error('offline')
		const { cull, flags, open, picture } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_10', THREE_REJECTED]])) })
		flags.api.takeOver = () => Promise.reject(error)

		open(SET, ENTRIES)
		await flushPromises()

		expect(warned).toHaveBeenCalledWith('Could not take the flags over; the photos show what their sidecars state', { error })
		expect(cull.decisionOf(picture('IMG_10'))).toEqual(THREE_REJECTED)
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
	// spec: XMP-003.9, XMP-003.20
	it('writes each picture of a step with its decision and changed fields at once', async () => {
		const { cull, writes, picture } = cullWith()
		cull.open(SET, ENTRIES)
		await flushPromises()

		cull.decide({ kind: 'rating', rating: 2 }, [picture('IMG_10'), picture('IMG_2')])
		expect(writes).toHaveLength(1)
		cull.undo()
		await flushPromises()

		expect(writes.map((write) => write.map(({ name, decision }) => [name, decision.rating]))).toEqual([
			[['IMG_2', 2], ['IMG_10', 2]],
			[['IMG_2', 0], ['IMG_10', 0]],
		])
		expect(writes.map((write) => write.map(({ fields }) => fields))).toEqual([[['rating'], ['rating']], [['rating'], ['rating']]])
	})

	// spec: XMP-003.38
	it.each([
		{ kind: 'flag', flag: 'picked' },
		{ kind: 'keepRaw' },
	] as const)('saves a $kind step and its undo to both members\' rows and writes no sidecar', async (intent) => {
		const { cull, writes, flags, picture } = cullWith()
		cull.open(SET, ENTRIES)
		await flushPromises()

		cull.decide(intent, [picture('IMG_10')])
		const decided = cull.decisionOf(picture('IMG_10'))
		cull.undo()
		await flushPromises()

		expect(flags.saves).toEqual([
			[2, 3].map((fileId) => ({ fileId, flag: decided.flag, keepRaw: decided.keepRaw })),
			[2, 3].map((fileId) => ({ fileId, flag: 'unflagged', keepRaw: false })),
		])
		expect(writes).toEqual([])
	})

	// spec: XMP-003.37
	it.each([
		{ kind: 'rating', rating: 2 },
		{ kind: 'colourLabel', colourLabel: 'red' },
	] as const)('writes the picture a $kind step touched and no other, without the flag fields', async (intent) => {
		const { cull, writes, flags, picture } = cullWith()
		cull.open(SET, ENTRIES)
		await flushPromises()

		cull.decide(intent, [picture('IMG_10')])
		await flushPromises()

		expect(writes.map((write) => write.map(({ name, fields }) => [name, fields]))).toEqual([[['IMG_10', [intent.kind]]]])
		expect(flags.saves).toEqual([])
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
		const { cull, writes, flags, picture } = cullWith()
		cull.open(SET, ENTRIES, access({ '/Trip/A': 1 }))
		await flushPromises()

		const step = cull.decide({ kind: 'flag', flag: 'rejected' }, [picture('IMG_2'), picture('IMG_10'), picture('IMG_9')])
		await flushPromises()

		expect(step?.names).toEqual(['IMG_2'])
		expect(cull.takeSkipped().map(({ picture, reason }) => [picture.baseName, reason])).toEqual([['IMG_10', 'readOnly'], ['IMG_9', 'readOnly']])
		expect(flags.saves.map((items) => items.map(({ fileId }) => fileId))).toEqual([[1]])
		expect(cull.pickRest(picture('IMG_2'), [picture('IMG_9')])?.names).toEqual(['IMG_2'])

		cull.undo()
		await flushPromises()
		cull.undo()
		await flushPromises()
		expect(flags.saves.slice(2).map((items) => items.map(({ fileId, flag }) => [fileId, flag]))).toEqual([[[1, 'rejected']], [[1, 'unflagged']]])
		expect(writes).toEqual([])
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('unflagged')
		expect(cull.undo()).toBeNull()
	})
})
