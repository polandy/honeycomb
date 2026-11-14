// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The most hash workers a run starts, so a large processor keeps cores for the rest (SERIES-004.6). */
const MAX_HASH_WORKERS = 8

/** How many workers hash for a run: the cores less one for the page, at least one, at most eight (SERIES-004.6). */
export function hashWorkerCount(cores: number | undefined): number {
	return Math.min(MAX_HASH_WORKERS, Math.max(1, (cores ?? 1) - 1))
}
