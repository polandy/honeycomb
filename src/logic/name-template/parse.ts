// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { isAllowedCharacter } from './sanitise.ts'

/** Why a name template is refused; the settings word it. */
export type TemplateProblem
	= | 'whitespace' | 'character' | 'unclosed-token' | 'unknown-token' | 'modifier' | 'number-digits' | 'date-format'
		| 'leading-slash' | 'empty-folder' | 'dot-folder' | 'no-extension' | 'empty-name'

/** How a token's value is cased after sanitising. */
export type LetterCase = 'as-is' | 'lower' | 'upper'

/** Literal text or one token of a folder or file name. */
export type TemplatePart
	= | { readonly kind: 'literal', readonly text: string }
		| { readonly kind: 'date', readonly format: string }
		| { readonly kind: 'number', readonly digits: number | null }
		| { readonly kind: 'name' | 'ext' | 'camera' | 'make', readonly letterCase: LetterCase }

/** A valid template: its folders, the file name before the final `.{ext}` and that extension's case. */
export interface NameTemplate {
	readonly folders: readonly (readonly TemplatePart[])[]
	readonly name: readonly TemplatePart[]
	readonly extensionCase: LetterCase
}

/** A template, or its first problem and that problem's column (from 1). */
export type ParsedTemplate
	= | { readonly ok: true, readonly template: NameTemplate }
		| { readonly ok: false, readonly problem: TemplateProblem, readonly column: number }

type Refusal = Extract<ParsedTemplate, { ok: false }>

interface Folder {
	readonly parts: TemplatePart[]
	readonly column: number
}

const DATE_CODES = 'YymdjHMS'
const LETTER_CASES: readonly string[] = ['lower', 'upper']
const NUMBER_DIGITS = /^[1-6]$/
const WHITESPACE = /^\s$/
const DOT_FOLDERS: readonly string[] = ['.', '..']

/** Parses and checks a name template (`docs/05-name-templates.md`); text before structure. */
export function parseNameTemplate(text: string): ParsedTemplate {
	const folders = lex(text)
	return Array.isArray(folders) ? structure(folders, text.length + 1) : folders
}

/** The refusal of a problem at a column. */
function refuse(problem: TemplateProblem, column: number): Refusal {
	return { ok: false, problem, column }
}

/** The template's folders and their parts, or the first problem in the text. */
function lex(text: string): Folder[] | Refusal {
	const folders: Folder[] = [{ parts: [], column: 1 }]
	let parts = folders[0]!.parts
	let literal = ''
	const endLiteral = () => {
		if (literal !== '') {
			parts.push({ kind: 'literal', text: literal })
			literal = ''
		}
	}
	for (let index = 0; index < text.length; index++) {
		const character = text.charAt(index)
		const column = index + 1
		if (character === '{') {
			const close = text.indexOf('}', index)
			if (close < 0) {
				return refuse('unclosed-token', column)
			}
			const token = parseToken(text.slice(index + 1, close), column)
			if ('ok' in token) {
				return token
			}
			endLiteral()
			parts.push(token)
			index = close
		} else if (character === '/') {
			endLiteral()
			parts = []
			folders.push({ parts, column: column + 1 })
		} else if (WHITESPACE.test(character)) {
			return refuse('whitespace', column)
		} else if (!isAllowedCharacter(character)) {
			return refuse('character', column)
		} else {
			literal += character
		}
	}
	endLiteral()
	return folders
}

/** The part of one token's content between `{` and `}`. */
function parseToken(content: string, column: number): TemplatePart | Refusal {
	const contentColumn = column + 1
	const stray = [...content].findIndex((character) => character === '{' || WHITESPACE.test(character))
	if (stray >= 0) {
		return refuse(content.charAt(stray) === '{' ? 'character' : 'whitespace', contentColumn + stray)
	}
	const colon = content.indexOf(':')
	const name = colon < 0 ? content : content.slice(0, colon)
	const argument = colon < 0 ? null : content.slice(colon + 1)
	switch (name) {
		case 'date':
			return argument === null || argument === '' ? refuse('date-format', column) : parseDateFormat(argument, contentColumn + colon + 1)
		case 'number':
			if (argument === null) {
				return { kind: 'number', digits: null }
			}
			return NUMBER_DIGITS.test(argument) ? { kind: 'number', digits: Number(argument) } : refuse('number-digits', column)
		case 'name':
		case 'ext':
		case 'camera':
		case 'make':
			if (argument === null) {
				return { kind: name, letterCase: 'as-is' }
			}
			return LETTER_CASES.includes(argument) ? { kind: name, letterCase: argument as LetterCase } : refuse('modifier', column)
		default:
			return refuse('unknown-token', column)
	}
}

/** A `{date}` part, refusing codes outside `%Y %y %m %d %j %H %M %S` and `/`. */
function parseDateFormat(format: string, column: number): TemplatePart | Refusal {
	for (let index = 0; index < format.length; index++) {
		const character = format.charAt(index)
		if (character === '%') {
			const code = format.charAt(index + 1)
			if (code === '' || !DATE_CODES.includes(code)) {
				return refuse('date-format', column + index)
			}
			index++
		} else if (character === '/') {
			return refuse('date-format', column + index)
		} else if (!isAllowedCharacter(character)) {
			return refuse('character', column + index)
		}
	}
	return { kind: 'date', format }
}

/** The template, or the first problem in its folders. */
function structure(folders: Folder[], endColumn: number): ParsedTemplate {
	if (folders.length > 1) {
		const empty = folders.findIndex((folder) => folder.parts.length === 0)
		if (empty >= 0) {
			return refuse(empty === 0 ? 'leading-slash' : 'empty-folder', folders[empty]!.column)
		}
	}
	const dotFolder = folders.find(({ parts: [only, ...rest] }) => only?.kind === 'literal' && rest.length === 0 && DOT_FOLDERS.includes(only.text))
	if (dotFolder !== undefined) {
		return refuse('dot-folder', dotFolder.column)
	}
	const last = folders.pop()!
	return fileName(last, endColumn, folders.map((folder) => folder.parts))
}

/** The template once the last folder ends with `.{ext}` after a name. */
function fileName({ parts, column }: Folder, endColumn: number, folders: readonly (readonly TemplatePart[])[]): ParsedTemplate {
	const extension = parts.at(-1)
	const beforeExtension = parts.at(-2)
	if (extension?.kind !== 'ext' || beforeExtension?.kind !== 'literal' || !beforeExtension.text.endsWith('.')) {
		return refuse('no-extension', endColumn)
	}
	const nameText = beforeExtension.text.slice(0, -1)
	const name = [...parts.slice(0, -2), ...(nameText === '' ? [] : [{ kind: 'literal' as const, text: nameText }])]
	if (name.length === 0) {
		return refuse('empty-name', column)
	}
	return { ok: true, template: { folders, name, extensionCase: extension.letterCase } }
}
