// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { SCHEMES } from './a11y.ts'
import { E2E_SETTINGS, putSettings } from './cull.ts'
import { JPEG } from './files.ts'

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
// WCAG 1.4.11: a part of a graphic needs 3:1 against what it stands on.
const MIN_CONTRAST = 3
const COVER = { fileId: 9901, mtime: 1 }
const PRIMARY = '.folder-row__cull, .folder-row__mark-done, .folder-row__cull-new, .folder-row__mark-all'

let nextId = 9100

/** A rateable row of the stubbed list below the level. */
function folder(name: string, fields: object) {
	return { fileId: ++nextId, root: ROOT, path: `${ROOT}/${LEVEL}/${name}`, photos: 3, bytes: 3_000_000, rawBytes: 0, picked: 3, rejected: 0, undecided: 0, bursts: 0, oldest: 1_600_000_000, newest: 1_600_000_100, lastActivity: null, previews: [], shotDays: [], permissions: 31, done: null, ...fields }
}

// Like the owner's test set: a folder with subfolders between leaves, a complete one and a done one.
const FOLDERS = [
	folder('Complete', {}),
	folder('Iceland/Day 1', { photos: 18, picked: 10, rejected: 3, undecided: 5 }),
	folder('Iceland/Day 2', { photos: 21, picked: 15, rejected: 6 }),
	folder('Jura', { photos: 8, picked: 2, undecided: 6 }),
	folder('Kept', { done: DONE, previews: [COVER] }),
]

/** Opens the stubbed level the way the owner did: the root, then the level's row. */
async function openLevel(page: Page): Promise<Locator> {
	await page.route(`**/apps/honeycomb/api/v1/images/${COVER.fileId}?**`, (route) => route.fulfill({ contentType: 'image/jpeg', body: JPEG }))
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
	const [first = Number.NaN] = values
	expect(values.length).toBeGreaterThan(1)
	for (const value of values) {
		expect(Math.abs(value - first)).toBeLessThanOrEqual(TOLERANCE_PX)
	}
}

type Box = { x: number, y: number, width: number, height: number }

/** The area two boxes share, null when none. */
function intersection(a: Box, b: Box): Box | null {
	const x = Math.max(a.x, b.x)
	const y = Math.max(a.y, b.y)
	const width = Math.min(a.x + a.width, b.x + b.width) - x
	const height = Math.min(a.y + a.height, b.y + b.height) - y
	return width > 0 && height > 0 ? { x, y, width, height } : null
}

/** The WCAG contrast ratio of two computed `rgb()` colours. */
function contrast(a: string, b: string): number {
	const luminance = (color: string) => {
		const [red = 0, green = 0, blue = 0] = color.match(/\d+(\.\d+)?/g)!.slice(0, 3).map((part) => Number(part) / 255)
			.map((part) => (part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4))
		return 0.2126 * red + 0.7152 * green + 0.0722 * blue
	}
	const [first, second] = [luminance(a), luminance(b)]
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

/** The element's computed style property. */
function style(element: Locator, property: 'backgroundColor' | 'color'): Promise<string> {
	return element.evaluate((each, name) => getComputedStyle(each)[name], property)
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
				const open = (await screen.getByRole('button', { name: 'Open Iceland' }).boundingBox())!
				expect(open.x).toBeGreaterThan(Math.max(...primaries.map((edge) => edge.right)))

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
				const legend = screen.getByRole('list', { name: 'Colours of the bar' })
				await expect(legend.getByRole('listitem')).toHaveText(['Picked', 'Undecided', 'Rejected'])
				const iceland = screen.getByRole('article', { name: 'Iceland' })
				for (const [index, kind] of ['picked', 'undecided', 'rejected'].entries()) {
					const swatch = await legend.locator('.folder-split-legend__swatch').nth(index).evaluate((element) => getComputedStyle(element).backgroundColor)
					await expect(iceland.locator(`.folder-row__split-${kind}`)).toHaveCSS('background-color', swatch)
				}
				expect((await legend.boundingBox())!.y + (await legend.boundingBox())!.height).toBeLessThanOrEqual((await screen.locator('.folder-level-list').boundingBox())!.y)
			})

			// spec: FOLDERS-007.22
			test('draws the bar and the done mark in colours that stand out', async ({ page }) => {
				const screen = await openLevel(page)
				const iceland = screen.getByRole('article', { name: 'Iceland' })
				const card = await style(iceland, 'backgroundColor')
				for (const kind of ['picked', 'undecided', 'rejected']) {
					expect(contrast(await style(iceland.locator(`.folder-row__split-${kind}`), 'backgroundColor'), card)).toBeGreaterThanOrEqual(MIN_CONTRAST)
				}
				const mark = screen.getByRole('article', { name: 'Kept' }).locator('.folder-cover__done')
				await expect(mark).toBeVisible()
				expect(contrast(await style(mark, 'backgroundColor'), await style(mark, 'color'))).toBeGreaterThanOrEqual(MIN_CONTRAST)
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
				const covered = (await toggle.isVisible()) ? intersection(crumb, (await toggle.boundingBox())!) : null
				// On touch widths the toggle floats over the crumb, as on the owner's phone, so the check below runs there.
				expect(covered !== null).toBe(viewport.touch)
				if (covered !== null) {
					// Where the toggle meets the crumb, the title row lies over the crumb: beside the toggle the crumb is hidden too.
					const x = crumb.x + crumb.width - TOLERANCE_PX
					const y = covered.y + covered.height / 2
					expect(y >= title.y && y <= title.y + title.height).toBe(true)
					expect(await page.evaluate(({ px, py }) => document.elementFromPoint(px, py)?.closest('.folder-breadcrumb') ?? null, { px: x, py: y })).toBeNull()
				}
			})
		})
	}
}
