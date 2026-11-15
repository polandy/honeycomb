// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { MissingPicture } from '../../../src/hash-run.ts'
import type { StoredVisualHash } from '../../../src/logic/visual-hash.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import FolderTree from '../../../src/components/FolderTree.vue'
import SimilarityPage from '../../../src/components/SimilarityPage.vue'
import { RateLimitedError } from '../../../src/logic/retry-after.ts'

vi.mock('../../../src/logger.ts', () => ({ logger: { warn: vi.fn() } }))

const picture = (fileId: number): MissingPicture => ({ fileId, etag: `etag-${fileId}`, mtime: 1, path: `/Photos/IMG_${fileId}.jpg` })

/** Seams with a first page of three pictures; the second page waits for `nextPage`. */
function seams() {
	let nextPage!: (page: { pictures: MissingPicture[], next: string | null }) => void
	const fake = {
		listMissing: vi.fn(async (_path: string, after: string) => (after === ''
			? { pictures: [picture(1), picture(2), picture(3)], next: 'IMG_3.jpg' }
			: new Promise<{ pictures: MissingPicture[], next: string | null }>((settle) => {
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
	return { fake, finish: () => nextPage({ pictures: [picture(4)], next: null }) }
}

function mountPage(fake = seams().fake) {
	return mount(SimilarityPage, { props: { seams: fake, listFolders: async () => [] } })
}

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
		fake.listMissing.mockResolvedValue({ pictures: [picture(1)], next: null })
		const wrapper = mountPage(fake)

		await startIn(wrapper)

		expect(wrapper.text()).toContain('Could not save the visual hashes. Resume to try again.')
		expect(button(wrapper, 'Resume')).toBeDefined()
	})

	// spec: SERIES-004.14
	it('says how long it waits when the server limits the saves', async () => {
		const { fake } = seams()
		fake.save.mockRejectedValueOnce(new RateLimitedError(60))
		fake.listMissing.mockResolvedValue({ pictures: [picture(1)], next: null })
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
		fake.listMissing.mockResolvedValue({ pictures: [picture(1)], next: null })
		const wrapper = mountPage(fake)

		await startIn(wrapper)

		expect(wrapper.text()).toContain('Done: every photo in this folder has its similarity.')
	})
})
