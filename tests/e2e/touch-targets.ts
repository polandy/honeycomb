// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect } from '@playwright/test'

/** The iPad mini's size, portrait and landscape (docs/dev/plan.md Reference devices). */
export const IPAD_MINI = {
	portrait: { width: 744, height: 1133 },
	landscape: { width: 1133, height: 744 },
}
const MIN_TARGET_PX = 44
/** How far from a control's middle the hit test looks for the end of its hit area. */
const PROBE_LIMIT_PX = 80

/** Controls known to fall short, each with a TODO.md item (a series tab covers the top of its filmstrip thumbnail). */
const EXEMPT = '.loupe-filmstrip__tab, .loupe-filmstrip__photo'

const TARGETS = 'button, a[href], input, select, textarea, summary, [role=button], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=treeitem], [role=gridcell], [role=option], [role=slider], [tabindex="0"]'

/** Sizes the page like an iPad with touch input, so `pointer: coarse` applies. */
export async function emulateIpad(page: Page, orientation: keyof typeof IPAD_MINI): Promise<void> {
	await page.setViewportSize(IPAD_MINI[orientation])
	expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
}

/** What is wrong with each control of `scope` that a finger could not use: too small, clipped or off screen. */
export function touchTargetFaults(scope: Locator): Promise<string[]> {
	return scope.evaluate((root, { targets, exempt, minimum, limit }) => {
		const faults: string[] = []
		const visible = (element: Element) => {
			const style = getComputedStyle(element)
			return style.visibility !== 'hidden' && style.display !== 'none' && style.pointerEvents !== 'none'
		}
		// A tooltip bubble never takes a tap and an undo toast leaves on its own, so the hit test looks through both.
		const topAt = (x: number, y: number) => document.elementsFromPoint(x, y).find((hit) => !hit.closest('.tip-bubble, .undo-toast')) ?? null
		// The hit area, not the look, keeps the target (a control may draw smaller than it takes taps).
		const hitExtent = (element: Element, dx: number, dy: number) => {
			const box = element.getBoundingClientRect()
			const [x, y] = [box.left + box.width / 2, box.top + box.height / 2]
			const owns = (hit: Element | null) => !!hit && element.contains(hit)
			let steps = 0
			while (steps < limit && owns(topAt(x + dx * (steps + 1), y + dy * (steps + 1)))) { steps++ }
			return steps
		}
		// A checkbox or radio is tapped on its wrapper or label, not on the input.
		const tapped = (element: Element) => (element instanceof HTMLInputElement && /checkbox|radio/.test(element.type) && (element.closest('.checkbox-radio-switch') ?? element.labels?.[0])) || element
		for (const control of [root, ...root.querySelectorAll(targets)]) {
			const element = tapped(control)
			if (!control.matches(targets) || control.matches(exempt) || !visible(element) || element.closest('[aria-hidden=true], [inert], [disabled]')) { continue }
			element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
			const box = element.getBoundingClientRect()
			if (box.width === 0 || box.height === 0) { continue }
			let scrolls = false
			let clip = { top: -Infinity, left: -Infinity, right: Infinity, bottom: Infinity }
			for (let parent = element.parentElement; parent; parent = parent.parentElement) {
				const style = getComputedStyle(parent)
				if (/auto|scroll/.test(style.overflowX + style.overflowY)) { scrolls = true } else if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
					const rect = parent.getBoundingClientRect()
					clip = { top: Math.max(clip.top, rect.top), left: Math.max(clip.left, rect.left), right: Math.min(clip.right, rect.right), bottom: Math.min(clip.bottom, rect.bottom) }
				}
			}
			const name = `${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40)}" ${Math.round(box.width)}×${Math.round(box.height)} at ${Math.round(box.left)},${Math.round(box.top)}`
			const [centreX, centreY] = [box.left + box.width / 2, box.top + box.height / 2]
			const reachable = centreX >= 0 && centreX < innerWidth && centreY >= 0 && centreY < innerHeight
			const width = 1 + hitExtent(element, -1, 0) + hitExtent(element, 1, 0)
			const height = 1 + hitExtent(element, 0, -1) + hitExtent(element, 0, 1)
			if (!reachable) { faults.push(`not reachable: ${name}`) } else if (width < minimum || height < minimum) {
				const top = topAt(centreX, centreY)
				const covered = width === 1 && height === 1 && top ? `, covered by ${top.tagName.toLowerCase()}.${String(top.className).slice(0, 50)}` : ''
				faults.push(`hit area ${width}×${height}${covered}: ${name}`)
			}
			if (box.top < clip.top - 0.5 || box.left < clip.left - 0.5 || box.right > clip.right + 0.5 || box.bottom > clip.bottom + 0.5) { faults.push(`clipped: ${name}`) }
			// Content of a scroller moves off screen as it scrolls; only fixed controls must stay on it.
			if (!scrolls && (box.top < -0.5 || box.left < -0.5 || box.right > innerWidth + 0.5 || box.bottom > innerHeight + 0.5)) { faults.push(`off screen: ${name}`) }
		}
		return faults
	}, { targets: TARGETS, exempt: EXEMPT, minimum: MIN_TARGET_PX, limit: PROBE_LIMIT_PX })
}

/** Fails with the faults of `scope` on the screen `screen`. */
export async function expectTouchTargets(scope: Locator, screen: string): Promise<void> {
	await expect.soft(await touchTargetFaults(scope), screen).toEqual([])
}
