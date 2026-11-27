// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { generateUrl } from '@nextcloud/router'
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
const CULL_URL = generateUrl('/apps/honeycomb/')

function mountLayout(positions: unknown = [POSITION], wide = false) {
	const fake = fakePageNavigation(positions)
	const wrapper = mount(PageLayout, { props: { page: 'statistics', seams: fake.seams, wide }, slots: { default: '<p class="page-body">Body</p>' } })
	return { wrapper, visited: fake.visited, navigation: () => wrapper.findComponent(AppNavigation) }
}

enableAutoUnmount(afterEach)

describe('PageLayout', () => {
	// spec: APP-001.25
	it('shows the page inside the one app layout, the navigation beside it with the page marked', async () => {
		const { wrapper, navigation } = mountLayout()
		await flushPromises()

		expect(wrapper.findComponent(AppLayout).exists()).toBe(true)
		expect(navigation().props('page')).toBe('statistics')
		expect(wrapper.find('.app-content .page-body').text()).toBe('Body')
	})

	// spec: STATS-001.73
	it('puts the page\'s actions into the title row, after the title', async () => {
		const fake = fakePageNavigation()
		const wrapper = mount(PageLayout, { props: { page: 'statistics', seams: fake.seams }, slots: { actions: '<a class="page-back" href="/back">Back</a>' } })
		await flushPromises()
		const row = wrapper.find('.page-title-row')

		expect(row.find('h2').text()).toBe('Statistics')
		expect(row.element.lastElementChild!.querySelector('.page-back')?.textContent).toBe('Back')
	})

	it('leaves the title row without actions when the page has none', async () => {
		const { wrapper } = mountLayout()
		await flushPromises()

		expect(wrapper.find('.page-title-row__actions').exists()).toBe(false)
	})

	// spec: STATS-001.73
	it.each([
		[false, false],
		[true, true],
	])('gives the title row the shared page width when wide is %s', async (wide, shared) => {
		const { wrapper } = mountLayout([POSITION], wide)
		await flushPromises()

		expect(wrapper.find('.page-title-row').classes('page-title-row--page-width')).toBe(shared)
	})

	// spec: APP-001.26
	it('lists the stored recent folder sets and opens one at its position on the cull page', async () => {
		const { navigation, visited } = mountLayout()
		await flushPromises()

		expect(navigation().props('items')).toEqual([{ position: POSITION, current: false, decided: 3, total: 40 }])
		navigation().vm.$emit('openRecent', POSITION)

		expect(visited).toEqual([CULL_URL + locationHash(SET, 9)])
	})

	// spec: APP-001.26
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
