// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FolderDoneApi } from '../../src/folders/folder-done.ts'
import type { FolderDone } from '../../src/logic/folder-row.ts'
import type { ToastAction } from '../../src/shared/toast.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { UNDO_MS, useFolderDone } from '../../src/folders/folder-done.ts'
import { buildHierarchy, findLevel } from '../../src/logic/folder-hierarchy.ts'
import { logger } from '../../src/shared/logger.ts'
import { doneRow, row } from './logic/folder-fixtures.ts'

const DONE: FolderDone = { by: 'andy', at: 1_800_000_000, photos: 1 }
const TREE = buildHierarchy(['/Photos'], [
	row({ fileId: 1, path: '/Photos/Iceland/Day 1', photos: 12 }),
	row({ fileId: 2, path: '/Photos/Iceland/Day 2', photos: 5 }),
	row({ fileId: 3, path: '/Photos/Iceland/Shared', permissions: 1 }),
	doneRow({ fileId: 4, path: '/Photos/Old/A' }, 400),
	doneRow({ fileId: 5, path: '/Photos/Old/B' }, 20),
])
const ICELAND = findLevel(TREE, '/Photos/Iceland')!
const OLD = findLevel(TREE, '/Photos/Old')!

/** The flow with a server that answers `api`, recording each call, shown status, toast and error toast. */
function flow(api: Partial<FolderDoneApi> = {}) {
	const calls: string[] = []
	const shown: [number, FolderDone | null][] = []
	const toasts: { message: string, action: ToastAction | null, duration: number | undefined }[] = []
	const errors: string[] = []
	const done = useFolderDone({
		markFolderDone: async () => DONE,
		reopenFolder: async () => undefined,
		markFoldersDone: async (folders) => {
			calls.push(`PUT ${folders.map((each) => `${each.fileId}:${each.photos}`).join(',')}`)
			return { done: folders.map((each) => ({ fileId: each.fileId, done: { ...DONE, photos: each.photos } })), skipped: [] }
		},
		reopenFolders: async (fileIds) => {
			calls.push(`DELETE ${fileIds.join(',')}`)
		},
		...api,
	}, {
		setDone: (fileId, status) => shown.push([fileId, status]),
		toast: (message, action = null, _offer, _details, duration) => {
			toasts.push({ message, action, duration })
			return () => undefined
		},
		toastError: (message) => errors.push(message),
	})
	return { done, calls, shown, toasts, errors }
}

describe('useFolderDone batches', () => {
	// spec: FOLDERS-009.11
	it('marks every rateable open folder in one call, names the skipped read-only ones and undoes it in one call', async () => {
		const { done, calls, shown, toasts } = flow()

		await done.markAllDone(ICELAND)

		expect(calls).toEqual(['PUT 1:12,2:5'])
		expect(shown).toEqual([[1, { ...DONE, photos: 12 }], [2, { ...DONE, photos: 5 }]])
		expect(toasts).toEqual([{ message: 'Marked 2 folders done · 1 read-only skipped', action: { label: 'Undo', run: expect.any(Function) }, duration: UNDO_MS }])

		toasts[0]!.action!.run()
		await flushPromises()

		expect(calls).toEqual(['PUT 1:12,2:5', 'DELETE 1,2'])
		expect(shown.slice(2)).toEqual([[1, null], [2, null]])
	})

	// spec: FOLDERS-009.11
	it('counts a folder the server skipped as read-only and leaves out one it skipped as done', async () => {
		const { done, toasts } = flow({
			markFoldersDone: async () => ({ done: [], skipped: [{ fileId: 1, reason: 'read-only' }, { fileId: 2, reason: 'done' }] }),
		})

		await done.markAllDone(ICELAND)

		expect(toasts[0]!.message).toBe('Marked 0 folders done · 2 read-only skipped')
	})

	// spec: FOLDERS-009.11
	it('names no skipped folder when none was read-only, and offers no Undo when the server marked none', async () => {
		const fresh = findLevel(buildHierarchy(['/Photos'], [row({ fileId: 9, path: '/Photos/Fresh/A', photos: 2 })]), '/Photos/Fresh')!
		const marking = flow()
		const refused = flow({ markFoldersDone: async () => ({ done: [], skipped: [{ fileId: 9, reason: 'done' }] }) })

		await marking.done.markAllDone(fresh)
		await refused.done.markAllDone(fresh)

		expect(marking.toasts[0]!.message).toBe('Marked 1 folder done')
		expect(refused.toasts).toEqual([{ message: 'Marked 0 folders done', action: null, duration: UNDO_MS }])
	})

	// spec: FOLDERS-009.12
	it('sends nothing and says so when nothing is left to mark', async () => {
		const { done, calls, toasts } = flow()

		await done.markAllDone(OLD)

		expect(calls).toEqual([])
		expect(toasts).toEqual([{ message: 'No folder left to mark done', action: null, duration: undefined }])
	})

	// spec: FOLDERS-009.13, FOLDERS-008.11
	it('reopens every done folder in one call and Undo marks them again with their earlier photos', async () => {
		const { done, calls, shown, toasts } = flow()

		await done.reopenAll(OLD)

		expect(calls).toEqual(['DELETE 4,5'])
		expect(shown).toEqual([[4, null], [5, null]])
		expect(toasts).toEqual([{ message: 'Reopened 2 folders', action: { label: 'Undo', run: expect.any(Function) }, duration: UNDO_MS }])

		toasts[0]!.action!.run()
		await flushPromises()

		expect(calls).toEqual(['DELETE 4,5', 'PUT 4:400,5:20'])
		expect(shown.slice(2)).toEqual([[4, { ...DONE, photos: 400 }], [5, { ...DONE, photos: 20 }]])
	})

	it('sends nothing for Reopen all without a done folder', async () => {
		const { done, calls, toasts } = flow()

		await done.reopenAll(ICELAND)

		expect([calls, toasts]).toEqual([[], []])
	})

	// spec: FOLDERS-009.18
	it('keeps the rows and says a refused batch in an error toast, logging the server\'s text', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const refused = new Error('403 Forbidden: secret detail')
		const { done, shown, toasts, errors } = flow({
			markFoldersDone: async () => {
				throw refused
			},
			reopenFolders: async () => {
				throw refused
			},
		})

		await done.markAllDone(ICELAND)
		await done.reopenAll(OLD)

		expect([shown, toasts]).toEqual([[], []])
		expect(errors).toEqual(['Could not mark the folders done.', 'Could not reopen the folders.'])
		expect(error).toHaveBeenCalledWith('Could not mark the folders done', { error: refused })
		expect(error).toHaveBeenCalledWith('Could not reopen the folders', { error: refused })
		error.mockRestore()
	})

	// spec: FOLDERS-008.12
	it('keeps the rows when the Undo of a batch fails', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const offline = async () => {
			throw new Error('offline')
		}
		const marking = flow({ reopenFolders: offline })
		const reopening = flow({ markFoldersDone: offline })
		await marking.done.markAllDone(ICELAND)
		await reopening.done.reopenAll(OLD)

		marking.toasts[0]!.action!.run()
		reopening.toasts[0]!.action!.run()
		await flushPromises()

		expect(marking.shown).toHaveLength(2)
		expect(reopening.shown).toHaveLength(2)
		expect(marking.errors).toEqual(['Could not reopen the folders.'])
		expect(reopening.errors).toEqual(['Could not mark the folders done.'])
		error.mockRestore()
	})
})
