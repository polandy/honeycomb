// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { lockScroll } from '../../src/shared/scroll-lock.ts'

describe('lockScroll', () => {
	// spec: APP-001.24
	it('holds the page still until the last lock is released and restores its own overflow', () => {
		const page = document.createElement('html')
		page.style.overflow = 'scroll'

		const first = lockScroll(page)
		const second = lockScroll(page)
		expect(page.style.overflow).toBe('hidden')

		first()
		expect(page.style.overflow).toBe('hidden')
		second()
		expect(page.style.overflow).toBe('scroll')
		expect(page.dataset.scrollLocks).toBeUndefined()
	})

	// spec: APP-001.24
	it('releases a lock only once', () => {
		const page = document.createElement('html')
		const first = lockScroll(page)
		const second = lockScroll(page)

		first()
		first()

		expect(page.style.overflow).toBe('hidden')
		second()
		expect(page.style.overflow).toBe('')
	})
})
