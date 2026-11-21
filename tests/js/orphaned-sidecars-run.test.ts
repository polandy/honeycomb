// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { OrphanedSidecar, OrphanedSidecarAnswer } from '../../src/logic/orphaned-sidecars.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ORPHANED_SIDECARS_TRASH_BATCH, useOrphanedSidecars } from '../../src/orphaned-sidecars-run.ts'

vi.mock('../../src/logger.ts', () => ({ logger: { error: vi.fn() } }))

const sidecar = (fileId: number, folder = '/P'): OrphanedSidecar => ({ fileId, etag: `etag-${fileId}`, path: `${folder}/s${fileId}.xmp`, size: 10 })

/** Seams with two pages of orphans under `/P`, the second in `/P/2024`, and a trash that trashes all but `notOrphaned`. */
function seams(notOrphaned: readonly number[] = []) {
	return {
		scan: vi.fn(async (_path: string, after: string) => (after === ''
			? { sidecars: [sidecar(1), sidecar(2)], next: '/' }
			: { sidecars: [sidecar(3, '/P/2024')], next: null })),
		trash: vi.fn(async (sidecars: readonly { fileId: number, etag: string }[]): Promise<OrphanedSidecarAnswer[]> => sidecars.map(({ fileId }) => ({ fileId, result: notOrphaned.includes(fileId) ? 'notOrphaned' : 'trashed' }))),
	}
}

describe('useOrphanedSidecars', () => {
	// spec: XMP-009.11
	it('scans page after page and lists every orphan by folder', async () => {
		const fake = seams()
		const run = useOrphanedSidecars(fake)

		void run.scan('/P')
		await flushPromises()

		expect(fake.scan.mock.calls).toEqual([['/P', ''], ['/P', '/']])
		expect(run.status.value).toBe('found')
		expect(run.list.value.folders.map(({ path, count }) => [path, count])).toEqual([['/P', 2], ['/P/2024', 1]])
		expect(run.list.value).toMatchObject({ count: 3, size: 30 })
	})

	// spec: XMP-009.10
	it('sends nothing to the trash bin before the move, nor after a new scan or a drop', async () => {
		const fake = seams()
		const run = useOrphanedSidecars(fake)

		void run.scan('/P')
		await flushPromises()
		void run.scan('/P')
		await flushPromises()
		run.drop()
		await flushPromises()
		await run.move()

		expect(fake.trash).not.toHaveBeenCalled()
		expect(run.status.value).toBe('idle')
		expect(run.list.value.count).toBe(0)
	})

	// spec: XMP-009.10
	it('drops the pages of a scan that a new scan replaced', async () => {
		const fake = seams()
		let second!: (page: { sidecars: OrphanedSidecar[], next: null }) => void
		fake.scan.mockImplementationOnce(async () => ({ sidecars: [sidecar(1)], next: '/' }))
		fake.scan.mockImplementationOnce(() => new Promise((settle) => {
			second = settle
		}))
		const run = useOrphanedSidecars(fake)

		void run.scan('/P')
		await flushPromises()
		void run.scan('/Q')
		second({ sidecars: [sidecar(9)], next: null })
		await flushPromises()

		expect(run.list.value.folders.flatMap(({ sidecars }) => sidecars.map(({ fileId }) => fileId))).toEqual([1, 2, 3])
	})

	// spec: XMP-009.12
	it('moves the confirmed list in batches and reports the trashed and the skipped', async () => {
		const fake = seams([2])
		fake.scan.mockImplementation(async () => ({ sidecars: Array.from({ length: ORPHANED_SIDECARS_TRASH_BATCH + 1 }, (_, index) => sidecar(index + 1)), next: null }))
		const run = useOrphanedSidecars(fake)
		void run.scan('/P')
		await flushPromises()

		await run.move()

		expect(fake.trash.mock.calls.map(([batch]) => batch.length)).toEqual([ORPHANED_SIDECARS_TRASH_BATCH, 1])
		expect(fake.trash.mock.calls[0]![0][0]).toEqual({ fileId: 1, etag: 'etag-1' })
		expect(run.status.value).toBe('done')
		expect(run.report.value).toEqual({ trashed: ORPHANED_SIDECARS_TRASH_BATCH, skipped: [{ path: '/P/s2.xmp', reason: 'notOrphaned' }] })
	})

	// spec: XMP-009.12
	it('stops at a failed request and counts the sidecars not sent as skipped', async () => {
		const fake = seams()
		fake.scan.mockImplementation(async () => ({ sidecars: Array.from({ length: ORPHANED_SIDECARS_TRASH_BATCH + 2 }, (_, index) => sidecar(index + 1)), next: null }))
		fake.trash.mockImplementationOnce(async (batch) => batch.map(({ fileId }) => ({ fileId, result: 'trashed' })))
		fake.trash.mockRejectedValueOnce(new Error('offline'))
		const run = useOrphanedSidecars(fake)
		void run.scan('/P')
		await flushPromises()

		await run.move()

		expect(run.status.value).toBe('done')
		expect(run.problem.value).toBe('trash')
		expect(run.report.value!.trashed).toBe(ORPHANED_SIDECARS_TRASH_BATCH)
		expect(run.report.value!.skipped.map(({ reason }) => reason)).toEqual(['notSent', 'notSent'])
	})

	// spec: XMP-009.11
	it('reports a failed scan and keeps nothing', async () => {
		const fake = seams()
		fake.scan.mockRejectedValueOnce(new Error('offline'))
		const run = useOrphanedSidecars(fake)

		void run.scan('/P')
		await flushPromises()
		await run.move()

		expect(run.status.value).toBe('idle')
		expect(run.problem.value).toBe('scan')
		expect(fake.trash).not.toHaveBeenCalled()
	})
})
