// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The page address, which keeps the open cull and the shown statistics period across a browser reload (DECISIONS-002.17, STATS-001.57). */
export interface LocationApi {
	read(): string
	write(hash: string): void
}

/** The browser's address, replaced in place so the back button is not filled. */
export const browserLocation: LocationApi = {
	read: () => window.location.hash,
	write: (hash) => window.history.replaceState(null, '', hash === '' ? window.location.pathname + window.location.search : hash),
}
