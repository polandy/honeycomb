// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { MissingPicture } from '../../../src/hashes/hash-run.ts'
import type { SharpnessRunSeams } from '../../../src/hashes/sharpness-run.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Sharpness } from '../../../src/logic/sharpness.ts'
import type { StoredVisualHash } from '../../../src/logic/visual-hash.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import FolderTree from '../../../src/components/FolderTree.vue'
import SimilarityPage from '../../../src/components/SimilarityPage.vue'
import { DEFAULT_PAIRING_SETTINGS } from '../../../src/logic/pairing.ts'
import { RateLimitedError } from '../../../src/logic/retry-after.ts'
import { listingEntry } from '../logic/listing-entries.ts'
import { fakePageNavigation } from '../page-navigation.ts'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { warn: vi.fn() } }))

const picture = (fileId: number): MissingPicture => ({ fileId, etag: `etag-${fileId}`, mtime: 1, path: `/Photos/IMG_${fileId}.jpg` })

/** Seams with a first page of three pictures; the second page waits for `nextPage`. */
function seams() {
	let nextPage!: (page: { pictures: MissingPicture[], nextCursor: string | null }) => void
	const fake = {
		listMissing: vi.fn(async (_path: string, after: string) => (after === ''
			? { pictures: [picture(1), picture(2), picture(3)], nextCursor: 'IMG_3.jpg' }
			: new Promise<{ pictures: MissingPicture[], nextCursor: string | null }>((settle) => {
					nextPage = settle
				}))),
		hash: vi.fn(async (each: MissingPicture) => {
			if (each.fileId === 2) {
				throw new Error('no preview')
			}
			return '00000000000000ff'
		}),
		save: vi.fn(async (hashes: readonly StoredVisualHash[]) => hashes.map((each) => each.fileId)),
		wait: vi.fn(() => new Promise<void>(() => {})),
		workers: 1,
	}
	return { fake, finish: () => nextPage({ pictures: [picture(4)], nextCursor: null }) }
}

/** A series of two photos and a single one. */
const TREE = [
	listingEntry(1, '/Photos/IMG_1.jpg', { captureTime: 0 }),
	listingEntry(2, '/Photos/IMG_2.jpg', { captureTime: 1 }),
	listingEntry(3, '/Photos/IMG_3.jpg', { captureTime: 500 }),
]

/** Sharpness seams listing the tree and measuring through promises the test settles. */
function sharpnessSeams() {
	const measures: { resolve: (value: Sharpness) => void }[] = []
	const fake = {
		listTree: vi.fn(async (_path: string): Promise<readonly ListingEntry[]> => TREE),
		pairing: async () => DEFAULT_PAIRING_SETTINGS,
		measureImage: () => new Promise<Sharpness>((resolve) => measures.push({ resolve })),
		saveQualityValues: async () => {},
		wait: async () => {},
	} satisfies SharpnessRunSeams
	return { fake, measures }
}

function mountPage(fake = seams().fake, roots: string[] = [], sharpness = sharpnessSeams().fake) {
	return mount(SimilarityPage, { props: { seams: fake, sharpness, listFolders: async () => [], roots, navigation: fakePageNavigation().seams } })
}

/** A page whose hashes are done at once, with the sharpness seams the test settles. */
async function hashedPage() {
	const { fake } = seams()
	fake.listMissing.mockResolvedValue({ pictures: [picture(1)], nextCursor: null })
	const sharpness = sharpnessSeams()
	const wrapper = mountPage(fake, [], sharpness.fake)
	await startIn(wrapper)
	return { wrapper, ...sharpness }
}

const sharpnessCounts = (wrapper: ReturnType<typeof mountPage>) => wrapper.findAll('.similarity-page__counts')[1]!.text()

const button = (wrapper: ReturnType<typeof mountPage>, label: string) => wrapper.findAll('button').find((each) => each.text() === label)

async function startIn(wrapper: ReturnType<typeof mountPage>) {
	await wrapper.findComponent(FolderTree).vm.$emit('toggle', '/Photos')
	await button(wrapper, 'Start')!.trigger('click')
	await flushPromises()
}

