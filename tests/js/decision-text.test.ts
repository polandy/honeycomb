// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionChange } from '../../src/logic/decision-change.ts'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { changeText, decidedText, redoneText, shownDecidedText, undoneText } from '../../src/decision-text.ts'
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
		expect(changeText({ kind: 'decision', change, names })).toBe(text)
	})

	// spec: SERIES-001.9
	it('words Pick this, reject the rest by the picked name', () => {
		expect(changeText({ kind: 'pickRest', picked: 'IMG_3', names: ['IMG_3', 'IMG_4'] })).toBe('Picked IMG_3, rejected the rest')
	})

	it('keeps a name as it is', () => {
		expect(changeText({ kind: 'decision', change: { flag: 'picked' }, names: ['A & <B>'] })).toBe('Picked A & <B>')
	})

	it('answers an undo with the change it took back', () => {
		expect(undoneText({ kind: 'decision', change: { flag: 'rejected' }, names: ['IMG_1'] })).toBe('Undid: Rejected IMG_1')
	})

	it('answers a redo with the change it put again', () => {
		expect(redoneText({ kind: 'decision', change: { rating: 2 }, names: ['A', 'B'] })).toBe('Redid: Rated 2 photos ★★')
	})

	describe('with the marked catalogue', () => {
		beforeEach(installMarkedCatalogue)
		afterEach(uninstallMarkedCatalogue)

		it('translates the words around the name', () => {
			expect(changeText({ kind: 'decision', change: { colourLabel: 'blue' }, names: ['IMG_1'] })).toBe(`${TRANSLATED_MARK}Labelled IMG_1 ${TRANSLATED_MARK}Blue`)
			expect(changeText({ kind: 'decision', change: { flag: 'picked' }, names: ['A', 'B'] })).toMatch(new RegExp(`^${escapeMark}Picked ${escapeMark}.*2 photos$`))
		})
	})
})

describe('decidedText', () => {
	it('words the progress as "x / y decided"', () => {
		expect(decidedText(1200, 1840)).toBe('1,200 / 1,840 decided')
	})
})

describe('shownDecidedText', () => {
	// spec: GRID-002.7
	it('names the shown photos as the scope: "x / y shown decided"', () => {
		expect(shownDecidedText(4, 1820)).toBe('4 / 1,820 shown decided')
	})
})

describe('changeText of a tag change', () => {
	// spec: TAGS-003.10
	it.each([
		[{ added: ['Sunrise'], removed: [] }, ['DSC_4103'], 'Tagged DSC_4103 Sunrise'],
		[{ added: ['Places/Dolomites'], removed: [] }, ['A', 'B', 'C', 'D', 'E', 'F', 'G'], 'Tagged 7 photos Places/Dolomites'],
		[{ added: [], removed: ['People/Anna'] }, ['A', 'B'], 'Removed People/Anna from 2 photos'],
	])('words %o of %o as "%s"', (change, names, text) => {
		expect(changeText({ kind: 'tags', change, names })).toBe(text)
		expect(undoneText({ kind: 'tags', change, names })).toBe(`Undid: ${text}`)
	})
})

describe('changeText of a series edit', () => {
	it.each([
		// spec: SERIES-005.10
		['remove', ['IMG_0402'], 1, 'Removed IMG_0402 from the series'],
		// spec: SERIES-005.11
		['remove', ['A', 'B'], 2, 'Removed 2 photos from their series'],
		// spec: SERIES-005.13
		['dissolve', ['A', 'B', 'C', 'D'], 1, 'Dissolved the series · 4 photos'],
		// spec: SERIES-005.4
		['new', ['A', 'B', 'C', 'D'], 0, 'Made a series of 4 photos'],
		// spec: SERIES-005.6
		['add', ['A', 'B', 'C'], 1, 'Added 3 photos to the series'],
		['add', ['A'], 1, 'Added A to the series'],
		// spec: SERIES-005.7
		['merge', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 2, 'Merged 2 series · 8 photos'],
		// spec: SERIES-005.14
		['done', ['A', 'B', 'C'], 1, 'Marked the series done'],
		// spec: SERIES-005.15
		['reopen', ['A', 'B', 'C'], 1, 'Reopened the series'],
	] as const)('words %s of %o in %i series as "%s"', (edit, names, series, text) => {
		expect(changeText({ kind: 'series', edit, names, series })).toBe(text)
		expect(redoneText({ kind: 'series', edit, names, series })).toBe(`Redid: ${text}`)
	})
})
