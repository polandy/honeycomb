// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from '../logic/long-press.ts'
import type { BrowserStorage } from '../shared/browser-storage.ts'
import type { OnPageHide } from '../shared/page-hide.ts'

import { browserSchedule } from '../shared/browser-schedule.ts'
import { toggleBrowserFullscreen } from '../shared/fullscreen.ts'
import { onBrowserPageHide } from '../shared/page-hide.ts'
import { browserDay } from '../statistics/year-review-hint.ts'

const MS_PER_SECOND = 1000

/** The seams of the browser: storage, timers, page events, full screen and the clocks. */
export interface BrowserSeams {
	storage?: BrowserStorage
	schedule?: Schedule
	/** Writes the waiting sidecars when the page hides (XMP-003.29). */
	onPageHide?: OnPageHide
	toggleFullscreen?: (element: HTMLElement) => void
	/** A monotonic clock in ms, which active time is measured by (STATS-001.35). */
	clock?: () => number
	/** The browser's local day as YYYY-MM-DD, which the year-in-review hint shows by (STATS-001.26). */
	today?: () => string
	/** The wall clock in Unix seconds, which the Immich time filter counts from (IMMICH-002.11). */
	now?: () => number
}

/** The browser seams the app uses in production. */
export const BROWSER_SEAMS = {
	storage: () => window.localStorage,
	schedule: browserSchedule,
	onPageHide: onBrowserPageHide,
	toggleFullscreen: toggleBrowserFullscreen,
	clock: () => performance.now(),
	today: browserDay,
	now: () => Date.now() / MS_PER_SECOND,
}
