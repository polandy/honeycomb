// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GridNotices from '../../../src/components/GridNotices.vue'
import { DEFAULT_PAIRING_SETTINGS, pairPictures } from '../../../src/logic/pairing.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'

const pictures = (paths: readonly string[]) => pairPictures(paths.map((path, index) => ({ path, fileId: index + 1 })), DEFAULT_PAIRING_SETTINGS)
const notices = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[role="note"], [role="alert"]').map((notice) => notice.text())

describe('GridNotices', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: LISTING-002.11
	it('warns once for each ambiguous base name of a folder', () => {
		const wrapper = mount(GridNotices, { props: { pictures: pictures(['/P/A.JPG', '/P/a.jpg', '/P/A.NEF', '/P/B.JPG', '/P/x&y.JPG', '/P/x&y.JPEG']), saveFailed: false } })

		// The test catalogue marks a plural form twice, once as a form and once as the chosen text.
		expect(notices(wrapper)).toEqual([
			`${TRANSLATED_MARK}${TRANSLATED_MARK}3 files share the name A; shown as singles`,
			`${TRANSLATED_MARK}${TRANSLATED_MARK}2 files share the name x&y; shown as singles`,
		])
	})

	it('shows nothing while every base name is unique and the last save succeeded', () => {
		const wrapper = mount(GridNotices, { props: { pictures: pictures(['/P/A.JPG', '/P/A.NEF']), saveFailed: false } })

		expect(notices(wrapper)).toEqual([])
	})

	it('reports a failed save before the name warnings', () => {
		const wrapper = mount(GridNotices, { props: { pictures: pictures(['/P/A.JPG', '/P/A.jpg']), saveFailed: true } })

		expect(notices(wrapper)[0]).toBe(`${TRANSLATED_MARK}Could not save the change; the photos show what is stored.`)
		expect(notices(wrapper)).toHaveLength(2)
	})
})
