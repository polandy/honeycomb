// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderDoneApi } from '../../src/folder-done.ts'
import type { FolderDone } from '../../src/logic/folder-row.ts'
import type { ToastAction } from '../../src/toast.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { UNDO_MS, useFolderDone } from '../../src/folder-done.ts'
import { logger } from '../../src/logger.ts'
import { doneRow, row } from './logic/folder-fixtures.ts'

const TRIP = row({ fileId: 7, path: '/Photos/2019/Trip', photos: 412, undecided: 0, picked: 412, rejected: 0 })
const DONE: FolderDone = { by: 'andy', at: 1_800_000_000, photos: 412 }

/** The flow with a server that answers `api`, recording each shown status, toast and error toast. */
function flow(api: Partial<FolderDoneApi> = {}) {
	const calls: string[] = []
	const shown: [number, FolderDone | null][] = []
	const toasts: { message: string, action: ToastAction | null, duration: number | undefined }[] = []
	const errors: string[] = []
	const done = useFolderDone({
		markFolderDone: async (fileId, photos) => {
			calls.push(`PUT ${fileId} ${photos}`)
			return DONE
		},
		reopenFolder: async (fileId) => {
			calls.push(`DELETE ${fileId}`)
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

describe('useFolderDone', () => {
	// spec: FOLDERS-008.1
	it('marks the folder with its photos, shows the answer and says so with Undo for 8 s', async () => {
		const { done, calls, shown, toasts } = flow()

		await done.markDone(TRIP)

		expect(calls).toEqual(['PUT 7 412'])
		expect(shown).toEqual([[7, DONE]])
		expect(toasts).toEqual([{ message: 'Marked Trip done', action: { label: 'Undo', run: expect.any(Function) }, duration: UNDO_MS }])
		expect(UNDO_MS).toBe(8000)
		expect(done.changed.value).toEqual({ fileId: 7 })
	})

	// spec: FOLDERS-008.3
	it('reopens the folder by Undo, without a toast of its own, and asks for the row\'s focus again', async () => {
		const { done, calls, shown, toasts } = flow()
		await done.markDone(TRIP)
		const marked = done.changed.value

		toasts[0]!.action!.run()
		await flushPromises()

		expect(calls).toEqual(['PUT 7 412', 'DELETE 7'])
		expect(shown).toEqual([[7, DONE], [7, null]])
		expect(toasts).toHaveLength(1)
		expect(done.changed.value).toEqual({ fileId: 7 })
		expect(done.changed.value).not.toBe(marked)
	})

	// spec: FOLDERS-008.4
	it('reopens a done folder and says so without Undo', async () => {
		const { done, calls, shown, toasts } = flow()

		await done.reopen(doneRow({ fileId: 9, path: '/Photos/Old' }))

		expect(calls).toEqual(['DELETE 9'])
		expect(shown).toEqual([[9, null]])
		expect(toasts).toEqual([{ message: 'Reopened Old', action: null, duration: undefined }])
		expect(done.changed.value).toEqual({ fileId: 9 })
	})

	// spec: FOLDERS-008.6
	it('keeps the row and says a failed mark, reopen or Undo in an error toast, logging the server\'s text', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const refused = new Error('403 Forbidden: secret detail')
		const { done, shown, errors } = flow({
			markFolderDone: async () => {
				throw refused
			},
			reopenFolder: async () => {
				throw refused
			},
		})

		await done.markDone(TRIP)
		await done.reopen(doneRow({ fileId: 9, path: '/Photos/Old' }))

		expect(shown).toEqual([])
		expect(done.changed.value).toBeNull()
		expect(errors).toEqual(['Could not mark Trip done.', 'Could not reopen Old.'])
		expect(error).toHaveBeenCalledWith('Could not mark the folder done', { error: refused })
		expect(error).toHaveBeenCalledWith('Could not reopen the folder', { error: refused })
		error.mockRestore()
	})

	// spec: FOLDERS-008.6
	it('keeps the row done when Undo fails', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { done, shown, toasts, errors } = flow({
			reopenFolder: async () => {
				throw new Error('offline')
			},
		})
		await done.markDone(TRIP)

		toasts[0]!.action!.run()
		await flushPromises()

		expect(shown).toEqual([[7, DONE]])
		expect(errors).toEqual(['Could not reopen Trip.'])
		error.mockRestore()
	})
})
