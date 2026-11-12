// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CDPSession, Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { openLoupe, putSettings } from './cull.ts'

const IPAD = {
	portrait: { width: 820, height: 1180 },
	landscape: { width: 1180, height: 820 },
}
/** How far a finger lifts the photo: past the swipe distance at either size. */
const LIFT = 320

test.use({ hasTouch: true })

/** One finger on the stage's middle, moved by `dy`, through real touch input. */
async function finger(cdp: CDPSession, stage: Locator, type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', dy = 0) {
	const box = (await stage.boundingBox())!
	const lifted = type === 'touchEnd' || type === 'touchCancel'
	await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: lifted ? [] : [{ x: box.x + box.width / 2, y: box.y + box.height / 2 + dy }] })
}

/** The computed border width, outline and background of a loupe flag button. */
function lookOf(loupe: Locator, flag: string) {
	return loupe.locator(`.action-bar .flag-buttons__button--${flag}`).evaluate((button) => {
		const style = getComputedStyle(button)
		return { border: style.borderTopWidth, outline: style.outlineStyle, background: style.backgroundColor }
	})
}

/** A CDP session to send touch input to the page. */
const touchInput = (page: Page) => page.context().newCDPSession(page)

for (const [orientation, viewport] of Object.entries(IPAD)) {
	// spec: LOUPE-002.14
	test(`hints the flag a swipe sets while the finger lifts the photo, in iPad ${orientation}`, async ({ page }) => {
		await page.setViewportSize(viewport)
		const loupe = await openLoupe(page)
		const stage = loupe.locator('.loupe-stage')
		const hint = loupe.locator('.loupe-swipe-hint')
		const cdp = await touchInput(page)

		await finger(cdp, stage, 'touchStart')
		await finger(cdp, stage, 'touchMove', -LIFT / 2)
		await finger(cdp, stage, 'touchMove', -LIFT)
		await expect(hint).toHaveText('Pick')
		await expect(hint).toHaveClass(/loupe-swipe-hint--armed/)
		await finger(cdp, stage, 'touchCancel')
		await expect(hint).toBeHidden()
		await expect(loupe.getByRole('heading', { name: 'IMG_0001' })).toBeVisible()

		await finger(cdp, stage, 'touchStart')
		await finger(cdp, stage, 'touchMove', LIFT / 2)
		await finger(cdp, stage, 'touchMove', LIFT)
		await expect(hint).toHaveText('Reject')
		await expect(hint).toHaveCSS('background-color', 'rgb(179, 48, 44)')
		await finger(cdp, stage, 'touchEnd')
		await expect(hint).toBeHidden()
		await expect(page.getByRole('status').filter({ hasText: 'Rejected IMG_0001' })).toBeVisible()
	})

	// spec: LOUPE-002.13
	test(`draws Unflag's pressed state as a fill with the same border as Pick and Reject, in iPad ${orientation}`, async ({ page }) => {
		await page.setViewportSize(viewport)
		const loupe = await openLoupe(page)
		await expect(loupe.locator('.action-bar .flag-buttons__button--unflagged')).toHaveAttribute('aria-pressed', 'true')

		const [pick, reject, unflag] = [await lookOf(loupe, 'picked'), await lookOf(loupe, 'rejected'), await lookOf(loupe, 'unflagged')]
		expect(unflag.border).toBe(pick.border)
		expect(unflag.border).toBe(reject.border)
		expect(unflag.outline).toBe('none')
		expect(unflag.background).toBe('rgb(84, 88, 94)')
	})
}

// spec: LOUPE-001.20
test('pins the filmstrip by the pin at its own end in landscape, and offers none in portrait', async ({ page }) => {
	await page.setViewportSize(IPAD.landscape)
	const loupe = await openLoupe(page)
	const strip = loupe.getByRole('navigation', { name: 'Filmstrip' })
	const pin = loupe.locator('.loupe-filmstrip').getByRole('button', { name: 'Pin filmstrip' })
	try {
		await expect(loupe.locator('.loupe-title-row').getByRole('button', { name: 'Pin filmstrip' })).toHaveCount(0)
		const stripBox = (await strip.boundingBox())!
		const pinBox = (await pin.boundingBox())!
		expect(pinBox.y).toBeCloseTo(stripBox.y, 0)
		expect(pinBox.x).toBeGreaterThanOrEqual(stripBox.x + stripBox.width - 1)

		await pin.tap()
		await expect(pin).toHaveAttribute('aria-pressed', 'true')
		const stage = (await loupe.locator('.loupe-stage').boundingBox())!
		expect(stage.y + stage.height).toBeLessThanOrEqual((await strip.boundingBox())!.y)

		await page.setViewportSize(IPAD.portrait)
		await expect(pin).toBeHidden()
	} finally {
		await putSettings(page, {})
	}
})
