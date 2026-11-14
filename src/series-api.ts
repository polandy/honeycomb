// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SeriesLookup, StoredSeries } from './logic/stored-series.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { API, ApiResponseError, isRecord } from './api.ts'

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
