// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { TrashResponseFile } from '../../src/logic/trash-report.ts'

import { describe, expect, it } from 'vitest'
import { flow, OTHER, PAIR, SINGLE } from './delete-fixtures.ts'

type Answer = (request: { fileId: number }[][]) => Promise<TrashResponseFile[][]>

/** Answers each request in turn: a file listed in `refused` with its result, every other file trashed, or deleted when marked permanent. */
function answers(...refused: Record<number, string>[]): Answer {
	return async (request) => {
		const results = refused.shift() ?? {}
		return request.map((files) => files.map((file) => ({
			fileId: file.fileId,
			result: results[file.fileId] ?? ('permanent' in file && file.permanent === true ? 'deleted' : 'trashed'),
		})))
	}
}

const ids = (files: readonly { file: { entry: { fileId: number } } }[]) => files.map(({ file }) => file.entry.fileId)

describe('deleting for good', () => {
	// spec: DELETE-002.20
	it('warns about the files the trash bin would not keep before it reports or toasts, after the other pictures went', async () => {
		const { deleting, pictures, toasts } = flow(answers({ 1: 'tooLarge', 2: 'skipped', 4: 'noTrashBin' }))

		deleting.summarise([PAIR!, SINGLE!, OTHER!])
		await deleting.confirm()

		const dialog = deleting.dialog.value
		expect(dialog?.kind).toBe('permanent')
		expect(dialog?.kind === 'permanent' && dialog.files.map(({ file, result }) => [file.entry.fileId, result])).toEqual([[1, 'tooLarge'], [4, 'noTrashBin']])
		expect(pictures.value).toEqual([PAIR, SINGLE])
		expect(toasts).toEqual([])
	})

	// spec: DELETE-002.21
	it('sends the refused files\' pictures again with permanent on exactly those files, and counts both requests', async () => {
		const { deleting, pictures, toasts, sent } = flow(answers({ 1: 'tooLarge', 2: 'skipped', 4: 'noTrashBin' }))
		deleting.summarise([PAIR!, SINGLE!, OTHER!])
		await deleting.confirm()

		await deleting.confirm()

		expect(sent[1]).toEqual([
			[{ fileId: 2, etag: 'etag-2' }, { fileId: 1, etag: 'etag-1', permanent: true }],
			[{ fileId: 4, etag: 'etag-4', permanent: true }],
		])
		expect(pictures.value).toEqual([])
		expect(deleting.dialog.value).toBeNull()
		expect(toasts).toEqual(['Moved 3 photos · 2 files · 5 kB freed to the Nextcloud trash bin · 2 files deleted permanently'])
	})

	// spec: DELETE-002.21
	it('reports a file refused again without a second warning', async () => {
		const { deleting, toasts, sent } = flow(answers({ 4: 'noTrashBin' }, { 4: 'changed' }))
		deleting.summarise([SINGLE!])
		await deleting.confirm()

		await deleting.confirm()

		const dialog = deleting.dialog.value
		expect(sent).toHaveLength(2)
		expect(dialog?.kind === 'report' && ids(dialog.report.failed)).toEqual([4])
		expect(toasts).toEqual(['Moved 0 files to trash · 1 failed'])
	})

	// spec: DELETE-002.22
	it('sends nothing more when cancelled, and reports the files with their reason as before', async () => {
		const { deleting, pictures, toasts, sent } = flow(answers({ 1: 'tooLarge', 2: 'skipped' }))
		deleting.summarise([PAIR!, OTHER!])
		await deleting.confirm()

		deleting.close()

		const dialog = deleting.dialog.value
		expect(sent).toHaveLength(1)
		expect(pictures.value).toEqual([PAIR, SINGLE])
		expect(dialog?.kind === 'report' && dialog.report.failed.map(({ file, result }) => [file.entry.fileId, result])).toEqual([[2, 'skipped'], [1, 'tooLarge']])
		expect(toasts).toEqual(['Moved 1 file to trash · 2 failed'])
	})

	// spec: DELETE-002.21
	it('sends nothing while a request runs', async () => {
		let release = () => {}
		const released = new Promise<void>((resolve) => {
			release = resolve
		})
		const held: Answer = async (request) => {
			await released
			return request.map((files) => files.map(({ fileId }) => ({ fileId, result: 'deleted' })))
		}
		const first = answers({ 4: 'noTrashBin' })
		const queue = [first, held]
		const { deleting, sent } = flow((request) => queue.shift()!(request))
		deleting.summarise([SINGLE!])
		await deleting.confirm()

		const running = deleting.confirm()
		await deleting.confirm()
		release()
		await running

		expect(sent).toHaveLength(2)
	})
})
