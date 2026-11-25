// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { VueWrapper } from '@vue/test-utils'

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import AppLayout from '../../../src/components/AppLayout.vue'
import AppNavigation from '../../../src/components/AppNavigation.vue'
import OrphanedSidecarsPage from '../../../src/components/OrphanedSidecarsPage.vue'
import SimilarityPage from '../../../src/components/SimilarityPage.vue'
import StatisticsPage from '../../../src/components/StatisticsPage.vue'
import { mountApp } from '../app-cull.ts'
import { fakePageNavigation } from '../page-navigation.ts'

const navigation = () => fakePageNavigation().seams
const noAnswer = () => new Promise<never>(() => {})

/** Each route's root, mounted over seams that never answer. */
const ROUTES: [string, () => VueWrapper][] = [
	['/apps/honeycomb/', () => mountApp().wrapper],
	['/apps/honeycomb/similarity', () => mount(SimilarityPage, { props: { seams: { listMissing: noAnswer, hash: noAnswer, save: noAnswer, wait: noAnswer, workers: 1 }, listFolders: noAnswer, roots: [], navigation: navigation() } })],
	['/apps/honeycomb/statistics', () => mount(StatisticsPage, { props: { seams: { loadStatistics: noAnswer, loadLibraryFolders: noAnswer, loadSettings: noAnswer, saveViewState: noAnswer }, navigation: navigation() } })],
	['/apps/honeycomb/orphaned-sidecars', () => mount(OrphanedSidecarsPage, { props: { seams: { scan: noAnswer, trash: noAnswer }, listFolders: noAnswer, roots: [], navigation: navigation() } })],
]

enableAutoUnmount(afterEach)

describe('every page', () => {
	// spec: APP-001.23
	it.each(ROUTES)('renders %s in the app layout with the navigation', async (_route, mountRoute) => {
		const wrapper = mountRoute()
		await flushPromises()

		expect(wrapper.findAllComponents(AppLayout)).toHaveLength(1)
		expect(wrapper.findAllComponents(AppNavigation)).toHaveLength(1)
		expect(wrapper.find('.app-navigation .app-navigation-toggle').exists()).toBe(true)
	})
})
