// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { expectAccessible, SCHEMES } from './a11y.ts'
import { closeByEscape, cullFolder, E2E_SETTINGS, putSettings, resetViewState } from './cull.ts'
import { createFolder, JPEG, RAW, upload, withCaptureTime } from './files.ts'

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

/** Culls a new folder of a burst of two with a RAW partner and one loose photo. */
async function cullPhotos(page: Page): Promise<void> {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `A11y ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:01'))
	await upload(page, `${folder}/IMG_0001.NEF`, RAW)
	await upload(page, `${folder}/IMG_0002.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:02'))
	await upload(page, `${folder}/IMG_0003.jpg`, withCaptureTime(JPEG, '2026:11:10 13:00:00'))
	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell')).toHaveCount(3)
}

/** Opens `dialog` by `open` and scans it, then closes it by its close button (Escape skips a focused switch, `TODO.md`). */
async function checkDialog(page: Page, dialog: Locator, screen: string, open: () => Promise<void>): Promise<void> {
	await open()
	await expect(dialog).toBeVisible()
	await expectAccessible(page, screen)
	await dialog.getByRole('button', { name: 'Close', exact: true }).first().click()
	await expect(dialog).toBeHidden()
}

for (const scheme of SCHEMES) {
	// spec: APP-001.15
	test(`finds no serious accessibility fault on any screen, in the ${scheme} theme`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: scheme })
		await cullPhotos(page)
		const at = (screen: string) => `${screen}, ${scheme}`

		await expectAccessible(page, at('grid'))

		await checkDialog(page, page.getByRole('dialog', { name: 'Choose folders' }), at('folder tree'), () => page.getByRole('button', { name: 'Change folders', exact: true }).click())
		await expect(page.getByRole('gridcell')).toHaveCount(3)

		await page.getByRole('button', { name: 'More' }).click()
		await checkDialog(page, page.getByRole('dialog', { name: 'Settings' }), at('settings'), () => page.getByRole('button', { name: 'Settings', exact: true }).click())

		await page.getByRole('button', { name: 'Select', exact: true }).click()
		await page.getByRole('gridcell', { name: /^IMG_0003/ }).click()
		await expectAccessible(page, at('selection'))
		await checkDialog(page, page.getByRole('dialog', { name: 'Move 1 photo' }), at('Move…'), () => page.getByRole('button', { name: 'Move…', exact: true }).click())
		await page.getByRole('button', { name: 'Reject', exact: true }).click()
		await page.getByRole('button', { name: 'Done' }).click()

		await page.getByRole('button', { name: 'More' }).click()
		await expect(page.getByRole('menu').or(page.locator('.v-popper__popper--shown'))).toBeVisible()
		await expectAccessible(page, at('⋯ menu'))
		await page.getByRole('button', { name: 'Review rejects: 1' }).click()
		await expect(page.getByRole('menu')).toBeHidden()
		const review = page.getByRole('dialog', { name: 'Review rejects' })
		await expect(review).toBeVisible()
		await expectAccessible(page, at('reject review'))
		await review.getByRole('button', { name: 'Continue: delete 1' }).click()
		const summary = page.getByRole('dialog', { name: 'Delete 1 photo' })
		await expect(summary).toBeVisible()
		await expectAccessible(page, at('Delete…'))
		await closeByEscape(page, summary)

		await page.getByRole('gridcell', { name: /^IMG_0001/ }).click()
		const loupe = page.getByRole('dialog', { name: 'Loupe' })
		await expect(loupe.getByRole('heading', { name: 'IMG_0001' })).toBeVisible()
		const guide = loupe.getByRole('dialog', { name: 'How to cull' })
		await expect(guide).toBeVisible()
		await expectAccessible(page, at('gesture guide'))
		await guide.getByRole('button', { name: 'Got it' }).click()
		await expectAccessible(page, at('loupe'))
		await loupe.getByRole('button', { name: 'Close loupe' }).click()
		await expect(loupe).toBeHidden()

		await page.getByRole('button', { name: /^Compare series: \d/ }).click()
		const compare = page.getByRole('dialog', { name: /^Compare series 1 of 1/ })
		await expect(compare).toBeVisible()
		await expectAccessible(page, at('series compare'))
		await compare.getByRole('button', { name: 'View photo 1 full screen' }).click()
		await expect(page.getByRole('dialog', { name: 'Series viewer' })).toBeVisible()
		await expectAccessible(page, at('series viewer'))
	})
}
