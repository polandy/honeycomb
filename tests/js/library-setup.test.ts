// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FolderTree from '../../src/components/FolderTree.vue'
import LibrarySetup from '../../src/components/LibrarySetup.vue'
import { logger } from '../../src/logger.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from './l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK

function mountSetup(check: (root: string) => Promise<boolean> = async () => true) {
	return mount(LibrarySetup, { props: { listFolders: async () => [], check }, global: { stubs: { FolderTree: true } } })
}

/** Chooses the folder in the tree and presses *Add as root*. */
async function add(wrapper: ReturnType<typeof mountSetup>, path: string) {
	wrapper.findComponent(FolderTree).vm.$emit('toggle', path)
	await flushPromises()
	await button(wrapper, 'Add as root').trigger('click')
	await flushPromises()
}

function button(wrapper: ReturnType<typeof mountSetup>, label: string) {
	return wrapper.findAll('button').find((each) => each.text() === `${MARK}${label}` || each.attributes('aria-label') === `${MARK}${label}`)!
}

/** The listed roots. */
function roots(wrapper: ReturnType<typeof mountSetup>): string[] {
	return wrapper.findAll('.library-roots__root-name').map((each) => each.text())
}

describe('LibrarySetup', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: FOLDERS-007.2
	it('asks where the library is, with a tree that chooses one folder and nothing to show yet', () => {
		const wrapper = mountSetup()

		expect(wrapper.find('h2').text()).toBe(`${MARK}Where is your library?`)
		expect(wrapper.findComponent(FolderTree).props()).toMatchObject({ ticked: [], single: true })
		expect(wrapper.text()).toContain(`${MARK}No root chosen yet.`)
		expect(button(wrapper, 'Add as root').attributes('disabled')).toBeDefined()
		expect(button(wrapper, 'Show folders').attributes('disabled')).toBeDefined()
		expect(untranslatedText(wrapper.element)).toEqual([])
	})

	// spec: FOLDERS-007.2
	it('says what honeycomb does to the files, with an example path and a link to the privacy page', () => {
		const wrapper = mountSetup()

		expect(wrapper.text()).toContain('can be undone; deleting only moves files to the Nextcloud trash bin')
		expect(wrapper.text()).toContain('XMP sidecar')
		expect(wrapper.text()).toContain('/Photos/2026')
		const link = wrapper.find('a')
		expect(link.text()).toBe(`${MARK}Your files and privacy`)
		expect(link.attributes('href')).toBe('https://github.com/polandy/honeycomb/blob/main/docs/user/your-files-and-privacy.md')
		expect(link.attributes('target')).toBe('_blank')
		expect(link.attributes('rel')).toBe('noopener noreferrer')
	})

	// spec: FOLDERS-007.3
	it('adds the chosen folder as a root and removes it again', async () => {
		const wrapper = mountSetup()

		await add(wrapper, '/Photos')
		expect(roots(wrapper)).toEqual(['/Photos'])
		expect(wrapper.findComponent(FolderTree).props('ticked')).toEqual([])
		expect(button(wrapper, 'Show folders').attributes('disabled')).toBeUndefined()
		expect(untranslatedText(wrapper.element)).toEqual([])

		await button(wrapper, 'Remove /Photos').trigger('click')
		expect(roots(wrapper)).toEqual([])
		expect(button(wrapper, 'Show folders').attributes('disabled')).toBeDefined()
	})

	// spec: FOLDERS-007.3
	it('ticks the chosen folder and unticks it on a second press', async () => {
		const wrapper = mountSetup()
		wrapper.findComponent(FolderTree).vm.$emit('toggle', '/Photos')
		await flushPromises()
		expect(wrapper.findComponent(FolderTree).props('ticked')).toEqual(['/Photos'])

		wrapper.findComponent(FolderTree).vm.$emit('toggle', '/Photos')
		await flushPromises()
		expect(wrapper.findComponent(FolderTree).props('ticked')).toEqual([])
	})

	// spec: FOLDERS-007.4
	it('refuses a folder inside a root, or holding one, or one already listed, or the home folder', async () => {
		const wrapper = mountSetup()
		await add(wrapper, '/Media/Photos')

		await add(wrapper, '/Media/Photos/2019')
		expect(wrapper.find('[role="alert"]').text()).toBe(`${MARK}/Media/Photos/2019 lies inside the root /Media/Photos.`)
		await add(wrapper, '/Media/Photos')
		expect(wrapper.find('[role="alert"]').text()).toBe(`${MARK}/Media/Photos is already a root.`)
		await add(wrapper, '/Media')
		expect(wrapper.find('[role="alert"]').text()).toBe(`${MARK}/Media holds the root /Media/Photos; remove that one first.`)
		await add(wrapper, '/')
		expect(wrapper.find('[role="alert"]').text()).toBe(`${MARK}Your home folder cannot be a root; choose a folder in it.`)
		expect(roots(wrapper)).toEqual(['/Media/Photos'])

		await add(wrapper, '/Phone')
		expect(wrapper.find('[role="alert"]').exists()).toBe(false)
		expect(roots(wrapper)).toEqual(['/Media/Photos', '/Phone'])
	})

	// spec: FOLDERS-007.4
	it('refuses a folder the server does not take as a root: a share, group folder or external storage', async () => {
		const check = vi.fn(async (root: string) => root !== '/Shared')
		const wrapper = mountSetup(check)

		await add(wrapper, '/Shared')

		expect(check).toHaveBeenCalledWith('/Shared')
		expect(wrapper.find('[role="alert"]').text()).toBe(`${MARK}/Shared is not in your own files: shares, group folders and external storage cannot be roots.`)
		expect(roots(wrapper)).toEqual([])
	})

	// spec: FOLDERS-007.4
	it('says when it could not check a folder', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const wrapper = mountSetup(() => Promise.reject(new Error('down')))

		await add(wrapper, '/Photos')

		expect(error).toHaveBeenCalledOnce()
		expect(wrapper.find('[role="alert"]').text()).toBe(`${MARK}Could not check /Photos; try again.`)
		expect(roots(wrapper)).toEqual([])
	})

	// spec: FOLDERS-007.5
	it('saves the roots in their order on Show folders', async () => {
		const wrapper = mountSetup()
		await add(wrapper, '/Photos')
		await add(wrapper, '/Phone')

		await button(wrapper, 'Show folders').trigger('click')

		expect(wrapper.emitted('save')).toEqual([[['/Photos', '/Phone']]])
	})
})
