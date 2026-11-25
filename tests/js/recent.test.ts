// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListEntries } from '../../src/folders/folder-count.ts'
import type { FolderSet } from '../../src/logic/folder-set.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { ResumePosition } from '../../src/logic/resume-position.ts'
import type { ToastAction } from '../../src/shared/toast.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { RequestTimeoutError } from '../../src/api/index.ts'
import { useRecent } from '../../src/folders/recent.ts'
import { DEFAULT_PAIRING_SETTINGS } from '../../src/logic/pairing.ts'
import { logger } from '../../src/shared/logger.ts'
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
function recentOn(positions: () => Promise<unknown>, listEntries: ListEntries = async (path: string) => ({ entries: LISTINGS[path] ?? [], truncated: false, folders: [{ path: '/Day', permissions: path === '/Day' ? 1 : 31 }] })) {
	const opened: unknown[][] = []
	const toasts: string[] = []
	const actions: (ToastAction | null | undefined)[] = []
	const listed: string[] = []
	let resumed = 0
	const folderSet = ref<FolderSet | null>(null)
	const progress = ref({ decided: 0, total: 0 })
	const recent = useRecent({ loadPositions: positions, savePosition: async () => undefined }, (path, subfolders, excluded = []) => {
		listed.push(`${path}${subfolders ? ' +' : ''}${excluded.map((each) => ` -${each}`).join('')}`)
		return listEntries(path, subfolders, excluded)
	}, {
		folderSet: () => folderSet.value,
		progress: () => progress.value,
		pairing: () => DEFAULT_PAIRING_SETTINGS,
	}, (message, action) => {
		toasts.push(message)
		actions.push(action)
	})
	const opener = { open: (...args: unknown[]) => opened.push(args), resumeAt: (fileId: number) => opened.at(-1)!.push(fileId), resumeOpen: () => resumed++ }
	return { ...recent, open: (position: ResumePosition) => recent.open(position, opener), openSet: (set: FolderSet) => recent.openSet(set, opener.open), opened, toasts, actions, listed, folderSet, progress, resumed: () => resumed }
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

		await recent.open(trip)
		await flushPromises()

		expect(recent.listed).toEqual(['/Trip', '/Day'])
		expect(recent.opened).toEqual([[TRIP, [...LISTINGS['/Trip']!, ...LISTINGS['/Day']!], { folders: [{ path: '/Day', permissions: 31 }] }, 2]])
	})

	it('lists a folder set and opens it without a position; the open one stays', async () => {
		const recent = recentOn(async () => [])

		await recent.openSet({ paths: ['/Day'], subfolders: false })
		recent.folderSet.value = { paths: ['/Day'], subfolders: false }
		await recent.openSet({ paths: ['/Day'], subfolders: false })

		expect(recent.listed).toEqual(['/Day'])
		expect(recent.opened).toEqual([[{ paths: ['/Day'], subfolders: false }, LISTINGS['/Day'], { folders: [{ path: '/Day', permissions: 1 }] }]])
		expect(recent.resumed()).toBe(0)
	})

	// spec: DECISIONS-002.16
	it('lists a recent folder set without its excluded folders', async () => {
		const recent = recentOn(async () => [])

		await recent.open({ ...trip, folderSet: { paths: ['/Trip', '/Trip/Raw/Best'], subfolders: true, excluded: ['/Trip/Raw'] } })
		await flushPromises()

		expect(recent.listed).toEqual(['/Trip + -/Trip/Raw', '/Trip/Raw/Best +'])
	})

	// spec: DECISIONS-002.8
	it('resumes the open cull instead of listing it again', async () => {
		const recent = recentOn(async () => [trip])
		recent.folderSet.value = { paths: ['/Day', '/Trip'], subfolders: false }

		await recent.open(trip)
		await flushPromises()

		expect(recent.resumed()).toBe(1)
		expect(recent.listed).toEqual([])
	})

	it('opens only the folder set chosen last', async () => {
		const answers: (() => void)[] = []
		const recent = recentOn(async () => [], (path) => new Promise((resolve) => answers.push(() => resolve({ entries: LISTINGS[path] ?? [], truncated: false, folders: [] }))))

		void recent.open(trip)
		void recent.open(home)
		answers.forEach((answer) => answer())
		await flushPromises()

		expect(recent.opened.map((args) => args[3])).toEqual([9])
	})

	// spec: GRID-001.13
	it('says it is listing until the folder set chosen last opened', async () => {
		const answers: (() => void)[] = []
		const recent = recentOn(async () => [], (path) => new Promise((resolve) => answers.push(() => resolve({ entries: LISTINGS[path] ?? [], truncated: false, folders: [] }))))
		expect(recent.listing.value).toBe(false)

		void recent.open(trip)
		void recent.open(home)
		answers[0]!()
		answers[1]!()
		await flushPromises()
		expect(recent.listing.value).toBe(true)

		answers[2]!()
		await flushPromises()
		expect(recent.listing.value).toBe(false)
	})

	// spec: GRID-001.13
	it('stops listing when the folder set cannot be listed', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => {})
		const recent = recentOn(async () => [], async () => {
			throw new Error('offline')
		})

		await recent.open(trip)
		await flushPromises()

		expect(recent.listing.value).toBe(false)
	})

	it('reports a folder set that cannot be listed and keeps the cull', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const recent = recentOn(async () => [], async () => {
			throw new Error('offline')
		})

		await recent.open(trip)
		await flushPromises()

		expect(recent.opened).toEqual([])
		expect(recent.toasts).toEqual(['Could not open 2 folders.'])
		expect(error).toHaveBeenCalledWith('Could not list the recent folder set', { error: expect.anything() })
	})

	// spec: SETTINGS-001.36
	it('reports a recent folder set the server refuses as outside the library roots', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => {})
		const recent = recentOn(async () => [], async () => {
			throw new Error('bad-path')
		})

		await recent.open(trip)
		await flushPromises()

		expect(recent.opened).toEqual([])
		expect(recent.toasts).toEqual(['Could not open 2 folders.'])
	})

	// spec: DECISIONS-002.19
	it('says the server did not answer in time and lists the folder set again on Try again', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => {})
		let fail = true
		const recent = recentOn(async () => [], async (path: string) => {
			if (fail) {
				throw new RequestTimeoutError(30_000)
			}
			return { entries: LISTINGS[path] ?? [], truncated: false, folders: [] }
		})

		await recent.open(trip)
		await flushPromises()
		expect(recent.toasts).toEqual(['Could not open 2 folders: the server did not answer within 30 s.'])
		expect(recent.actions[0]?.label).toBe('Try again')

		fail = false
		recent.actions[0]!.run()
		await flushPromises()
		expect(recent.opened).toHaveLength(1)
		expect(recent.opened[0]!.at(-1)).toBe(2)
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

	// spec: DECISIONS-002.8
	it('lists a position the cull saved first, without reading the positions again', async () => {
		let reads = 0
		const recent = recentOn(async () => {
			reads++
			return [home]
		})
		recent.refresh()
		await flushPromises()

		await recent.positions.savePosition(trip, 0)

		expect(recent.items.value.map((item) => item.position.fileId)).toEqual([2, 9])
		expect(reads).toBe(1)
	})
})
