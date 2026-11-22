// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { LibraryScanning } from '../../src/api.ts'
import type { FolderList } from '../../src/folders.ts'
import type { FolderRow } from '../../src/logic/folder-row.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import FoldersScreen from '../../src/components/FoldersScreen.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from './l10n/marked-catalogue.ts'
import { doneRow, row } from './logic/folder-fixtures.ts'

/** A plural form is marked twice: the library translates the chosen form again. */
const MARK = TRANSLATED_MARK
/** Noon UTC on 20 November 2026, in Unix seconds. */
const NOW = Date.UTC(2026, 10, 20, 12) / 1000

const OPEN = row({ fileId: 1, path: '/Photos/2019/Trip', undecided: 63, picked: 30, rejected: 7, bursts: 18, oldest: Date.UTC(2019, 3, 1) / 1000 })
const COMPLETE = row({ fileId: 2, path: '/Photos/Done soon', undecided: 0, picked: 80 })
const DONE = doneRow({ fileId: 3, path: '/Photos/Old', photos: 104, bytes: 6e8 }, 100)
const READ_ONLY = row({ fileId: 4, path: '/Photos/Shared copy', permissions: 1 })
const PHONE = row({ fileId: 5, root: '/Phone', path: '/Phone/Camera' })

function fakeList(rows: readonly FolderRow[], state: FolderList['state']['value'] = 'ready', updating: LibraryScanning | null = null) {
	return { rows: shallowRef(rows), state: ref(state), updating: ref(updating), shown: ref(true), refresh: vi.fn(async () => undefined) } satisfies FolderList
}

function mountScreen(list: FolderList, roots: readonly string[] = ['/Photos']) {
	return mount(FoldersScreen, { props: { folders: list, roots, now: () => NOW }, attachTo: document.body })
}

type Screen = ReturnType<typeof mountScreen>

/** The folder names of the rows, in order. */
function names(wrapper: Screen): string[] {
	return wrapper.findAll('.folder-row__name').map((each) => each.text())
}

function row_(wrapper: Screen, name: string) {
	return wrapper.findAll('.folder-row').find((each) => each.find('.folder-row__name').text() === name)!
}

function chip(wrapper: Screen, group: string, label: string) {
	return wrapper.find(`[role="group"][aria-label="${MARK}${group}"]`).findAll('button').find((each) => each.text().startsWith(label) || each.text().startsWith(`${MARK}${label}`))!
}

/** The open dialog's buttons by their text. */
function dialogButton(label: string): HTMLButtonElement | undefined {
	return [...document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((each) => each.textContent?.trim() === `${MARK}${label}`)
}

describe('FoldersScreen', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		document.body.replaceChildren()
	})

	// spec: FOLDERS-007.11
	it('shows each row\'s state and offers Cull only on the open one', () => {
		const wrapper = mountScreen(fakeList([OPEN, COMPLETE, DONE, READ_ONLY]), ['/Photos'])
		const chosen = chip(wrapper, 'Filter', 'All')
		void chosen.trigger('click')

		return nextTick().then(() => {
			expect(row_(wrapper, 'Trip').text()).toContain(`${MARK}63 % undecided · ${MARK}18 in bursts · 500 MB · 2019`)
			expect(row_(wrapper, 'Trip').find('.folder-row__parent').text()).toBe('/Photos/2019')
			expect(row_(wrapper, 'Trip').text()).toContain(`${MARK}100 photos`)
			expect(row_(wrapper, 'Trip').text()).toContain(`${MARK}63 undecided`)
			expect(row_(wrapper, 'Trip').find('.folder-row__split').attributes('aria-label')).toBe(`${MARK}30 picked · 63 undecided · 7 rejected`)
			expect(row_(wrapper, 'Done soon').text()).toContain(`${MARK}Complete · not marked done`)
			expect(row_(wrapper, 'Old').text()).toContain(`${MARK}Done 2026-11-02 · by Andy`)
			expect(row_(wrapper, 'Old').text()).toContain(`${MARK}4 new`)
			expect(row_(wrapper, 'Shared copy').text()).toContain(`${MARK}Read-only`)
			const culls = wrapper.findAll('.folder-row__cull')
			expect(culls.map((each) => each.attributes('aria-label'))).toEqual([`${MARK}Cull Trip`])
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

		expect(card().find('.folders-progress__name').text()).toBe(`${MARK}Library`)
		expect(card().text()).toContain(`${MARK}${MARK}2 roots · ${MARK}${MARK}3 folders · ${MARK}${MARK}304 photos`)
		expect(card().text()).toContain(`${MARK}34 % of photos in done folders`)
		expect(card().text()).toContain(`${MARK}1 of 3 folders done`)
		expect(card().text()).toContain(`${MARK}1 this month`)
		expect(card().findAll('.folders-progress__root')).toHaveLength(2)

		await chip(wrapper, 'Library root', '/Phone').trigger('click')

		expect(card().find('.folders-progress__name').text()).toBe('/Phone')
		expect(card().text()).toContain(`${MARK}${MARK}1 folder · ${MARK}${MARK}100 photos`)
		expect(card().findAll('.folders-progress__root')).toHaveLength(0)
		expect(names(wrapper)).toEqual(['Camera'])
	})

	// spec: FOLDERS-007.10
	it('filters by the chips with their counts and sorts by the menu', async () => {
		const big = row({ fileId: 6, path: '/Photos/Big', bytes: 9e9, undecided: 10, picked: 90, rejected: 0 })
		const wrapper = mountScreen(fakeList([OPEN, DONE, big, PHONE]), ['/Photos', '/Phone'])

		expect(chip(wrapper, 'Filter', 'Suggested').text()).toContain('3')
		expect(chip(wrapper, 'Filter', 'New photos').text()).toContain('1')
		expect(chip(wrapper, 'Filter', 'All').text()).toContain('4')
		expect(chip(wrapper, 'Filter', 'Suggested').attributes('aria-pressed')).toBe('true')
		expect(wrapper.findAll('.folders-screen__root-heading').map((each) => each.find('[translate="no"]').text())).toEqual(['/Photos', '/Phone'])
		expect(names(wrapper)).toEqual(['Trip', 'Big', 'Camera'])

		await chip(wrapper, 'Filter', 'New photos').trigger('click')
		expect(names(wrapper)).toEqual(['Old'])

		await chip(wrapper, 'Filter', 'All').trigger('click')
		await wrapper.find('select').setValue('largest')
		expect(names(wrapper)).toEqual(['Big', 'Old', 'Trip', 'Camera'])

		await wrapper.find('select').setValue('oldest')
		expect(wrapper.findAll('.folders-screen__year').map((each) => each.text())).toEqual(['2019', '2020', '2020'])
		expect(untranslatedText(wrapper.element)).toEqual([])
	})

	// spec: FOLDERS-007.10
	it('shows no root chips and no root headings with one root', () => {
		const wrapper = mountScreen(fakeList([OPEN]))

		expect(wrapper.find(`[role="group"][aria-label="${MARK}Library root"]`).exists()).toBe(false)
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
		await nextTick()

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
