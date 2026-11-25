// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { parseSettings } from '../logic/settings.ts'
import { logger } from '../shared/logger.ts'
import { loadSettings } from './user-data.ts'

/** The user's library roots for a page's folder picker; none (every folder offered) when the settings cannot be read. */
export async function loadLibraryRoots(load: () => Promise<unknown> = loadSettings): Promise<readonly string[]> {
	try {
		return parseSettings(await load()).libraryRoots
	} catch (error) {
		logger.error('Could not read the library roots; the picker offers every folder', { error })
		return []
	}
}
