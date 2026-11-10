// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { INFO_OPEN_KEY, INFO_WIDTH_KEY, useLoupePanels } from '../../src/loupe-panels.ts'
import { fakeStorage } from './app-cull.ts'

describe('useLoupePanels', () => {
	it('starts with the info panel closed at its initial width', () => {
		const panels = useLoupePanels(fakeStorage())

		expect([panels.infoOpen.value, panels.infoWidth.value]).toEqual([false, 300])
	})

	it('reads and keeps the open state and the width', () => {
		const stored: Record<string, string> = { [INFO_OPEN_KEY]: 'true', [INFO_WIDTH_KEY]: '999' }
		const panels = useLoupePanels(fakeStorage(stored))
		expect([panels.infoOpen.value, panels.infoWidth.value]).toEqual([true, 480])

		panels.setInfoOpen(false)
		panels.setInfoWidth(256)

		expect(stored).toEqual({ [INFO_OPEN_KEY]: 'false', [INFO_WIDTH_KEY]: '256' })
		expect([panels.infoOpen.value, panels.infoWidth.value]).toEqual([false, 256])
	})

	it('works for this visit where the browser blocks site data', () => {
		const panels = useLoupePanels(fakeStorage({}, true))

		panels.setInfoOpen(true)
		panels.setInfoWidth(240)

		expect([panels.infoOpen.value, panels.infoWidth.value]).toEqual([true, 240])
	})
})
