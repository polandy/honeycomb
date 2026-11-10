// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { parseNameTemplate } from '../../../../src/logic/name-template/parse.ts'
import { vectors } from './vectors.ts'

const TEXT_PROBLEMS = ['whitespace', 'character', 'unclosed-token', 'unknown-token', 'modifier', 'number-digits', 'date-format']

describe('parseNameTemplate', () => {
	// spec: MOVE-001.1
	it.each(vectors.valid)('accepts %s', (template) => {
		expect(parseNameTemplate(template).ok).toBe(true)
	})

	// spec: MOVE-001.2, MOVE-001.3, MOVE-001.4, MOVE-001.5, MOVE-001.6
	it.each(vectors.invalid)('refuses $name', ({ template, problem, column }) => {
		expect(parseNameTemplate(template)).toEqual({ ok: false, problem, column })
	})

	// spec: MOVE-001.6
	it('names a problem in the text before one in the folder structure', () => {
		expect(parseNameTemplate('/a b/{name}.{ext}')).toEqual({ ok: false, problem: 'whitespace', column: 3 })
	})

	it('names the first of several problems in the text', () => {
		expect(parseNameTemplate('{title} {name}.{ext}')).toEqual({ ok: false, problem: 'unknown-token', column: 1 })
	})

	it('covers every problem in the text with a vector', () => {
		const covered = new Set(vectors.invalid.map((vector) => vector.problem))

		expect(TEXT_PROBLEMS.filter((problem) => !covered.has(problem))).toEqual([])
	})
})
