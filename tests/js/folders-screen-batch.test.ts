// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FolderNode } from '../../src/logic/folder-hierarchy.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { dialogButton, fakeList, MARK, mountScreen, row_, showAll } from './folders-screen-fixture.ts'
import { installMarkedCatalogue, uninstallMarkedCatalogue, untranslatedText } from './l10n/marked-catalogue.ts'
import { doneRow, row } from './logic/folder-fixtures.ts'

const ROWS = [
	row({ fileId: 1, path: '/Photos/Iceland/Day 1' }),
	doneRow({ fileId: 2, path: '/Photos/Iceland/Day 2' }),
	row({ fileId: 3, path: '/Photos/Finished/A', undecided: 0, picked: 80 }),
	doneRow({ fileId: 4, path: '/Photos/Finished/B' }),
	row({ fileId: 5, path: '/Photos/Fresh/A' }),
	row({ fileId: 6, path: '/Photos/Fresh/B' }),
]

type Screen = ReturnType<typeof mountScreen>

async function screen(): Promise<Screen> {
	const wrapper = mountScreen(fakeList(ROWS))
	await showAll(wrapper)
	return wrapper
}

/** Opens the ⋯ menu of the subtree row named `name`. */
async function openMenu(wrapper: Screen, name: string) {
	await row_(wrapper, name).find(`[aria-label="${MARK}More for ${name}"]`).trigger('click')
	await flushPromises()
}

/** The paths of the nodes a batch event carried. */
function paths(wrapper: Screen, event: 'markAllDone' | 'reopenAll'): string[] {
	return (wrapper.emitted(event) as [FolderNode][] | undefined ?? []).map(([node]) => node.path)
}

describe('FoldersScreen: Mark all done and Reopen all', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		document.body.replaceChildren()
	})

	// spec: FOLDERS-009.10
	it('offers Mark all done in the row of a complete subtree only', async () => {
		const wrapper = await screen()

		const marks = wrapper.findAll('.folder-row__mark-all')
		expect(marks.map((each) => each.attributes('aria-label'))).toEqual([`${MARK}Mark all done: Finished`])
		await marks[0]!.trigger('click')

		expect(paths(wrapper, 'markAllDone')).toEqual(['/Photos/Finished'])
		expect(untranslatedText(wrapper.element)).toEqual([])
	})

	// spec: FOLDERS-008.13, FOLDERS-009.11
	it('marks a subtree with open photos done from its menu and closes the menu', async () => {
		const wrapper = await screen()
		await openMenu(wrapper, 'Iceland')

		dialogButton('Mark all done')!.click()
		await flushPromises()

		expect(paths(wrapper, 'markAllDone')).toEqual(['/Photos/Iceland'])
		expect(document.body.querySelector('[role="dialog"]')).toBeNull()
	})

	// spec: FOLDERS-008.13, FOLDERS-009.13
	it('reopens a subtree with a done folder from its menu and closes the menu', async () => {
		const wrapper = await screen()
		await openMenu(wrapper, 'Iceland')

		dialogButton('Reopen all')!.click()
		await flushPromises()

		expect(paths(wrapper, 'reopenAll')).toEqual(['/Photos/Iceland'])
		expect(document.body.querySelector('[role="dialog"]')).toBeNull()
	})

	// spec: FOLDERS-008.13
	it('disables Reopen all in the menu of a subtree without a done folder', async () => {
		const wrapper = await screen()
		await openMenu(wrapper, 'Fresh')

		expect(dialogButton('Mark all done')!.disabled).toBe(false)
		expect(dialogButton('Reopen all')!.disabled).toBe(true)
	})

	it('culls the subtree in the switch\'s scope from its menu', async () => {
		const wrapper = await screen()
		await openMenu(wrapper, 'Fresh')

		dialogButton('Cull')!.click()
		await flushPromises()

		expect(wrapper.emitted('cull')).toEqual([[{ paths: ['/Photos/Fresh'], subfolders: true }]])
		expect(document.body.querySelector('[role="dialog"]')).toBeNull()
	})
})
