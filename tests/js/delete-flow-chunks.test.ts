// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { TrashResponseFile } from '../../src/logic/trash-report.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { allTrashed, flow, OTHER, PAIR, SINGLE } from './delete-fixtures.ts'

const ONE_PICTURE = { pictures: 1, files: 500 }

afterEach(() => vi.restoreAllMocks())

describe('useDeleteFlow: requests in chunks', () => {
	// spec: DELETE-002.13
	it('sends whole pictures a chunk per request and shows how many photos were sent', async () => {
		const pending: (() => void)[] = []
		const { deleting, pictures, sent, toasts } = flow((request) => new Promise<TrashResponseFile[][]>((resolve) => {
			pending.push(() => void allTrashed(request).then(resolve))
		}), ONE_PICTURE)

		deleting.summarise([PAIR!, SINGLE!])
		const done = deleting.confirm()
		expect(deleting.progress.value).toEqual({ done: 0, total: 2 })
		await flushPromises()
		pending.shift()!()
		await flushPromises()
		expect(deleting.progress.value).toEqual({ done: 1, total: 2 })
		pending.shift()!()
		await done

		expect(sent).toEqual([[[{ fileId: 2, etag: 'etag-2' }, { fileId: 1, etag: 'etag-1' }]], [[{ fileId: 4, etag: 'etag-4' }]]])
		expect(pictures.value).toEqual([OTHER])
		expect(deleting.progress.value).toBeNull()
		expect(toasts).toEqual(['Moved 2 photos · 3 files · 4 kB freed to the Nextcloud trash bin'])
	})

	// spec: DELETE-002.14
	it('keeps what the first chunk trashed, leaves the rest whole and reports it when a later request fails', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const answers = [allTrashed, () => Promise.reject(new Error('Gateway Timeout'))]
		const { deleting, pictures, sent, toasts } = flow((request) => answers.shift()!(request), ONE_PICTURE)

		deleting.summarise([PAIR!, SINGLE!, OTHER!])
		await deleting.confirm()

		expect(sent).toHaveLength(2)
		expect(pictures.value).toEqual([SINGLE, OTHER])
		const dialog = deleting.dialog.value
		expect(dialog?.kind === 'report' && dialog.report.failed.map(({ file, result }) => [file.entry.fileId, result])).toEqual([[4, 'failed'], [5, 'failed']])
		expect(toasts).toEqual(['Moved 2 files to trash · 2 failed'])
		expect(error).toHaveBeenCalledWith('Stopped the delete after a failed request', expect.objectContaining({ error: expect.any(Error) }))
		expect(deleting.progress.value).toBeNull()
	})
})
