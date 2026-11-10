// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

const ALLOWED = 'A-Za-z0-9._-'
const ALLOWED_CHARACTER = new RegExp(`^[${ALLOWED}]$`)
const OTHER_CHARACTERS = new RegExp(`[^${ALLOWED}]+`, 'g')
const UMLAUTS: Readonly<Record<string, string>> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ẞ: 'SS' }

/** Whether a character may stand in a name template's path (`docs/05-name-templates.md`). */
export function isAllowedCharacter(character: string): boolean {
	return ALLOWED_CHARACTER.test(character)
}

/** Reduces a token value to `[A-Za-z0-9._-]`: umlauts spelt out, accents stripped, the rest `-`. */
export function sanitiseValue(value: string): string {
	return value.normalize('NFC')
		.replace(/[äöüßÄÖÜẞ]/g, (umlaut) => UMLAUTS[umlaut] ?? umlaut)
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(OTHER_CHARACTERS, '-')
		.replace(/-+/g, '-')
		.replace(/^[-.]+|[-.]+$/g, '')
}
