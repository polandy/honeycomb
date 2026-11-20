// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ResumePosition } from '../logic/resume-position.ts'
import type { StatsAnswer } from '../logic/statistics.ts'
import type { Tag } from '../logic/tag.ts'
import type { ViewState } from '../logic/view-state.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { parseCounters, parseReadPictures } from '../logic/statistics.ts'
import { API, ApiResponseError, isRecord } from './core.ts'

/** The stored settings of the user as they came, checked by `parseSettings` (ADR 0014). */
export async function loadSettings(): Promise<unknown> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/settings`))
	if (!isRecord(data)) {
		throw new ApiResponseError('The settings came without a settings object; check the server\'s version.')
	}
	return data.settings
}

/** Stores the whole settings of the user (ADR 0014). */
export async function saveSettings(settings: object): Promise<void> {
	await axios.put(generateUrl(`${API}/settings`), { settings })
}

/** The stored view state of the user as it came, checked by `parseViewState` (ADR 0019). */
export async function loadViewState(): Promise<unknown> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/view-state`))
	if (!isRecord(data) || !isRecord(data.viewState)) {
		throw new ApiResponseError('The view state came without a viewState object; check the server\'s version.')
	}
	return data.viewState
}

/** Stores only the keys of the view state given (ADR 0019). */
export async function saveViewState(viewState: Partial<ViewState>): Promise<void> {
	await axios.put(generateUrl(`${API}/view-state`), { viewState })
}

/** Every tag the user has had, sorted (ADR 0022). */
export async function loadTagList(): Promise<Tag[]> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/tags/list`))
	if (!isRecord(data) || !Array.isArray(data.tagList) || !data.tagList.every((tag) => typeof tag === 'string')) {
		throw new ApiResponseError('The tag list came without a tagList array of texts; check the server\'s version.')
	}
	return data.tagList
}

/** The stored resume positions of the user, newest first, as they came, checked by `parsePositions` (ADR 0012). */
export async function loadPositions(): Promise<unknown[]> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/positions`))
	if (!isRecord(data) || !Array.isArray(data.positions)) {
		throw new ApiResponseError('The resume positions came without a positions array; check the server\'s version.')
	}
	return data.positions
}

/** Stores the resume position of a folder set (ADR 0012) with the active seconds since the last save (STATS-001.39). */
export async function savePosition(position: ResumePosition, activeSeconds = 0): Promise<void> {
	await axios.put(generateUrl(`${API}/positions`), { ...position, activeSeconds })
}

/** Removes the flags of files deleted for good or in a trash bin, for every user; an admin only (SETTINGS-001.27). */
export async function cleanUpOrphanedData(): Promise<number> {
	const { data } = await axios.post<unknown>(generateUrl(`${API}/cleanup`))
	if (!isRecord(data) || typeof data.removed !== 'number') {
		throw new ApiResponseError('The clean-up came without a removed count; check the server\'s version.')
	}
	return data.removed
}

/** Removes every statistics counter of the user (STATS-001.3). */
export async function resetStatistics(): Promise<void> {
	await axios.delete(generateUrl(`${API}/stats`))
}

/** Every statistics counter of the user, their first counted day, their today and what began before the counting (STATS-001.4). */
export async function loadStatistics(): Promise<StatsAnswer> {
	const { data } = await axios.get<unknown>(generateUrl(`${API}/stats`))
	if (!isRecord(data) || !Array.isArray(data.counters) || typeof data.today !== 'string') {
		throw new ApiResponseError('The statistics came without counters or today; check the server\'s version.')
	}
	return {
		counters: parseCounters(data.counters),
		firstDay: typeof data.firstDay === 'string' ? data.firstDay : null,
		today: data.today,
		seriesDoneBefore: Number.isInteger(data.seriesDoneBefore) ? data.seriesDoneBefore as number : 0,
		read: parseReadPictures(data.read),
	}
}
