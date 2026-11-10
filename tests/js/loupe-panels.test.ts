// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ViewState } from '../../src/logic/view-state.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { INFO_WIDTH_KEY, NAVIGATION_SHOWN_KEY, useLoupePanels } from '../../src/loupe-panels.ts'
import { fakeStorage, fakeViewState } from './app-cull.ts'

describe('useLoupePanels', () => {
	it('starts with the info panel closed at its initial width', async () => {
		const panels = useLoupePanels(fakeStorage(), fakeViewState())
		await flushPromises()

		expect([panels.infoOpen.value, panels.infoWidth.value]).toEqual([false, 300])
	})

	// spec: LOUPE-001.13, LOUPE-003.6
	it('keeps the width in the browser and the open state in the view state', async () => {
		const stored: Record<string, string> = { [INFO_WIDTH_KEY]: '999' }
		const saved: Partial<ViewState>[] = []
		const panels = useLoupePanels(fakeStorage(stored), fakeViewState({ infoPanelOpen: true }, saved))
		await flushPromises()
		expect([panels.infoOpen.value, panels.infoWidth.value]).toEqual([true, 480])

		panels.setInfoOpen(false)
		panels.setInfoWidth(256)

		expect(stored).toEqual({ [INFO_WIDTH_KEY]: '256' })
		expect(saved).toEqual([{ infoPanelOpen: false }])
		expect([panels.infoOpen.value, panels.infoWidth.value]).toEqual([false, 256])
	})

	// spec: LOUPE-001.14
	it('covers the Nextcloud navigation until it is shown, and keeps that choice', () => {
		const stored: Record<string, string> = {}
		const panels = useLoupePanels(fakeStorage(stored), fakeViewState())
		expect(panels.navigationShown.value).toBe(false)

		panels.setNavigationShown(true)

		expect(stored).toEqual({ [NAVIGATION_SHOWN_KEY]: 'true' })
		expect(useLoupePanels(fakeStorage(stored), fakeViewState()).navigationShown.value).toBe(true)
	})

	// spec: LOUPE-001.15, LOUPE-003.6
	it('shows the gesture guide until it is dismissed once', async () => {
		const saved: Partial<ViewState>[] = []
		const panels = useLoupePanels(fakeStorage(), fakeViewState({ gestureGuideSeen: null }, saved))
		await flushPromises()
		expect(panels.gestureGuideSeen.value).toBe(false)

		panels.dismissGestureGuide()

		expect(panels.gestureGuideSeen.value).toBe(true)
		expect(saved).toEqual([{ gestureGuideSeen: true }])
	})

	// spec: LOUPE-001.16
	it('works for this visit where the browser blocks site data', () => {
		const panels = useLoupePanels(fakeStorage({}, true), fakeViewState())

		panels.setInfoOpen(true)
		panels.setInfoWidth(240)
		panels.setNavigationShown(true)

		expect([panels.infoOpen.value, panels.infoWidth.value, panels.navigationShown.value]).toEqual([true, 240, true])
	})
})
