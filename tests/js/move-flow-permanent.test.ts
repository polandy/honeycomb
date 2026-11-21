// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Answer } from './move-fixtures.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { moveFlow } from './move-fixtures.ts'

/** Moves every file, except a replace not marked permanent, which the trash bin would not keep. */
const tooLarge: Answer = async (request) => request.map((files) => files.map(({ fileId, path, replace }) => (replace !== undefined && replace.permanent !== true
	? { fileId, result: 'tooLarge', replaced: false }
	: { fileId, result: 'moved', replaced: replace !== undefined, path, newFileId: fileId, etag: `moved-${fileId}` })))

/** The pair and the single photo moved to `/Out`, where the single one replaces `IMG_2.JPG`. */
async function confirmed() {
	const fixture = moveFlow(tooLarge, { held: ['IMG_2.JPG'] })
	fixture.moving.open([fixture.pair, fixture.single])
	fixture.moving.choose('/Out')
	await flushPromises()
	fixture.moving.setChoice(fixture.single, 'replace')
	await fixture.moving.confirm()
	return fixture
}

describe('useMoveFlow: replace for good', () => {
	// spec: MOVE-004.21
	it('warns about the replace the trash bin would not keep before the toast', async () => {
		const { moving, pictures, single, sunset, toasts } = await confirmed()

		expect(moving.warning.value!.map(({ replace, result }) => [replace.path, result])).toEqual([['/Out/IMG_2.JPG', 'tooLarge']])
		expect(moving.pictures.value).toBeNull()
		expect(pictures.value).toEqual([single, sunset])
		expect(toasts).toEqual([])
	})

	// spec: MOVE-004.22
	it('sends the photo again with its replace marked permanent and toasts both requests', async () => {
		const { moving, pictures, sunset, sent, toasts } = await confirmed()

		await moving.replacePermanently()

		expect(sent).toHaveLength(2)
		expect(sent[1]).toEqual([[{ fileId: 4, etag: 'etag-4', path: '/Out/IMG_2.JPG', replace: { fileId: 90, etag: 'held', permanent: true } }]])
		expect(pictures.value).toEqual([sunset])
		expect(moving.warning.value).toBeNull()
		expect(moving.report.value).toBeNull()
		expect(toasts).toEqual([{ message: 'Moved 2 photos to Out', action: expect.objectContaining({ label: 'Undo' }) }])

		toasts[0]!.action!.run()
		await flushPromises()
		expect(sent[2]!.flat().map(({ fileId }) => fileId)).toEqual([2, 1, 4])
	})

	// spec: MOVE-004.23
	it('keeps the photo on Cancel and reports it', async () => {
		const { moving, pictures, single, sunset, sent, toasts } = await confirmed()

		moving.cancelWarning()

		expect(sent).toHaveLength(1)
		expect(moving.warning.value).toBeNull()
		expect(pictures.value).toEqual([single, sunset])
		expect(moving.report.value!.failed).toEqual([expect.objectContaining({ result: 'tooLarge' })])
		expect(toasts.at(-1)!.message).toBe('Moved 2 files to Out · 1 failed')
	})

	// spec: MOVE-004.22
	it('does not send twice while the permanent replace runs', async () => {
		const { moving, sent } = await confirmed()

		const first = moving.replacePermanently()
		await moving.replacePermanently()
		await first

		expect(sent).toHaveLength(2)
	})
})
