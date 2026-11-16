// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN_STATE } from './admin.ts'
import { createFolder, JPEG, upload } from './files.ts'
import { PORT } from './server.ts'

// The reference devices the folder tree is captured on (docs/dev/plan.md Reference devices).
const SCREENSHOT_VIEWPORTS = { desktop: { width: 1440, height: 900 }, 'ipad-mini-portrait': { width: 744, height: 1133 }, 'ipad-mini-landscape': { width: 1133, height: 744 }, 'pixel-portrait': { width: 427, height: 952 } }
const TOUCH_TARGET = 44

/** Creates `Tree <id>/2026/Day 1` with one photo and opens the picker on it. */
async function treeFixture(page: Page) {
	const root = `Tree ${randomUUID().slice(0, 8)}`
	await page.goto('/index.php/apps/honeycomb/')
	await createFolder(page, root)
	await createFolder(page, `${root}/2026`)
	await createFolder(page, `${root}/2026/Day 1`)
	await upload(page, `${root}/2026/Day 1/IMG_0001.jpg`, JPEG)
	await page.reload()
	const tree = page.getByRole('dialog', { name: 'Choose folders' }).getByRole('tree', { name: 'Folders' })
	// By the folder name alone: a badge adds to the treeitem's accessible name.
	const item = (name: string) => tree.getByRole('treeitem').filter({ has: page.locator('.folder-tree__name').getByText(name, { exact: true }) })
	return { root, tree, item }
}

// spec: LISTING-003.14
test('keeps the status line quiet and every folder row one height', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const id = randomUUID().slice(0, 8)
	await createFolder(page, `Rows ${id} parent`)
	await createFolder(page, `Rows ${id} parent/Child`)
	await createFolder(page, `Rows ${id} leaf`)
	await page.reload()

	const picker = page.getByRole('dialog', { name: 'Choose folders' })
	const status = picker.getByText('Tick one or more folders.')
	const muted = await status.evaluate((element) => {
		const probe = element.ownerDocument.createElement('span')
		probe.style.color = 'var(--color-text-maxcontrast)'
		element.append(probe)
		const colour = getComputedStyle(probe).color
		probe.remove()
		return colour
	})
	await expect(status).toHaveCSS('font-weight', '400')
	await expect(status).toHaveCSS('color', muted)

	const parent = (await picker.getByRole('treeitem', { name: `Rows ${id} parent` }).boundingBox())!
	const leaf = (await picker.getByRole('treeitem', { name: `Rows ${id} leaf` }).boundingBox())!
	expect(parent.height).toBe(leaf.height)
})

// spec: LISTING-003.4, LISTING-003.16, LISTING-003.17
test('expands the folder tree by its arrow and the arrow keys and ticks a subfolder', async ({ page }) => {
	const { root, item } = await treeFixture(page)

	await item(root).locator('.folder-tree__twisty').click()
	await expect(item('2026')).toHaveAttribute('aria-level', '2')
	await expect(item(root)).toHaveAttribute('aria-selected', 'false')
	await item('2026').focus()
	await page.keyboard.press('ArrowRight')
	await expect(item('Day 1')).toHaveAttribute('aria-level', '3')
	await page.keyboard.press('ArrowRight')
	await expect(item('Day 1')).toBeFocused()
	await page.keyboard.press('Space')

	await expect(item('Day 1')).toHaveAttribute('aria-selected', 'true')
	await expect(page.getByText('1 photo in 1 folder')).toBeVisible()
	await page.keyboard.press('ArrowLeft')
	await expect(item('2026')).toBeFocused()
	await page.keyboard.press('ArrowLeft')
	await expect(item('Day 1')).toBeHidden()
	await expect(item('2026')).toHaveAccessibleName(/^2026\s*1 ticked folder inside$/)
	await expect(item(root).locator('.folder-tree__badge > [aria-hidden="true"]')).toHaveText('1 inside')
	await expect(item(root)).toHaveAttribute('aria-selected', 'false')
})

// spec: LISTING-003.18
test('marks the folders below a ticked one as included while Include subfolders is on', async ({ page }) => {
	const { root, item } = await treeFixture(page)
	const picker = page.getByRole('dialog', { name: 'Choose folders' })

	await item(root).click()
	await item(root).locator('.folder-tree__twisty').click()
	await expect(item('2026').locator('.folder-tree__included')).toHaveCount(0)
	await picker.getByText('Include subfolders', { exact: true }).click()

	await expect(item('2026')).toHaveAccessibleName(/^2026\s*included with Tree [0-9a-f]+$/)
	await expect(item('2026')).toHaveAttribute('aria-selected', 'false')
	await expect(item('2026').locator('.folder-tree__box--included')).toBeVisible()
	await expect(picker.getByText('1 photo in 1 folder')).toBeVisible()
	await item('2026').click()
	await expect(item('2026')).toHaveAttribute('aria-selected', 'true')
	await expect(item('2026').locator('.folder-tree__included')).toHaveCount(0)
})

// spec: LISTING-003.16
test('fits the folder tree on the reference devices with 44 px touch targets', async ({ browser }, testInfo) => {
	const context = await browser.newContext({ baseURL: `http://localhost:${PORT}`, storageState: ADMIN_STATE, isMobile: true, hasTouch: true, viewport: SCREENSHOT_VIEWPORTS['ipad-mini-portrait'] })
	const page = await context.newPage()
	const { root, tree, item } = await treeFixture(page)
	await item(root).locator('.folder-tree__twisty').tap()
	await item('2026').locator('.folder-tree__twisty').tap()
	await item('Day 1').tap()
	await expect(item('Day 1')).toHaveAttribute('aria-selected', 'true')

	for (const target of [item('Day 1'), item('2026').locator('.folder-tree__twisty')]) {
		const box = (await target.boundingBox())!
		expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(TOUCH_TARGET)
	}
	for (const [device, viewport] of Object.entries(SCREENSHOT_VIEWPORTS)) {
		await page.setViewportSize(viewport)
		await item('Day 1').scrollIntoViewIfNeeded()
		expect(await tree.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
		await page.screenshot({ path: testInfo.outputPath(`folder-tree-${device}.png`), animations: 'disabled' })
	}
	await context.close()
})
