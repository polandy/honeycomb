// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tile = readFileSync(new URL('../../../src/components/PhotoTile.vue', import.meta.url), 'utf8')
const rule = (selector: string) => tile.match(new RegExp(`${selector.replaceAll('.', '\\.')}\\s*\\{([^}]*)\\}`))?.[1] ?? ''

describe('the tile marks', () => {
	// spec: GRID-001.16
	it('sit on a fixed dark shade, not on a theme colour', () => {
		const marks = rule('.photo-tile__marks')

		expect(marks).toMatch(/rgb(a)?\(0,\s*0,\s*0/)
		expect(marks).not.toContain('var(--color-')
	})

	// spec: GRID-001.16
	it('draw the stars in white', () => {
		const stars = rule('.photo-tile__stars')

		expect(stars).toMatch(/color:\s*#fff/)
		expect(stars).not.toContain('--color-main-background')
	})
})
