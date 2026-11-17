// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, upload, withCaptureTime } from './files.ts'

const PHONE = { width: 320, height: 640 }
const DESKTOP = { width: 1440, height: 900 }

/** Uploads one photo per capture time into a new folder and culls it. */
async function cullShots(page: Page, times: readonly string[]) {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Brackets ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	for (const [index, time] of times.entries()) {
		await upload(page, `${folder}/IMG_000${index + 1}.jpg`, withCaptureTime(JPEG, `2026:11:10 ${time}`))
	}
	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell')).toHaveCount(times.length)
}

// spec: SERIES-002.12
test('brackets a series across a row wrap with a cap at either end', async ({ page }) => {
	await page.setViewportSize(PHONE)
	await cullShots(page, ['10:00:00', '10:00:01', '10:00:02', '10:00:03', '10:00:04'])
	const tops = await page.getByRole('gridcell').evaluateAll((cells) => cells.map((cell) => Math.round(cell.getBoundingClientRect().top)))
	const rows = new Set(tops).size
	expect(rows).toBeGreaterThan(1)

	const brackets = page.locator('.photo-grid__bracket')
	await expect(brackets).toHaveCount(rows)
	await expect(brackets.first()).toHaveClass(/photo-grid__bracket--start/)
	await expect(brackets.first()).not.toHaveClass(/photo-grid__bracket--end/)
	await expect(brackets.last()).toHaveClass(/photo-grid__bracket--end/)
	await expect(page.locator('.photo-tile__series')).toHaveCount(1)
	await expect(page.getByRole('gridcell').nth(1)).toHaveAccessibleName(/Series, photo 2 of 5/)
})

// spec: SERIES-002.13
test('opens the compare on the series from its badge', async ({ page }) => {
	await page.setViewportSize(DESKTOP)
	await cullShots(page, ['10:00:00', '10:00:01', '10:00:02'])

	await page.getByRole('button', { name: 'Series of 3 – compare' }).click()
	await expect(page.getByRole('dialog', { name: /^Compare series/ })).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(page.getByRole('dialog', { name: /^Compare series/ })).toBeHidden()
})

// spec: SERIES-002.15
test('jumps the focus between series with Alt and an arrow', async ({ page }) => {
	await page.setViewportSize(DESKTOP)
	await cullShots(page, ['10:00:00', '10:00:01', '10:01:30', '10:03:00', '10:03:01'])
	await page.getByRole('gridcell').first().focus()

	await page.keyboard.press('Alt+ArrowRight')
	await expect(page.getByRole('gridcell').nth(3)).toBeFocused()
	await page.keyboard.press('Alt+ArrowRight')
	await expect(page.getByRole('gridcell').nth(3)).toBeFocused()
	await page.keyboard.press('Alt+ArrowLeft')
	await expect(page.getByRole('gridcell').first()).toBeFocused()
})
