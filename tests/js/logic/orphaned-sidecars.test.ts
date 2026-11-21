// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { OrphanedSidecar } from '../../../src/logic/orphaned-sidecars.ts'

import { describe, expect, it } from 'vitest'
import { groupByFolder, moveReport } from '../../../src/logic/orphaned-sidecars.ts'

const sidecar = (fileId: number, path: string, size = 100): OrphanedSidecar => ({ fileId, etag: `etag-${fileId}`, path, size })

describe('groupByFolder', () => {
	// spec: XMP-009.11
	it('groups the sidecars by folder in the order found, with each folder\'s and the total count and size', () => {
		const list = groupByFolder([sidecar(1, '/P/a.xmp', 10), sidecar(2, '/P/2024/b.CR2.xmp', 20), sidecar(3, '/P/c.xmp', 30), sidecar(4, '/top.xmp', 5)])

		expect(list).toEqual({
			folders: [
				{ path: '/P', count: 2, size: 40, sidecars: [{ ...sidecar(1, '/P/a.xmp', 10), name: 'a.xmp' }, { ...sidecar(3, '/P/c.xmp', 30), name: 'c.xmp' }] },
				{ path: '/P/2024', count: 1, size: 20, sidecars: [{ ...sidecar(2, '/P/2024/b.CR2.xmp', 20), name: 'b.CR2.xmp' }] },
				{ path: '/', count: 1, size: 5, sidecars: [{ ...sidecar(4, '/top.xmp', 5), name: 'top.xmp' }] },
			],
			count: 4,
			size: 65,
		})
	})

	// spec: XMP-009.11
	it('is empty without sidecars', () => {
		expect(groupByFolder([])).toEqual({ folders: [], count: 0, size: 0 })
	})
})

describe('moveReport', () => {
	// spec: XMP-009.12
	it('counts the trashed sidecars and lists each skipped one with its reason', () => {
		const sent = [sidecar(1, '/P/a.xmp'), sidecar(2, '/P/b.xmp'), sidecar(3, '/P/c.xmp')]

		const report = moveReport(sent, [{ fileId: 1, result: 'trashed' }, { fileId: 2, result: 'notOrphaned' }, { fileId: 3, result: 'changed' }])

		expect(report).toEqual({ trashed: 1, skipped: [{ path: '/P/b.xmp', reason: 'notOrphaned' }, { path: '/P/c.xmp', reason: 'changed' }] })
	})

	// spec: XMP-009.12
	it('counts a sidecar without an answer as not sent', () => {
		const report = moveReport([sidecar(1, '/P/a.xmp'), sidecar(2, '/P/b.xmp')], [{ fileId: 1, result: 'trashed' }])

		expect(report).toEqual({ trashed: 1, skipped: [{ path: '/P/b.xmp', reason: 'notSent' }] })
	})
})
