// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { SCHEMES } from './a11y.ts'
import { E2E_SETTINGS, putSettings } from './cull.ts'

const ROOT = '/Photos'
const LEVEL = 'honeycomb-testset'
const DONE = { by: 'e2e', at: 1_800_000_000, photos: 3 }
const VIEWPORTS = [
	{ name: 'a phone', width: 412, height: 915, touch: true },
	{ name: 'a tablet', width: 820, height: 1180, touch: true },
	{ name: 'a desktop', width: 1440, height: 900, touch: false },
]
// Far enough that the title row and the breadcrumb would leave the screen with the content.
const SCROLL_PX = 180
// Low enough that every viewport's level scrolls by `SCROLL_PX`.
const SCROLL_HEIGHT_PX = 600
// Sub-pixel rounding between rows.
const TOLERANCE_PX = 1
const PRIMARY = '.folder-row__cull, .folder-row__mark-done, .folder-row__cull-new, .folder-row__mark-all'

let nextId = 9100

/** A rateable row of the stubbed list below the level. */
function folder(name: string, fields: object) {
	return { fileId: ++nextId, root: ROOT, path: `${ROOT}/${LEVEL}/${name}`, photos: 3, bytes: 3_000_000, rawBytes: 0, picked: 3, rejected: 0, undecided: 0, bursts: 0, oldest: 1_600_000_000, newest: 1_600_000_100, lastActivity: null, previews: [], permissions: 31, done: null, ...fields }
}

// Like the owner's test set: a folder with subfolders between leaves, a complete one and a done one.
const FOLDERS = [
	folder('Complete', {}),
	folder('Iceland/Day 1', { photos: 18, picked: 10, rejected: 3, undecided: 5 }),
	folder('Iceland/Day 2', { photos: 21, picked: 15, rejected: 6 }),
	folder('Jura', { photos: 8, picked: 2, undecided: 6 }),
	folder('Kept', { done: DONE }),
]

/** Opens the stubbed level the way the owner did: the root, then the level's row. */
async function openLevel(page: Page): Promise<Locator> {
	await page.route('**/apps/honeycomb/api/v1/library/folders?**', (route) => route.fulfill({ json: { folders: FOLDERS, nextCursor: null, scanning: null } }))
	await page.goto('/index.php/apps/honeycomb/')
	// The settings write needs the page's request token; the reload reads the roots.
	await putSettings(page, { libraryRoots: [ROOT] })
	await page.reload()
	const screen = page.locator('.folders-screen')
	await screen.getByRole('button', { name: `Open ${LEVEL}` }).click()
	await expect(screen.getByRole('article', { name: 'Iceland' })).toBeVisible()
	return screen
}

/** The x of each element's left and right edge. */
async function edges(elements: Locator): Promise<{ left: number, right: number }[]> {
	return elements.evaluateAll((all) => all.map((element) => element.getBoundingClientRect()).map((box) => ({ left: box.left, right: box.right })))
}

/** Expects all numbers to lie within the tolerance of the first. */
function expectAligned(values: number[]) {
	expect(values.length).toBeGreaterThan(1)
	for (const value of values) {
		expect(Math.abs(value - values[0])).toBeLessThanOrEqual(TOLERANCE_PX)
	}
}

/** Whether two boxes share any area. */
function overlap(a: { x: number, y: number, width: number, height: number }, b: { x: number, y: number, width: number, height: number }): boolean {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

for (const viewport of VIEWPORTS) {
	for (const scheme of SCHEMES) {
		test.describe(`on ${viewport.name} in the ${scheme} theme`, () => {
			test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch, colorScheme: scheme })

			// spec: FOLDERS-007.19, FOLDERS-009.24
			test('lines up the actions, counts and state of every row', async ({ page }, testInfo) => {
				const screen = await openLevel(page)
				const rows = screen.locator('.folder-level-list .folder-row')
				await expect(rows).toHaveCount(FOLDERS.length - 1)
				await screen.screenshot({ path: testInfo.outputPath('folders-level.png') })

				const primaries = await edges(rows.locator(PRIMARY))
				expect(primaries).toHaveLength(3)
				expectAligned(primaries.map((edge) => edge.right))
				expectAligned((await edges(rows.getByRole('button', { name: /^More for / }))).map((edge) => edge.left))
				const open = (await edges(screen.getByRole('button', { name: 'Open Iceland' })))[0]
				expect(open.left).toBeGreaterThan(primaries[0].right)

				for (const counts of await rows.locator('.folder-row__counts').all()) {
					const tops = await counts.locator('span').evaluateAll((spans) => spans.map((span) => Math.round(span.getBoundingClientRect().top)))
					expect(new Set(tops).size).toBe(1)
				}

				const complete = screen.getByRole('article', { name: 'Complete' }).getByText('Complete · not marked done')
				await expect(complete).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
			})

			// spec: FOLDERS-007.20
			test('names the colours of the bar once above the rows', async ({ page }) => {
				const screen = await openLevel(page)
				const legend = screen.getByRole('list', { name: 'Bar' })
				await expect(legend.getByRole('listitem')).toHaveText(['Picked', 'Undecided', 'Rejected'])
				const iceland = screen.getByRole('article', { name: 'Iceland' })
				for (const [index, kind] of ['picked', 'undecided', 'rejected'].entries()) {
					const swatch = await legend.locator('.folder-split-legend__swatch').nth(index).evaluate((element) => getComputedStyle(element).backgroundColor)
					await expect(iceland.locator(`.folder-row__split-${kind}`)).toHaveCSS('background-color', swatch)
				}
				expect((await legend.boundingBox())!.y + (await legend.boundingBox())!.height).toBeLessThanOrEqual((await screen.locator('.folder-level-list').boundingBox())!.y)
			})

			// spec: FOLDERS-007.21
			test('keeps the title row above the content and the navigation toggle off the breadcrumb', async ({ page }, testInfo) => {
				await page.setViewportSize({ width: viewport.width, height: SCROLL_HEIGHT_PX })
				const screen = await openLevel(page)
				await screen.evaluate((element, top) => element.scrollTo({ top }), SCROLL_PX)
				await expect.poll(() => screen.evaluate((element) => element.scrollTop)).toBe(SCROLL_PX)
				await page.screenshot({ path: testInfo.outputPath('folders-scrolled.png') })

				const view = (await screen.boundingBox())!
				const title = (await screen.locator('.page-title-row').boundingBox())!
				expect(Math.abs(title.y - view.y)).toBeLessThanOrEqual(TOLERANCE_PX)
				const toggle = page.getByRole('button', { name: /navigation$/ })
				const crumb = (await screen.getByRole('navigation', { name: 'Level' }).getByRole('button', { name: 'Photos' }).boundingBox())!
				const hidden = crumb.y + crumb.height <= title.y + title.height
				if (await toggle.isVisible()) {
					expect(hidden || !overlap(crumb, (await toggle.boundingBox())!)).toBe(true)
				}
			})
		})
	}
}
