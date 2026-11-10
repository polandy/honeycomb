// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSet } from '../../src/logic/folder-set.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { ResumePosition } from '../../src/logic/resume-position.ts'
import type { ToastAction } from '../../src/toast.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { useResume } from '../../src/resume.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

const SET: FolderSet = { paths: ['/Trip'], subfolders: false }
const first = pictureOf(listingEntry(1, '/Trip/A.JPG'))
const second = pictureOf(listingEntry(2, '/Trip/B.NEF'), listingEntry(3, '/Trip/B.JPG'))
const third = pictureOf(listingEntry(4, '/Trip/C.JPG'))
const stored = (fileId: number, folderSet = SET) => ({ folderSet, fileId, decided: 1, total: 3, updatedAt: 5 })

/** A save the test settles by hand. */
function pending() {
	let settle = (_failed: boolean) => {}
	const promise = new Promise<void>((resolve, reject) => {
		settle = (failed) => (failed ? reject(new Error('offline')) : resolve())
	})
	return { promise, settle }
}

/** The resume flow over a fake server that answers `positions`; saves settle as `save` says. */
function resumeOn(positions: () => Promise<unknown>, save: () => Promise<void> = async () => undefined) {
	const saved: ResumePosition[] = []
	const toasts: { message: string, action: ToastAction | null }[] = []
	const opened: number[] = []
	const folderSet = ref<FolderSet | null>(SET)
	const pictures = shallowRef<Picture<ListingEntry>[]>([first, second, third])
	const view = shallowRef<Picture<ListingEntry>[]>([first, second, third])
	const progress = ref({ decided: 0, total: 3 })
	const shown = shallowRef<Picture<ListingEntry> | null>(null)
	const resume = useResume({
		loadPositions: positions,
		savePosition: (position) => {
			saved.push(position)
			return save()
		},
	}, {
		folderSet: () => folderSet.value,
		pictures: () => pictures.value,
		view: () => view.value,
		progress: () => progress.value,
		decisionOf: () => UNDECIDED,
		shown: () => shown.value,
		openLoupe: (index) => opened.push(index),
	}, (message, action) => toasts.push({ message, action }))
	return { ...resume, saved, toasts, opened, folderSet, pictures, view, progress, shown }
}

describe('useResume', () => {
	// spec: DECISIONS-002.7
	it('offers to continue at the stored picture of the folder set and opens the loupe there', async () => {
		const flow = resumeOn(async () => [stored(9, { paths: ['/Other'], subfolders: false }), stored(3)])

		flow.offer()
		await flushPromises()

		expect(flow.toasts.map((toast) => [toast.message, toast.action?.label])).toEqual([['Continue where you left off', 'Resume']])
		expect(flow.resumeName.value).toBe('B')
		flow.toasts[0]!.action!.run()
		expect(flow.opened).toEqual([1])
	})

	// spec: DECISIONS-002.7
	it('saves the shown picture with the progress, and again when the progress changes', async () => {
		const flow = resumeOn(async () => [])
		flow.offer()
		await flushPromises()

		flow.shown.value = second
		await flushPromises()
		flow.shown.value = null
		flow.progress.value = { decided: 1, total: 3 }
		await flushPromises()

		expect(flow.saved).toEqual([
			{ folderSet: SET, fileId: 3, decided: 0, total: 3 },
			{ folderSet: SET, fileId: 3, decided: 1, total: 3 },
		])
		expect(flow.resumeName.value).toBe('B')
	})

	// spec: DECISIONS-002.10
	it('offers nothing for a folder set without a position or a picture no longer in it', async () => {
		for (const answer of [[], [stored(9)], { positions: [] }]) {
			const flow = resumeOn(async () => answer)
			flow.offer()
			await flushPromises()

			expect(flow.toasts).toEqual([])
			expect(flow.resumeName.value).toBeNull()
			flow.resume()
			expect(flow.opened).toEqual([])
		}
	})

	// spec: DECISIONS-002.10
	it('saves nothing before a picture of the open cull was shown', async () => {
		const flow = resumeOn(async () => [stored(3)])
		flow.offer()
		flow.progress.value = { decided: 2, total: 3 }
		await flushPromises()

		expect(flow.saved).toEqual([])
	})

	it('does not offer once the user has moved on, nor for a folder set opened since', async () => {
		let answer = (_positions: unknown) => {}
		const flow = resumeOn(() => new Promise((resolve) => (answer = resolve)))
		flow.offer()
		flow.shown.value = third
		await nextTick()
		answer([stored(3)])
		await flushPromises()
		expect(flow.toasts).toEqual([])
		expect(flow.resumeName.value).toBe('C')

		flow.offer()
		const stale = answer
		flow.offer()
		stale([stored(3)])
		await flushPromises()
		expect(flow.toasts).toEqual([])
	})

	it('sends one save at a time, then only the latest of those that waited', async () => {
		const saves = [pending(), pending()]
		const flow = resumeOn(async () => [], () => saves.shift()?.promise ?? Promise.resolve())
		flow.offer()
		await flushPromises()

		flow.shown.value = first
		await nextTick()
		flow.shown.value = second
		await nextTick()
		flow.shown.value = third
		await nextTick()
		expect(flow.saved.map((position) => position.fileId)).toEqual([1])

		const [firstSave] = saves
		firstSave!.settle(false)
		await flushPromises()
		expect(flow.saved.map((position) => position.fileId)).toEqual([1, 4])
	})

	// spec: DECISIONS-002.11
	it('logs a failed read or save and goes on', async () => {
		const logged = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const flow = resumeOn(async () => {
			throw new Error('offline')
		}, async () => {
			throw new Error('offline')
		})
		flow.offer()
		await flushPromises()
		flow.shown.value = first
		await flushPromises()
		flow.shown.value = second
		await flushPromises()

		expect(flow.toasts).toEqual([])
		expect(flow.saved.map((position) => position.fileId)).toEqual([1, 3])
		expect(logged.mock.calls.map(([message]) => message)).toEqual(['Could not read the resume positions.', 'Could not save the resume position.', 'Could not save the resume position.'])
	})

	it('saves nothing without an open folder set', async () => {
		const flow = resumeOn(async () => [])
		flow.offer()
		flow.folderSet.value = null
		flow.shown.value = first
		await flushPromises()

		expect(flow.saved).toEqual([])
	})
})
