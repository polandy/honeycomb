// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FreshCheck } from '../../src/delete-flow.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'

import { describe, expect, it } from 'vitest'
import { skipReason, uncheckedText } from '../../src/trash-text.ts'
import { allTrashed, flow, OTHER, PAIR } from './delete-fixtures.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'

const FRESH_PAIR = pictureOf(...[PAIR!.raw!, PAIR!.rendered!], listingEntry(3, '/Trip/IMG_1.CR3.xmp', { size: 100 }))

describe('useDeleteFlow, deleting by decision', () => {
	// spec: DELETE-002.15
	it('checks the review\'s pictures afresh after the flush and sends only the fresh files of those that pass', async () => {
		const steps: string[] = []
		const checked: unknown[] = []
		const check = async (pictures: readonly Picture<ListingEntry>[], decisionFlow: string): Promise<FreshCheck> => {
			steps.push('check')
			checked.push([pictures, decisionFlow])
			return { passed: [FRESH_PAIR], skipped: [{ picture: OTHER!, reason: 'notRejected' }], unchecked: [] }
		}
		const { deleting, sent, pictures, toasts } = flow(allTrashed, undefined, async () => {
			steps.push('flush')
		}, check)

		deleting.continueToSummary()
		await deleting.confirm()

		expect(steps).toEqual(['flush', 'check'])
		expect(checked).toEqual([[[PAIR, OTHER], 'rejects']])
		expect(sent).toEqual([[[{ fileId: 2, etag: 'etag-2' }, { fileId: 1, etag: 'etag-1' }, { fileId: 3, etag: 'etag-3' }]]])
		expect(pictures.value).toHaveLength(2)
		expect(deleting.dialog.value).toMatchObject({ kind: 'report', skipped: [{ picture: OTHER, reason: 'notRejected' }] })
		expect(toasts).toEqual(['Moved 1 photo · 3 files · 3.1 kB freed to the Nextcloud trash bin · 1 photo skipped'])
	})

	// spec: DELETE-002.16
	it('sends nothing when every picture is skipped, and reports them', async () => {
		const check = async (pictures: readonly Picture<ListingEntry>[]): Promise<FreshCheck> => ({ passed: [], skipped: pictures.map((picture) => ({ picture, reason: 'disagrees' })), unchecked: [] })
		const { deleting, sent, pictures, toasts } = flow(allTrashed, undefined, undefined, check)

		deleting.continueToSummary()
		await deleting.confirm()

		expect(sent).toEqual([])
		expect(pictures.value).toHaveLength(3)
		expect(deleting.dialog.value).toMatchObject({ kind: 'report', report: { trashed: [], failed: [] }, skipped: [{ picture: PAIR }, { picture: OTHER }] })
		expect(toasts).toEqual(['2 photos skipped'])
	})

	// spec: DELETE-002.15
	it('deletes the chosen pictures without the check', async () => {
		const checked: unknown[] = []
		const { deleting, sent } = flow(allTrashed, undefined, undefined, async (pictures) => {
			checked.push(pictures)
			return { passed: [], skipped: [], unchecked: [] }
		})

		deleting.summarise([PAIR!])
		await deleting.confirm()

		expect(checked).toEqual([])
		expect(sent).toHaveLength(1)
	})

	// spec: DELETE-003.8
	it('checks the pairs Remove RAWs takes for the raws flow', async () => {
		const checked: unknown[] = []
		const { deleting, sent, pictures } = flow(allTrashed, undefined, undefined, async (chosen, decisionFlow) => {
			checked.push([chosen, decisionFlow])
			return { passed: [], skipped: [{ picture: chosen[0]!, reason: 'jpegSidecar' }], unchecked: [] }
		})
		pictures.value = [FRESH_PAIR]

		deleting.removeRaws()
		await deleting.confirm()

		expect(checked).toEqual([[[FRESH_PAIR], 'raws']])
		expect(sent).toEqual([])
		expect(deleting.dialog.value).toMatchObject({ kind: 'report', skipped: [{ picture: FRESH_PAIR, reason: 'jpegSidecar' }] })
	})

	// spec: DELETE-002.23
	it('sends the pictures it could not check afresh as honeycomb saved them once Delete anyway confirms, so the server still holds a changed file', async () => {
		const saved = pictureOf(PAIR!.raw!, { ...PAIR!.rendered!, etag: 'saved-2' })
		const check = async (): Promise<FreshCheck> => ({ passed: [], skipped: [{ picture: OTHER!, reason: 'notRejected' }], unchecked: [PAIR!] })
		const answer = async () => [[{ fileId: 2, result: 'changed' }, { fileId: 1, result: 'skipped' }]]
		const { deleting, sent, toasts } = flow(answer, undefined, undefined, check, (picture) => (picture === PAIR ? saved : picture))

		deleting.continueToSummary()
		await deleting.confirm()
		await deleting.confirm()

		expect(sent).toEqual([[[{ fileId: 2, etag: 'saved-2' }, { fileId: 1, etag: 'etag-1' }]]])
		expect(deleting.dialog.value).toMatchObject({ kind: 'report', report: { failed: [{ result: 'changed' }, { result: 'skipped' }] } })
		expect(toasts).toEqual(['Moved 0 files to trash · 2 failed · 1 photo skipped'])
	})

	// spec: DELETE-002.25
	it('asks before sending anything when the fresh check fails for some pictures', async () => {
		const check = async (): Promise<FreshCheck> => ({ passed: [OTHER!], skipped: [], unchecked: [PAIR!] })
		const { deleting, sent, toasts } = flow(allTrashed, undefined, undefined, check)

		deleting.continueToSummary()
		await deleting.confirm()

		expect(sent).toEqual([])
		expect(toasts).toEqual([])
		expect(deleting.dialog.value).toMatchObject({ kind: 'unchecked', count: 1 })
		expect(deleting.busy.value).toBe(false)
	})

	// spec: DELETE-002.25
	it('sends nothing, the checked pictures neither, when the question is cancelled', async () => {
		const check = async (): Promise<FreshCheck> => ({ passed: [OTHER!], skipped: [], unchecked: [PAIR!] })
		const { deleting, sent, toasts } = flow(allTrashed, undefined, undefined, check)

		deleting.continueToSummary()
		await deleting.confirm()
		deleting.close()

		expect(sent).toEqual([])
		expect(toasts).toEqual([])
		expect(deleting.dialog.value).toBeNull()
	})

	// spec: DELETE-003.10
	it('removes the RAWs it could not check afresh as honeycomb knows them once Delete anyway confirms', async () => {
		const { deleting, sent, toasts, pictures } = flow(allTrashed, undefined, undefined, async (chosen) => ({ passed: [], skipped: [], unchecked: chosen }))
		pictures.value = [FRESH_PAIR]

		deleting.removeRaws()
		await deleting.confirm()
		expect(sent).toEqual([])
		expect(deleting.dialog.value).toMatchObject({ kind: 'unchecked', count: 1 })
		await deleting.confirm()

		expect(sent).toEqual([[[{ fileId: 1, etag: 'etag-1' }, { fileId: 3, etag: 'etag-3' }]]])
		expect(toasts).toEqual([expect.stringMatching(/^Removed the RAWs of 1 photo [^·]*$/)])
	})

	// spec: DELETE-002.15
	it('changes nothing when the check fails', async () => {
		const { deleting, sent, toasts } = flow(allTrashed, undefined, undefined, async () => Promise.reject(new Error('offline')))

		deleting.continueToSummary()
		await deleting.confirm()

		expect(sent).toEqual([])
		expect(deleting.dialog.value).toBeNull()
		expect(toasts).toEqual(['Could not delete the photos; reload the folder to see what changed.'])
	})
})

// spec: DELETE-002.16
describe('skipReason', () => {
	it.each([
		['changed', 'Its files changed since the folder was listed; reload the folder'],
		['unread', 'A sidecar could not be read'],
		['refused', 'A sidecar is not valid XMP'],
		['disagrees', 'Its sidecars disagree'],
		['notRejected', 'Its sidecars do not say rejected'],
		['notRemovable', 'Its sidecars now say Keep RAW or rejected'],
		['jpegSidecar', 'The JPEG sidecar could not be written, so the RAW stays'],
	] as const)('words %s', (reason, text) => {
		expect(skipReason(reason)).toBe(text)
	})
})

// spec: DELETE-002.23
describe('uncheckedText', () => {
	it('counts the photos not checked afresh', () => {
		expect(uncheckedText(1)).toBe('Fresh check not possible for 1 photo')
		expect(uncheckedText(3)).toBe('Fresh check not possible for 3 photos')
	})
})
