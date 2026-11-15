// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { CHUNK_LIMITS, requestChunks, sendInChunks } from '../../../src/logic/request-chunks.ts'

const LIMITS = { pictures: 2, files: 4 }
const answer = async (chunk: readonly (readonly number[])[]) => chunk.map((files) => files.map((file) => `done-${file}`))

describe('requestChunks', () => {
	// spec: DELETE-002.13, MOVE-004.17
	it('cuts after the picture limit and before a picture that would pass the file limit, never inside a picture', () => {
		expect(requestChunks([[1, 2], [3], [4, 5, 6], [7], [8, 9, 10, 11, 12]], LIMITS)).toEqual([
			[[1, 2], [3]],
			[[4, 5, 6], [7]],
			[[8, 9, 10, 11, 12]],
		])
	})

	it('sends nothing for no pictures and keeps the default limits inside the endpoints\' 500 files', () => {
		expect(requestChunks([], LIMITS)).toEqual([])
		expect(CHUNK_LIMITS).toEqual({ pictures: 50, files: 500 })
	})
})

describe('sendInChunks', () => {
	// spec: DELETE-002.13, MOVE-004.17
	it('sends the chunks one after another, joins the answers in order and counts the pictures sent', async () => {
		const sent: number[][][] = []
		const progress: number[] = []

		const result = await sendInChunks([[1, 2], [3], [4]], async (chunk) => {
			sent.push(chunk.map((files) => [...files]))
			return answer(chunk)
		}, (done) => progress.push(done), LIMITS)

		expect(sent).toEqual([[[1, 2], [3]], [[4]]])
		expect(progress).toEqual([0, 2, 3])
		expect(result).toEqual({ answers: [['done-1', 'done-2'], ['done-3'], ['done-4']], unsent: [], failure: null })
	})

	// spec: DELETE-002.14, MOVE-004.18
	it('stops at the first failed request and returns what was answered and the whole pictures not sent', async () => {
		const error = new Error('timeout')
		let calls = 0

		const result = await sendInChunks([[1, 2], [3], [4, 5], [6]], async (chunk) => {
			calls++
			if (calls === 2) {
				throw error
			}
			return answer(chunk)
		}, () => undefined, LIMITS)

		expect(calls).toBe(2)
		expect(result).toEqual({ answers: [['done-1', 'done-2'], ['done-3']], unsent: [[4, 5], [6]], failure: { error } })
	})
})
