// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '../../../src/components/AppLayout.vue'
import AppNavigation from '../../../src/components/AppNavigation.vue'
import PageLayout from '../../../src/components/PageLayout.vue'
import { locationHash, targetHash } from '../../../src/logic/cull-location.ts'
import { logger } from '../../../src/shared/logger.ts'
import { fakePageNavigation } from '../page-navigation.ts'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

const SET = { paths: ['/Trip'], subfolders: false }
const POSITION = { folderSet: SET, fileId: 9, decided: 3, total: 40 }
const CULL_URL = '/index.php/apps/honeycomb/'

function mountLayout(positions: unknown = [POSITION]) {
	const fake = fakePageNavigation(positions)
	const wrapper = mount(PageLayout, { props: { page: 'statistics', seams: fake.seams }, slots: { default: '<p class="page-body">Body</p>' } })
	return { wrapper, visited: fake.visited, navigation: () => wrapper.findComponent(AppNavigation) }
}

enableAutoUnmount(afterEach)

describe('PageLayout', () => {
	// spec: APP-001.23
	it('shows the page inside the one app layout, the navigation beside it with the page marked', async () => {
		const { wrapper, navigation } = mountLayout()
		await flushPromises()

		expect(wrapper.findComponent(AppLayout).exists()).toBe(true)
		expect(navigation().props('page')).toBe('statistics')
		expect(wrapper.find('.app-content .page-body').text()).toBe('Body')
	})

	// spec: APP-001.24
	it('lists the stored recent folder sets and opens one at its position on the cull page', async () => {
		const { navigation, visited } = mountLayout()
		await flushPromises()

		expect(navigation().props('items')).toEqual([{ position: POSITION, current: false, decided: 3, total: 40 }])
		navigation().vm.$emit('openRecent', POSITION)

		expect(visited).toEqual([CULL_URL + locationHash(SET, 9)])
	})

	// spec: APP-001.24
	it.each([
		['openFolders', ''],
		['chooseFolders', targetHash('folder-picker')],
		['openSettings', targetHash('settings')],
	] as const)('opens the cull page from %s', async (event, hash) => {
		const { navigation, visited } = mountLayout()

		navigation().vm.$emit(event)

		expect(visited).toEqual([CULL_URL + hash])
	})

	it('logs a failed read of the recent folder sets and lists none', async () => {
		const error = new Error('offline')
		const fake = fakePageNavigation()
		const wrapper = mount(PageLayout, { props: { page: 'similarity', seams: { ...fake.seams, loadPositions: async () => Promise.reject(error) } } })
		await flushPromises()

		expect(wrapper.findComponent(AppNavigation).props('items')).toEqual([])
		expect(logger.error).toHaveBeenCalledWith('Could not read the recent folder sets', { error })
	})
})
