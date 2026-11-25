// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fakeList, MARK, mountScreen, row_, showAll } from './folders-screen-fixture.ts'
import { installMarkedCatalogue, uninstallMarkedCatalogue, untranslatedText } from './l10n/marked-catalogue.ts'
import { doneRow, row } from './logic/folder-fixtures.ts'

const shot = (fileId: number) => ({ fileId, mtime: fileId })
const SARDINIA = row({ fileId: 20, path: '/Photos/2023/Sardinia', photos: 3, undecided: 3, picked: 0, rejected: 0, previews: [shot(201)] })
const DRONE = doneRow({ fileId: 21, path: '/Photos/2023/Sardinia/Drone', photos: 14, picked: 14 }, 2)
const CORSICA = doneRow({ fileId: 22, path: '/Photos/2023/Corsica/Beach', photos: 7, picked: 7 }, 7)
const ROWS = [SARDINIA, DRONE, CORSICA, row({ fileId: 23, path: '/Photos/2023/Corsica/Port', previews: [shot(231)] })]

async function openYear(wrapper: ReturnType<typeof mountScreen>) {
	await showAll(wrapper)
	await wrapper.find(`[aria-label="${MARK}Open 2023"]`).trigger('click')
}

describe('FoldersScreen subtree rows', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		document.body.replaceChildren()
	})

	// spec: FOLDERS-009.20
	it('covers a row with previews of its scope: the subtree with the switch on, its own folder with it off', async () => {
		const wrapper = mountScreen(fakeList(ROWS))
		await openYear(wrapper)
		const sources = (name: string) => row_(wrapper, name).findAll('.folder-cover img').map((image) => image.attributes('src') ?? '')

		expect(sources('Corsica')).toHaveLength(1)
		expect(sources('Corsica')[0]).toContain('231')
		expect(sources('Sardinia')).toHaveLength(1)
		await wrapper.setProps({ includeSubfolders: false })
		expect(sources('Sardinia')[0]).toContain('201')
		expect(row_(wrapper, 'Corsica').find('.folder-cover--none').exists()).toBe(true)
	})

	// spec: FOLDERS-009.15
	it('shows n new and Cull new on a row whose subtree has new photos, which culls the subtree with the switch\'s scope', async () => {
		const wrapper = mountScreen(fakeList(ROWS))
		await openYear(wrapper)

		expect(row_(wrapper, 'Sardinia').text()).toContain(`${MARK}12 new`)
		expect(row_(wrapper, 'Corsica').find('.folder-row__cull-new').exists()).toBe(false)
		await row_(wrapper, 'Sardinia').find('.folder-row__cull-new').trigger('click')
		await wrapper.setProps({ includeSubfolders: false })
		expect(row_(wrapper, 'Sardinia').find('.folder-row__cull-new').exists()).toBe(false)

		expect(wrapper.emitted('cullNew')).toEqual([[{ paths: ['/Photos/2023/Sardinia'], subfolders: true }]])
		expect(untranslatedText(wrapper.element)).toEqual([])
	})

	// spec: FOLDERS-009.15
	it('with the switch off shows the own folder\'s new photos and culls them without subfolders', async () => {
		const grown = doneRow({ fileId: 40, path: '/Photos/2023/Grown', photos: 15, picked: 10, undecided: 5 }, 10)
		const below = row({ fileId: 41, path: '/Photos/2023/Grown/Extra' })
		const wrapper = mountScreen(fakeList([grown, below, row({ fileId: 42, path: '/Photos/2023/Other' })]), ['/Photos'], null, false)
		await openYear(wrapper)

		expect(row_(wrapper, 'Grown').text()).toContain(`${MARK}5 new`)
		await row_(wrapper, 'Grown').find('.folder-row__cull-new').trigger('click')

		expect(wrapper.emitted('cullNew')).toEqual([[{ paths: ['/Photos/2023/Grown'], subfolders: false }]])
	})

	// spec: FOLDERS-009.21
	it('adds the large-subtree line to the level card above 20,000 photos, whatever the switch says, and keeps Cull enabled', async () => {
		const big = row({ fileId: 30, path: '/Photos/Big/a', photos: 20_001, undecided: 20_001, picked: 0, rejected: 0 })
		const wrapper = mountScreen(fakeList([big, row({ fileId: 31, path: '/Photos/Big/b' })]), ['/Photos'], null, false)
		await showAll(wrapper)
		await wrapper.find(`[aria-label="${MARK}Open Big"]`).trigger('click')
		const card = () => wrapper.find('.folder-level-card')

		expect(card().text()).toContain(`${MARK}A large subtree: loading it takes a while.`)
		await wrapper.setProps({ includeSubfolders: true })
		expect(card().text()).toContain(`${MARK}A large subtree: loading it takes a while.`)
		expect(card().find('button').attributes('disabled')).toBeUndefined()
	})

	it('adds no line to the level card of a small subtree', async () => {
		const wrapper = mountScreen(fakeList(ROWS))
		await openYear(wrapper)

		expect(wrapper.find('.folder-level-card').text()).not.toContain('large subtree')
	})
})
