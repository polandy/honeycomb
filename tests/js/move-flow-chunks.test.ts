// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Answer } from './move-fixtures.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { allMoved, moveFlow } from './move-fixtures.ts'

const ONE_PICTURE = { pictures: 1, files: 500 }
const timeout: Answer = () => Promise.reject(new Error('Gateway Timeout'))

/** A flow whose move endpoint answers each request with the next of `answers`. */
function chunkedFlow(...answers: Answer[]) {
	return moveFlow((request) => answers.shift()!(request), { chunks: ONE_PICTURE })
}

afterEach(() => vi.restoreAllMocks())

describe('useMoveFlow: requests in chunks', () => {
	// spec: MOVE-004.17
	it('sends whole pictures a chunk per request and shows how many photos were sent', async () => {
		let release = () => {}
		const { moving, pair, single, sunset, sent, pictures } = chunkedFlow(allMoved(), (request) => new Promise((resolve) => {
			release = () => void allMoved()(request).then(resolve)
		}))
		moving.open([pair, single])
		moving.choose('/Out')
		await flushPromises()

		const done = moving.confirm()
		await flushPromises()
		expect(moving.progress.value).toEqual({ done: 1, total: 2 })
		release()
		await done

		expect(sent.map((request) => request.map((files) => files.map(({ fileId }) => fileId)))).toEqual([[[2, 1]], [[4]]])
		expect(pictures.value).toEqual([sunset])
		expect(moving.progress.value).toBeNull()
	})

	// spec: MOVE-004.18
	it('keeps what the first chunk moved, leaves the rest whole, reports it and offers Undo when a later request fails', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { moving, pair, single, sunset, pictures, toasts } = chunkedFlow(allMoved(), timeout)
		moving.open([pair, single, sunset])
		moving.choose('/Out')
		await flushPromises()

		await moving.confirm()

		expect(pictures.value.map((picture) => picture.baseName)).toEqual(['IMG_2', 'sunset'])
		expect(pictures.value.every((picture) => picture.rendered !== null)).toBe(true)
		expect(moving.report.value!.failed.map(({ file, result }) => [file.entry.fileId, result])).toEqual([[4, 'failed'], [5, 'failed']])
		expect(toasts.at(-1)).toMatchObject({ message: 'Moved 2 files to Out · 2 failed', action: { label: 'Undo' } })
		expect(error).toHaveBeenCalledWith('Stopped the move after a failed request', expect.objectContaining({ error: expect.any(Error) }))
	})

	// spec: MOVE-004.18
	it('counts the files an undo could not send as failed', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { moving, pair, single, toasts } = chunkedFlow(allMoved(), allMoved(), allMoved(), timeout)
		moving.open([pair, single])
		moving.choose('/Out')
		await flushPromises()
		await moving.confirm()

		toasts.at(-1)!.action!.run()
		await flushPromises()

		expect(toasts.at(-1)!.message).toBe('Moved 2 files back · 1 failed')
	})
})