describe('SimilarityPage', () => {
	// spec: SERIES-004.13
	it('starts once a folder is chosen', async () => {
		const { fake } = seams()
		const wrapper = mountPage(fake)
		expect(button(wrapper, 'Start')!.attributes('disabled')).toBeDefined()

		await startIn(wrapper)

		expect(fake.listMissing).toHaveBeenCalledWith('/Photos', '')
	})

	// spec: SERIES-004.11
	it('shows the photos found, hashed, failed and left, found as a lower bound while pages come', async () => {
		const { fake, finish } = seams()
		const wrapper = mountPage(fake)

		await startIn(wrapper)
		expect(wrapper.find('.similarity-page__counts').text()).toBe('Found3+Hashed2Failed1Left0')
		expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('3')

		finish()
		await flushPromises()
		expect(wrapper.find('.similarity-page__counts').text()).toBe('Found4Hashed3Failed1Left0')
	})

	// spec: SERIES-004.10
	it('lists the paths of the failed photos', async () => {
		const wrapper = mountPage()

		await startIn(wrapper)

		expect(wrapper.find('.similarity-page__failed').text()).toContain('/Photos/IMG_2.jpg')
	})

	// spec: SERIES-004.8
	it('pauses and resumes', async () => {
		const { fake } = seams()
		const wrapper = mountPage(fake)
		await startIn(wrapper)

		await button(wrapper, 'Pause')!.trigger('click')
		await flushPromises()
		expect(button(wrapper, 'Resume')).toBeDefined()

		await button(wrapper, 'Resume')!.trigger('click')
		expect(button(wrapper, 'Pause')).toBeDefined()
	})

	// spec: SERIES-004.9
	it('names a failed save and offers to resume', async () => {
		const { fake } = seams()
		fake.save.mockRejectedValue(new Error('offline'))
		fake.listMissing.mockResolvedValue({ pictures: [picture(1)], nextCursor: null })
		const wrapper = mountPage(fake)

		await startIn(wrapper)

		expect(wrapper.text()).toContain('Could not save the visual hashes. Resume to try again.')
		expect(button(wrapper, 'Resume')).toBeDefined()
	})

	// spec: SERIES-004.14
	it('says how long it waits when the server limits the saves', async () => {
		const { fake } = seams()
		fake.save.mockRejectedValueOnce(new RateLimitedError(60))
		fake.listMissing.mockResolvedValue({ pictures: [picture(1)], nextCursor: null })
		const wrapper = mountPage(fake)

		await startIn(wrapper)

		expect(wrapper.text()).toContain('The server asked for a break: the hashes are saved again in 60 s.')
		expect(button(wrapper, 'Pause')).toBeDefined()
	})

	// spec: SERIES-004.12
	it('names a failed page', async () => {
		const { fake } = seams()
		fake.listMissing.mockRejectedValue(new Error('offline'))
		const wrapper = mountPage(fake)

		await startIn(wrapper)

		expect(wrapper.text()).toContain('Could not load the photos. Resume to try again.')
	})

	// spec: SERIES-004.11
	it('says when every photo is compared', async () => {
		const { fake } = seams()
		fake.listMissing.mockResolvedValue({ pictures: [picture(1)], nextCursor: null })
		const wrapper = mountPage(fake)

		await startIn(wrapper)

		expect(wrapper.text()).toContain('Done: every photo in this folder has its similarity.')
	})

	// spec: SERIES-004.17
	it('lists the tree for the sharpness only once the hashes are done', async () => {
		const { fake, finish } = seams()
		const sharpness = sharpnessSeams()
		const wrapper = mountPage(fake, [], sharpness.fake)

		await startIn(wrapper)
		expect(sharpness.fake.listTree).not.toHaveBeenCalled()
		expect(wrapper.findAll('.similarity-page__counts')).toHaveLength(1)

		finish()
		await flushPromises()
		expect(sharpness.fake.listTree).toHaveBeenCalledWith('/Photos')
		expect(sharpness.measures).toHaveLength(1)
	})

	// spec: SERIES-004.18
	it('shows the photos to measure, measured, failed and left, and says when the sharpness is done', async () => {
		const { wrapper, measures } = await hashedPage()
		expect(sharpnessCounts(wrapper)).toBe('To measure2Measured0Failed0Left2')
		expect(wrapper.text()).not.toContain('Done: every photo of a series in this folder has its sharpness.')

		measures[0]!.resolve({ sharpness: 1, focusTile: 0 })
		await flushPromises()
		expect(sharpnessCounts(wrapper)).toBe('To measure2Measured1Failed0Left1')
		expect(wrapper.findAll('[role="progressbar"]')[1]!.attributes('aria-valuenow')).toBe('1')
		measures[1]!.resolve({ sharpness: 2, focusTile: 0 })
		await flushPromises()

		expect(sharpnessCounts(wrapper)).toBe('To measure2Measured2Failed0Left0')
		expect(wrapper.text()).toContain('Done: every photo of a series in this folder has its sharpness.')
		expect(button(wrapper, 'Start')).toBeDefined()
	})

	// spec: SERIES-004.19
	it('pauses and resumes the sharpness', async () => {
		const { wrapper, measures } = await hashedPage()

		await button(wrapper, 'Pause')!.trigger('click')
		measures[0]!.resolve({ sharpness: 1, focusTile: 0 })
		await flushPromises()
		expect(measures).toHaveLength(1)
		expect(button(wrapper, 'Start')).toBeUndefined()

		await button(wrapper, 'Resume')!.trigger('click')
		await flushPromises()
		expect(measures).toHaveLength(2)
		expect(button(wrapper, 'Pause')).toBeDefined()
	})

	// spec: SERIES-004.20
	it('names a failed listing of the series and offers to resume', async () => {
		const { fake } = seams()
		fake.listMissing.mockResolvedValue({ pictures: [picture(1)], nextCursor: null })
		const sharpness = sharpnessSeams()
		sharpness.fake.listTree.mockRejectedValueOnce(new Error('offline'))
		const wrapper = mountPage(fake, [], sharpness.fake)

		await startIn(wrapper)
		expect(wrapper.text()).toContain('Could not list the series of this folder. Resume to try again.')

		await button(wrapper, 'Resume')!.trigger('click')
		await flushPromises()
		expect(wrapper.text()).not.toContain('Could not list the series of this folder.')
		expect(sharpness.measures).toHaveLength(1)
	})

	// spec: SETTINGS-001.36
	it('offers only folders inside a library root, and every folder while none is set', () => {
		const note = (wrapper: ReturnType<typeof mountPage>) => wrapper.findComponent(FolderTree).props('disabledNote') as (path: string) => string | null
		const limited = note(mountPage(undefined, ['/Photos']))

		expect(limited('/Photos/2025')).toBeNull()
		expect(limited('/Docs')).toContain('Outside your library roots')
		expect(note(mountPage())('/Docs')).toBeNull()
	})
})
