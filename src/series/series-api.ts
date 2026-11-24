// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SeriesWrite } from '../logic/series-edit.ts'
import type { SeriesLookup, StoredSeries } from '../logic/stored-series.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { API, ApiResponseError, isRecord } from '../api/index.ts'

/** The stored series and kept-out files among the files (ADR 0027). */
export async function lookupSeries(fileIds: readonly number[]): Promise<SeriesLookup> {
	if (fileIds.length === 0) {
		return { series: [], keptOut: [] }
	}
	const { data } = await axios.post<unknown>(generateUrl(`${API}/series/lookup`), { fileIds })
	if (!isRecord(data) || !Array.isArray(data.series) || !Array.isArray(data.keptOut)) {
		throw new ApiResponseError('The series lookup came without series and keptOut arrays; check the server\'s version.')
	}
	return { series: data.series as StoredSeries[], keptOut: data.keptOut as number[] }
}

/** Writes the series edits and answers each series' id in request order (ADR 0027). */
export async function saveSeries(write: SeriesWrite): Promise<{ ids: number[] }> {
	const { data } = await axios.put<unknown>(generateUrl(`${API}/series`), write)
	if (!isRecord(data) || !Array.isArray(data.ids)) {
		throw new ApiResponseError('The series write came without an ids array; check the server\'s version.')
	}
	return { ids: data.ids as number[] }
}
