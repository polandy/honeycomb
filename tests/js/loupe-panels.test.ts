// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { GESTURE_GUIDE_SEEN_KEY, INFO_OPEN_KEY, INFO_WIDTH_KEY, NAVIGATION_SHOWN_KEY, useLoupePanels } from '../../src/loupe-panels.ts'
import { fakeStorage } from './app-cull.ts'

describe('useLoupePanels', () => {
	it('starts with the info panel closed at its initial width', () => {
		const panels = useLoupePanels(fakeStorage())

		expect([panels.infoOpen.value, panels.infoWidth.value]).toEqual([false, 300])
	})

	// spec: LOUPE-001.13
	it('reads and keeps the open state and the width', () => {
		const stored: Record<string, string> = { [INFO_OPEN_KEY]: 'true', [INFO_WIDTH_KEY]: '999' }
		const panels = useLoupePanels(fakeStorage(stored))
		expect([panels.infoOpen.value, panels.infoWidth.value]).toEqual([true, 480])

		panels.setInfoOpen(false)
		panels.setInfoWidth(256)

		expect(stored).toEqual({ [INFO_OPEN_KEY]: 'false', [INFO_WIDTH_KEY]: '256' })
		expect([panels.infoOpen.value, panels.infoWidth.value]).toEqual([false, 256])
	})

	// spec: LOUPE-001.14
	it('covers the Nextcloud navigation until it is shown, and keeps that choice', () => {
		const stored: Record<string, string> = {}
		const panels = useLoupePanels(fakeStorage(stored))
		expect(panels.navigationShown.value).toBe(false)

		panels.setNavigationShown(true)

		expect(stored).toEqual({ [NAVIGATION_SHOWN_KEY]: 'true' })
		expect(useLoupePanels(fakeStorage(stored)).navigationShown.value).toBe(true)
	})

	// spec: LOUPE-001.15
	it('shows the gesture guide until it is dismissed once', () => {
		const stored: Record<string, string> = {}
		const panels = useLoupePanels(fakeStorage(stored))
		expect(panels.gestureGuideSeen.value).toBe(false)

		panels.dismissGestureGuide()

		expect(panels.gestureGuideSeen.value).toBe(true)
		expect(stored).toEqual({ [GESTURE_GUIDE_SEEN_KEY]: 'true' })
		expect(useLoupePanels(fakeStorage(stored)).gestureGuideSeen.value).toBe(true)
	})

	// spec: LOUPE-001.16
	it('works for this visit where the browser blocks site data', () => {
		const panels = useLoupePanels(fakeStorage({}, true))

		panels.setInfoOpen(true)
		panels.setInfoWidth(240)
		panels.setNavigationShown(true)

		expect([panels.infoOpen.value, panels.infoWidth.value, panels.navigationShown.value]).toEqual([true, 240, true])
	})
})
