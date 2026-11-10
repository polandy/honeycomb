// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { reactive } from 'vue'

/** Decodes the image at `src` off the page. */
export async function decodeSource(src: string): Promise<void> {
	const image = new Image()
	image.src = src
	await image.decode()
}

/** Loads images once each and keeps a window of them, so paging to a neighbour shows it at once. */
export function usePrefetch(decode: (src: string) => Promise<void>) {
	const loading = new Map<string, Promise<void>>()
	/** The sources that have decoded. */
	const ready = reactive(new Set<string>())

	/** Loads `src`, or returns its load already under way; a failed load is tried again next time. */
	function load(src: string): Promise<void> {
		let pending = loading.get(src)
		if (pending === undefined) {
			pending = decode(src).then(() => {
				ready.add(src)
			}, (error: unknown) => {
				loading.delete(src)
				throw error
			})
			loading.set(src, pending)
		}
		return pending
	}

	/** Loads `sources` in order and forgets every source outside them and `keep`. */
	function prefetch(sources: readonly string[], keep: readonly string[]) {
		const window = new Set([...sources, ...keep])
		for (const src of [...loading.keys()].filter((src) => !window.has(src))) {
			loading.delete(src)
			ready.delete(src)
		}
		for (const src of sources) {
			load(src).catch(() => undefined)
		}
	}

	return { ready, load, prefetch }
}
