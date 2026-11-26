// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FolderSet } from '../../../src/logic/folder-set.ts'
import type { ImmichOnlyOffer } from '../../../src/logic/immich-only.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import FolderPicker from '../../../src/components/FolderPicker.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'
import { DialogStub } from './stubs.ts'

const MARK = TRANSLATED_MARK
const ONLY_IMMICH = `${MARK}I only use Immich`

/** The picker with no folders, offering *I only use Immich* as given. */
async function mountPicker(immichOnly?: ImmichOnlyOffer, current: FolderSet | null = null) {
	const wrapper = mount(FolderPicker, {
		props: { current, ...(immichOnly === undefined ? {} : { immichOnly }), listFolders: async () => [], listEntries: () => new Promise(() => undefined) },
		global: { stubs: { NcDialog: DialogStub } },
	})
	await flushPromises()
	return wrapper
}

const onlyImmichButton = (wrapper: Awaited<ReturnType<typeof mountPicker>>) => wrapper.findAll('button').find((button) => button.text() === ONLY_IMMICH)

describe('FolderPicker: I only use Immich', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: IMMICH-001.21
	it('offers nothing without a connection, nor with an open cull', async () => {
		expect(onlyImmichButton(await mountPicker())).toBeUndefined()
		expect(onlyImmichButton(await mountPicker('none'))).toBeUndefined()
		expect(onlyImmichButton(await mountPicker('ok', { paths: ['/Trip'], subfolders: false }))).toBeUndefined()
	})

	// spec: IMMICH-001.21, IMMICH-001.22
	it('can be chosen while the connection answers ok', async () => {
		const wrapper = await mountPicker('ok')

		await onlyImmichButton(wrapper)!.trigger('click')

		expect(onlyImmichButton(wrapper)!.attributes('disabled')).toBeUndefined()
		expect(wrapper.emitted('immichOnly')).toEqual([[]])
	})

	// spec: IMMICH-001.21
	it.each([
		['asked', 'Checking the Immich connection…'],
		['broken', 'Immich is unavailable because of the server configuration.'],
		['unreachable', 'Immich is unreachable.'],
		['refused', 'Immich refuses the API key.'],
		['key', 'The Immich API key cannot be read.'],
		['version', 'This Immich version is not supported.'],
	] as const)('is disabled while Immich is %s and says why', async (offer, reason) => {
		const wrapper = await mountPicker(offer)

		await onlyImmichButton(wrapper)!.trigger('click')

		expect(onlyImmichButton(wrapper)!.attributes('disabled')).toBeDefined()
		expect(wrapper.emitted('immichOnly')).toBeUndefined()
		expect(wrapper.find('.folder-picker__immich-only-reason').text()).toBe(`${MARK}${reason}`)
	})
})
