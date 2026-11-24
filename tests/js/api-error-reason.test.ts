// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { errorReasonOf } from '../../src/api/index.ts'

/** An axios error answering `status` with `data`. */
function answered(status: number, data: unknown): Error {
	return Object.assign(new Error('failed'), { response: { status, data } })
}

describe('errorReasonOf', () => {
	// spec: APP-004.6
	it('reads the reason of a 400 answer', () => {
		expect(errorReasonOf(answered(400, { error: 'request', reason: 'too-many' }))).toBe('too-many')
	})

	// spec: APP-004.6
	it.each([
		['an answer without a reason', answered(400, { error: 'request' })],
		['a reason that is no string', answered(400, { error: 'request', reason: 3 })],
		['an answer without a body', answered(400, undefined)],
		['an error without an answer', new Error('offline')],
		['no error object', 'offline'],
	])('is null for %s', (_name, error) => {
		expect(errorReasonOf(error)).toBeNull()
	})
})
