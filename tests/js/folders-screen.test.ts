// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { chip, COMPLETE, crumbs, dialogButton, DONE, fakeList, MARK, mountScreen, names, OPEN, PHONE, READ_ONLY, row_, showSuggested } from './folders-screen-fixture.ts'
import { installMarkedCatalogue, uninstallMarkedCatalogue, untranslatedText } from './l10n/marked-catalogue.ts'
import { row } from './logic/folder-fixtures.ts'

describe('FoldersScreen', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		document.body.replaceChildren()
	})

	// spec: FOLDERS-007.18
	it('shows each row\'s previews as its cover and the icon for a folder without', async () => {
		const previewed = row({ fileId: 8, path: '/Photos/Alps', previews: [{ fileId: 31, mtime: 5 }, { fileId: 32, mtime: 6 }, { fileId: 33, mtime: 7 }] })
		const wrapper = mountScreen(fakeList([previewed, OPEN]))
		await showSuggested(wrapper)

		expect(row_(wrapper, 'Alps').findAll('.folder-cover img')).toHaveLength(3)
		expect(row_(wrapper, 'Alps').find('.folder-cover img').attributes('src')).toContain('/images/31?size=256&v=5')
		expect(row_(wrapper, 'Trip').find('.folder-cover img').exists()).toBe(false)
		expect(row_(wrapper, 'Trip').find('.folder-cover__icon').exists()).toBe(true)
	})

	// spec: FOLDERS-007.11
	it('shows each row\'s state and offers Cull only on the open one', () => {
		const wrapper = mountScreen(fakeList([OPEN, COMPLETE, DONE, READ_ONLY]), ['/Photos'])
		const chosen = chip(wrapper, 'Filter', 'All')
		void chosen.trigger('click')

		return nextTick().then(() => {
			const trip = row_(wrapper, '2019 / Trip')
			expect(trip.text()).toContain(`${MARK}63 % undecided · ${MARK}18 in bursts · 500 MB · 2019`)
			expect(trip.find('.folder-row__parent').exists()).toBe(false)
			expect(trip.text()).toContain(`${MARK}100 photos`)
			expect(trip.text()).toContain(`${MARK}63 undecided`)
			expect(trip.find('.folder-row__split').attributes('aria-label')).toBe(`${MARK}30 picked · 63 undecided · 7 rejected`)
			expect(row_(wrapper, 'Done soon').text()).toContain(`${MARK}Complete · not marked done`)
			expect(row_(wrapper, 'Old').text()).toContain(`${MARK}Done 2026-11-02 · by Andy`)
			expect(row_(wrapper, 'Old').text()).toContain(`${MARK}4 new`)
			expect(row_(wrapper, 'Shared copy').text()).toContain(`${MARK}Read-only`)
			const culls = wrapper.findAll('.folder-row__cull')
			expect(culls.map((each) => each.attributes('aria-label'))).toEqual([`${MARK}Cull 2019 / Trip`])
			expect(untranslatedText(wrapper.element)).toEqual([])
		})
	})

	// spec: FOLDERS-007.13
	it('culls the folder without its subfolders', async () => {
		const wrapper = mountScreen(fakeList([OPEN]))

		await wrapper.find('.folder-row__cull').trigger('click')

		expect(wrapper.emitted('cull')).toEqual([[{ paths: ['/Photos/2019/Trip'], subfolders: false }]])
	})

	// spec: FOLDERS-007.12
	it('opens the row\'s menu with Cull, Cull with subfolders and Open in Files, and closes it by Cancel', async () => {
		const wrapper = mountScreen(fakeList([OPEN]))
		await showSuggested(wrapper)

		await row_(wrapper, 'Trip').find(`[aria-label="${MARK}More for Trip"]`).trigger('click')
		await flushPromises()
		expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('Trip')
		const files = [...document.body.querySelectorAll<HTMLAnchorElement>('[role="dialog"] a')].find((each) => each.textContent?.includes('Open in Files'))
		expect(files?.getAttribute('href')).toContain('/apps/files/?dir=%2FPhotos%2F2019%2FTrip')
		dialogButton('Cull with subfolders')!.click()
		await flushPromises()
		expect(wrapper.emitted('cull')).toEqual([[{ paths: ['/Photos/2019/Trip'], subfolders: true }]])
		expect(document.body.querySelector('[role="dialog"]')).toBeNull()

		await row_(wrapper, 'Trip').find(`[aria-label="${MARK}More for Trip"]`).trigger('click')
		await flushPromises()
		dialogButton('Cull')!.click()
		await flushPromises()
		expect(wrapper.emitted('cull')?.[1]).toEqual([{ paths: ['/Photos/2019/Trip'], subfolders: false }])

		await row_(wrapper, 'Trip').find(`[aria-label="${MARK}More for Trip"]`).trigger('click')
		await flushPromises()
		dialogButton('Cancel')!.click()
		await flushPromises()
		expect(document.body.querySelector('[role="dialog"]')).toBeNull()
		expect(wrapper.emitted('cull')).toHaveLength(2)
	})

	// spec: FOLDERS-007.12
	it('disables both Cull entries of a read-only folder\'s menu', async () => {
		const wrapper = mountScreen(fakeList([READ_ONLY]))
		await chip(wrapper, 'Filter', 'All').trigger('click')

		await row_(wrapper, 'Shared copy').find(`[aria-label="${MARK}More for Shared copy"]`).trigger('click')
		await flushPromises()

		expect(dialogButton('Cull')!.disabled).toBe(true)
		expect(dialogButton('Cull with subfolders')!.disabled).toBe(true)
	})

	// spec: FOLDERS-007.9
	it('shows the library\'s progress with a bar per root, and one root\'s alone', async () => {
		const wrapper = mountScreen(fakeList([OPEN, DONE, PHONE]), ['/Photos', '/Phone'])
		const card = () => wrapper.find('.folders-progress')
		const title = () => wrapper.find('.page-title-row')

		expect(title().find('.page-title-row__title').text()).toBe(`${MARK}Library`)
		expect(card().find('.folders-progress__name').exists()).toBe(false)
		expect(title().text()).toContain(`${MARK}${MARK}2 roots · ${MARK}${MARK}3 folders · ${MARK}${MARK}304 photos`)
		expect(card().text()).toContain(`${MARK}34 % of photos in done folders`)
		expect(card().text()).toContain(`${MARK}1 of 3 folders done`)
		expect(card().text()).toContain(`${MARK}1 this month`)
		expect(card().findAll('.folders-progress__root')).toHaveLength(2)

		await chip(wrapper, 'Filter', 'All').trigger('click')
		await wrapper.find(`[aria-label="${MARK}Open /Phone"]`).trigger('click')
		await chip(wrapper, 'Filter', 'Suggested').trigger('click')

		expect(title().find('.page-title-row__title').text()).toBe('/Phone')
		expect(title().text()).toContain(`${MARK}${MARK}1 folder · ${MARK}${MARK}100 photos`)
		expect(card().findAll('.folders-progress__root')).toHaveLength(0)
		expect(names(wrapper)).toEqual(['Camera'])
	})

	// spec: FOLDERS-007.10
	it('filters by the chips with their counts and sorts by the menu', async () => {
		const big = row({ fileId: 6, path: '/Photos/Big', bytes: 9e9, undecided: 10, picked: 90, rejected: 0 })
		const wrapper = mountScreen(fakeList([OPEN, DONE, big, PHONE]), ['/Photos', '/Phone'])

		expect(chip(wrapper, 'Filter', 'Suggested').text()).toContain('3')
		expect(chip(wrapper, 'Filter', 'New photos').text()).toContain('1')
		expect(chip(wrapper, 'Filter', 'All').text()).toContain('2')
		const chips = wrapper.find(`[role="group"][aria-label="${MARK}Filter"]`).findAll('button')
		expect(chips[0]!.attributes('aria-pressed')).toBe('true')
		expect(chips[0]!.text()).toContain('All')
		expect(names(wrapper)).toEqual(['/Photos', '/Phone'])

		await showSuggested(wrapper)
		expect(wrapper.findAll('.folders-screen__root-heading').map((each) => each.find('[translate="no"]').text())).toEqual(['/Photos', '/Phone'])
		expect(names(wrapper)).toEqual(['Trip', 'Big', 'Camera'])

		await chip(wrapper, 'Filter', 'New photos').trigger('click')
		expect(names(wrapper)).toEqual(['Old'])

		await chip(wrapper, 'Filter', 'All').trigger('click')
		expect(names(wrapper)).toEqual(['/Photos', '/Phone'])

		await chip(wrapper, 'Filter', 'Suggested').trigger('click')
		await wrapper.find('select').setValue('largest')
		expect(names(wrapper)).toEqual(['Big', 'Trip', 'Camera'])

		await wrapper.find('select').setValue('oldest')
		expect(wrapper.findAll('.folders-screen__year').map((each) => each.text())).toEqual(['2019', '2020', '2020'])
		expect(untranslatedText(wrapper.element)).toEqual([])
	})

	// spec: FOLDERS-007.10
	it('shows no root chips and no root headings with one root', () => {
		const wrapper = mountScreen(fakeList([OPEN]))

		expect(wrapper.find(`[role="group"][aria-label="${MARK}Library root"]`).exists()).toBe(false)
		expect(crumbs(wrapper)).toEqual(['Photos'])
		expect(wrapper.find('.folders-screen__root-heading').exists()).toBe(false)
		expect(wrapper.find('.folders-progress__root').exists()).toBe(false)
	})

	// spec: FOLDERS-007.7
	it('shows how many folders are being updated, with a bar', () => {
		const wrapper = mountScreen(fakeList([OPEN], 'ready', { done: 7, total: 12 }))

		const strip = wrapper.find('.folders-screen__updating')
		expect(strip.text()).toContain(`${MARK}Updating 5 folders`)
		expect(strip.find('[role="progressbar"]').attributes()).toMatchObject({ 'aria-valuenow': '7', 'aria-valuemax': '12' })
	})

	// spec: FOLDERS-007.8
	it('says when the folders could not be read and reads them again on Try again', async () => {
		const list = fakeList([], 'failed')
		const wrapper = mountScreen(list)

		expect(wrapper.text()).toContain(`${MARK}Could not load the folders.`)
		await wrapper.findAll('button').find((each) => each.text() === `${MARK}Try again`)!.trigger('click')

		expect(list.refresh).toHaveBeenCalledOnce()
		expect(untranslatedText(wrapper.element)).toEqual([])
	})

	it('says while it reads the folders, and when none is left by the filter', async () => {
		const list = fakeList([], 'loading')
		const wrapper = mountScreen(list)
		expect(wrapper.text()).toContain(`${MARK}Loading the folders…`)

		list.state.value = 'ready'
		list.rows.value = [DONE]
		await showSuggested(wrapper)

		expect(wrapper.text()).toContain(`${MARK}No folders here.`)
	})

	// spec: FOLDERS-007.14
	it('keeps its scroll while a cull hides it', async () => {
		const list = fakeList([OPEN])
		const wrapper = mountScreen(list)
		const scroller = wrapper.element as HTMLElement
		scroller.scrollTop = 300

		list.shown.value = false
		await nextTick()
		scroller.scrollTop = 0
		list.shown.value = true
		await nextTick()
		await nextTick()

		expect(scroller.scrollTop).toBe(300)
	})
})
