// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../src/logic/decision.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { TrashResponseFile } from '../../src/logic/trash-report.ts'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import { TrashBinOffError } from '../../src/api.ts'
import { useDeleteFlow } from '../../src/delete-flow.ts'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { DEFAULT_PAIRING_SETTINGS } from '../../src/logic/pairing.ts'
import { withoutFiles } from '../../src/logic/trash-report.ts'
import { failureReason } from '../../src/trash-text.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'

const [PAIR, SINGLE, OTHER] = picturesOf([
	listingEntry(1, '/Trip/IMG_1.CR3', { mime: 'image/x-dcraw', size: 2048 }),
	listingEntry(2, '/Trip/IMG_1.JPG', { size: 1024 }),
	listingEntry(4, '/Trip/IMG_2.JPG', { size: 1024 }),
	listingEntry(5, '/Trip/IMG_3.JPG', { size: 1024 }),
]) as Picture<ListingEntry>[]

/** A flow over the three pictures, PAIR and OTHER rejected, with a trash endpoint answering `answer`. */
function flow(answer: (request: { fileId: number }[][]) => Promise<TrashResponseFile[][]>) {
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
	})
	return { deleting, pictures, toasts, decided, sent, loupe }
}

const allTrashed = async (request: { fileId: number }[][]) => request.map((files) => files.map(({ fileId }) => ({ fileId, result: 'trashed' })))

afterEach(() => vi.restoreAllMocks())

describe('useDeleteFlow', () => {
	it('reviews the rejects with the loupe closed, rescues one as a decision and continues to their summary', () => {
		const { deleting, decided, loupe } = flow(allTrashed)

		deleting.review()
		expect(loupe.value).toBeNull()
		expect(deleting.dialog.value).toEqual({ kind: 'review' })
		expect(deleting.rejected.value).toEqual([PAIR, OTHER])

		deleting.rescue(OTHER!)
		expect(decided).toEqual([[{ kind: 'flag', flag: 'unflagged' }, [OTHER]]])

		deleting.continueToSummary()
		expect(deleting.dialog.value).toEqual({ kind: 'summary', pictures: [PAIR, OTHER], fromReview: true })
		deleting.backToReview()
		expect(deleting.dialog.value).toEqual({ kind: 'review' })
		deleting.close()
		expect(deleting.dialog.value).toBeNull()
	})

	it('says so instead of opening an empty review', () => {
		const { deleting, toasts } = flow(allTrashed)
		deleting.summarise([])
		deleting.rescue(PAIR!)
		const none = flow(allTrashed)
		none.pictures.value = [SINGLE!]

		none.deleting.review()

		expect(deleting.dialog.value).toBeNull()
		expect(none.deleting.dialog.value).toBeNull()
		expect(none.toasts).toEqual(['No rejected photos'])
		expect(toasts).toEqual([])
	})

	it('moves whole pictures to the trash bin, takes them out of the listing and the loupe and says what was freed', async () => {
		const { deleting, pictures, toasts, sent, loupe } = flow(allTrashed)
		loupe.value = { pictures: [PAIR!, SINGLE!], index: 0 }

		deleting.summarise([PAIR!])
		await deleting.confirm()

		expect(sent).toEqual([[[{ fileId: 2, etag: 'etag-2' }, { fileId: 1, etag: 'etag-1' }]]])
		expect(pictures.value).toEqual([SINGLE, OTHER])
		expect(loupe.value).toEqual({ pictures: [SINGLE], index: 0 })
		expect(deleting.dialog.value).toBeNull()
		expect(toasts).toEqual(['Moved 1 photo · 2 files · 3 kB freed to the Nextcloud trash bin'])
	})

	it('reports the failed files, keeps the picture that lost a member as a single, and retries only the failed ones', async () => {
		const answers = [
			async () => [[{ fileId: 2, result: 'trashed' }, { fileId: 1, result: 'locked' }]],
			allTrashed,
		]
		const { deleting, pictures, toasts, sent } = flow((request) => answers.shift()!(request))

		deleting.summarise([PAIR!])
		await deleting.confirm()

		const dialog = deleting.dialog.value
		expect(dialog?.kind === 'report' && dialog.report.failed.map(({ file, result }) => [file.entry.fileId, failureReason(result)])).toEqual([[1, 'File is locked (another process is writing to it)']])
		expect(pictures.value[0]).toMatchObject({ raw: { fileId: 1 }, rendered: null })
		expect(toasts).toEqual(['Moved 1 file to trash · 1 failed'])

		await deleting.retry()

		expect(sent[1]).toEqual([[{ fileId: 1, etag: 'etag-1' }]])
		expect(pictures.value).toEqual([SINGLE, OTHER])
		expect(toasts[1]).toBe('Moved 1 remaining file to the Nextcloud trash bin')
		expect(deleting.dialog.value).toBeNull()
	})

	it.each([
		[new TrashBinOffError('off'), 'The Nextcloud trash bin is off, so nothing was deleted. honeycomb deletes only into the trash bin.'],
		[new Error('Network Error'), 'Could not delete the photos; reload the folder to see what changed.'],
	])('changes nothing and says why when the request fails: %s', async (error, message) => {
		vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { deleting, pictures, toasts } = flow(() => Promise.reject(error))

		deleting.summarise([PAIR!])
		await deleting.confirm()

		expect(pictures.value).toHaveLength(3)
		expect(deleting.dialog.value).toBeNull()
		expect(deleting.busy.value).toBe(false)
		expect(toasts).toEqual([message])
	})

	it('sends nothing without a summary or a report, or while a request runs', async () => {
		let release = () => {}
		const { deleting, sent } = flow((request) => new Promise((resolve) => {
			release = () => resolve(request.map((files) => files.map(({ fileId }) => ({ fileId, result: 'trashed' }))))
		}))
		await deleting.confirm()
		await deleting.retry()

		deleting.summarise([SINGLE!])
		const first = deleting.confirm()
		await deleting.confirm()
		release()
		await first

		expect(sent).toHaveLength(1)
	})
})

