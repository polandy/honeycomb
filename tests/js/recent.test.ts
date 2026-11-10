// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSet } from '../../src/logic/folder-set.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { logger } from '../../src/logger.ts'
import { DEFAULT_PAIRING_SETTINGS } from '../../src/logic/pairing.ts'
import { useRecent } from '../../src/recent.ts'
import { listingEntry } from './logic/listing-entries.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

const TRIP: FolderSet = { paths: ['/Trip', '/Day'], subfolders: false }
const trip = { folderSet: TRIP, fileId: 2, decided: 1, total: 3, updatedAt: 5 }
const home = { folderSet: { paths: [''], subfolders: true }, fileId: 9, decided: 0, total: 4, updatedAt: 4 }
const LISTINGS: Record<string, ListingEntry[]> = {
	'/Trip': [listingEntry(1, '/Trip/A.JPG'), listingEntry(2, '/Trip/B.JPG')],
	'/Day': [listingEntry(3, '/Day/C.JPG')],
}

/** The recent folder sets over a fake server whose answers the test gives as functions. */
function recentOn(positions: () => Promise<unknown>, listEntries = async (path: string) => ({ entries: LISTINGS[path] ?? [], truncated: false, sharedFolders: path === '/Day' ? ['/Day'] : [] })) {
	const opened: unknown[][] = []
	const toasts: string[] = []
	const listed: string[] = []
	let resumed = 0
	const folderSet = ref<FolderSet | null>(null)
	const progress = ref({ decided: 0, total: 0 })
	const recent = useRecent({ loadPositions: positions }, (path, subfolders) => {
		listed.push(`${path}${subfolders ? ' +' : ''}`)
		return listEntries(path)
	}, {
		folderSet: () => folderSet.value,
		progress: () => progress.value,
		pairing: () => DEFAULT_PAIRING_SETTINGS,
		open: (...args) => opened.push(args),
		resumeOpen: () => resumed++,
	}, (message) => toasts.push(message))
	return { ...recent, opened, toasts, listed, folderSet, progress, resumed: () => resumed }
}

describe('useRecent', () => {
	// spec: DECISIONS-002.8
	it('lists the stored positions, the open folder set with the progress of its cull', async () => {
		const recent = recentOn(async () => [trip, home, { malformed: true }])
		recent.refresh()
		await flushPromises()
		recent.folderSet.value = { paths: ['/Day', '/Trip'], subfolders: false }
		recent.progress.value = { decided: 3, total: 3 }

		expect(recent.items.value.map(({ position, current, decided }) => [position.fileId, current, decided])).toEqual([[2, true, 3], [9, false, 0]])
	})

	// spec: DECISIONS-002.8, LISTING-003.13
	it('lists a recent folder set and opens it at its position', async () => {
		const recent = recentOn(async () => [trip])

		recent.open(trip)
		await flushPromises()

		expect(recent.listed).toEqual(['/Trip', '/Day'])
		expect(recent.opened).toEqual([[TRIP, [...LISTINGS['/Trip']!, ...LISTINGS['/Day']!], ['/Day'], 2]])
	})

	// spec: DECISIONS-002.8
	it('resumes the open cull instead of listing it again', async () => {
		const recent = recentOn(async () => [trip])
		recent.folderSet.value = { paths: ['/Day', '/Trip'], subfolders: false }

		recent.open(trip)
		await flushPromises()

		expect(recent.resumed()).toBe(1)
		expect(recent.listed).toEqual([])
	})

	it('opens only the folder set chosen last', async () => {
		const answers: (() => void)[] = []
		const recent = recentOn(async () => [], (path) => new Promise((resolve) => answers.push(() => resolve({ entries: LISTINGS[path] ?? [], truncated: false, sharedFolders: [] }))))

		recent.open(trip)
		recent.open(home)
		answers.forEach((answer) => answer())
		await flushPromises()

		expect(recent.opened.map((args) => args[3])).toEqual([9])
	})

	it('reports a folder set that cannot be listed and keeps the cull', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const recent = recentOn(async () => [], async () => {
			throw new Error('offline')
		})

		recent.open(trip)
		await flushPromises()

		expect(recent.opened).toEqual([])
		expect(recent.toasts).toEqual(['Could not open 2 folders.'])
		expect(error).toHaveBeenCalledWith('Could not list the recent folder set', expect.objectContaining({ folderSet: TRIP }))
	})

	it('keeps the list it has when the positions cannot be read, and takes the latest answer', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const answers: ((value: unknown) => void)[] = []
		let fail = false
		const recent = recentOn(() => (fail ? Promise.reject(new Error('offline')) : new Promise((resolve) => answers.push(resolve))))
		recent.refresh()
		recent.refresh()
		answers[1]!([trip])
		answers[0]!([home])
		await flushPromises()
		expect(recent.items.value.map((item) => item.position.fileId)).toEqual([2])

		fail = true
		recent.refresh()
		await flushPromises()

		expect(recent.items.value.map((item) => item.position.fileId)).toEqual([2])
		expect(error).toHaveBeenCalledWith('Could not read the recent folder sets', expect.anything())
	})
})
