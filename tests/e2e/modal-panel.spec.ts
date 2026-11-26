// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserContextOptions, Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, openFolderPicker } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'
import { WEBKIT } from './webkit.ts'

// The reference devices (docs/dev/plan.md Reference devices); the phone is below the 520 px sheet breakpoint.
const DEVICES: Record<string, BrowserContextOptions> = {
	desktop: { viewport: { width: 1440, height: 900 } },
	'ipad-mini-portrait': { viewport: { width: 744, height: 1133 }, isMobile: true, hasTouch: true },
	'pixel-portrait': { viewport: { width: 427, height: 952 }, isMobile: true, hasTouch: true },
}
const CLOSE_PATHS = ['close button', 'Escape', 'backdrop'] as const
// A point on the backdrop: clear of a centred panel and above a bottom sheet's 24 px gap.
const BACKDROP = { x: 4, y: 4 }

/** Closes `panel` by `path`, a tap where the device has touch, and checks it is gone. */
async function closeBy(page: Page, panel: Locator, path: typeof CLOSE_PATHS[number]) {
	// The panel closes only once its focus trap holds the focus, after its fade-in.
	await expect.poll(() => panel.evaluate((element) => element.contains(document.activeElement))).toBe(true)
	const touch = (await page.evaluate(() => navigator.maxTouchPoints)) > 0
	if (path === 'close button') {
		const button = panel.locator('.modal-container__close')
		await (touch ? button.tap() : button.click())
	} else if (path === 'Escape') {
		await page.keyboard.press('Escape')
	} else {
		await (touch ? page.touchscreen.tap(BACKDROP.x, BACKDROP.y) : page.mouse.click(BACKDROP.x, BACKDROP.y))
	}
	await expect(panel).toBeHidden()
}

/** Checks the panel is on screen, a bottom sheet below 520 px, and holds the page still. */
async function expectRendered(page: Page, panel: Locator) {
	const box = (await panel.locator('.modal-container').boundingBox())!
	const viewport = page.viewportSize()!
	expect(box.width).toBeGreaterThan(0)
	expect(box.y).toBeGreaterThanOrEqual(0)
	expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
	if (viewport.width <= 520) {
		expect(box.width).toBe(viewport.width)
		expect(Math.round(box.y + box.height)).toBe(viewport.height)
	}
	await expect(panel).toHaveAttribute('aria-modal', 'true')
	expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden')
}

/** Checks that `Tab` and `Shift+Tab` keep the focus inside the panel, wrapping at its ends. */
async function expectFocusWraps(page: Page, panel: Locator) {
	const inside = () => panel.evaluate((element) => element.contains(document.activeElement))
	await expect.poll(inside).toBe(true)
	for (const key of ['Shift+Tab', 'Shift+Tab', 'Tab', 'Tab', 'Tab']) {
		await page.keyboard.press(key)
		expect(await inside()).toBe(true)
	}
}

for (const [device, options] of Object.entries(DEVICES)) {
	test.describe(device, () => {
		test.use(options)

		for (const path of CLOSE_PATHS) {
			// spec: APP-001.23, APP-001.24, APP-001.6, LISTING-003.11 (focus return and wrap on the desktop)
			test(`closes Choose folders on its first opening by the ${path}`, async ({ page }) => {
				await page.goto('/index.php/apps/honeycomb/')
				const picker = await openFolderPicker(page)
				const opener = page.getByRole('navigation', { name: 'honeycomb navigation' }).getByRole('link', { name: 'Folder', exact: true })
				await expectRendered(page, picker)
				if (device === 'desktop') {
					await expectFocusWraps(page, picker)
				}

				await closeBy(page, picker, path)

				await expect(page.locator('.folders-home')).toBeVisible()
				expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden')
				if (device === 'desktop') {
					await expect(opener).toBeFocused()
				}
			})
		}

		// spec: APP-001.23
		test('closes Keyboard shortcuts by every path and keeps it open on a click inside', async ({ page }) => {
			const folder = `Panel ${randomUUID().slice(0, 8)}`
			await page.goto('/index.php/apps/honeycomb/')
			await createFolder(page, folder)
			await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
			await cullFolder(page, folder)
			const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' })

			for (const path of CLOSE_PATHS) {
				await page.keyboard.press('Shift+?')
				await expect(sheet.getByRole('rowheader', { name: 'Flags' })).toBeVisible()
				await expectRendered(page, sheet)
				await sheet.getByRole('rowheader', { name: 'Flags' }).click()
				await expect(sheet).toBeVisible()

				await closeBy(page, sheet, path)
			}
		})
	})
}

// spec: APP-001.23
test(`closes Choose folders by every path on the project's own device ${WEBKIT}`, async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	for (const path of CLOSE_PATHS) {
		const picker = await openFolderPicker(page)
		await expectRendered(page, picker)

		await closeBy(page, picker, path)
	}
})
