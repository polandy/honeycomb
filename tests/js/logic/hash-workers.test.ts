// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { hashWorkerCount } from '../../../src/logic/hash-workers.ts'

describe('hashWorkerCount', () => {
	// spec: SERIES-004.6
	it.each([[undefined, 1], [0, 1], [1, 1], [2, 1], [4, 3], [9, 8], [32, 8]])('gives %s cores %i workers', (cores, workers) => {
		expect(hashWorkerCount(cores)).toBe(workers)
	})
})
