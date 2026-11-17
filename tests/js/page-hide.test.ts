// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { onBrowserPageHide } from '../../src/page-hide.ts'

afterEach(() => vi.restoreAllMocks())

describe('onBrowserPageHide', () => {
	// spec: XMP-003.29
	it('runs when the page turns hidden or is left, not when it turns visible nor once stopped', () => {
		const run = vi.fn()
		const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
		const stop = onBrowserPageHide(run)

		document.dispatchEvent(new Event('visibilitychange'))
		expect(run).not.toHaveBeenCalled()
		state.mockReturnValue('hidden')
		document.dispatchEvent(new Event('visibilitychange'))
		window.dispatchEvent(new Event('pagehide'))

		expect(run).toHaveBeenCalledTimes(2)
		stop()
		window.dispatchEvent(new Event('pagehide'))
		expect(run).toHaveBeenCalledTimes(2)
	})
})
