// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HotkeyEvent, HotkeyState } from '../../../src/logic/hotkeys.ts'

import { describe, expect, it } from 'vitest'
import { formatCaps, hotkey, KEYMAP, NO_HOTKEY_STATE, stepRating } from '../../../src/logic/hotkeys.ts'

const press = (key: string, fields: Partial<HotkeyEvent> = {}): HotkeyEvent => ({ key, code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, capsLock: false, ...fields })
const action = (event: HotkeyEvent, state: HotkeyState = NO_HOTKEY_STATE) => hotkey(event, state).action
const VI: HotkeyState = { vi: true, pendingG: false }

describe('hotkey', () => {
	it.each([
		['p', 'picked'],
		['X', 'rejected'],
		['u', 'unflagged'],
		['`', 'picked'],
	])('flags by %s without advancing', (key, flag) => {
		expect(action(press(key))).toEqual({ kind: 'decide', intent: { kind: 'flag', flag }, advance: false })
	})

	it('flags and advances with Shift or Caps Lock', () => {
		expect(action(press('P', { shiftKey: true }))).toEqual({ kind: 'decide', intent: { kind: 'flag', flag: 'picked' }, advance: true })
		expect(action(press('X', { capsLock: true }))).toEqual({ kind: 'decide', intent: { kind: 'flag', flag: 'rejected' }, advance: true })
	})

	it('rates by a digit, and by Shift and the digit key whatever the layout prints', () => {
		expect(action(press('3'))).toEqual({ kind: 'decide', intent: { kind: 'rating', rating: 3 }, advance: false })
		expect(action(press('§', { code: 'Digit3', shiftKey: true }))).toEqual({ kind: 'decide', intent: { kind: 'rating', rating: 3 }, advance: true })
		expect(action(press('0', { capsLock: true }))).toEqual({ kind: 'decide', intent: { kind: 'rating', rating: 0 }, advance: true })
		expect(action(press('^', { code: 'Digit6', shiftKey: true }))).toBeNull()
	})

	it('steps the rating by [ and ]', () => {
		expect(action(press('['))).toEqual({ kind: 'decide', intent: { kind: 'ratingStep', step: -1 }, advance: false })
		expect(action(press(']'))).toEqual({ kind: 'decide', intent: { kind: 'ratingStep', step: 1 }, advance: false })
	})

	it.each([['6', 'red'], ['7', 'yellow'], ['8', 'green'], ['9', 'blue']])('labels by %s', (key, colourLabel) => {
		expect(action(press(key))).toEqual({ kind: 'decide', intent: { kind: 'colourLabel', colourLabel }, advance: false })
	})

	it('toggles Keep RAW by R and never advances, not even with Caps Lock', () => {
		expect(action(press('R', { capsLock: true }))).toEqual({ kind: 'decide', intent: { kind: 'keepRaw' }, advance: false })
		expect(action(press('R', { shiftKey: true }))).toBeNull()
	})

	it.each([
		['ArrowLeft', 'previous'],
		['ArrowRight', 'next'],
		['ArrowUp', 'up'],
		['ArrowDown', 'down'],
		['Home', 'first'],
		['End', 'last'],
		['g', 'grid'],
		['e', 'loupe'],
		[' ', 'zoom'],
		['z', 'zoom'],
		['f', 'fullscreen'],
		['Tab', 'header'],
		['i', 'info'],
		['\\', 'filter-bar'],
		['Escape', 'close'],
		['b', 'flag-buttons'],
		['?', 'shortcuts'],
	])('runs %j as %s', (key, kind) => {
		expect(action(press(key))).toEqual({ kind })
	})

	it.each([
		['a', {}, 'select-all'],
		['d', { metaKey: true }, 'select-none'],
		['l', {}, 'filters-off'],
		['z', {}, 'undo'],
		['Z', { shiftKey: true }, 'redo'],
		['=', {}, 'zoom-in'],
		['+', { shiftKey: true }, 'zoom-in'],
		['-', {}, 'zoom-out'],
		['/', {}, 'shortcuts'],
		['/', { shiftKey: true }, 'shortcuts'],
	])('runs Ctrl+%s %o as %s', (key, fields, kind) => {
		expect(action(press(key, { ctrlKey: true, ...fields }))).toEqual({ kind })
	})

	it.each([
		press('a', { ctrlKey: true, shiftKey: true }),
		press('k', { ctrlKey: true }),
		press('p', { altKey: true }),
		press('ArrowRight', { shiftKey: true }),
		press('Tab', { shiftKey: true }),
		press('K', { shiftKey: true }),
		press('n'),
		press('Delete'),
		press('h'),
		press('/'),
	])('leaves %o alone', (event) => {
		expect(action(event)).toBeNull()
	})

	it('leaves a lone modifier alone and keeps a waiting g', () => {
		const state = { vi: true, pendingG: true }
		expect(hotkey(press('Shift'), state)).toEqual({ action: null, state })
	})

	describe('with vi keys', () => {
		it.each([['h', 'previous'], ['l', 'next'], ['j', 'down'], ['k', 'up'], ['/', 'filter-focus'], ['G', 'last']])('runs %s as %s', (key, kind) => {
			expect(action(press(key, { shiftKey: key === 'G' }), VI)).toEqual({ kind })
		})

		it('goes to the first photo by g g, the first g waiting without a timeout', () => {
			const first = hotkey(press('g'), VI)
			expect(first).toEqual({ action: null, state: { vi: true, pendingG: true } })
			expect(hotkey(press('g'), first.state)).toEqual({ action: { kind: 'first' }, state: VI })
		})

		it('drops a waiting g on any other key, which acts as usual', () => {
			expect(hotkey(press('p'), { vi: true, pendingG: true })).toEqual({ action: { kind: 'decide', intent: { kind: 'flag', flag: 'picked' }, advance: false }, state: VI })
			expect(hotkey(press('z', { ctrlKey: true }), { vi: true, pendingG: true })).toEqual({ action: { kind: 'undo' }, state: VI })
		})

		it('keeps the other keys and the plain arrows', () => {
			expect(action(press('x'), VI)).toEqual({ kind: 'decide', intent: { kind: 'flag', flag: 'rejected' }, advance: false })
			expect(action(press('Escape'), VI)).toEqual({ kind: 'close' })
			expect(action(press('H', { shiftKey: true }), VI)).toBeNull()
		})
	})
})

describe('stepRating', () => {
	it('steps within 0 to 5 and starts a mixed rating at 0', () => {
		expect(stepRating(3, 1)).toBe(4)
		expect(stepRating(5, 1)).toBe(5)
		expect(stepRating(0, -1)).toBe(0)
		expect(stepRating(undefined, 1)).toBe(1)
	})
})

describe('KEYMAP', () => {
	it('names every action once', () => {
		const ids = KEYMAP.map((entry) => entry.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('shows Ctrl as the command key on a Mac', () => {
		expect(formatCaps('Ctrl+Shift+Z', false)).toBe('Ctrl+Shift+Z')
		expect(formatCaps('Ctrl+Shift+Z', true)).toBe('⌘+Shift+Z')
		expect(formatCaps('P', true)).toBe('P')
	})
})
