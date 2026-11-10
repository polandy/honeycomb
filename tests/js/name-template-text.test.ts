// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TemplateProblem } from '../../src/logic/name-template/parse.ts'

import { describe, expect, it } from 'vitest'
import { parseNameTemplate } from '../../src/logic/name-template/parse.ts'
import { templateProblemText } from '../../src/name-template-text.ts'

/** The words for the problem of an invalid template. */
function wordsFor(template: string): string {
	const parsed = parseNameTemplate(template)
	if (parsed.ok) {
		throw new Error(`${template} is valid`)
	}
	return templateProblemText(template, parsed.problem, parsed.column)
}

describe('templateProblemText', () => {
	// spec: SETTINGS-001.18
	it.each([
		['{name} .{ext}', 'Whitespace is not allowed; use - or _'],
		['{name}+.{ext}', '"+" is not allowed; use letters, digits, . _ - and /'],
		['{name}}.{ext}', 'This } has no matching {'],
		['{na{me}.{ext}', 'Braces cannot be part of a file name'],
		['{name.{ext', 'This { is not closed'],
		['{nope}.{ext}', 'Unknown token {nope}'],
		['{name:title}.{ext}', 'Unknown option in {name:title}'],
		['{number:9}.{ext}', 'Unknown option in {number:9}'],
		['{date}.{ext}', '{date} needs a format, such as {date:%Y-%m-%d}'],
		['{date:%Q}.{ext}', 'Unknown date code %Q'],
		['{date:%Y/%m}.{ext}', 'A date format cannot contain /; use a separate folder'],
		['/{name}.{ext}', 'A template cannot start with /'],
		['a//{name}.{ext}', 'Empty folder name; remove the extra /'],
		['../{name}.{ext}', 'A folder cannot be . or ..'],
		['{name}', 'The name must end with .{ext}, so the files of a photo keep distinct names'],
		['a/.{ext}', 'The name needs something before .{ext}'],
	])('words the problem of %s', (template, words) => {
		expect(wordsFor(template)).toBe(words)
	})

	// spec: SETTINGS-001.18
	it('words every problem', () => {
		const problems: TemplateProblem[] = ['whitespace', 'character', 'unclosed-token', 'unknown-token', 'modifier', 'number-digits', 'date-format', 'leading-slash', 'empty-folder', 'dot-folder', 'no-extension', 'empty-name']

		expect(problems.every((problem) => templateProblemText('{name}.{ext}', problem, 1) !== '')).toBe(true)
	})
})
