// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LoupeInfo from '../../../src/components/LoupeInfo.vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { listingEntry, pictureOf } from '../logic/listing-entries.ts'

/** The info panel's definition list as term → value. */
function infoRows(wrapper: ReturnType<typeof mount>) {
	const terms = wrapper.findAll('dt').map((term) => term.text())
	const values = wrapper.findAll('dd').map((value) => value.text())
	return Object.fromEntries(terms.map((term, at) => [term, values[at]]))
}

describe('LoupeInfo shake risk', () => {
	const mountInfo = (picture: ReturnType<typeof pictureOf>) => mount(LoupeInfo, { props: { picture, folderSet: { paths: ['/P'], subfolders: true }, decision: UNDECIDED } })

	// spec: SERIES-009.3
	it('shows the exposure facts and the shake risk with its reason', () => {
		const exposure = { exposureTime: 1 / 15, focalLength: 200, focalLength35: 300, aperture: 5.6, iso: 800 }
		const wrapper = mountInfo(pictureOf(listingEntry(1, '/P/IMG_1.JPG', { exposure })))
		expect(infoRows(wrapper)).toMatchObject({ Exposure: '1/15 s · f/5.6 · ISO 800', 'Focal length': '200 mm (300 mm full frame)', Hints: 'Shake risk' })
		expect(wrapper.text()).toContain('1/15 s at 300 mm full frame; slower than 1/300 s')
		expect(wrapper.find('.loupe-info__note').text()).not.toContain('series')
	})

	// spec: SERIES-009.3
	it('shows the facts without a hint for a steady shot, and nothing without facts', () => {
		const steady = infoRows(mountInfo(pictureOf(listingEntry(1, '/P/IMG_1.JPG', { exposure: { exposureTime: 1 / 1000, focalLength: 50, focalLength35: null, aperture: null, iso: null } }))))
		expect(steady).toMatchObject({ Exposure: '1/1000 s', 'Focal length': '50 mm' })
		expect(Object.keys(steady)).not.toContain('Hints')
		const none = Object.keys(infoRows(mountInfo(pictureOf(listingEntry(2, '/P/IMG_2.JPG')))))
		expect(none).not.toContain('Exposure')
		expect(none).not.toContain('Focal length')
		expect(none).not.toContain('Hints')
	})
})
