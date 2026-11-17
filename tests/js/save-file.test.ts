// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveBrowserFile } from '../../src/save-file.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

describe('saveBrowserFile', () => {
	// spec: XMP-007.8
	it('offers the text as a download under the name and frees its URL', () => {
		const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:legacy')
		const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
		const clicked: { href: string, download: string }[] = []
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) {
			clicked.push({ href: this.href, download: this.download })
		})

		saveBrowserFile('honeycomb-legacy-rows.json', '{}')

		expect(created.mock.calls[0]![0]).toBeInstanceOf(Blob)
		expect(clicked).toEqual([{ href: 'blob:legacy', download: 'honeycomb-legacy-rows.json' }])
		expect(revoked).toHaveBeenCalledWith('blob:legacy')
	})
})
