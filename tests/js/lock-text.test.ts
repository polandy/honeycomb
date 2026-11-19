// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { LockedPicture } from '../../src/logic/writability.ts'

import { describe, expect, it } from 'vitest'
import { lockDetails, lockedText, partialText } from '../../src/lock-text.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'

const locked = (name: string, reason: LockedPicture['reason']): LockedPicture => ({ picture: pictureOf(listingEntry(1, `/P/${name}.JPG`)), reason })

describe('lock texts', () => {
	// spec: XMP-008.3, XMP-008.11
	it.each([
		['readOnly', 'Not changed: read only'],
		['legacy', 'Not changed: this photo\'s stored decisions are not yet in its sidecars'],
	] as const)('names why one photo was not changed (%s)', (reason, text) => {
		expect(lockedText([locked('A', reason)])).toBe(text)
	})

	// spec: XMP-008.14
	it('says read only for a step whose photos are all locked, one of them read-only', () => {
		expect(lockedText([locked('A', 'readOnly'), locked('B', 'readOnly')])).toBe('Not changed: read only')
		expect(lockedText([locked('A', 'legacy'), locked('B', 'readOnly')])).toBe('Not changed: read only')
	})

	// spec: XMP-008.11
	it('counts the photos not changed for stored decisions', () => {
		expect(lockedText([locked('A', 'legacy'), locked('B', 'legacy')])).toBe('2 photos not changed: stored decisions are not yet in the sidecars')
	})

	// spec: XMP-008.14
	it('adds the photos not changed to what a step changed, and nothing when every photo was changed', () => {
		expect(partialText('Picked 7 photos', [locked('A', 'readOnly'), locked('B', 'readOnly'), locked('C', 'readOnly')])).toBe('Picked 7 photos; 3 photos not changed: read only')
		expect(partialText('Rejected IMG_2', [locked('A', 'legacy'), locked('B', 'readOnly')])).toBe('Rejected IMG_2; 2 photos not changed: read only')
		expect(partialText('Rejected IMG_2', [locked('A', 'readOnly')])).toBe('Rejected IMG_2; 1 photo not changed: read only')
		expect(partialText('Rejected IMG_2', [])).toBe('Rejected IMG_2')
	})

	// spec: XMP-008.14
	it('details each photo not changed with its reason', () => {
		expect(lockDetails([locked('A', 'readOnly'), locked('B', 'legacy')])).toEqual([
			'A: read only',
			'B: stored decisions are not yet in the sidecars',
		])
	})
})
