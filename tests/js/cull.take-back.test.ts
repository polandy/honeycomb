// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SidecarFailureReason } from '../../src/logic/sidecar-sync.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/shared/logger.ts'
import { ENTRIES, SET, stored } from './app-cull.ts'
import { access, cullWith } from './cull-sidecars-fake.ts'

/** READ and UPDATE without CREATE. */
const NO_CREATE = 3
const NAMES = ['IMG_2', 'IMG_10', 'IMG_9']

describe('useCull: a read-only picture', () => {
	// spec: XMP-008.13
	it('changes nothing and saves nothing for any of the six values, alone or in a step', async () => {
		const { cull, writes, tagWrites, flags, picture, open } = cullWith()
		await open(SET, ENTRIES, access({ '/Trip/A': NO_CREATE }))
		await flushPromises()
		const before = NAMES.map((name) => cull.decisionOf(picture(name)))

		for (const intent of [{ kind: 'flag', flag: 'picked' }, { kind: 'rating', rating: 4 }, { kind: 'colourLabel', colourLabel: 'red' }, { kind: 'keepRaw' }] as const) {
			expect(cull.decide(intent, [picture('IMG_10')])).toBeNull()
			expect(cull.decide(intent, [picture('IMG_10'), picture('IMG_9')])).toBeNull()
		}
		expect(cull.tag({ added: ['Anna'], removed: [] }, [picture('IMG_10'), picture('IMG_9')])).toBeNull()
		expect(cull.pickRest(picture('IMG_10'), [picture('IMG_9')])).toBeNull()
		await flushPromises()

		expect(NAMES.map((name) => cull.decisionOf(picture(name)))).toEqual(before)
		expect(cull.tags.tagsOf(picture('IMG_10'))).toEqual([])
		expect([flags.saves, writes, tagWrites]).toEqual([[], [], []])
	})
})

describe('useCull: a failed write is taken back', () => {
	// spec: XMP-008.15, XMP-008.16
	it.each<[SidecarFailureReason]>([['locked'], ['notPermitted'], ['changed'], ['failed'], ['not-xmp'], ['noSpace']])('gives back the earlier rating of the picture whose sidecar answers %s, and keeps the others', async (reason) => {
		const failing: Record<string, SidecarFailureReason> = {}
		const { cull, picture, open } = cullWith({ failing })
		await open(SET, ENTRIES)
		await flushPromises()
		cull.decide({ kind: 'rating', rating: 1 }, [picture('IMG_10')])
		await flushPromises()
		failing.IMG_10 = reason

		cull.decide({ kind: 'rating', rating: 3 }, NAMES.map(picture))
		expect(cull.decisionOf(picture('IMG_10')).rating).toBe(3)
		await flushPromises()

		expect(NAMES.map((name) => cull.decisionOf(picture(name)).rating)).toEqual([3, 1, 3])
	})

	// spec: XMP-008.17
	it('gives both pictures back their earlier flag when the flag save fails, and says how many', async () => {
		const { cull, flags, picture, open, notSaved } = cullWith({ stored: [stored(1, 'rejected')] })
		await open(SET, ENTRIES)
		await flushPromises()
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		flags.api.save = async () => {
			throw new Error('500')
		}

		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_2'), picture('IMG_9')])
		expect(cull.decisionOf(picture('IMG_2')).flag).toBe('picked')
		await flushPromises()

		expect([cull.decisionOf(picture('IMG_2')).flag, cull.decisionOf(picture('IMG_9')).flag]).toEqual(['rejected', 'unflagged'])
		expect(notSaved).toEqual([2])
		expect(error).toHaveBeenCalledWith('Could not save the flags; they are taken back', expect.anything())
		error.mockRestore()
	})

	// spec: XMP-008.17
	it('gives back the decided flag when the save of its undo fails', async () => {
		const { cull, flags, picture, open, notSaved } = cullWith()
		await open(SET, ENTRIES)
		await flushPromises()
		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_9')])
		await flushPromises()
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		flags.api.save = async () => {
			throw new Error('500')
		}

		cull.undo()
		expect(cull.decisionOf(picture('IMG_9')).flag).toBe('unflagged')
		await flushPromises()

		expect(cull.decisionOf(picture('IMG_9')).flag).toBe('picked')
		expect(notSaved).toEqual([1])
		error.mockRestore()
	})

	// spec: XMP-008.17
	it('saves the flag of a picture whose sidecar is locked', async () => {
		const { cull, flags, picture, open, notSaved } = cullWith({ failing: { IMG_10: 'locked' } })
		await open(SET, ENTRIES)
		await flushPromises()

		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_10')])
		await flushPromises()

		expect(flags.saves.map((items) => items.map(({ fileId }) => fileId).sort())).toEqual([[2, 3]])
		expect(cull.decisionOf(picture('IMG_10')).flag).toBe('picked')
		expect(notSaved).toEqual([])
	})

	// spec: XMP-008.17
	it('takes back only the picture whose id the server skips', async () => {
		const { cull, flags, picture, open, notSaved } = cullWith()
		await open(SET, ENTRIES)
		await flushPromises()
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
		flags.api.save = async (items) => ({ saved: items.map(({ fileId }) => fileId).filter((fileId) => fileId !== 4), skipped: [{ fileId: 4, reason: 'notPermitted' }] })

		cull.decide({ kind: 'flag', flag: 'rejected' }, [picture('IMG_2'), picture('IMG_9')])
		await flushPromises()

		expect([cull.decisionOf(picture('IMG_2')).flag, cull.decisionOf(picture('IMG_9')).flag]).toEqual(['rejected', 'unflagged'])
		expect(notSaved).toEqual([1])
		expect(warn).toHaveBeenCalledOnce()
		warn.mockRestore()
	})
})

describe('useCull: Clear picks/rejects', () => {
	// spec: GRID-001.22
	it('resets the rateable flagged or kept pictures as one undo step, saves their rows and writes no sidecar', async () => {
		const { cull, writes, flags, picture, open } = cullWith({ stored: [stored(1, 'picked'), { ...stored(2, 'rejected'), keepRaw: true }, { ...stored(3, 'rejected'), keepRaw: true }, stored(4, 'picked')] })
		await open(SET, ENTRIES, access({ '/Trip/B': NO_CREATE }))
		await flushPromises()
		expect(cull.clearable.value).toBe(2)

		expect(cull.clearFlags()?.names.toSorted()).toEqual(['IMG_10', 'IMG_9'])
		await flushPromises()

		expect(NAMES.map((name) => [cull.decisionOf(picture(name)).flag, cull.decisionOf(picture(name)).keepRaw])).toEqual([['picked', false], ['unflagged', false], ['unflagged', false]])
		expect(cull.clearable.value).toBe(0)
		expect(flags.saves.map((items) => items.toSorted((a, b) => a.fileId - b.fileId))).toMatchObject([[2, 3, 4].map((fileId) => ({ fileId, flag: 'unflagged', keepRaw: false }))])
		expect(writes).toEqual([])
		cull.undo()
		expect(cull.decisionOf(picture('IMG_10'))).toMatchObject({ flag: 'rejected', keepRaw: true })
		expect(cull.decisionOf(picture('IMG_9'))).toMatchObject({ flag: 'picked', keepRaw: false })
	})
})
