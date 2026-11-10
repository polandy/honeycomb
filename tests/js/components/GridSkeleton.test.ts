// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GridSkeleton from '../../../src/components/GridSkeleton.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'

describe('GridSkeleton', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: GRID-001.13
	it('draws hidden skeleton tiles at the tile size and tells screen readers it is loading', () => {
		const wrapper = mount(GridSkeleton, { props: { tileSize: 200 } })

		expect(wrapper.attributes('aria-busy')).toBe('true')
		expect(wrapper.get('[role="status"]').text()).toBe(`${TRANSLATED_MARK}Loading photos…`)
		const tiles = wrapper.findAll('.grid-skeleton__tile')
		expect(tiles.length).toBeGreaterThan(0)
		expect(tiles.every((tile) => tile.attributes('aria-hidden') === 'true')).toBe(true)
		expect(wrapper.attributes('style')).toContain('--grid-skeleton-size: 200px')
	})
})
