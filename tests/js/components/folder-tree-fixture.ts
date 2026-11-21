// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { VueWrapper } from '@vue/test-utils'
import type { Folder } from '../../../src/api.ts'

import { flushPromises, mount } from '@vue/test-utils'
import FolderTree from '../../../src/components/FolderTree.vue'

export const FOLDERS: Record<string, Folder[]> = {
	'': [
		{ name: 'Photos', path: '/Photos', hasSubfolders: true, pictures: 3, picturesBelow: 1203, picturesBelowApproximate: false, orphanedSidecars: 0, orphanedSidecarsBelow: 0 },
		{ name: '.hidden', path: '/.hidden', hasSubfolders: false, pictures: null, picturesBelow: null, picturesBelowApproximate: false, orphanedSidecars: null, orphanedSidecarsBelow: null },
		{ name: 'Day 10', path: '/Day 10', hasSubfolders: false, pictures: 0, picturesBelow: 0, picturesBelowApproximate: false, orphanedSidecars: 0, orphanedSidecarsBelow: 0 },
		{ name: 'Day 9', path: '/Day 9', hasSubfolders: false, pictures: 1, picturesBelow: 1, picturesBelowApproximate: false, orphanedSidecars: 0, orphanedSidecarsBelow: 0 },
	],
	'/Photos': [{ name: '2026', path: '/Photos/2026', hasSubfolders: true, pictures: 0, picturesBelow: 0, picturesBelowApproximate: false, orphanedSidecars: 0, orphanedSidecarsBelow: 0 }, { name: '2025', path: '/Photos/2025', hasSubfolders: false, pictures: 1200, picturesBelow: 1200, picturesBelowApproximate: false, orphanedSidecars: 0, orphanedSidecarsBelow: 0 }],
	// The server saw a subfolder that is gone by the time the folder opens.
	'/Photos/2026': [],
}

/** A folder endpoint over FOLDERS whose answers the test settles per path. */
export function fakeFolders(folders = FOLDERS) {
	const pending: { path: string, settle: () => void, fail: () => void }[] = []
	const listFolders = (path: string) => new Promise<Folder[]>((resolve, reject) => {
		pending.push({ path, settle: () => resolve(folders[path]!), fail: () => reject(new Error(`no ${path}`)) })
	})
	/** Answers the oldest request for `path`. */
	const answer = async (path: string, outcome: 'settle' | 'fail' = 'settle') => {
		const index = pending.findIndex((each) => each.path === path)
		pending.splice(index, 1)[0]![outcome]()
		await flushPromises()
	}
	return { pending, listFolders, answer }
}

export async function mountTree(ticked: string[] = [], subfolders = false, tree = FOLDERS, excluded: string[] = []) {
	const folders = fakeFolders(tree)
	const wrapper = mount(FolderTree, { props: { ticked, subfolders, excluded, listFolders: folders.listFolders }, attachTo: document.body })
	await folders.answer('')
	return { wrapper, ...folders }
}

export const items = (wrapper: VueWrapper) => wrapper.findAll('[role="treeitem"]')
export const item = (wrapper: VueWrapper, name: string) => items(wrapper).find((each) => each.find('.folder-tree__name').text() === name)!
export const shown = (wrapper: VueWrapper) => items(wrapper).map((each) => `${each.find('.folder-tree__name').text()}@${each.attributes('aria-level')}`)
export const twisty = (wrapper: VueWrapper, name: string) => item(wrapper, name).find('.folder-tree__twisty')
export const focused = () => document.activeElement?.querySelector('.folder-tree__name')?.textContent
