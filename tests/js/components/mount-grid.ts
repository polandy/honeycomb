// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSet } from '../../../src/logic/folder-set.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'

import { mount } from '@vue/test-utils'
import PhotoGrid from '../../../src/components/PhotoGrid.vue'
import { prepareCull } from '../../../src/logic/cull.ts'
import { sortPictures } from '../../../src/logic/picture-order.ts'
import { listingEntry } from '../logic/listing-entries.ts'

const compareNames = new Intl.Collator('en', { numeric: true }).compare
export const SET: FolderSet = { paths: ['/P'], subfolders: true }

/** `count` singles in each folder. */
export function picturesIn(folders: Record<string, number>) {
	const entries: ListingEntry[] = []
	for (const [folder, count] of Object.entries(folders)) {
		for (let index = 0; index < count; index++) {
			entries.push(listingEntry(entries.length + 1, `${folder}/IMG_${index}.JPG`))
		}
	}
	return sortPictures(prepareCull(entries).pictures, 'file-name', compareNames, true)
}

/** A size observer the test drives, and the grid mounted with it. */
export function mountGrid(props: Record<string, unknown> = {}, attach = false) {
	let resize: (width: number, height: number) => void = () => undefined
	let stopped = false
	const observeSize = (_element: Element, onSize: typeof resize) => {
		resize = onSize
		return () => {
			stopped = true
		}
	}
	const wrapper = mount(PhotoGrid, {
		props: {
			pictures: picturesIn({ '/P': 100 }),
			folderSet: SET,
			groupByFolder: false,
			tileSize: 100,
			observeSize,
			loadImage: () => new Promise<void>(() => undefined),
			...props,
		},
		...(attach && { attachTo: document.body }),
	})
	return { wrapper, resize: async (width: number, height: number) => {
		resize(width, height)
		await wrapper.vm.$nextTick()
	}, stopped: () => stopped }
}
