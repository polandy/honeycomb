// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { MoveRequestFile } from '../../src/logic/move-plan.ts'
import type { MoveResponseFile } from '../../src/logic/move-report.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { Settings } from '../../src/logic/settings.ts'
import type { ToastAction } from '../../src/toast.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import { TrashBinOffError } from '../../src/api.ts'
import { logger } from '../../src/logger.ts'
import { DEFAULT_PAIRING_SETTINGS, pairPictures } from '../../src/logic/pairing.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { withoutFiles } from '../../src/logic/trash-report.ts'
import { useMoveFlow } from '../../src/move-flow.ts'
import { listingEntry } from './logic/listing-entries.ts'

const ENTRIES = [
	listingEntry(1, '/Trip/IMG_1.CR3', { size: 2048 }),
	listingEntry(2, '/Trip/IMG_1.JPG', { size: 1024 }),
	listingEntry(4, '/Trip/IMG_2.JPG', { size: 1024 }),
	listingEntry(5, '/Trip/sunset.JPG', { size: 1024 }),
]

type Answer = (request: MoveRequestFile[][]) => Promise<MoveResponseFile[][]>

/** Answers every file as moved to its requested path, with the same id unless `newId` says otherwise. */
const allMoved = (newId = (fileId: number) => fileId): Answer => async (request) => request.map((files) => files.map(({ fileId, path }) => ({ fileId, result: 'moved', replaced: false, path, newFileId: newId(fileId), etag: `moved-${fileId}` })))

/** A flow over the entries' pictures, the folder `/Out` holding `held`, with a move endpoint answering `answer`. */
function flow(answer: Answer = allMoved(), { held = [] as string[], template = '{name}.{ext}', probe = undefined as (() => Promise<never>) | undefined } = {}) {
	const entries = shallowRef<ListingEntry[]>(ENTRIES)
	const pictures = shallowRef<Picture<ListingEntry>[]>(pairPictures(ENTRIES, DEFAULT_PAIRING_SETTINGS))
	const settings = shallowRef<Settings>({ ...DEFAULT_SETTINGS, moveFavourites: ['/Fav'], moveRecent: ['/Old', '/Fav'] })
	const toasts: { message: string, action: ToastAction | null }[] = []
	const sent: MoveRequestFile[][][] = []
	const probed: string[][] = []
	const loupe = ref<{ pictures: readonly Picture<ListingEntry>[], index: number } | null>(null)
	const moving = useMoveFlow({
		view: () => pictures.value,
		settings: () => settings.value,
		updateSettings: (patch) => {
			settings.value = { ...settings.value, ...patch }
		},
		probe: probe ?? (async (folders) => {
			probed.push([...folders])
			return folders.map((path) => ({ path, children: path === '/Out' ? held.map((name, index) => ({ name, fileId: 90 + index, etag: 'held' })) : [] }))
		}),
		move: async (request) => {
			sent.push(request.map((files) => [...files]))
			return answer(request.map((files) => [...files]))
		},
		removeFiles: (fileIds) => {
			const { pictures: left, replaced } = withoutFiles(pictures.value, fileIds, DEFAULT_PAIRING_SETTINGS)
			pictures.value = left
			entries.value = entries.value.filter((entry) => !fileIds.has(entry.fileId))
			return replaced
		},
		restoreFiles: (restored) => {
			entries.value = [...entries.value, ...restored]
			pictures.value = pairPictures(entries.value, DEFAULT_PAIRING_SETTINGS)
		},
		loupe,
		toast: (message, action = null) => toasts.push({ message, action }),
		template: () => template,
		offset: () => 0,
	})
	const [pair, single, sunset] = pictures.value as [Picture<ListingEntry>, Picture<ListingEntry>, Picture<ListingEntry>]
	return { moving, pictures, entries, settings, toasts, sent, probed, loupe, pair, single, sunset }
}

afterEach(() => vi.restoreAllMocks())

