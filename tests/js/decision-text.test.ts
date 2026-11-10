// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionChange } from '../../src/logic/decision-change.ts'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { changeText, decidedText, redoneText, undoneText } from '../../src/decision-text.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from './l10n/marked-catalogue.ts'

const escapeMark = TRANSLATED_MARK.replace(/[[\]]/g, '\\$&')

describe('changeText', () => {
	it.each<[DecisionChange, string[], string]>([
		[{ flag: 'rejected' }, ['IMG_1'], 'Rejected IMG_1'],
		[{ flag: 'picked' }, ['A', 'B'], 'Picked 2 photos'],
		[{ flag: 'unflagged' }, ['IMG_1'], 'Unflagged IMG_1'],
		[{ rating: 3 }, ['IMG_1'], 'Rated IMG_1 ★★★'],
		[{ rating: 0 }, ['A', 'B', 'C'], 'Cleared rating of 3 photos'],
		[{ colourLabel: 'red' }, ['IMG_1'], 'Labelled IMG_1 Red'],
		[{ colourLabel: null }, ['IMG_1'], 'Removed label from IMG_1'],
		[{ keepRaw: true }, ['IMG_1'], 'Marked IMG_1 Keep RAW'],
		[{ keepRaw: false }, ['A', 'B'], 'Removed Keep RAW from 2 photos'],
	])('words %o of %o as "%s"', (change, names, text) => {
		expect(changeText({ change, names })).toBe(text)
	})

	// spec: SERIES-001.9
	it('words Pick this, reject the rest by the picked name', () => {
		expect(changeText({ change: { pickRest: 'IMG_3' }, names: ['IMG_3', 'IMG_4'] })).toBe('Picked IMG_3, rejected the rest')
	})

	it('keeps a name as it is', () => {
		expect(changeText({ change: { flag: 'picked' }, names: ['A & <B>'] })).toBe('Picked A & <B>')
	})

	it('answers an undo with the change it took back', () => {
		expect(undoneText({ change: { flag: 'rejected' }, names: ['IMG_1'] })).toBe('Undid: Rejected IMG_1')
	})

	it('answers a redo with the change it put again', () => {
		expect(redoneText({ change: { rating: 2 }, names: ['A', 'B'] })).toBe('Redid: Rated 2 photos ★★')
	})

	describe('with the marked catalogue', () => {
		beforeEach(installMarkedCatalogue)
		afterEach(uninstallMarkedCatalogue)

		it('translates the words around the name', () => {
			expect(changeText({ change: { colourLabel: 'blue' }, names: ['IMG_1'] })).toBe(`${TRANSLATED_MARK}Labelled IMG_1 ${TRANSLATED_MARK}Blue`)
			expect(changeText({ change: { flag: 'picked' }, names: ['A', 'B'] })).toMatch(new RegExp(`^${escapeMark}Picked ${escapeMark}.*2 photos$`))
		})
	})
})

describe('decidedText', () => {
	it('words the progress as "x / y decided"', () => {
		expect(decidedText(1200, 1840)).toBe('1,200 / 1,840 decided')
	})
})
