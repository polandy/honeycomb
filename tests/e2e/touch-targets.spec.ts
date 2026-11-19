// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, E2E_SETTINGS, putSettings, resetViewState } from './cull.ts'
import { createFolder, JPEG, RAW, upload, withCaptureTime } from './files.ts'
import { emulateIpad, expectTouchTargets, IPAD_MINI } from './touch-targets.ts'

test.use({ hasTouch: true })

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

/** Culls a new folder of a burst of two with a RAW partner and one loose photo. */
async function cullPhotos(page: Page): Promise<string> {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Touch ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:01'))
	await upload(page, `${folder}/IMG_0001.NEF`, RAW)
	await upload(page, `${folder}/IMG_0002.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:02'))
	await upload(page, `${folder}/IMG_0003.jpg`, withCaptureTime(JPEG, '2026:11:10 13:00:00'))
	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell')).toHaveCount(3)
	return folder
}

/** Opens `dialog` by `open` and checks its controls, then closes it with Escape. */
async function checkDialog(page: Page, dialog: Locator, screen: string, open: () => Promise<void>): Promise<void> {
	await open()
	await expect(dialog).toBeVisible()
	await expectTouchTargets(dialog, screen)
	await page.keyboard.press('Escape')
	await expect(dialog).toBeHidden()
}

for (const orientation of Object.keys(IPAD_MINI) as (keyof typeof IPAD_MINI)[]) {
	// spec: GRID-001.19
	test(`keeps every control a finger can reach at least 44 × 44 px, in iPad ${orientation}`, async ({ page }) => {
		await emulateIpad(page, orientation)
		await cullPhotos(page)
		const content = page.locator('#content')
		const at = (screen: string) => `${screen}, ${orientation}`

		await expectTouchTargets(content, at('grid'))

		const filters = page.getByRole('button', { name: /^Filters/ })
		if (await filters.isVisible()) {
			await filters.click()
		}
		await expectTouchTargets(content, at('filters'))
		if (await filters.isVisible()) {
			await filters.click()
		}

		await checkDialog(page, page.getByRole('dialog', { name: 'Choose folders' }), at('folder tree'), () => page.getByRole('button', { name: 'Change folders', exact: true }).click())
		await expect(page.getByRole('gridcell')).toHaveCount(3)

		await page.getByRole('button', { name: 'More' }).click()
		await checkDialog(page, page.getByRole('dialog', { name: 'Settings' }), at('settings'), () => page.getByRole('button', { name: 'Settings', exact: true }).click())

		await page.getByRole('button', { name: 'Select', exact: true }).click()
		await page.getByRole('gridcell', { name: /^IMG_0003/ }).click()
		await expectTouchTargets(content, at('selection'))
		await checkDialog(page, page.getByRole('dialog', { name: 'Move 1 photo' }), at('Move…'), () => page.getByRole('button', { name: 'Move…', exact: true }).click())
		await page.getByRole('button', { name: 'Reject', exact: true }).click()
		await page.getByRole('button', { name: 'Done' }).click()

		await page.getByRole('button', { name: 'More' }).click()
		await expectTouchTargets(page.getByRole('menu').or(page.locator('.v-popper__popper--shown')), at('⋯ menu'))
		await page.getByRole('button', { name: /^Review rejects 1/ }).click()
		await expect(page.getByRole('menu')).toBeHidden()
		// The menu fades out above the dialog; the hit test waits until it has left.
		await expect(page.locator('.v-popper__popper').filter({ visible: true })).toHaveCount(0)
		const review = page.getByRole('dialog', { name: 'Review rejects' })
		await expectTouchTargets(review, at('reject review'))
		await review.getByRole('button', { name: 'Continue: delete 1' }).click()
		const summary = page.getByRole('dialog', { name: 'Delete 1 photo' })
		await expectTouchTargets(summary, at('Delete…'))
		await page.keyboard.press('Escape')

		await page.getByRole('gridcell', { name: /^IMG_0001/ }).click()
		const loupe = page.getByRole('dialog', { name: 'Loupe' })
		await expect(loupe.getByRole('heading', { name: 'IMG_0001' })).toBeVisible()
		const guide = loupe.getByRole('dialog', { name: 'How to cull' })
		await expectTouchTargets(guide, at('gesture guide'))
		await guide.getByRole('button', { name: 'Got it' }).click()
		await expectTouchTargets(loupe, at('loupe'))
		await loupe.getByRole('button', { name: 'Close loupe' }).click()
		await expect(loupe).toBeHidden()

		const compareButton = page.getByRole('button', { name: /^Compare series \(?\d/ })
		if (!(await compareButton.isVisible())) {
			await page.getByRole('button', { name: 'More' }).click()
		}
		await compareButton.click()
		const compare = page.getByRole('dialog', { name: /^Compare series 1 of 1/ })
		await expect(compare).toBeVisible()
		await expectTouchTargets(compare, at('series compare'))
		await compare.getByRole('button', { name: 'View photo 1 full screen' }).click()
		const viewer = page.getByRole('dialog', { name: 'Series viewer' })
		await expect(viewer).toBeVisible()
		await expectTouchTargets(viewer, at('series viewer'))
	})
}
