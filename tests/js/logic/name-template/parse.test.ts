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

	// spec: MOVE-005.3
	it.each(['{job}', '{job:lower}', '{job:upper}'])('accepts the job code token %s, cased by its modifier', (token) => {
		const parsed = parseNameTemplate(`${token}_{name}.{ext}`)

		expect(parsed.ok && parsed.template.name[0]).toEqual({ kind: 'job', letterCase: token.includes(':') ? token.slice(5, -1) : 'as-is' })
	})

	// spec: MOVE-005.3
	it.each(['{job:4}', '{job:title}', '{job:}'])('refuses %s as a modifier problem at the token\'s {', (token) => {
		expect(parseNameTemplate(`ab${token}.{ext}`)).toEqual({ ok: false, problem: 'modifier', column: 3 })
	})

	it('covers every problem in the text with a vector', () => {
		const covered = new Set(vectors.invalid.map((vector) => vector.problem))

		expect(TEXT_PROBLEMS.filter((problem) => !covered.has(problem))).toEqual([])
	})
})
