// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { flushPromises, mount } from '@vue/test-utils'
import PhotoTile from '../../../src/components/PhotoTile.vue'
import { createLoadQueue } from '../../../src/logic/load-queue.ts'

export const urlFor = (fileId: number, size: number, mtime: number) => `/img/${fileId}/${size}/${mtime}`

/** A load queue over a loader whose loads the test settles by URL. */
export function fakeLoads() {
	const started: string[] = []
	const settle = new Map<string, { resolve: () => void, reject: () => void }>()
	const loads = createLoadQueue((url) => new Promise<void>((resolve, reject) => {
		started.push(url)
		settle.set(url, { resolve, reject })
	}), 10)
	const settled = async (url: string, outcome: 'resolve' | 'reject' = 'resolve') => {
		settle.get(url)![outcome]()
		await flushPromises()
	}
	return { started, loads, settled }
}

export function mountTile(picture: Picture<ListingEntry>, props: Record<string, unknown> = {}) {
	return mount(PhotoTile, { props: { picture, size: 160, imageUrl: urlFor, loads: fakeLoads().loads, devicePixelRatio: 2, ...props } })
}