describe('useMoveFlow: opening and targets', () => {
	// spec: MOVE-004.1
	it('opens on the pictures in view order, and not on none', () => {
		const { moving, pair, single } = flow()

		moving.open([])
		expect(moving.pictures.value).toBeNull()

		moving.open([single, pair])
		expect(moving.pictures.value).toEqual([pair, single])
		expect(moving.target.value).toBeNull()
	})

	// spec: MOVE-004.1
	it('opens on the loupe photo, else the chosen pictures, else the focused tile', () => {
		const { moving, loupe, pair, single, sunset } = flow()

		moving.openShown([], () => 1)
		expect(moving.pictures.value).toEqual([single])

		moving.openShown([sunset, pair], () => 1)
		expect(moving.pictures.value).toEqual([pair, sunset])

		loupe.value = { pictures: [sunset], index: 0 }
		moving.openShown([pair], () => 0)
		expect(moving.pictures.value).toEqual([sunset])
	})

	// spec: MOVE-004.3
	it('offers favourites, then recent targets, and chooses one by its key', async () => {
		const { moving, pair, probed } = flow()
		moving.open([pair])

		expect(moving.chips.value.map((chip) => [chip.path, chip.favourite])).toEqual([['/Fav', true], ['/Old', false]])

		moving.chooseKey(2)
		moving.chooseKey(7)
		await flushPromises()

		expect(moving.target.value).toBe('/Old')
		expect(probed).toEqual([['/Old']])
	})

	// spec: MOVE-004.4
	it('chooses a browsed folder and closes the picker', () => {
		const { moving, pair } = flow()
		moving.open([pair])
		moving.browsing.value = true

		moving.choose('/Picked')

		expect(moving.target.value).toBe('/Picked')
		expect(moving.browsing.value).toBe(false)
	})

	// spec: MOVE-004.5
	it('adds the target to the favourites and removes it again', () => {
		const { moving, pair, settings } = flow()
		moving.open([pair])
		moving.choose('/New')

		moving.toggleFavourite()
		expect(settings.value.moveFavourites).toEqual(['/Fav', '/New'])
		expect(moving.favourite.value).toBe(true)

		moving.toggleFavourite()
		expect(settings.value.moveFavourites).toEqual(['/Fav'])
	})
})

describe('useMoveFlow: the summary', () => {
	// spec: MOVE-004.6
	it('plans every file below the target once the folders are probed', async () => {
		const { moving, pair, single } = flow()
		moving.open([pair, single])
		moving.choose('/Out')
		expect(moving.plan.value).toBeNull()

		await flushPromises()

		expect(moving.plan.value!.flatMap((picture) => picture.files.map((file) => file.path))).toEqual(['/Out/IMG_1.JPG', '/Out/IMG_1.CR3', '/Out/IMG_2.JPG'])
		expect(moving.counts.value).toEqual({ files: 3, conflicts: 0 })
	})

	// spec: MOVE-004.7
	it('sets the choice of one conflict and of all', async () => {
		const { moving, pair, single } = flow(allMoved(), { held: ['IMG_1.JPG', 'IMG_2.JPG'] })
		moving.open([pair, single])
		moving.choose('/Out')
		await flushPromises()

		moving.setChoice(pair, 'skip')
		expect(moving.plan.value!.map((picture) => picture.sent)).toEqual([false, true])
		expect(moving.allChoice.value).toBeNull()

		moving.setAll('replace')
		expect(moving.plan.value!.map((picture) => picture.files[0]!.replace?.fileId)).toEqual([90, 91])
		expect(moving.allChoice.value).toBe('replace')
		expect(moving.counts.value).toEqual({ files: 3, conflicts: 2 })
	})

	// spec: MOVE-004.15
	it('leaves a picture it cannot name out of the plan', async () => {
		const { moving, pair, sunset } = flow(allMoved(), { template: '{number}.{ext}' })
		moving.open([pair, sunset])
		moving.choose('/Out')
		await flushPromises()

		expect(moving.named.value.map((named) => named.problem)).toEqual([null, 'no-number'])
		expect(moving.counts.value.files).toBe(2)
	})

	// spec: MOVE-004.6
	it('refuses an invalid template', () => {
		const { moving, pair } = flow(allMoved(), { template: '{nope}' })
		moving.open([pair])

		expect(() => moving.named.value).toThrow('{nope}')
	})

	// spec: MOVE-004.8
	it('does not move without a target or without files', async () => {
		const { moving, pair, sent } = flow(allMoved(), { held: ['IMG_1.JPG'] })
		moving.open([pair])
		await moving.confirm()
		moving.choose('/Out')
		await flushPromises()
		moving.setChoice(pair, 'skip')

		await moving.confirm()

		expect(sent).toEqual([])
	})
})

