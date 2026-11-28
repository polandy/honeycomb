// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { addJobCode, jobCodeReady, MAX_JOB_CODE, typedJobCode, usesJobCode } from '../../../src/logic/job-codes.ts'
import { parseNameTemplate } from '../../../src/logic/name-template/parse.ts'

/** The parsed template, which must be valid. */
function template(text: string) {
	const parsed = parseNameTemplate(text)
	if (!parsed.ok) {
		throw new Error(`invalid template ${text}`)
	}
	return parsed.template
}

describe('usesJobCode', () => {
	// spec: MOVE-005.5
	it.each([
		['{job}_{name}.{ext}', true],
		['{date:%Y}/{job:lower}/{name}.{ext}', true],
		['{name}.{ext}', false],
		['job_{name}.{ext}', false],
	])('%s uses the job code: %s', (text, uses) => {
		expect(usesJobCode(template(text))).toBe(uses)
	})
})

describe('jobCodeReady', () => {
	// spec: MOVE-005.6
	it.each([
		['', false],
		['   ', false],
		['?!', false],
		['--', false],
		['Ü', true],
		['Shoot 1', true],
	])('"%s" is ready: %s', (code, ready) => {
		expect(jobCodeReady(code)).toBe(ready)
	})
})

describe('typedJobCode', () => {
	// spec: MOVE-005.7
	it('keeps the first 40 characters of what is typed', () => {
		const long = `${'a'.repeat(39)}bc`

		expect(MAX_JOB_CODE).toBe(40)
		expect(typedJobCode(long)).toBe(`${'a'.repeat(39)}b`)
		expect(typedJobCode('a'.repeat(40))).toBe('a'.repeat(40))
		expect(typedJobCode('')).toBe('')
	})
})

describe('addJobCode', () => {
	// spec: MOVE-005.8
	it('puts the job code first, each once, 5 kept', () => {
		expect(addJobCode([], 'A')).toEqual(['A'])
		expect(addJobCode(['A', 'B', 'C'], 'B')).toEqual(['B', 'A', 'C'])
		expect(addJobCode(['A', 'B', 'C', 'D', 'E'], 'F')).toEqual(['F', 'A', 'B', 'C', 'D'])
	})
})
