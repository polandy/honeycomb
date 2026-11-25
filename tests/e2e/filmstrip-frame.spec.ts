// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { openLoupe } from './cull.ts'
import { emulateIpad, IPAD_MINI } from './touch-targets.ts'

/** Checks the series frame hugs the photo row: the strip, the frame and its tab are as high as the photos, the tab right before the first. */
async function expectFrameHugsPhotos(loupe: Locator): Promise<void> {
	const filmstrip = loupe.getByRole('navigation', { name: 'Filmstrip' })
	const tab = filmstrip.getByRole('button', { name: 'Series of 2 – compare' })
	await expect(tab).toBeVisible()
	// One frame measures every box, so the loupe's reflow as the series forms cannot move one between two reads.
	const { strip, frame, tabBox, photo } = await filmstrip.evaluate((element) => {
		const box = (selector: string) => element.querySelector(selector)!.getBoundingClientRect().toJSON() as DOMRect
		return { strip: element.getBoundingClientRect().toJSON() as DOMRect, frame: box('.loupe-filmstrip__frame'), tabBox: box('.loupe-filmstrip__tab'), photo: box('[aria-label="IMG_0001"]') }
	})

	expect(strip.height).toBe(photo.height)
	expect([frame.y, frame.height]).toEqual([photo.y, photo.height])
	expect([tabBox.y, tabBox.height]).toEqual([photo.y, photo.height])
	expect(tabBox.width).toBeGreaterThanOrEqual(44)
	expect(tabBox.x + tabBox.width).toBe(photo.x)
	expect(tabBox.x).toBe(frame.x)
}

// spec: LOUPE-001.19
test('hugs the photo row with the series frame and puts its tab in a column before the first photo, with a mouse', async ({ page }) => {
	await expectFrameHugsPhotos(await openLoupe(page))
})

test.describe('with a finger', () => {
	test.use({ hasTouch: true })

	for (const orientation of Object.keys(IPAD_MINI) as (keyof typeof IPAD_MINI)[]) {
		// spec: LOUPE-001.19
		test(`hugs the photo row with the series frame and puts its tab in a column before the first photo, in iPad ${orientation}`, async ({ page }) => {
			await emulateIpad(page, orientation)
			await expectFrameHugsPhotos(await openLoupe(page))
		})
	}
})
