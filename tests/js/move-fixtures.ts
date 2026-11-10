// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { MoveRequestFile } from '../../src/logic/move-plan.ts'
import type { MoveResponseFile } from '../../src/logic/move-report.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { Settings } from '../../src/logic/settings.ts'
import type { ToastAction } from '../../src/toast.ts'

import { ref, shallowRef } from 'vue'
import { DEFAULT_PAIRING_SETTINGS, pairPictures } from '../../src/logic/pairing.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { withoutFiles } from '../../src/logic/trash-report.ts'
import { useMoveFlow } from '../../src/move-flow.ts'
import { listingEntry } from './logic/listing-entries.ts'

const ENTRIES = [
	listingEntry(1, '/Trip/IMG_1.CR3', { size: 2048 }),
	listingEntry(2, '/Trip/IMG_1.JPG', { size: 1024 }),
	listingEntry(4, '/Trip/IMG_2.JPG', { size: 1024 }),
	listingEntry(5, '/Trip/sunset.JPG', { size: 1024 }),
]

export type Answer = (request: MoveRequestFile[][]) => Promise<MoveResponseFile[][]>

/** Answers every file as moved to its requested path, with the same id unless `newId` says otherwise. */
export const allMoved = (newId = (fileId: number) => fileId): Answer => async (request) => request.map((files) => files.map(({ fileId, path }) => ({ fileId, result: 'moved', replaced: false, path, newFileId: newId(fileId), etag: `moved-${fileId}` })))

/** A flow over the entries' pictures, the folder `/Out` holding `held`, with a move endpoint answering `answer`. */
export function moveFlow(answer: Answer = allMoved(), { held = [] as string[], template = '{name}.{ext}', probe = undefined as (() => Promise<never>) | undefined } = {}) {
	const entries = shallowRef<ListingEntry[]>(ENTRIES)
	const pictures = shallowRef<Picture<ListingEntry>[]>(pairPictures(ENTRIES, DEFAULT_PAIRING_SETTINGS))
	const settings = shallowRef<Settings>({ ...DEFAULT_SETTINGS, moveFavourites: ['/Fav'], moveRecent: ['/Old', '/Fav'] })
	const toasts: { message: string, action: ToastAction | null }[] = []
	const sent: MoveRequestFile[][][] = []
	const probed: string[][] = []
	const loupe = ref<{ pictures: readonly Picture<ListingEntry>[], index: number } | null>(null)
	const moving = useMoveFlow({
		view: () => pictures.value,
		settings: () => settings.value,
		updateSettings: (patch) => {
			settings.value = { ...settings.value, ...patch }
		},
		probe: probe ?? (async (folders) => {
			probed.push([...folders])
			return folders.map((path) => ({ path, children: path === '/Out' ? held.map((name, index) => ({ name, fileId: 90 + index, etag: 'held' })) : [] }))
		}),
		move: async (request) => {
			sent.push(request.map((files) => [...files]))
			return answer(request.map((files) => [...files]))
		},
		removeFiles: (fileIds) => {
			const { pictures: left, replaced } = withoutFiles(pictures.value, fileIds, DEFAULT_PAIRING_SETTINGS)
			pictures.value = left
			entries.value = entries.value.filter((entry) => !fileIds.has(entry.fileId))
			return replaced
		},
		restoreFiles: (restored) => {
			entries.value = [...entries.value, ...restored]
			pictures.value = pairPictures(entries.value, DEFAULT_PAIRING_SETTINGS)
		},
		loupe,
		toast: (message, action = null) => toasts.push({ message, action }),
		template: () => template,
		offset: () => 0,
	})
	const [pair, single, sunset] = pictures.value as [Picture<ListingEntry>, Picture<ListingEntry>, Picture<ListingEntry>]
	return { moving, pictures, entries, settings, toasts, sent, probed, loupe, pair, single, sunset }
}
