// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { dragWidth, INFO_PANEL, keyWidth, parsePanelWidth } from '../../../src/logic/panel-width.ts'

describe('parsePanelWidth', () => {
	it('reads a stored width within the limits, else the default', () => {
		expect(parsePanelWidth('360', INFO_PANEL)).toBe(360)
		expect(parsePanelWidth('9999', INFO_PANEL)).toBe(INFO_PANEL.max)
		expect(parsePanelWidth('wide', INFO_PANEL)).toBe(INFO_PANEL.initial)
		expect(parsePanelWidth(null, INFO_PANEL)).toBe(INFO_PANEL.initial)
	})
})

describe('dragWidth', () => {
	it('widens the panel on the right as the divider moves left, within the limits', () => {
		expect(dragWidth(300, 700, 650, INFO_PANEL)).toBe(350)
		expect(dragWidth(300, 700, 0, INFO_PANEL)).toBe(INFO_PANEL.max)
		expect(dragWidth(300, 700, 900, INFO_PANEL)).toBe(INFO_PANEL.min)
	})
})

describe('keyWidth', () => {
	it('moves the divider by a step with the arrow keys and to the narrowest and widest with Home and End', () => {
		expect(keyWidth(300, 'ArrowLeft', INFO_PANEL)).toBe(300 + INFO_PANEL.step)
		expect(keyWidth(300, 'ArrowRight', INFO_PANEL)).toBe(300 - INFO_PANEL.step)
		expect(keyWidth(300, 'Home', INFO_PANEL)).toBe(INFO_PANEL.min)
		expect(keyWidth(300, 'End', INFO_PANEL)).toBe(INFO_PANEL.max)
		expect(keyWidth(INFO_PANEL.max, 'ArrowLeft', INFO_PANEL)).toBe(INFO_PANEL.max)
	})

	it('leaves other keys alone', () => {
		expect(keyWidth(300, 'ArrowUp', INFO_PANEL)).toBeNull()
	})
})
