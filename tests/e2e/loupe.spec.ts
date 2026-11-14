// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { openLoupe } from './cull.ts'

/** Whether the middle of Nextcloud's header is on top, not under the loupe. */
function headerUncovered(page: Page) {
	return page.evaluate(() => {
		const header = document.getElementById('header')!.getBoundingClientRect()
		return document.elementFromPoint(header.x + header.width / 2, header.y + header.height / 2)?.closest('#header') !== null
	})
}

// spec: LOUPE-001.2, LOUPE-001.3
test('opens a photo in the loupe, pages by key and closes back to the grid', async ({ page }) => {
	const loupe = await openLoupe(page)

	await page.keyboard.press('ArrowRight')
	await expect(loupe.getByRole('heading', { name: 'IMG_0002' })).toBeVisible()
	await expect(loupe.getByText('2 of 2')).toBeVisible()

	await expect.poll(() => headerUncovered(page)).toBe(false)
	await loupe.getByRole('button', { name: 'Toggle Nextcloud navigation' }).click()
	await expect.poll(() => headerUncovered(page)).toBe(true)

	await page.keyboard.press('Escape')
	await expect(loupe).toBeHidden()
	await expect(page.getByRole('gridcell', { name: 'IMG_0002, JPG only' })).toBeFocused()
})

// spec: LOUPE-001.13, LOUPE-001.19
test('shows the filmstrip as square photos edge to edge at full opacity from its left edge, the shown one with a white ring and a dark edge', async ({ page }) => {
	const loupe = await openLoupe(page)
	const filmstrip = loupe.getByRole('navigation', { name: 'Filmstrip' })
	const shown = filmstrip.getByRole('button', { name: 'IMG_0001' })
	const other = filmstrip.getByRole('button', { name: 'IMG_0002' })

	await expect(shown).toHaveCSS('opacity', '1')
	await expect(other).toHaveCSS('opacity', '1')
	const ring = (button: typeof shown) => button.evaluate((element) => getComputedStyle(element, '::before').boxShadow)
	expect(await ring(shown)).toBe('rgb(255, 255, 255) 0px 0px 0px 3px inset, rgb(0, 0, 0) 0px 0px 0px 4px inset')
	expect(await ring(other)).toBe('none')
	const [strip, first, second] = [(await filmstrip.boundingBox())!, (await shown.boundingBox())!, (await other.boundingBox())!]
	expect(first.width).toBe(first.height)
	expect(second.x).toBe(first.x + first.width)
	expect(Math.abs(first.x - strip.x)).toBeLessThanOrEqual(1)
	expect((await loupe.locator('.action-bar__row').boundingBox())!.y).toBeGreaterThanOrEqual(strip.y + strip.height)
})

// spec: LOUPE-002.11
test('puts Pick and Reject at the side edges and Unflag bottom centre above the filmstrip in landscape, and Pick, Unflag, Reject in a row in portrait', async ({ page }) => {
	const loupe = await openLoupe(page)
	const button = (name: string) => loupe.getByRole('button', { name, exact: true }).first()
	const box = async (name: string) => (await button(name).boundingBox())!
	const frame = (await loupe.boundingBox())!
	const strip = (await loupe.getByRole('navigation', { name: 'Filmstrip' }).boundingBox())!

	const [pick, reject, centre] = [await box('Pick'), await box('Reject'), await box('Unflag')]
	expect(pick.x - frame.x).toBeLessThan(frame.width / 10)
	expect(frame.x + frame.width - (reject.x + reject.width)).toBeLessThan(frame.width / 4)
	expect(reject.x).toBeGreaterThan(frame.x + frame.width / 2)
	expect(Math.abs(centre.x + centre.width / 2 - (frame.x + frame.width / 2))).toBeLessThanOrEqual(1)
	expect(centre.y + centre.height).toBeLessThanOrEqual(strip.y)
	expect(centre.y).toBeGreaterThan(pick.y + pick.height / 2)
	for (const name of ['Pick', 'Reject', 'Unflag']) {
		const label = button(name).getByText(name, { exact: true })
		await expect(label).toBeVisible()
		const word = (await label.boundingBox())!
		const edge = await box(name)
		expect(word.y).toBeGreaterThanOrEqual(edge.y)
		expect(word.y + word.height).toBeLessThanOrEqual(edge.y + edge.height)
	}

	await page.setViewportSize({ width: 600, height: 900 })
	const photo = (await loupe.getByRole('img', { name: 'IMG_0001' }).boundingBox())!
	const [portraitPick, portraitReject, unflag] = [await box('Pick'), await box('Reject'), await box('Unflag')]
	expect(portraitPick.y).toBeGreaterThanOrEqual(photo.y + photo.height)
	expect(portraitReject.y).toBe(portraitPick.y)
	expect(unflag.y).toBe(portraitPick.y)
	expect(portraitPick.x).toBeLessThan(unflag.x)
	expect(unflag.x).toBeLessThan(portraitReject.x)

	await page.setViewportSize({ width: 952, height: 427 })
	const [phonePick, phoneReject, phoneUnflag] = [await box('Pick'), await box('Reject'), await box('Unflag')]
	const phoneStrip = (await loupe.getByRole('navigation', { name: 'Filmstrip' }).boundingBox())!
	for (const flag of [phonePick, phoneReject, phoneUnflag]) {
		expect(flag.y + flag.height).toBeLessThanOrEqual(phoneStrip.y)
	}
})

// spec: KEYS-001.10, KEYS-001.12
test('picks by P, undoes it by Ctrl+Z and opens the shortcut sheet by ?', async ({ page }) => {
	const loupe = await openLoupe(page)
	const toast = page.getByRole('status').filter({ hasText: 'IMG_0001' })

	await page.keyboard.press('p')
	await expect(toast).toContainText('Picked IMG_0001')
	await page.keyboard.press('Control+z')
	await expect(toast).toContainText('Undid: Picked IMG_0001')
	await page.keyboard.press('ArrowLeft')
	await expect(loupe.getByRole('heading', { name: 'IMG_0001' })).toBeVisible()
	await expect(loupe.getByRole('button', { name: 'Pick' }).first()).toHaveAttribute('aria-pressed', 'false')

	await page.keyboard.press('Shift+?')
	const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
	await expect(sheet.getByRole('rowheader', { name: 'Flags' })).toBeVisible()
	await sheet.getByRole('button', { name: 'Close' }).last().click()
	await expect(sheet).toBeHidden()
})
