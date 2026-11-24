// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { pageUrl, useNavigationItems } from '../../src/folders/navigation-items.ts'

describe('useNavigationItems', () => {
	// spec: STATS-001.40
	it('lists the pages of their own, Statistics beside Similarity, each at its URL', () => {
		const items = useNavigationItems()

		expect(items.map(({ page, name, icon }) => ({ page, name, icon }))).toEqual([
			{ page: 'similarity', name: 'Similarity', icon: 'compare' },
			{ page: 'statistics', name: 'Statistics', icon: 'chart' },
			{ page: 'orphaned-sidecars', name: 'Orphaned sidecars', icon: 'trash' },
		])
		expect(items[1]!.href).toBe(pageUrl('statistics'))
		expect(pageUrl('statistics')).toMatch(/\/apps\/honeycomb\/statistics$/)
	})

	// spec: XMP-009.13
	it('lists Orphaned sidecars after Statistics, at its page', () => {
		const items = useNavigationItems()

		expect(items.at(-1)).toEqual({ page: 'orphaned-sidecars', name: 'Orphaned sidecars', icon: 'trash', href: pageUrl('orphaned-sidecars') })
		expect(pageUrl('orphaned-sidecars')).toMatch(/\/apps\/honeycomb\/orphaned-sidecars$/)
	})
})
