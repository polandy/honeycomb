// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ViewState } from '../../src/logic/view-state.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { GESTURE_GUIDE_SEEN_KEY, INFO_OPEN_KEY, useViewState } from '../../src/view-state.ts'
import { fakeStorage } from './app-cull.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

/** A save the test settles by hand. */
function pending() {
	let settle = (_failed: boolean) => {}
	const promise = new Promise<void>((resolve, reject) => {
		settle = (failed) => (failed ? reject(new Error('offline')) : resolve())
	})
	return { promise, settle }
}

/** The view state over a fake server answering `load`, with browser storage holding `local`. */
function viewStateOn(load: () => Promise<unknown>, local: Record<string, string> = {}, save: () => Promise<void> = async () => undefined) {
	const saved: Partial<ViewState>[] = []
	const state = useViewState({
		loadViewState: load,
		saveViewState: (patch) => {
			saved.push(patch)
			return save()
		},
	}, fakeStorage(local))
	return { ...state, saved, local }
}

describe('useViewState', () => {
	// spec: LOUPE-003.5
	it('does not show the gesture guide before the answer, then takes the stored values', async () => {
		const { infoPanelOpen, gestureGuideSeen, saved } = viewStateOn(async () => ({ infoPanelOpen: true, gestureGuideSeen: false }))
		expect([infoPanelOpen.value, gestureGuideSeen.value]).toEqual([false, true])

		await flushPromises()

		expect([infoPanelOpen.value, gestureGuideSeen.value]).toEqual([true, false])
		expect(saved).toEqual([])
	})

	// spec: LOUPE-003.5
	it('without stored or local values keeps the panel closed, shows the guide and writes nothing', async () => {
		const { infoPanelOpen, gestureGuideSeen, saved } = viewStateOn(async () => ({ infoPanelOpen: null, gestureGuideSeen: null }))
		await flushPromises()

		expect([infoPanelOpen.value, gestureGuideSeen.value]).toEqual([false, false])
		expect(saved).toEqual([])
	})

	// spec: LOUPE-003.6
	it('applies a change at once and writes only its key', async () => {
		const { infoPanelOpen, gestureGuideSeen, setInfoPanelOpen, dismissGestureGuide, saved } = viewStateOn(async () => ({ infoPanelOpen: null, gestureGuideSeen: null }))
		await flushPromises()

		setInfoPanelOpen(true)
		dismissGestureGuide()

		expect([infoPanelOpen.value, gestureGuideSeen.value]).toEqual([true, true])
		expect(saved).toEqual([{ infoPanelOpen: true }, { gestureGuideSeen: true }])
	})

	// spec: LOUPE-003.6, SETTINGS-001.22
	it('shows the gesture guide again and writes only that key', async () => {
		const { gestureGuideSeen, showGestureGuide, saved } = viewStateOn(async () => ({ infoPanelOpen: null, gestureGuideSeen: true }))
		await flushPromises()
		expect(gestureGuideSeen.value).toBe(true)

		showGestureGuide()

		expect(gestureGuideSeen.value).toBe(false)
		expect(saved).toEqual([{ gestureGuideSeen: false }])
	})

	// spec: LOUPE-003.5, LOUPE-003.6
	it('counts the first-series hint as seen until the answer, and dismissing it writes only its key', async () => {
		const { seriesHintSeen, dismissSeriesHint, saved } = viewStateOn(async () => ({ infoPanelOpen: true, gestureGuideSeen: true, seriesHintSeen: null }))
		expect(seriesHintSeen.value).toBe(true)

		await flushPromises()
		expect(seriesHintSeen.value).toBe(false)
		dismissSeriesHint()

		expect(seriesHintSeen.value).toBe(true)
		expect(saved).toEqual([{ seriesHintSeen: true }])
	})

	// spec: LOUPE-003.6
	it('keeps a change made before the answer over the stored value', async () => {
		const { infoPanelOpen, setInfoPanelOpen, saved } = viewStateOn(async () => ({ infoPanelOpen: false, gestureGuideSeen: true }))

		setInfoPanelOpen(true)
		await flushPromises()

		expect(infoPanelOpen.value).toBe(true)
		expect(saved).toEqual([{ infoPanelOpen: true }])
	})

	// spec: LOUPE-003.7
	it('takes over the local values, writes them once and removes them only after the write succeeded', async () => {
		const write = pending()
		const { infoPanelOpen, gestureGuideSeen, saved, local } = viewStateOn(async () => ({ infoPanelOpen: null, gestureGuideSeen: null }), { [INFO_OPEN_KEY]: 'true', [GESTURE_GUIDE_SEEN_KEY]: 'true', 'honeycomb.infoWidth': '320' }, () => write.promise)
		await flushPromises()

		expect([infoPanelOpen.value, gestureGuideSeen.value]).toEqual([true, true])
		expect(saved).toEqual([{ infoPanelOpen: true, gestureGuideSeen: true }])
		expect(Object.keys(local)).toEqual([INFO_OPEN_KEY, GESTURE_GUIDE_SEEN_KEY, 'honeycomb.infoWidth'])

		write.settle(false)
		await flushPromises()

		expect(local).toEqual({ 'honeycomb.infoWidth': '320' })
	})

	// spec: LOUPE-003.7, LOUPE-003.8
	it('keeps the local values when taking them over fails', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { infoPanelOpen, local } = viewStateOn(async () => ({ infoPanelOpen: null, gestureGuideSeen: true }), { [INFO_OPEN_KEY]: 'true' }, async () => {
			throw new Error('offline')
		})
		await flushPromises()

		expect(infoPanelOpen.value).toBe(true)
		expect(local).toEqual({ [INFO_OPEN_KEY]: 'true' })
		expect(error).toHaveBeenCalledOnce()
	})

	// spec: LOUPE-003.7
	it('removes a local value beside a stored one without writing', async () => {
		const { infoPanelOpen, saved, local } = viewStateOn(async () => ({ infoPanelOpen: false, gestureGuideSeen: true }), { [INFO_OPEN_KEY]: 'true', [GESTURE_GUIDE_SEEN_KEY]: 'false' })
		await flushPromises()

		expect(infoPanelOpen.value).toBe(false)
		expect(saved).toEqual([])
		expect(local).toEqual({})
	})

	// spec: LOUPE-003.8
	it('falls back to the local values when the view state cannot be read, and takes nothing over', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { infoPanelOpen, gestureGuideSeen, saved, local } = viewStateOn(async () => {
			throw new Error('offline')
		}, { [INFO_OPEN_KEY]: 'true' })
		await flushPromises()

		expect([infoPanelOpen.value, gestureGuideSeen.value]).toEqual([true, false])
		expect(saved).toEqual([])
		expect(local).toEqual({ [INFO_OPEN_KEY]: 'true' })
		expect(error).toHaveBeenCalledOnce()
	})

	// spec: LOUPE-003.8
	it('keeps a change whose write failed for this visit', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { gestureGuideSeen, dismissGestureGuide } = viewStateOn(async () => ({ infoPanelOpen: null, gestureGuideSeen: null }), {}, async () => {
			throw new Error('offline')
		})
		await flushPromises()

		dismissGestureGuide()
		await flushPromises()

		expect(gestureGuideSeen.value).toBe(true)
		expect(error).toHaveBeenCalledOnce()
	})

	// spec: LOUPE-003.8
	it('works where the browser blocks site data or refuses to remove a key', async () => {
		const blocked = useViewState({ loadViewState: async () => ({ infoPanelOpen: true, gestureGuideSeen: true }), saveViewState: async () => undefined }, fakeStorage({}, true))
		const stuck = useViewState({ loadViewState: async () => ({}), saveViewState: async () => undefined }, () => ({
			getItem: () => 'true',
			setItem: () => undefined,
			removeItem: () => {
				throw new DOMException('blocked', 'SecurityError')
			},
		}))
		await flushPromises()

		expect([blocked.infoPanelOpen.value, blocked.gestureGuideSeen.value]).toEqual([true, true])
		expect([stuck.infoPanelOpen.value, stuck.gestureGuideSeen.value]).toEqual([true, true])
	})
})
