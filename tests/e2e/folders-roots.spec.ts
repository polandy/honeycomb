// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { putSettings, resetViewState } from './cull.ts'
import { apiHeaders, createFolder, JPEG, upload } from './files.ts'
import { logIn, occ, trackRequests } from './server.ts'
import { WEBKIT } from './webkit.ts'

const API = '/index.php/apps/honeycomb/api/v1/library'
const VIEWPORTS = [{ name: 'a phone', width: 390, height: 844 }, { name: 'an iPad', width: 820, height: 1180 }]
const FOLDERS = ['Photos/Trip', 'Photos-old/Trip', 'Other/Trip']

test.use({ storageState: { cookies: [], origins: [] }, hasTouch: true })

let user = { username: '', password: '' }
let drainRequests = async (): Promise<void> => {}

test.beforeEach(async ({ page }) => {
	drainRequests = trackRequests(page)
	user = { username: `roots-${randomUUID().slice(0, 8)}`, password: `e2e-${randomUUID()}` }
	occ(['user:add', '--password-from-env', user.username], { OC_PASS: user.password })
	await logIn(page, user)
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	for (const folder of FOLDERS) {
		const [top] = folder.split('/')
		await createFolder(page, top!, user.username).catch(() => undefined)
		await createFolder(page, folder, user.username)
		await upload(page, `${folder}/IMG_0001.jpg`, JPEG, user.username)
	}
	await putSettings(page, { libraryRoots: ['/Photos'] })
})

test.afterEach(async () => {
	await drainRequests()
	occ(['user:delete', user.username])
})

for (const viewport of VIEWPORTS) {
	// spec: FOLDERS-005.20, FOLDERS-005.21
	test(`lists only the folders of the library roots on ${viewport.name}`, { tag: WEBKIT }, async ({ page }) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height })
		await page.goto('/index.php/apps/honeycomb/')
		const list = page.locator('.folders-screen')

		await expect(list.getByText('Trip').first()).toBeVisible()
		await expect(list.getByText('Photos-old')).toHaveCount(0)
		await expect(list.getByText('Other')).toHaveCount(0)
		expect(await list.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)

		const headers = await apiHeaders(page)
		for (const root of ['/', '/Photos-old', '/Other', '/Photos/../Other']) {
			expect((await page.request.get(`${API}/folders`, { params: { root }, headers })).status(), `list ${root}`).toBe(400)
			expect((await page.request.post(`${API}/scan`, { data: { root }, headers })).status(), `scan ${root}`).toBe(400)
		}
		expect((await page.request.get(`${API}/folders`, { params: { root: '/Photos/Trip' }, headers })).status()).toBe(200)
		expect((await page.request.get(`${API}/root`, { params: { root: '/Other' }, headers })).status()).toBe(204)
	})
}
