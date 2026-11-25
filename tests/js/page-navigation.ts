// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PageNavigationSeams } from '../../src/components/PageLayout.vue'

import { fakeStorage } from './app-cull.ts'

/** A page's navigation seams over `positions`, recording each address it goes to. */
export function fakePageNavigation(positions: unknown = [], stored: Record<string, string> = {}) {
	const visited: string[] = []
	const seams: PageNavigationSeams = { loadPositions: async () => positions, storage: fakeStorage(stored), goTo: (url) => visited.push(url) }
	return { seams, visited }
}