describe('useDeleteFlow: Remove RAWs', () => {
	const [KEEP, DROP, SHARED] = picturesOf([
		listingEntry(11, '/Trip/IMG_4.NEF', { mime: 'image/x-dcraw', size: 2048 }),
		listingEntry(12, '/Trip/IMG_4.JPG', { size: 1024 }),
		listingEntry(21, '/Trip/IMG_5.NEF', { mime: 'image/x-dcraw', size: 2048 }),
		listingEntry(22, '/Trip/IMG_5.JPG', { size: 1024 }),
		listingEntry(23, '/Trip/IMG_5.NEF.xmp', { mime: 'application/octet-stream', size: 1024 }),
		listingEntry(24, '/Trip/IMG_5.xmp', { mime: 'application/octet-stream', size: 1 }),
		listingEntry(31, '/Trip/IMG_6.NEF', { mime: 'image/x-dcraw', size: 1024 }),
		listingEntry(32, '/Trip/IMG_6.JPG', { size: 1024 }),
	]) as Picture<ListingEntry>[]

	/** A flow over KEEP (marked Keep RAW), DROP and SHARED, where `decide` toggles Keep RAW. */
	function rawFlow(answer: (request: { fileId: number }[][]) => Promise<TrashResponseFile[][]>) {
		const pictures = shallowRef<readonly Picture<ListingEntry>[]>([KEEP!, DROP!, SHARED!])
		const marked = shallowRef(new Set([KEEP!]))
		const toasts: string[] = []
		const sent: { fileId: number }[][][] = []
		const deleting = useDeleteFlow({
			pictures: () => pictures.value,
			view: () => pictures.value,
			decisionOf: (picture) => ({ ...UNDECIDED, keepRaw: marked.value.has(picture) }),
			decide: (intent, chosen) => {
				expect(intent).toEqual({ kind: 'keepRaw' })
				const next = new Set(marked.value)
				chosen.forEach((picture) => (next.has(picture) ? next.delete(picture) : next.add(picture)))
				marked.value = next
			},
			trash: async (request) => {
				sent.push(request.map((files) => [...files]))
				return answer(request.map((files) => [...files]))
			},
			removeFiles: (fileIds) => {
				const { pictures: left, replaced } = withoutFiles(pictures.value, fileIds, DEFAULT_PAIRING_SETTINGS)
				pictures.value = left
				return replaced
			},
			loupe: ref(null),
			toast: (message) => toasts.push(message),
		})
		return { deleting, pictures, toasts, sent }
	}

	it('opens on the view, follows a Keep RAW toggle and moves only each RAW with its own sidecar', async () => {
		const { deleting, pictures, toasts, sent } = rawFlow(allTrashed)

		expect(deleting.rawRemovable.value).toBe(2)
		deleting.removeRaws()
		expect(deleting.rawRemoval.value).toMatchObject({ removed: [DROP, SHARED], kept: [KEEP] })

		deleting.toggleKeepRaw(SHARED!)
		expect(deleting.rawRemoval.value).toMatchObject({ removed: [DROP], kept: [KEEP, SHARED] })
		expect(deleting.rawRemovable.value).toBe(1)

		await deleting.confirm()

		expect(sent).toEqual([[[{ fileId: 21, etag: 'etag-21' }, { fileId: 23, etag: 'etag-23' }]]])
		expect(pictures.value[1]).toMatchObject({ rendered: { fileId: 22 }, raw: null, sidecars: [{ fileId: 24 }] })
		expect(deleting.dialog.value).toBeNull()
		expect(toasts).toEqual(['Removed the RAWs of 1 photo · 2 files · 3 kB freed to the Nextcloud trash bin'])
	})

	it('keeps the pair whose RAW failed and reports it', async () => {
		const { deleting, pictures, toasts } = rawFlow(async () => [[{ fileId: 21, result: 'locked' }, { fileId: 23, result: 'skipped' }], [{ fileId: 31, result: 'trashed' }]])

		deleting.removeRaws()
		await deleting.confirm()

		expect(pictures.value[1]).toBe(DROP)
		expect(deleting.dialog.value?.kind).toBe('report')
		expect(toasts).toEqual(['Moved 1 file to trash · 2 failed'])
	})

	it('has no removal without its summary open', () => {
		const { deleting } = rawFlow(allTrashed)

		deleting.summarise([KEEP!])

		expect(deleting.rawRemoval.value).toBeNull()
	})
})

describe('failureReason', () => {
	it.each([
		['notFound', 'File is gone or no longer a photo; reload the folder'],
		['changed', 'File changed since the folder was listed; reload the folder, then delete again'],
		['notPermitted', 'You may not delete this file'],
		['skipped', 'Not tried, because another file of this photo failed'],
		['failed', 'Could not move the file to the trash bin'],
	] as const)('words %s', (result, reason) => {
		expect(failureReason(result)).toBe(reason)
	})
})
