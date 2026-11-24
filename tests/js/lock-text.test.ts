// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { LockedPicture } from '../../src/logic/writability.ts'

import { describe, expect, it } from 'vitest'
import { lockDetails, lockedText, partialText } from '../../src/cull/lock-text.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'

const locked = (name: string, reason: LockedPicture['reason']): LockedPicture => ({ picture: pictureOf(listingEntry(1, `/P/${name}.JPG`)), reason })

describe('lock texts', () => {
	// spec: XMP-008.3
	it('names why one photo was not changed', () => {
		expect(lockedText()).toBe('Not changed: read only')
	})

	// spec: XMP-008.14
	it('says read only for a step whose photos are all locked', () => {
		expect(lockedText()).toBe('Not changed: read only')
	})

	// spec: XMP-008.14
	it('adds the photos not changed to what a step changed, and nothing when every photo was changed', () => {
		expect(partialText('Picked 7 photos', [locked('A', 'readOnly'), locked('B', 'readOnly'), locked('C', 'readOnly')])).toBe('Picked 7 photos; 3 photos not changed: read only')
		expect(partialText('Rejected IMG_2', [locked('A', 'readOnly'), locked('B', 'readOnly')])).toBe('Rejected IMG_2; 2 photos not changed: read only')
		expect(partialText('Rejected IMG_2', [locked('A', 'readOnly')])).toBe('Rejected IMG_2; 1 photo not changed: read only')
		expect(partialText('Rejected IMG_2', [])).toBe('Rejected IMG_2')
	})

	// spec: XMP-008.14
	it('details each photo not changed with its reason', () => {
		expect(lockDetails([locked('A', 'readOnly'), locked('B', 'readOnly')])).toEqual(['A: read only', 'B: read only'])
	})
})