describe('useMoveFlow: moving and undo', () => {
	// spec: MOVE-004.9, MOVE-004.10
	it('sends the plan, takes the pictures out of the listing and the loupe, keeps the target and offers Undo', async () => {
		const { moving, pair, single, sunset, sent, pictures, loupe, settings, toasts } = flow()
		loupe.value = { pictures: [pair, sunset], index: 0 }
		moving.open([pair, single])
		moving.choose('/Out')
		await flushPromises()

		await moving.confirm()

		expect(sent).toEqual([[[{ fileId: 2, etag: 'etag-2', path: '/Out/IMG_1.JPG' }, { fileId: 1, etag: 'etag-1', path: '/Out/IMG_1.CR3' }], [{ fileId: 4, etag: 'etag-4', path: '/Out/IMG_2.JPG' }]]])
		expect(pictures.value).toEqual([sunset])
		expect(loupe.value).toEqual({ pictures: [sunset], index: 0 })
		expect(settings.value.moveRecent).toEqual(['/Out', '/Old', '/Fav'])
		expect(moving.pictures.value).toBeNull()
		expect(toasts.at(-1)).toMatchObject({ message: 'Moved 2 photos to Out', action: { label: 'Undo' } })
	})

	// spec: MOVE-004.11
	it('moves the files back on Undo and shows them again', async () => {
		const { moving, pair, sent, pictures, toasts } = flow()
		moving.open([pair])
		moving.choose('/Out')
		await flushPromises()
		await moving.confirm()

		toasts.at(-1)!.action!.run()
		await flushPromises()

		expect(sent[1]).toEqual([[{ fileId: 2, etag: 'moved-2', path: '/Trip/IMG_1.JPG' }, { fileId: 1, etag: 'moved-1', path: '/Trip/IMG_1.CR3' }]])
		expect(pictures.value.map((picture) => picture.baseName)).toContain('IMG_1')
		expect(toasts.at(-1)!.message).toBe('Moved 2 files back')
	})

	// spec: MOVE-004.11
	it('says so when the undo request fails', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		let calls = 0
		const { moving, pair, toasts } = flow(async (request) => (calls++ === 0 ? allMoved()(request) : Promise.reject(new Error('down'))))
		moving.open([pair])
		moving.choose('/Out')
		await flushPromises()
		await moving.confirm()

		toasts.at(-1)!.action!.run()
		await flushPromises()

		expect(toasts.at(-1)!.message).toBe('Could not move the photos; reload the folder to see what changed.')
	})

	// spec: MOVE-004.12
	it('reports the files that failed', async () => {
		const { moving, pair, single, pictures, toasts } = flow(async (request) => request.map((files) => files.map(({ fileId, path }) => (fileId === 4 ? { fileId, result: 'locked', replaced: false } : { fileId, result: 'moved', replaced: false, path, newFileId: fileId, etag: 'm' }))))
		moving.open([pair, single])
		moving.choose('/Out')
		await flushPromises()

		await moving.confirm()

		expect(pictures.value.map((picture) => picture.baseName)).toEqual(['IMG_2', 'sunset'])
		expect(moving.report.value!.failed).toEqual([expect.objectContaining({ result: 'locked' })])
		expect(toasts.at(-1)!.message).toBe('Moved 2 files to Out · 1 failed')

		moving.closeReport()
		expect(moving.report.value).toBeNull()
	})

	// spec: MOVE-004.12
	it('offers no Undo when nothing moved', async () => {
		const { moving, single, toasts, settings } = flow(async (request) => request.map((files) => files.map(({ fileId }) => ({ fileId, result: 'locked', replaced: false }))))
		moving.open([single])
		moving.choose('/Out')
		await flushPromises()

		await moving.confirm()

		expect(toasts.at(-1)!.action).toBeNull()
		expect(settings.value.moveRecent).toEqual(['/Old', '/Fav'])
	})

	// spec: MOVE-004.13
	it.each([
		[new TrashBinOffError('off'), 'The Nextcloud trash bin is off, so nothing was moved. honeycomb replaces files only into the trash bin.'],
		[new Error('down'), 'Could not move the photos; reload the folder to see what changed.'],
	])('changes nothing when the move request fails with %s', async (error, message) => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { moving, pair, pictures, toasts } = flow(async () => Promise.reject(error))
		moving.open([pair])
		moving.choose('/Out')
		await flushPromises()

		await moving.confirm()

		expect(pictures.value).toHaveLength(3)
		expect(moving.pictures.value).toBeNull()
		expect(toasts.at(-1)!.message).toBe(message)
	})

	// spec: MOVE-004.13
	it('closes the dialog when the probe fails', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { moving, pair, toasts } = flow(allMoved(), { probe: async () => Promise.reject(new Error('down')) })
		moving.open([pair])

		moving.choose('/Out')
		await flushPromises()

		expect(moving.pictures.value).toBeNull()
		expect(toasts.at(-1)!.message).toBe('Could not move the photos; reload the folder to see what changed.')
	})

	// spec: MOVE-004.14
	it('says decisions did not move when a file got a new file id', async () => {
		const { moving, single, toasts } = flow(allMoved((fileId) => fileId + 100))
		moving.open([single])
		moving.choose('/Out')
		await flushPromises()

		await moving.confirm()

		expect(toasts.at(-1)!.message).toBe('Moved IMG_2 to Out · decisions did not move with the files')
	})
})
