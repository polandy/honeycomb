// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TemplateProblem } from './logic/name-template/parse.ts'

import { t } from '@nextcloud/l10n'
import { PLAIN_TEXT } from './l10n.ts'

/** The problem of a template at its column (from 1), in the user's words. */
export function templateProblemText(template: string, problem: TemplateProblem, column: number): string {
	const at = template.charAt(column - 1)
	const token = () => template.slice(column - 1, template.indexOf('}', column) + 1)
	switch (problem) {
		case 'whitespace':
			return t('honeycomb', 'Whitespace is not allowed; use - or _')
		case 'character':
			return characterText(at)
		case 'unclosed-token':
			return t('honeycomb', 'This { is not closed')
		case 'unknown-token':
			return t('honeycomb', 'Unknown token {token}', { token: token() }, undefined, PLAIN_TEXT)
		case 'modifier':
		case 'number-digits':
			return t('honeycomb', 'Unknown option in {token}', { token: token() }, undefined, PLAIN_TEXT)
		case 'date-format':
			return dateFormatText(at, template.charAt(column))
		case 'leading-slash':
			return t('honeycomb', 'A template cannot start with /')
		case 'empty-folder':
			return t('honeycomb', 'Empty folder name; remove the extra /')
		case 'dot-folder':
			return t('honeycomb', 'A folder cannot be . or ..')
		case 'no-extension':
			return t('honeycomb', 'The name must end with .{ext}, so the files of a photo keep distinct names')
		case 'empty-name':
			return t('honeycomb', 'The name needs something before .{ext}')
	}
}

/** Why a character outside a token, or a brace, cannot stand in a template. */
function characterText(character: string): string {
	if (character === '}') {
		return t('honeycomb', 'This } has no matching {')
	}
	if (character === '{') {
		return t('honeycomb', 'Braces cannot be part of a file name')
	}
	return t('honeycomb', '"{character}" is not allowed; use letters, digits, . _ - and /', { character }, undefined, PLAIN_TEXT)
}

/** What is wrong with a `{date}` format: a `/`, an unknown `%` code, or no format at all. */
function dateFormatText(at: string, code: string): string {
	if (at === '/') {
		return t('honeycomb', 'A date format cannot contain /; use a separate folder')
	}
	if (at === '%') {
		return t('honeycomb', 'Unknown date code %{code}', { code }, undefined, PLAIN_TEXT)
	}
	return t('honeycomb', '{date} needs a format, such as {date:%Y-%m-%d}')
}
