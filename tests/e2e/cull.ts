// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { apiHeaders, createFolder, JPEG, upload } from './files.ts'

const SETTINGS_URL = '/index.php/apps/honeycomb/api/v1/settings'

/** Resolves once the server took a series write; the toast comes with the edit, the write after it. */
export function seriesSaved(page: Page): Promise<unknown> {
	return page.waitForResponse((response) => response.url().endsWith('/api/v1/series') && response.request().method() === 'PUT' && response.ok())
}

/** Waits until the grid's stored series have been read: the grid is busy from the render that shows the cells (SERIES-005.30). */
export async function seriesRead(page: Page): Promise<void> {
	await expect(page.getByRole('grid', { name: 'Photos' })).not.toHaveAttribute('aria-busy', 'true')
}

/** Closes a modal by Escape once its focus trap has taken the focus: the modal closes on Escape only from then on, after its fade-in. */
export async function closeByEscape(page: Page, dialog: Locator): Promise<void> {
	await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
	await page.keyboard.press('Escape')
	await expect(dialog).toBeHidden()
}

/** Opens the folder picker from the navigation's *Folder* on the loaded app, opening the navigation where it starts closed. */
export async function openFolderPicker(page: Page): Promise<Locator> {
	return (await pickFromNavigation(page)).picker
}

/** The folder picker, and whether the navigation had to be opened to reach it. */
async function pickFromNavigation(page: Page): Promise<{ picker: Locator, opened: boolean }> {
	// The start screen shows once the settings are read, after the navigation took its start state.
	await expect(page.locator('.folders-home')).toBeVisible()
	const toggle = page.locator('.app-navigation-toggle')
	const opened = await toggle.getAttribute('aria-expanded') !== 'true'
	if (opened) {
		await toggle.click()
	}
	await page.getByRole('navigation', { name: 'honeycomb navigation' }).getByRole('link', { name: 'Folder', exact: true }).click()
	const picker = page.getByRole('dialog', { name: 'Choose folders' })
	await expect(picker).toBeVisible()
	return { picker, opened }
}

/** Opens the app and culls `folder` from the folder picker, the navigation left as the app started it. */
export async function cullFolder(page: Page, folder: string): Promise<void> {
	await page.goto('/index.php/apps/honeycomb/')
	const { picker, opened } = await pickFromNavigation(page)
	await picker.getByRole('treeitem', { name: folder }).click()
	await picker.getByRole('button', { name: `Cull ${folder}` }).click()
	await expect(picker).toBeHidden()
	const toggle = page.locator('.app-navigation-toggle')
	if (opened && await toggle.getAttribute('aria-expanded') === 'true') {
		await toggle.click()
		await expect(toggle).toHaveAttribute('aria-expanded', 'false')
	}
}

/** Closes the info panel, brings the gesture guide back and sets the first-series hint as seen unless `seriesHintSeen` says otherwise; the view state is the admin's, shared by every test (LOUPE-003). */
export async function resetViewState(page: Page, seriesHintSeen = true): Promise<void> {
	const reset = await page.request.put('/index.php/apps/honeycomb/api/v1/view-state', {
		data: { viewState: { info_panel_open: false, gesture_guide_seen: false, series_hint_seen: seriesHintSeen } },
		headers: await apiHeaders(page),
	})
	expect(reset.status(), await reset.text()).toBe(200)
}

/** Culls a new folder of IMG_0001 and IMG_0002, opens IMG_0001 in the loupe and dismisses the guide. */
export async function openLoupe(page: Page): Promise<Locator> {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Loupe ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)

	await cullFolder(page, folder)
	await page.getByRole('gridcell', { name: 'IMG_0001, JPG only' }).click()

	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await expect(loupe.getByRole('heading', { name: 'IMG_0001' })).toBeVisible()
	await expect(loupe.getByText('1 of 2')).toBeVisible()
	await expect(loupe.getByRole('img', { name: 'IMG_0001' })).toHaveJSProperty('complete', true)

	const guide = loupe.getByRole('dialog', { name: 'How to cull' })
	await guide.getByRole('button', { name: 'Got it' }).click()
	await expect(guide).toBeHidden()
	return loupe
}

/** The settings every test starts from: the defaults. */
export const E2E_SETTINGS = {}

/** Stores the settings for the user, `E2E_SETTINGS` putting back the ones every test starts from. */
export async function putSettings(page: Page, settings: Record<string, unknown>): Promise<void> {
	const response = await page.request.put(SETTINGS_URL, { data: { settings }, headers: await apiHeaders(page) })
	expect(response.status(), await response.text()).toBe(200)
}
