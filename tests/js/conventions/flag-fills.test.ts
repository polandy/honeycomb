// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../../../src/${path}`, import.meta.url), 'utf8')
const FILLS = read('flag-fills.css')
const MIN_CONTRAST = 4.5

/** The WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string) {
	const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
		const channel = Number.parseInt(hex.slice(i, i + 2), 16) / 255
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05)
const token = (name: string) => FILLS.match(new RegExp(`--honeycomb-${name}-fill:\\s*(#[0-9a-f]{6})`, 'i'))?.[1] ?? ''

describe('the flag fills', () => {
	// spec: LOUPE-002.13
	it.each(['pick', 'reject', 'unflag'])('draws white on the %s fill at 4.5:1 or more', (name) => {
		expect(contrastWithWhite(token(name))).toBeGreaterThanOrEqual(MIN_CONTRAST)
	})

	// spec: LOUPE-002.13
	it.each([
		['FlagMark.vue', 'picked', 'pick'],
		['FlagMark.vue', 'rejected', 'reject'],
		['FlagButtons.vue', 'picked', 'pick'],
		['FlagButtons.vue', 'rejected', 'reject'],
		['FlagButtons.vue', 'unflagged', 'unflag'],
		['LoupeSwipeHint.vue', 'picked', 'pick'],
		['LoupeSwipeHint.vue', 'rejected', 'reject'],
	])('%s fills %s with the app token and a white icon', (file, flag, name) => {
		const source = read(`components/${file}`)
		expect(source).toContain(`var(--honeycomb-${name}-fill)`)
		expect(source).not.toMatch(/--color-(success|error)\)/)
		expect(source).not.toMatch(new RegExp(`${flag}[^}]*color: var\\(--color-main-background\\)`))
	})

	// spec: LOUPE-002.13
	it('marks a pressed Unflag by its fill like Pick and Reject, not by a heavier outline', () => {
		expect(read('components/FlagButtons.vue')).not.toMatch(/\[aria-pressed='true'\][^}]*outline/)
	})
})
