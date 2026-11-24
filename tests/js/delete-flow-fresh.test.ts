import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FreshCheck } from '../../src/trash/delete-flow.ts'

import { describe, expect, it } from 'vitest'
import { skipReason } from '../../src/trash/trash-text.ts'
import { allTrashed, flow, OTHER, PAIR } from './delete-fixtures.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'

const FRESH_PAIR = pictureOf(...[PAIR!.raw!, PAIR!.rendered!], listingEntry(3, '/Trip/IMG_1.CR3.xmp', { size: 100 }))

/** A trash endpoint that answers `decisionChanged` for the files of `changed` and trashes the others. */
function changedFor(...changed: number[]) {
	return async (request: { fileId: number }[][]) => request.map((files) => files.map(({ fileId }) => ({ fileId, result: changed.includes(fileId) ? 'decisionChanged' : 'trashed' })))
}

describe('useDeleteFlow, deleting by decision', () => {
	// spec: DELETE-002.26, DELETE-002.28
	it('lists the review\'s pictures afresh after the flush and sends the fresh files with the expectation rejected', async () => {
		const steps: string[] = []
		const checked: unknown[] = []
		const check = async (pictures: readonly Picture<ListingEntry>[], decisionFlow: string): Promise<FreshCheck> => {
			steps.push('check')
			checked.push([pictures, decisionFlow])
			return { passed: [FRESH_PAIR], skipped: [{ picture: OTHER!, reason: 'changed' }] }
		}
		const { deleting, sent, expectations, pictures, toasts } = flow(allTrashed, undefined, async () => {
			steps.push('flush')
		}, check)

		deleting.continueToSummary()
		await deleting.confirm()

		expect(steps).toEqual(['flush', 'check'])
		expect(checked).toEqual([[[PAIR, OTHER], 'rejects']])
		expect(sent).toEqual([[[{ fileId: 2, etag: 'etag-2' }, { fileId: 1, etag: 'etag-1' }, { fileId: 3, etag: 'etag-3' }]]])
		expect(expectations).toEqual(['rejected'])
		expect(pictures.value).toHaveLength(2)
		expect(deleting.dialog.value).toMatchObject({ kind: 'report', skipped: [{ picture: OTHER, reason: 'changed' }] })
		expect(toasts).toEqual(['Moved 1 photo · 3 files · 3.1 kB freed to the Nextcloud trash bin · 1 photo skipped'])
	})

	// spec: DELETE-002.26
	it('reports a picture the server found no longer rejected as skipped, not failed, and keeps it', async () => {
		const { deleting, pictures, toasts } = flow(changedFor(1, 2))

		deleting.continueToSummary()
		await deleting.confirm()

		expect(pictures.value).toEqual([PAIR, expect.anything()])
		expect(deleting.dialog.value).toMatchObject({ kind: 'report', report: { failed: [] }, skipped: [{ picture: PAIR, reason: 'notRejected' }] })
		expect(toasts).toEqual(['Moved 1 photo · 1 file · 1 kB freed to the Nextcloud trash bin · 1 photo skipped'])
	})

	// spec: DELETE-002.16
	it('sends nothing when every picture is skipped, and reports them', async () => {
		const check = async (pictures: readonly Picture<ListingEntry>[]): Promise<FreshCheck> => ({ passed: [], skipped: pictures.map((picture) => ({ picture, reason: 'unlisted' })) })
		const { deleting, sent, pictures, toasts } = flow(allTrashed, undefined, undefined, check)

		deleting.continueToSummary()
		await deleting.confirm()

		expect(sent).toEqual([])
		expect(pictures.value).toHaveLength(3)
		expect(deleting.dialog.value).toMatchObject({ kind: 'report', report: { trashed: [], failed: [] }, skipped: [{ picture: PAIR }, { picture: OTHER }] })
		expect(toasts).toEqual(['2 photos skipped'])
	})

	// spec: DELETE-002.17
	it('deletes the chosen pictures without the check and without an expectation', async () => {
		const checked: unknown[] = []
		const { deleting, sent, expectations } = flow(allTrashed, undefined, undefined, async (pictures) => {
			checked.push(pictures)
			return { passed: [], skipped: [] }
		})

		deleting.summarise([PAIR!])
		await deleting.confirm()

		expect(checked).toEqual([])
		expect(sent).toHaveLength(1)
		expect(expectations).toEqual([null])
	})

	// spec: DELETE-003.11
	it('sends the pairs Remove RAWs takes with the expectation rawRemovable, and reports a pair the server kept', async () => {
		const checked: unknown[] = []
		const { deleting, sent, expectations, pictures } = flow(changedFor(1, 3), undefined, undefined, async (chosen, decisionFlow) => {
			checked.push([chosen, decisionFlow])
			return { passed: chosen, skipped: [] }
		})
		pictures.value = [FRESH_PAIR]

		deleting.removeRaws()
		await deleting.confirm()

		expect(checked).toEqual([[[FRESH_PAIR], 'raws']])
		expect(sent).toEqual([[[{ fileId: 1, etag: 'etag-1' }, { fileId: 3, etag: 'etag-3' }]]])
		expect(expectations).toEqual(['rawRemovable'])
		expect(pictures.value).toEqual([FRESH_PAIR])
		expect(deleting.dialog.value).toMatchObject({ kind: 'report', report: { failed: [] }, skipped: [{ picture: FRESH_PAIR, reason: 'notRemovable' }] })
	})

	// spec: DELETE-002.26
	it('sends the retry and the permanent resend with the expectation of the flow', async () => {
		let answers = [[{ fileId: 2, result: 'locked' }, { fileId: 1, result: 'skipped' }], [{ fileId: 5, result: 'tooLarge' }]]
		const { deleting, expectations } = flow(async () => answers)

		deleting.continueToSummary()
		await deleting.confirm()
		expect(deleting.dialog.value).toMatchObject({ kind: 'permanent' })
		answers = [[{ fileId: 5, result: 'deleted' }]]
		await deleting.confirm()
		answers = [[{ fileId: 2, result: 'trashed' }, { fileId: 1, result: 'trashed' }]]
		await deleting.retry()

		expect(expectations).toEqual(['rejected', 'rejected', 'rejected'])
	})

	// spec: DELETE-002.11
	it('changes nothing when the check fails', async () => {
		const { deleting, sent, errors } = flow(allTrashed, undefined, undefined, async () => Promise.reject(new Error('offline')))

		deleting.continueToSummary()
		await deleting.confirm()

		expect(sent).toEqual([])
		expect(deleting.dialog.value).toBeNull()
		expect(errors).toEqual(['Could not delete the photos; reload the folder to see what changed.'])
	})
})

// spec: DELETE-002.16
describe('skipReason', () => {
	it.each([
		['changed', 'Its files changed since the folder was listed; reload the folder'],
		['unlisted', 'Its folder could not be listed again'],
		['notRejected', 'No longer rejected'],
		['notRemovable', 'Now rejected or kept with Keep RAW'],
		['jpegSidecar', 'The JPEG sidecar could not be written, so the RAW stays'],
	] as const)('words %s', (reason, text) => {
		expect(skipReason(reason)).toBe(text)
	})
})
