// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { OrphanedSidecar, OrphanedSidecarAnswer } from '../../../src/logic/orphaned-sidecars.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import FolderTree from '../../../src/components/FolderTree.vue'
import OrphanedSidecarsPage from '../../../src/components/OrphanedSidecarsPage.vue'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

const sidecar = (fileId: number, path: string, size: number): OrphanedSidecar => ({ fileId, etag: `etag-${fileId}`, path, size })

/** Seams with two pages: two orphans in `/Photos`, one in `/Photos/2024`; the trash skips file 2. */
function seams() {
	return {
		scan: vi.fn(async (_path: string, after: string) => (after === ''
			? { sidecars: [sidecar(1, '/Photos/a.xmp', 1024), sidecar(2, '/Photos/b.CR2.xmp', 1024)], nextCursor: '/' }
			: { sidecars: [sidecar(3, '/Photos/2024/c.xmp', 2048)], nextCursor: null })),
		trash: vi.fn(async (sidecars: readonly { fileId: number }[]): Promise<OrphanedSidecarAnswer[]> => sidecars.map(({ fileId }) => ({ fileId, result: fileId === 2 ? 'notOrphaned' : 'trashed' }))),
	}
}

function mountPage(fake = seams()) {
	return mount(OrphanedSidecarsPage, { props: { seams: fake, listFolders: async () => [] } })
}

const button = (wrapper: ReturnType<typeof mountPage>, label: string) => wrapper.findAll('button').find((each) => each.text() === label)

async function scanIn(wrapper: ReturnType<typeof mountPage>, path = '/Photos') {
	await wrapper.findComponent(FolderTree).vm.$emit('toggle', path)
	await button(wrapper, 'Find orphaned sidecars')!.trigger('click')
	await flushPromises()
}

describe('OrphanedSidecarsPage', () => {
	// spec: XMP-009.11
	it('lists the orphans of a chosen folder by folder with count and size, and the total', async () => {
		const fake = seams()
		const wrapper = mountPage(fake)
		expect(button(wrapper, 'Find orphaned sidecars')!.attributes('disabled')).toBeDefined()

		await scanIn(wrapper)

		expect(fake.scan).toHaveBeenCalledWith('/Photos', '')
		expect(wrapper.text()).toContain('3 orphaned sidecars, 4 kB')
		const folders = wrapper.findAll('.orphaned-sidecars__folder')
		expect(folders.map((folder) => folder.find('summary').text())).toEqual(['/Photos – 2 sidecars, 2 kB', '/Photos/2024 – 1 sidecar, 2 kB'])
		expect(folders[0]!.findAll('li').map((item) => item.text())).toEqual(['a.xmp – 1 kB', 'b.CR2.xmp – 1 kB'])
	})

	// spec: XMP-009.11
	it('scans the whole library from the user\'s folder and says when none is found', async () => {
		const fake = seams()
		fake.scan.mockImplementation(async () => ({ sidecars: [], nextCursor: null }))
		const wrapper = mountPage(fake)

		await button(wrapper, 'Whole library')!.trigger('click')
		await button(wrapper, 'Find orphaned sidecars')!.trigger('click')
		await flushPromises()

		expect(fake.scan).toHaveBeenCalledWith('/', '')
		expect(wrapper.text()).toContain('No orphaned sidecars found.')
		expect(button(wrapper, 'Move 0 sidecars to trash')).toBeUndefined()
	})

	// spec: XMP-009.10
	it('moves nothing until the user confirms, and a new folder or scan drops the list', async () => {
		const fake = seams()
		const wrapper = mountPage(fake)

		await scanIn(wrapper)
		expect(button(wrapper, 'Move 3 sidecars to trash')).toBeDefined()
		await scanIn(wrapper)
		await wrapper.findComponent(FolderTree).vm.$emit('toggle', '/Other')
		await flushPromises()

		expect(button(wrapper, 'Move 3 sidecars to trash')).toBeUndefined()
		expect(wrapper.findAll('.orphaned-sidecars__folder')).toHaveLength(0)
		expect(fake.trash).not.toHaveBeenCalled()
	})

	// spec: XMP-009.12
	it('moves the list once confirmed and reports the moved and the skipped with their reason', async () => {
		const fake = seams()
		const wrapper = mountPage(fake)
		await scanIn(wrapper)

		await button(wrapper, 'Move 3 sidecars to trash')!.trigger('click')
		await flushPromises()

		expect(fake.trash).toHaveBeenCalledTimes(1)
		expect(wrapper.text()).toContain('2 moved to the trash bin, 1 skipped')
		expect(wrapper.find('.orphaned-sidecars__skipped').text()).toContain('/Photos/b.CR2.xmp – A photo or video it belongs to is in its folder now')
		expect(button(wrapper, 'Move 3 sidecars to trash')).toBeUndefined()
	})

	// spec: XMP-009.12
	it('says when a request failed', async () => {
		const fake = seams()
		fake.trash.mockRejectedValueOnce(new Error('offline'))
		const wrapper = mountPage(fake)
		await scanIn(wrapper)

		await button(wrapper, 'Move 3 sidecars to trash')!.trigger('click')
		await flushPromises()

		expect(wrapper.text()).toContain('0 moved to the trash bin, 3 skipped')
		expect(wrapper.text()).toContain('Could not reach the server; the sidecars not sent stay where they are.')
		expect(wrapper.find('.orphaned-sidecars__skipped').text()).toContain('Not sent, because a request failed')
	})

	// spec: XMP-009.11
	it('says when the scan failed', async () => {
		const fake = seams()
		fake.scan.mockRejectedValueOnce(new Error('offline'))
		const wrapper = mountPage(fake)

		await scanIn(wrapper)

		expect(wrapper.text()).toContain('Could not look for orphaned sidecars. Try again.')
	})
})
