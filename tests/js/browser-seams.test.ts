// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fullscreenAvailable, toggleBrowserFullscreen } from '../../src/fullscreen.ts'
import { formatDateTime, formatFileSize } from '../../src/l10n.ts'
import { observeElementSize } from '../../src/observe-size.ts'

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe('toggleBrowserFullscreen', () => {
	it('enters full screen with the element, and leaves it when something is full screen', () => {
		const element = document.createElement('div')
		const request = vi.fn(async () => undefined)
		element.requestFullscreen = request
		const exit = vi.fn(async () => undefined)
		document.exitFullscreen = exit
		toggleBrowserFullscreen(element)
		Object.defineProperty(document, 'fullscreenElement', { value: element, configurable: true })
		toggleBrowserFullscreen(element)
		Reflect.deleteProperty(document, 'fullscreenElement')
		expect([request.mock.calls.length, exit.mock.calls.length]).toEqual([1, 1])
	})

	it('swallows a refusal, as when the browser allows no full screen', async () => {
		const element = document.createElement('div')
		element.requestFullscreen = async () => {
			throw new TypeError('not allowed')
		}
		expect(() => toggleBrowserFullscreen(element)).not.toThrow()
		await Promise.resolve()
	})
})

describe('webkit fullscreen fallback', () => {
	const stub = (values: Record<string, unknown>) => Object.entries(values).forEach(([key, value]) => Object.defineProperty(document, key, { value, configurable: true }))
	afterEach(() => ['fullscreenEnabled', 'webkitFullscreenEnabled', 'webkitFullscreenElement', 'webkitExitFullscreen', 'exitFullscreen'].forEach((key) => Reflect.deleteProperty(document, key)))

	it('is available by either flag', () => {
		expect(fullscreenAvailable()).toBe(false)
		stub({ webkitFullscreenEnabled: true })
		expect(fullscreenAvailable()).toBe(true)
	})

	it('enters and leaves with the webkit calls when the standard ones are missing', () => {
		const element = document.createElement('div') as HTMLElement & { webkitRequestFullscreen?: () => void }
		const request = vi.fn()
		element.webkitRequestFullscreen = request
		const exit = vi.fn()
		stub({ webkitExitFullscreen: exit, exitFullscreen: undefined })
		Object.defineProperty(element, 'requestFullscreen', { value: undefined })
		toggleBrowserFullscreen(element)
		stub({ webkitFullscreenElement: element })
		toggleBrowserFullscreen(element)
		expect([request.mock.calls.length, exit.mock.calls.length]).toEqual([1, 1])
	})
})

describe('observeElementSize', () => {
	it('reports each content size and disconnects on stop', () => {
		const observers: { report: (entries: unknown[]) => void, observed: Element[], disconnected: boolean }[] = []
		vi.stubGlobal('ResizeObserver', class {
			state: typeof observers[number]
			constructor(report: (entries: unknown[]) => void) {
				this.state = { report, observed: [], disconnected: false }
				observers.push(this.state)
			}

			observe(element: Element) {
				this.state.observed.push(element)
			}

			disconnect() {
				this.state.disconnected = true
			}
		})
		const element = document.createElement('div')
		const sizes: number[][] = []
		const stop = observeElementSize(element, (width, height) => sizes.push([width, height]))
		observers[0]!.report([{ contentRect: { width: 300, height: 200 } }])
		observers[0]!.report([])
		stop()
		expect(sizes).toEqual([[300, 200]])
		expect(observers[0]).toMatchObject({ observed: [element], disconnected: true })
	})
})

describe('formatFileSize and formatDateTime', () => {
	it('shows kB below one MB, MB below one GB and GB from there', () => {
		expect([formatFileSize(512 * 1024), formatFileSize(1.5 * 1024 ** 2), formatFileSize(2 * 1024 ** 3)]).toEqual(['512 kB', '1.5 MB', '2 GB'])
	})

	it('shows a capture time with its year', () => {
		expect(formatDateTime(Date.UTC(2026, 10, 10, 12) / 1000)).toContain('2026')
	})
})
