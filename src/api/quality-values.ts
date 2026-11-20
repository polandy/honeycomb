// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { StoredQualityValue } from '../logic/sharpness.ts'

import { putSavedRows } from './saved-rows.ts'

/** Stores quality values with the etags they were measured on and answers the file ids stored; the server skips those of changed files (ADR 0046), a `429` rejects with `RateLimitedError`. */
export async function saveQualityValues(values: readonly StoredQualityValue[]): Promise<number[]> {
	if (values.length === 0) {
		return []
	}
	return putSavedRows('quality-values', { values }, 'quality values')
}
