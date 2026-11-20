// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect } from '@playwright/test'

/** Multiplies every limit; below 1 it forces the budgets to fail, to show that they gate. */
const SCALE = Number(process.env.HONEYCOMB_BUDGET_SCALE ?? '1')

/** Limits in ms: the budgets of `docs/dev/plan.md` where CI measured well inside them, else about three times CI's slowest run. */
export const BUDGET_MS = {
	prefetchedLoupe: 100,
	sharpRendered: 1_000,
	smallCold: 10_000,
	sharpCold: 30_000,
	serverRender: 8_000,
	loupeWarmed: 2_000,
} as const

/** Fails the test when `elapsedMs` is over the limit of `budget`. */
export function withinBudget(budget: keyof typeof BUDGET_MS, elapsedMs: number): void {
	expect(elapsedMs, `${budget} took ${elapsedMs.toFixed(0)} ms`).toBeLessThanOrEqual(BUDGET_MS[budget] * SCALE)
}
