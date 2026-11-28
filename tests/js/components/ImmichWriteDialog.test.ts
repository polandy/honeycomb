// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ImmichWriteApi } from '../../../src/immich/immich-write.ts'
import type { CheckedAsset, WriteCandidate, WriteResult } from '../../../src/logic/immich-write-plan.ts'
import type { WriteRequest } from '../../../src/logic/immich-write-run.ts'

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ImmichWriteDialog from '../../../src/components/ImmichWriteDialog.vue'
import { useImmichWrite } from '../../../src/immich/immich-write.ts'
import { logger } from '../../../src/shared/logger.ts'
import { candidate, checked } from '../logic/immich-fixtures.ts'

enableAutoUnmount(afterEach)
afterEach(() => {
	vi.restoreAllMocks()
})

const FAMILY = { id: 'family', label: 'Family phones', url: 'http://immich.local', picksAsFavorites: false }
const PENDING = [candidate('r1', { flag: 'rejected' }), candidate('top', { flag: 'rejected' }), candidate('p1', { flag: 'picked' }), candidate('s1', { rating: 4 })]
const CHECKED = [checked('r1'), checked('top', { stackSize: 3 }), checked('p1'), checked('s1')]

/** The dialog over a fake server whose check and write wait until the test answers them. */
async function mountDialog(answered: CheckedAsset[] = CHECKED, pending: WriteCandidate[] = PENDING) {
	const checks: { answer: (rows: CheckedAsset[]) => void, fail: (error: Error) => void }[] = []
	const writes: { requests: readonly WriteRequest[], answer: (rows: WriteResult[]) => void }[] = []
	const api: ImmichWriteApi = {
		candidates: async () => pending,
		check: () => new Promise((answer, fail) => checks.push({ answer, fail })),
		write: (_id, requests) => new Promise((answer) => writes.push({ requests, answer })),
		imageUrl: (id, assetId, size) => `/${id}/${assetId}/${size}`,
	}
	const write = useImmichWrite(api, () => FAMILY)
	mount(ImmichWriteDialog, { props: { write }, attachTo: document.body })
	const opening = write.open()
	await flushPromises()
	const answer = async () => {
		checks[0]!.answer(answered)
		await opening
		await flushPromises()
	}
	const text = () => document.body.textContent ?? ''
	const button = (name: string) => [...document.body.querySelectorAll('button')].find((each) => each.textContent?.trim() === name)
	return { write, checks, writes, answer, text, button }
}

describe('ImmichWriteDialog', () => {
	// spec: IMMICH-004.25
	it('is not shown while closed', () => {
		const write = useImmichWrite({ candidates: async () => [], check: async () => [], write: async () => [], imageUrl: () => '' }, () => FAMILY)
		mount(ImmichWriteDialog, { props: { write }, attachTo: document.body })

		expect(document.body.textContent).not.toContain('Write to Immich')
	})

	// spec: IMMICH-004.25
	it('checks with the progress per block, then names the counts, the reject choice and the stack with its thumbnail', async () => {
		const { answer, text, button } = await mountDialog()
		expect(text()).toContain('Checking 4 photos with Immich · block 1 of 1')
		expect(document.body.querySelector('[role="progressbar"]')?.getAttribute('aria-valuemax')).toBe('4')
		expect(button('Write 0 changes')?.disabled).toBe(true)

		await answer()

		for (const shown of ['4 photos change.', '2 rejected', '1 picked', '1 rating', 'Immich has no pick; on this connection picks stay in honeycomb.', 'Move to Immich trash', 'Archive', 'Rating “rejected” only', '1 to check before writing', 'Top of a stack of 3.', 'Sent in 1 block of up to 100 photos.']) {
			expect(text()).toContain(shown)
		}
		expect(text()).not.toContain('no longer rejected')
		expect(document.body.querySelector('.immich-write-plan__thumbnail')?.getAttribute('src')).toBe('/family/top/thumbnail')
		expect(button('Write 4 changes')?.disabled).toBe(false)
	})

	// spec: IMMICH-004.25, IMMICH-004.3
	it('plans the write again on a reject choice', async () => {
		const { answer, text } = await mountDialog()
		await answer()

		const archive = [...document.body.querySelectorAll('input[type="radio"]')].find((input) => input.getAttribute('value') === 'archive') as HTMLInputElement
		archive.click()
		await flushPromises()

		expect(text()).toContain('They leave the Immich timeline')
	})

	// spec: IMMICH-004.25, IMMICH-004.7, IMMICH-004.8
	it('offers the choices of a rating changed in Immich and of a shared album, and plans again on each', async () => {
		const { write, answer, text } = await mountDialog([checked('r1', { sharedAlbum: { name: 'Family', others: 2 } }), checked('s1', { rating: 2, updatedAt: '2026-12-01T00:00:00.000Z' })], [candidate('r1', { flag: 'rejected' }), candidate('s1', { rating: 4 })])
		await answer()
		expect(text()).toContain('2 to check before writing')
		const radio = (value: string) => [...document.body.querySelectorAll('input[type="radio"]')].find((input) => input.getAttribute('value') === value) as HTMLInputElement

		radio('skip').click()
		radio('immich').click()
		await flushPromises()

		expect(write.sharedChoices.value).toEqual(new Map([['r1', 'skip']]))
		expect(write.ratingChoices.value).toEqual(new Map([['s1', 'immich']]))
		expect(text()).toContain('1 photo changes.')
	})

	// spec: IMMICH-004.25, IMMICH-004.13
	it('says that Immich does not answer and keeps the write disabled', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { checks, text, button } = await mountDialog()
		checks[0]!.fail(new Error('unreachable'))
		await flushPromises()

		expect(text()).toContain('Immich does not answer at the moment.')
		expect(button('Write 0 changes')?.disabled).toBe(true)
		button('Cancel')!.click()
		await flushPromises()
		expect(document.body.textContent).not.toContain('Immich does not answer')
	})

	// spec: IMMICH-004.26
	it('writes with the progress per block, locked, then shows the result and the failed with their thumbnails', async () => {
		const { writes, answer, text, button } = await mountDialog()
		await answer()

		button('Write 4 changes')!.click()
		await flushPromises()
		expect(text()).toContain('Writing block 1 of 1 · 0 of 4 photos')
		expect(button('Cancel')?.disabled).toBe(true)
		writes[0]!.answer(writes[0]!.requests.map(({ assetId }) => ({ assetId, state: assetId === 'p1' ? 'failed' : 'written' })))
		await flushPromises()

		expect(text()).toContain('Written: 3 · Failed: 1')
		expect(text()).toContain('Immich refused this change.')
		expect(document.body.querySelector('.immich-write__thumbnail')?.getAttribute('src')).toBe('/family/p1/thumbnail')
		button('Done')!.click()
		await flushPromises()
		expect(document.body.textContent).not.toContain('Written:')
	})

	// spec: IMMICH-004.26, IMMICH-004.8
	it('names the skipped, as the user chose', async () => {
		const { write, writes, answer, text, button } = await mountDialog([checked('r1', { sharedAlbum: { name: 'Family', others: 2 } }), checked('s1')], [candidate('r1', { flag: 'rejected' }), candidate('s1', { rating: 4 })])
		await answer()
		write.chooseShared('r1', 'skip')
		await flushPromises()

		button('Write 1 change')!.click()
		await flushPromises()
		writes[0]!.answer([{ assetId: 's1', state: 'written' }])
		await flushPromises()

		expect(text()).toContain('Written: 1')
		expect(text()).not.toContain('Failed')
		expect(text()).toContain('Skipped, as you chose: 1')
	})
})
