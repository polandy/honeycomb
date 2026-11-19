// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'

/** The light and the dark theme, as the browser reports them to Nextcloud. */
export const SCHEMES = ['light', 'dark'] as const

/** The rule sets the scan runs (ADR 0041). */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']
const GATED_IMPACTS = new Set(['serious', 'critical'])
/** Nextcloud's own header is not honeycomb's to fix. */
const OUTSIDE_THE_APP = '#header'

/** Waits until the transitions running on the page have ended, as a dialog fading in has the contrast of its opacity. */
async function settled(page: Page): Promise<void> {
	await page.evaluate(async () => {
		// Vue starts an enter transition two frames after it mounts the element.
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
		// An endless animation (a spinner) never ends, so only finite ones are awaited; a cancelled one has ended too.
		await Promise.allSettled(document.getAnimations().filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map((animation) => animation.finished))
	})
}

/** The serious or critical faults axe-core finds on the open screen, one line each. */
export async function accessibilityFaults(page: Page, screen: string): Promise<string[]> {
	await settled(page)
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).exclude(OUTSIDE_THE_APP).analyze()
	return results.violations
		.filter((violation) => GATED_IMPACTS.has(violation.impact ?? ''))
		.flatMap((violation) => violation.nodes.map((node) => `${screen}: ${violation.id} (${violation.impact}) at ${node.target.join(' ')} ${node.html}: ${node.failureSummary ?? violation.help}`))
}

/** Fails the test, but goes on to the next screen, with every serious or critical fault on the open screen. */
export async function expectAccessible(page: Page, screen: string): Promise<void> {
	expect.soft(await accessibilityFaults(page, screen), `accessibility faults on ${screen}`).toEqual([])
}
