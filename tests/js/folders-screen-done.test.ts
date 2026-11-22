// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { chip, COMPLETE, dialogButton, DONE, fakeList, MARK, mountScreen, OPEN, READ_ONLY, row_ } from './folders-screen-fixture.ts'
import { installMarkedCatalogue, uninstallMarkedCatalogue, untranslatedText } from './l10n/marked-catalogue.ts'
import { doneRow } from './logic/folder-fixtures.ts'

/** Opens the menu of the row named `name`. */
async function openMenu(wrapper: ReturnType<typeof mountScreen>, name: string) {
	await row_(wrapper, name).find(`[aria-label="${MARK}More for ${name}"]`).trigger('click')
	await flushPromises()
}

/** The texts of the open menu's buttons. */
function menuEntries(): string[] {
	return [...document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].map((each) => each.textContent!.trim())
}

describe('FoldersScreen: the done status', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		document.body.replaceChildren()
	})

	// spec: FOLDERS-008.1
	it('offers Mark done in the row of a complete folder only, in place of Cull', async () => {
		const wrapper = mountScreen(fakeList([OPEN, COMPLETE]))

		const marks = wrapper.findAll('.folder-row__mark-done')
		expect(marks.map((each) => each.attributes('aria-label'))).toEqual([`${MARK}Mark done: Done soon`])
		expect(row_(wrapper, 'Done soon').find('.folder-row__cull').exists()).toBe(false)
		await marks[0]!.trigger('click')

		expect(wrapper.emitted('markDone')).toEqual([[COMPLETE]])
		expect(document.body.querySelector('[role="dialog"]')).toBeNull()
		expect(untranslatedText(wrapper.element)).toEqual([])
	})

	// spec: FOLDERS-008.2
	it('marks an open folder done from its menu and closes the menu', async () => {
		const wrapper = mountScreen(fakeList([OPEN]))
		await openMenu(wrapper, 'Trip')
		expect(menuEntries()).not.toContain(`${MARK}Reopen`)

		dialogButton('Mark done')!.click()
		await flushPromises()

		expect(wrapper.emitted('markDone')).toEqual([[OPEN]])
		expect(document.body.querySelector('[role="dialog"]')).toBeNull()
	})

	// spec: FOLDERS-008.4
	it('reopens a done folder from its menu and closes the menu', async () => {
		const wrapper = mountScreen(fakeList([DONE]))
		await chip(wrapper, 'Filter', 'All').trigger('click')
		await openMenu(wrapper, 'Old')
		expect(menuEntries()).not.toContain(`${MARK}Mark done`)

		dialogButton('Reopen')!.click()
		await flushPromises()

		expect(wrapper.emitted('reopen')).toEqual([[DONE]])
		expect(document.body.querySelector('[role="dialog"]')).toBeNull()
	})

	// spec: FOLDERS-008.5
	it('offers neither Mark done nor Reopen for a read-only folder, open or done', async () => {
		const doneReadOnly = doneRow({ fileId: 8, path: '/Photos/Shared done', permissions: 1, photos: 120 })
		const wrapper = mountScreen(fakeList([{ ...READ_ONLY, undecided: 0 }, doneReadOnly]))
		await chip(wrapper, 'Filter', 'All').trigger('click')

		expect(wrapper.find('.folder-row__mark-done').exists()).toBe(false)
		expect(wrapper.find('.folder-row__cull-new').exists()).toBe(false)
		for (const name of ['Shared copy', 'Shared done']) {
			await openMenu(wrapper, name)
			expect(menuEntries()).not.toContain(`${MARK}Mark done`)
			expect(menuEntries()).not.toContain(`${MARK}Reopen`)
			dialogButton('Cancel')!.click()
			await flushPromises()
		}
	})

	// spec: FOLDERS-008.7
	it('shows n new and Cull new on a done folder with new photos, which culls it without subfolders', async () => {
		const grown = doneRow({ fileId: 6, path: '/Photos/Grown', photos: 412, undecided: 12, picked: 400 }, 400)
		const wrapper = mountScreen(fakeList([grown, DONE]))
		await chip(wrapper, 'Filter', 'All').trigger('click')

		expect(row_(wrapper, 'Grown').text()).toContain(`${MARK}12 new`)
		const culls = wrapper.findAll('.folder-row__cull-new')
		expect(culls.map((each) => each.attributes('aria-label'))).toEqual([`${MARK}Cull new in Grown`, `${MARK}Cull new in Old`])
		await culls[0]!.trigger('click')

		expect(wrapper.emitted('cullNew')).toEqual([[{ paths: ['/Photos/Grown'], subfolders: false }]])
	})

	// spec: FOLDERS-008.7
	it('offers no Cull new on a done folder without new photos', async () => {
		const wrapper = mountScreen(fakeList([doneRow({ fileId: 6, path: '/Photos/Same', photos: 100 }, 100)]))
		await chip(wrapper, 'Filter', 'All').trigger('click')

		expect(wrapper.find('.folder-row__cull-new').exists()).toBe(false)
	})

	// spec: FOLDERS-008.3
	it('puts the focus on the row\'s More once a done change asks for it, else on the list', async () => {
		const wrapper = mountScreen(fakeList([OPEN, COMPLETE]))

		await wrapper.setProps({ focusRow: { fileId: COMPLETE.fileId } })
		await nextTick()
		expect(document.activeElement?.getAttribute('aria-label')).toBe(`${MARK}More for Done soon`)

		await wrapper.setProps({ focusRow: { fileId: 99 } })
		await nextTick()
		expect(document.activeElement).toBe(wrapper.element)
	})
})
