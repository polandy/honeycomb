// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { logIn, occ, trackRequests } from './server.ts'

const PHONE = { name: 'phone', width: 390, height: 844 }
const IPAD = { name: 'iPad', width: 1194, height: 834 }
const IPAD_PORTRAIT = { name: 'iPad portrait', width: 834, height: 1194 }

/** Every route of the app, by the title its page shows. */
const ROUTES = [
	{ path: '/index.php/apps/honeycomb/', title: 'Where is your library?' },
	{ path: '/index.php/apps/honeycomb/similarity', title: 'Similarity' },
	{ path: '/index.php/apps/honeycomb/statistics', title: 'Statistics' },
	{ path: '/index.php/apps/honeycomb/orphaned-sidecars', title: 'Orphaned sidecars' },
]

test.use({ storageState: { cookies: [], origins: [] } })

let user = { username: '', password: '' }
let drainRequests = async (): Promise<void> => {}

test.beforeEach(async ({ page }) => {
	drainRequests = trackRequests(page)
	user = { username: `nav-${randomUUID().slice(0, 8)}`, password: `e2e-${randomUUID()}` }
	occ(['user:add', '--password-from-env', user.username], { OC_PASS: user.password })
	await logIn(page, user)
})

test.afterEach(async () => {
	await drainRequests()
	occ(['user:delete', user.username])
})

const navigationOf = (page: Page) => page.getByRole('navigation', { name: 'honeycomb navigation' })

/** Whether two boxes share any area. */
function overlap(a: { x: number, y: number, width: number, height: number }, b: { x: number, y: number, width: number, height: number }) {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** The navigation's rendered box, checked to lie inside the viewport with its entries drawn. */
async function shownNavigation(page: Page, viewport: { width: number }): Promise<{ x: number, width: number }> {
	const statistics = navigationOf(page).getByRole('link', { name: 'Statistics' })
	await expect(statistics).toBeInViewport()
	const box = (await page.locator('.app-navigation').boundingBox())!
	expect(box.x).toBeGreaterThanOrEqual(0)
	expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
	expect(box.width).toBeGreaterThan(200)
	return box
}

/** Opens and closes the navigation with its toggle, checking what the browser draws each time. */
async function expandAndCollapse(page: Page, viewport: { width: number }, title: Locator) {
	const toggle = page.locator('.app-navigation-toggle')
	await expect(toggle).toHaveAttribute('aria-expanded', 'false')
	await expect(navigationOf(page).getByRole('link', { name: 'Statistics' })).not.toBeInViewport()
	expect(overlap((await toggle.boundingBox())!, (await title.boundingBox())!)).toBe(false)

	await toggle.click()
	await expect(toggle).toHaveAttribute('aria-expanded', 'true')
	const navigation = await shownNavigation(page, viewport)
	const content = (await page.locator('.app-content').boundingBox())!
	// From 1024 px the navigation sits beside the page, below it covers the page as a drawer.
	expect(content.x >= navigation.x + navigation.width - 1).toBe(viewport.width >= 1024)

	await toggle.click()
	await expect(toggle).toHaveAttribute('aria-expanded', 'false')
	await expect(navigationOf(page).getByRole('link', { name: 'Statistics' })).not.toBeInViewport()
}

// spec: APP-001.23
for (const viewport of [PHONE, IPAD, IPAD_PORTRAIT]) {
	for (const route of ROUTES) {
		test(`expands and collapses the navigation on ${route.path} on a ${viewport.name}`, async ({ page }) => {
			await page.setViewportSize(viewport)
			await page.goto(route.path)
			const title = page.getByRole('heading', { name: route.title })
			await expect(title).toBeVisible()

			await expandAndCollapse(page, viewport, title)
		})
	}
}

// spec: APP-001.8, APP-001.23
test('keeps the navigation open on every page once the user opened it on an iPad', async ({ page }) => {
	await page.setViewportSize(IPAD)
	await page.goto('/index.php/apps/honeycomb/statistics')
	await page.locator('.app-navigation-toggle').click()
	await expect(page.locator('.app-navigation-toggle')).toHaveAttribute('aria-expanded', 'true')
	// NcAppNavigation reports the toggle only after its slide animation.
	await expect.poll(() => page.evaluate((name) => window.localStorage.getItem(`honeycomb.navigationOpen.${name}`), user.username)).toBe('true')

	for (const route of ROUTES) {
		await page.goto(route.path)
		await expect(page.getByRole('heading', { name: route.title })).toBeVisible()
		await expect(page.locator('.app-navigation-toggle')).toHaveAttribute('aria-expanded', 'true')
		await shownNavigation(page, IPAD)
	}
})

// spec: APP-001.23, APP-001.24
test('marks the page shown and opens the cull page\'s settings from a page of its own on a phone', async ({ page }) => {
	await page.setViewportSize(PHONE)
	await page.goto('/index.php/apps/honeycomb/orphaned-sidecars')
	await page.locator('.app-navigation-toggle').click()
	await expect(navigationOf(page).locator('.active')).toHaveText('Orphaned sidecars')

	await navigationOf(page).getByRole('link', { name: 'Settings' }).click()

	await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
	await expect(page).toHaveURL(/\/apps\/honeycomb\/$/)
})
