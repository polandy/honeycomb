// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toggleBrowserFullscreen } from '../../src/fullscreen.ts'
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
	it('shows MB below one GB and GB from there', () => {
		expect([formatFileSize(1.5 * 1024 ** 2), formatFileSize(2 * 1024 ** 3)]).toEqual(['1.5 MB', '2 GB'])
	})

	it('shows a capture time with its year', () => {
		expect(formatDateTime(Date.UTC(2026, 10, 10, 12) / 1000)).toContain('2026')
	})
})
