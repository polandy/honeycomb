// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../src/logic/decision.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { ChunkLimits } from '../../src/logic/request-chunks.ts'
import type { TrashResponseFile } from '../../src/logic/trash-report.ts'

import { ref, shallowRef } from 'vue'
import { useDeleteFlow } from '../../src/delete-flow.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { DEFAULT_PAIRING_SETTINGS } from '../../src/logic/pairing.ts'
import { withoutFiles } from '../../src/logic/trash-report.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'

export const [PAIR, SINGLE, OTHER] = picturesOf([
	listingEntry(1, '/Trip/IMG_1.CR3', { mime: 'image/x-dcraw', size: 2048 }),
	listingEntry(2, '/Trip/IMG_1.JPG', { size: 1024 }),
	listingEntry(4, '/Trip/IMG_2.JPG', { size: 1024 }),
	listingEntry(5, '/Trip/IMG_3.JPG', { size: 1024 }),
]) as Picture<ListingEntry>[]

/** A flow over the three pictures, PAIR and OTHER rejected, with a trash endpoint answering `answer` and `flush` writing the waiting sidecars. */
export function flow(answer: (request: { fileId: number }[][]) => Promise<TrashResponseFile[][]>, chunks?: ChunkLimits, flush = async () => {}) {
	const pictures = shallowRef<readonly Picture<ListingEntry>[]>([PAIR!, SINGLE!, OTHER!])
	const flags = new Map([[PAIR, 'rejected'], [OTHER, 'rejected']])
	const toasts: string[] = []
	const decided: unknown[] = []
	const sent: { fileId: number }[][][] = []
	const loupe = ref<{ pictures: readonly Picture<ListingEntry>[], index: number } | null>({ pictures: [PAIR!, SINGLE!], index: 0 })
	const deleting = useDeleteFlow({
		pictures: () => pictures.value,
		view: () => pictures.value,
		decisionOf: (picture) => ({ ...UNDECIDED, flag: flags.get(picture) ?? 'unflagged' } as Decision),
		decide: (intent, chosen) => decided.push([intent, chosen]),
		flush,
		trash: async (request) => {
			sent.push(request.map((files) => [...files]))
			return answer(request.map((files) => [...files]))
		},
		removeFiles: (fileIds) => {
			const { pictures: left, replaced } = withoutFiles(pictures.value, fileIds, DEFAULT_PAIRING_SETTINGS)
			pictures.value = left
			return replaced
		},
		loupe,
		toast: (message) => toasts.push(message),
		chunks,
	})
	return { deleting, pictures, toasts, decided, sent, loupe }
}

export const allTrashed = async (request: { fileId: number }[][]) => request.map((files) => files.map(({ fileId }) => ({ fileId, result: 'trashed' })))
