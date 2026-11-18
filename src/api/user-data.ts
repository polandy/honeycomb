import type { StoredDecision } from '../logic/decision.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ResumePosition } from '../logic/resume-position.ts'
import type { StoredTags, Tag } from '../logic/tag.ts'
import type { ViewState } from '../logic/view-state.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { API, ApiResponseError, isRecord } from './core.ts'

/** The stored decisions of the files; a file without one is undecided (ADR 0012). */
export async function lookupDecisions(fileIds: readonly number[]): Promise<StoredDecision[]> {
	if (fileIds.length === 0) {
		return []
	}
	const { data } = await axios.post<unknown>(generateUrl(`${API}/decisions/lookup`), { fileIds })
	if (!isRecord(data) || !Array.isArray(data.decisions)) {
		throw new ApiResponseError('The decision lookup came without a decisions array; check the server\'s version.')
	}
	return data.decisions as StoredDecision[]
}

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

/** The stored tags of the files; a file without a row has no tags (ADR 0022). */
export async function lookupTags(fileIds: readonly number[]): Promise<StoredTags[]> {
	if (fileIds.length === 0) {
		return []
	}
	const { data } = await axios.post<unknown>(generateUrl(`${API}/tags/lookup`), { fileIds })
	if (!isRecord(data) || !Array.isArray(data.tags)) {
		throw new ApiResponseError('The tag lookup came without a tags array; check the server\'s version.')
	}
	return data.tags as StoredTags[]
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

/** Stores the resume position of a folder set (ADR 0012). */
export async function savePosition(position: ResumePosition): Promise<void> {
	await axios.put(generateUrl(`${API}/positions`), position)
}
