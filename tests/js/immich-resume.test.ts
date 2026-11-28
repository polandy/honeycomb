// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ImmichPositionSave } from '../../src/logic/immich-position.ts'
import type { ToastAction } from '../../src/shared/toast.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useImmichResume } from '../../src/immich/immich-resume.ts'
import { logger } from '../../src/shared/logger.ts'
import { COUNTS, cullOn, page } from './immich-cull-fixtures.ts'
import { NOW } from './logic/immich-fixtures.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

const CONNECTIONS = [{ id: 'andy-phone', label: 'Andy’s phone', url: 'https://immich.example.org', picksAsFavorites: false }]
const stored = (assetId: string, connectionId = 'andy-phone') => ({ immich: connectionId, assetId, takenAt: NOW - 60, decided: 1, total: 1000, updatedAt: NOW - 3600 })

/** The resume of an Immich cull over a fake server that answers `positions`; saves settle as `save` says. */
function resumeOn(positions: () => Promise<unknown>, save: () => Promise<void> = async () => undefined) {
	const on = cullOn()
	const saved: ImmichPositionSave[] = []
	const toasts: { message: string, action: ToastAction, closed: boolean }[] = []
	const resume = useImmichResume({
		api: { loadPositions: positions, savePosition: (position) => {
			saved.push(position)
			return save()
		} },
		cull: on.cull,
		toast: (message, action) => {
			const toast = { message, action, closed: false }
			toasts.push(toast)
			return () => (toast.closed = true)
		},
		connections: () => CONNECTIONS,
		now: () => NOW,
	})
	return { ...on, resume, saved, toasts }
}

describe('useImmichResume', () => {
	// spec: IMMICH-003.14
	it('saves the loupe\'s asset with the counts as the connection\'s position, once per change', async () => {
		const { cull, assets, counts, resume, saved } = resumeOn(async () => [])
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1', 'a2']))
		counts[0]!.answer({ ...COUNTS, decided: 4 })
		await flushPromises()

		resume.track(1)
		await nextTick()
		resume.track(1)
		await nextTick()

		expect(saved).toEqual([{ connectionId: 'andy-phone', assetId: 'a2', takenAt: NOW, decided: 4, total: 1000 }])
		expect(resume.recent.value).toEqual([{ connectionId: 'andy-phone', label: 'Andy’s phone', decided: 4, total: 1000 }])
	})

	// spec: IMMICH-003.14
	it('saves nothing before the counts arrive, and the position once they do', async () => {
		const { cull, assets, counts, resume, saved } = resumeOn(async () => [])
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1']))
		await flushPromises()

		resume.track(0)
		await nextTick()
		expect(saved).toEqual([])
		counts[0]!.answer(COUNTS)
		await flushPromises()

		expect(saved.map(({ assetId }) => assetId)).toEqual(['a1'])
	})

	// spec: IMMICH-003.14
	it('logs a failed save and keeps the list', async () => {
		vi.spyOn(logger, 'error').mockReturnValue()
		const { cull, assets, counts, resume } = resumeOn(async () => [], async () => {
			throw new Error('offline')
		})
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1']))
		counts[0]!.answer(COUNTS)
		await flushPromises()

		resume.track(0)
		await flushPromises()

		expect(logger.error).toHaveBeenCalledWith('Could not save the Immich position.', expect.anything())
		expect(resume.recent.value).toEqual([])
	})

	// spec: IMMICH-003.14
	it('offers the stored position of the opened connection, and Resume opens the loupe at its asset from the listing\'s from', async () => {
		const { cull, assets, resume, toasts } = resumeOn(async () => [stored('a6', 'andy-camera'), stored('a6')])
		cull.open('andy-phone')
		resume.offer('andy-phone')
		await flushPromises()

		expect(toasts.map(({ message, action }) => [message, action.label])).toEqual([['Continue where you left off', 'Resume']])
		toasts[0]!.action.run()
		expect(assets.at(-1)!.request).toMatchObject({ cursor: null, from: { assetId: 'a6', takenAt: NOW - 60 } })
		expect(resume.takeLoupeAt()).toBeNull()
		assets.at(-1)!.answer({ ...page(['a6', 'a7']), previousCursor: 'p5' })
		await flushPromises()

		expect(resume.takeLoupeAt()).toBe(0)
		expect(resume.takeLoupeAt()).toBeNull()
	})

	// spec: IMMICH-003.14
	it('opens the loupe at the asset among same-second neighbours, and at the first entry when the asset is gone', async () => {
		const { cull, assets, resume, toasts } = resumeOn(async () => [stored('a6')])
		cull.open('andy-phone')
		resume.offer('andy-phone')
		await flushPromises()
		toasts[0]!.action.run()
		assets.at(-1)!.answer({ ...page(['a5', 'a6']), previousCursor: 'p4' })
		await flushPromises()
		expect(resume.takeLoupeAt()).toBe(1)

		toasts[0]!.action.run()
		assets.at(-1)!.answer({ ...page(['a7']), previousCursor: 'p6' })
		await flushPromises()
		expect(resume.takeLoupeAt()).toBe(0)
	})

	// spec: IMMICH-003.14
	it('offers nothing without a position of the connection, once the user moved on, or for a connection opened meanwhile', async () => {
		const answers: ((positions: unknown) => void)[] = []
		const { cull, assets, counts, resume, toasts } = resumeOn(() => new Promise((resolve) => answers.push(resolve)))
		cull.open('andy-phone')
		resume.offer('andy-phone')
		answers[0]!([stored('a6', 'andy-camera')])
		await flushPromises()
		expect(toasts).toEqual([])

		resume.offer('andy-phone')
		assets[0]!.answer(page(['a1']))
		counts[0]!.answer(COUNTS)
		await flushPromises()
		resume.track(0)
		answers[1]!([stored('a6')])
		await flushPromises()
		expect(toasts).toEqual([])

		resume.offer('andy-phone')
		resume.offer('andy-camera')
		answers[2]!([stored('a6')])
		answers[3]!([])
		await flushPromises()
		expect(toasts).toEqual([])
	})

	// spec: IMMICH-003.14
	it('closes the offer once the loupe shows an asset', async () => {
		const { cull, assets, counts, resume, toasts } = resumeOn(async () => [stored('a6')])
		cull.open('andy-phone')
		resume.offer('andy-phone')
		assets[0]!.answer(page(['a1']))
		counts[0]!.answer(COUNTS)
		await flushPromises()
		expect(toasts[0]!.closed).toBe(false)

		resume.track(0)

		expect(toasts[0]!.closed).toBe(true)
	})

	// spec: IMMICH-003.15
	it('lists the stored positions under Recent on refresh, and logs a failed read', async () => {
		vi.spyOn(logger, 'error').mockReturnValue()
		let read: () => Promise<unknown> = async () => [stored('a6')]
		const { resume } = resumeOn(() => read())

		resume.refresh()
		await flushPromises()
		expect(resume.recent.value).toEqual([{ connectionId: 'andy-phone', label: 'Andy’s phone', decided: 1, total: 1000 }])

		read = async () => {
			throw new Error('offline')
		}
		resume.refresh()
		await flushPromises()
		expect(resume.recent.value).toHaveLength(1)
		expect(logger.error).toHaveBeenCalledWith('Could not read the Immich positions.', expect.anything())
	})
})
