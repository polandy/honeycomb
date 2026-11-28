// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { blocksHint, changesText, checkingText, conflictText, countHeadings, picksText, rejectAsText, resultText, skippedText, writeButtonText, writingText } from '../../src/immich/immich-write-text.ts'

describe('immich-write-text', () => {
	// spec: IMMICH-004.25
	it('names the check\'s block, and the load before it', () => {
		expect(checkingText(null)).toBe('Loading your decisions…')
		expect(checkingText({ done: 100, total: 1240 })).toBe('Checking 1,240 photos with Immich · block 2 of 13')
		expect(checkingText({ done: 0, total: 1 })).toBe('Checking 1 photo with Immich · block 1 of 1')
	})

	// spec: IMMICH-004.26
	it('names the write\'s block and how many photos are written', () => {
		expect(writingText({ done: 200, total: 250 })).toBe('Writing block 3 of 3 · 200 of 250 photos')
	})

	// spec: IMMICH-004.26
	it('names the failed only when one failed', () => {
		expect(resultText({ written: 12, skipped: 0, failed: 0, failedIds: [] })).toBe('Written: 12')
		expect(resultText({ written: 1238, skipped: 0, failed: 2, failedIds: ['a', 'b'] })).toBe('Written: 1,238 · Failed: 2')
		expect(skippedText(3)).toBe('Skipped, as you chose: 3')
	})

	// spec: IMMICH-004.25
	it('counts the changes, singular and plural', () => {
		expect(changesText(1)).toBe('1 photo changes.')
		expect(changesText(1240)).toBe('1,240 photos change.')
		expect(writeButtonText(0)).toBe('Write 0 changes')
		expect(writeButtonText(1)).toBe('Write 1 change')
		expect(countHeadings.rejects(212)).toBe('212 rejected')
		expect(countHeadings.restores(3)).toBe('3 no longer rejected')
		expect(countHeadings.picks(64)).toBe('64 picked')
		expect(countHeadings.ratings(1)).toBe('1 rating')
		expect(countHeadings.ratings(2)).toBe('2 ratings')
		expect(countHeadings.conflicts(2)).toBe('2 to check before writing')
	})

	// spec: IMMICH-004.5
	it('names the blocks a write is sent in, one up to 100', () => {
		expect(blocksHint(100)).toBe('Sent in 1 block of up to 100 photos. Only Immich’s database changes; no file and no sidecar is written.')
		expect(blocksHint(101)).toMatch(/^Sent in 2 blocks of up to 100 photos\./)
		expect(blocksHint(0)).toMatch(/^Sent in 1 block /)
	})

	// spec: IMMICH-004.3, IMMICH-004.4
	it('says what each reject choice and the picks do', () => {
		expect(rejectAsText('trash')).toMatch(/^Immich moves them to its trash/)
		expect(rejectAsText('archive')).toMatch(/^They leave the Immich timeline/)
		expect(rejectAsText('rating')).toMatch(/“rejected” rating \(−1\)/)
		expect(picksText(true)).toBe('They become favourites in Immich.')
		expect(picksText(false)).toBe('Immich has no pick; on this connection picks stay in honeycomb.')
	})

	// spec: IMMICH-004.7, IMMICH-004.8, IMMICH-004.9, IMMICH-004.16
	it('says what each conflict is', () => {
		expect(conflictText({ kind: 'rating', assetId: 'a', immichRating: 2, honeycombRating: 4 })).toBe('Rating changed in Immich since you decided: Immich ★★, honeycomb ★★★★.')
		expect(conflictText({ kind: 'rating', assetId: 'a', immichRating: null, honeycombRating: 0 })).toBe('Rating changed in Immich since you decided: Immich none, honeycomb none.')
		expect(conflictText({ kind: 'shared', assetId: 'a', album: { name: 'Family', others: 1 } })).toBe('In the shared album “Family”. The trash removes it there for 1 other person too.')
		expect(conflictText({ kind: 'shared', assetId: 'a', album: { name: 'Family', others: 3 } })).toMatch(/for 3 other people too\.$/)
		expect(conflictText({ kind: 'trashed', assetId: 'a' })).toBe('Already in the Immich trash. Counts as done; nothing is sent.')
		expect(conflictText({ kind: 'stack', assetId: 'a', stackSize: 4 })).toBe('Top of a stack of 4. Only this photo goes; Immich makes the next one the top.')
	})
})
