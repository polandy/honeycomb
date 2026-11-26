// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PageNavigationSeams } from './PageLayout.vue'

import { loadPositions } from '../api/index.ts'

/** The navigation seams of a page of its own in the browser (APP-001.23). */
export const browserPageNavigation: PageNavigationSeams = {
	loadPositions,
	storage: () => window.localStorage,
	goTo: (url) => window.location.assign(url),
}
