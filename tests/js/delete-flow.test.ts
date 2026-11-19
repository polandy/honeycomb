// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { TrashResponseFile } from '../../src/logic/trash-report.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import { TrashBinOffError } from '../../src/api.ts'
import { useDeleteFlow } from '../../src/delete-flow.ts'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { DEFAULT_PAIRING_SETTINGS } from '../../src/logic/pairing.ts'
import { withoutFiles } from '../../src/logic/trash-report.ts'
import { failureReason } from '../../src/trash-text.ts'
import { allPass, allTrashed, flow, OTHER, PAIR, SINGLE } from './delete-fixtures.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'

afterEach(() => vi.restoreAllMocks())

describe('useDeleteFlow', () => {
	// spec: DELETE-002.1
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

	// spec: DELETE-002.4
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

	// spec: DELETE-002.8
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

	// spec: STATS-001.20
	it('tells the delete it answered, with the state the server checked', async () => {
		const { deleting, deletes } = flow(allTrashed)

		deleting.summarise([PAIR!])
		await deleting.confirm()

		expect(deletes.map(([report, expect]) => [report.trashed.map((file) => file.entry.fileId), expect])).toEqual([[[2, 1], null]])
	})

	// spec: DELETE-002.9, DELETE-002.10
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

	// spec: DELETE-002.11, APP-001.13
	it.each([
		[new TrashBinOffError('off'), 'The Nextcloud trash bin is off, so nothing was deleted. honeycomb deletes only into the trash bin.'],
		[new Error('Network Error'), 'Could not delete the photos; reload the folder to see what changed.'],
	])('changes nothing and says why when the request fails: %s', async (error, message) => {
		vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { deleting, pictures, errors } = flow(() => Promise.reject(error))

		deleting.summarise([PAIR!])
		await deleting.confirm()

		expect(pictures.value).toHaveLength(3)
		expect(deleting.dialog.value).toBeNull()
		expect(deleting.busy.value).toBe(false)
		expect(errors).toEqual([message])
	})

	// spec: XMP-003.30
	it('writes the waiting sidecars and waits for every write before it moves anything to the trash bin', async () => {
		let written = () => {}
		const { deleting, sent } = flow(allTrashed, undefined, () => new Promise<void>((resolve) => (written = resolve)))
		deleting.summarise([PAIR!])

		const confirmed = deleting.confirm()
		await flushPromises()
		expect(sent).toEqual([])

		written()
		await confirmed
		expect(sent).toHaveLength(1)
	})

	// spec: DELETE-002.17
	it('sends the chosen pictures as honeycomb saved their sidecars, once the waiting sidecars are written', async () => {
		const own = { ...PAIR!, sidecars: [listingEntry(30, '/Trip/IMG_1.JPG.xmp', { etag: 'saved' })] }
		let written = false
		const { deleting, sent } = flow(allTrashed, undefined, async () => {
			written = true
		}, allPass, (picture) => (written && picture === PAIR ? own : picture))
		deleting.summarise([PAIR!])

		await deleting.confirm()

		expect(sent).toEqual([[[{ fileId: 2, etag: 'etag-2' }, { fileId: 1, etag: 'etag-1' }, { fileId: 30, etag: 'saved' }]]])
	})

	// spec: DELETE-002.7
	it('sends nothing without a summary or a report, or while a request runs', async () => {
		let release = () => {}
		let reached = () => {}
		const trashing = new Promise<void>((resolve) => (reached = resolve))
		const { deleting, sent } = flow((request) => new Promise((resolve) => {
			release = () => resolve(request.map((files) => files.map(({ fileId }) => ({ fileId, result: 'trashed' }))))
			reached()
		}))
		await deleting.confirm()
		await deleting.retry()

		deleting.summarise([SINGLE!])
		const first = deleting.confirm()
		await deleting.confirm()
		await trashing
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
			flush: async () => {},
			current: (picture) => picture,
			check: allPass,
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
			error: (message) => toasts.push(message),
		})
		return { deleting, pictures, toasts, sent }
	}

	// spec: DELETE-003.1, DELETE-003.4, DELETE-003.6
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

	// spec: DELETE-003.7
	it('keeps the pair whose RAW failed and reports it', async () => {
		const { deleting, pictures, toasts } = rawFlow(async () => [[{ fileId: 21, result: 'locked' }, { fileId: 23, result: 'skipped' }], [{ fileId: 31, result: 'trashed' }]])

		deleting.removeRaws()
		await deleting.confirm()

		expect(pictures.value[1]).toBe(DROP)
		expect(deleting.dialog.value?.kind).toBe('report')
		expect(toasts).toEqual(['Moved 1 file to trash · 2 failed'])
	})

	// spec: DELETE-003.5
	it('has no removal without its summary open', () => {
		const { deleting } = rawFlow(allTrashed)

		deleting.summarise([KEEP!])

		expect(deleting.rawRemoval.value).toBeNull()
	})
})

// spec: DELETE-002.9, DELETE-002.22
describe('failureReason', () => {
	it.each([
		['notFound', 'File is gone or no longer a photo; reload the folder'],
		['changed', 'File changed since the folder was listed; reload the folder, then delete again'],
		['notPermitted', 'You may not delete this file'],
		['noTrashBin', 'No trash bin on this storage'],
		['tooLarge', 'Larger than the trash bin allows'],
		['skipped', 'Not tried, because another file of this photo failed'],
		['failed', 'Could not move the file to the trash bin'],
	] as const)('words %s', (result, reason) => {
		expect(failureReason(result)).toBe(reason)
	})
})
