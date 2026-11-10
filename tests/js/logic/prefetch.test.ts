// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { prefetchOrder } from '../../../src/logic/prefetch.ts'

describe('prefetchOrder', () => {
	// spec: LOUPE-001.12
	it('takes three neighbours ahead and two behind, nearest first, the next one first', () => {
		expect(prefetchOrder(10, 100)).toEqual([11, 9, 12, 8, 13])
	})

	it('stays inside the pictures', () => {
		expect(prefetchOrder(0, 3)).toEqual([1, 2])
		expect(prefetchOrder(2, 3)).toEqual([1, 0])
		expect(prefetchOrder(0, 1)).toEqual([])
	})
})
