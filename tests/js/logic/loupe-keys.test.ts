// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { loupeKey } from '../../../src/logic/loupe-keys.ts'

const key = (name: string, modifiers: Partial<{ ctrlKey: boolean, metaKey: boolean, altKey: boolean, shiftKey: boolean }> = {}) => ({ key: name, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...modifiers })

describe('loupeKey', () => {
	it('maps the loupe keys of the shared key map', () => {
		expect(loupeKey(key('ArrowLeft'))).toBe('previous')
		expect(loupeKey(key('ArrowRight'))).toBe('next')
		expect(loupeKey(key('Home'))).toBe('first')
		expect(loupeKey(key('End'))).toBe('last')
		expect(loupeKey(key('Escape'))).toBe('close')
		expect(loupeKey(key('Tab'))).toBe('chrome-free')
		expect(loupeKey(key('f'))).toBe('fullscreen')
		expect(loupeKey(key('F'))).toBe('fullscreen')
		expect(loupeKey(key('z'))).toBe('zoom')
		expect(loupeKey(key(' '))).toBe('zoom')
		expect(loupeKey(key('i'))).toBe('info')
	})

	it('leaves chords and other keys to the browser', () => {
		expect(loupeKey(key('f', { ctrlKey: true }))).toBeNull()
		expect(loupeKey(key('ArrowLeft', { altKey: true }))).toBeNull()
		expect(loupeKey(key('Tab', { shiftKey: true }))).toBeNull()
		expect(loupeKey(key('ArrowRight', { metaKey: true }))).toBeNull()
		expect(loupeKey(key('q'))).toBeNull()
	})
})
