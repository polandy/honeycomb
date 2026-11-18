// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { LockedPicture } from '../../src/logic/writability.ts'

import { describe, expect, it } from 'vitest'
import { lockDetails, lockedText, partialText } from '../../src/lock-text.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'

const locked = (name: string, reason: LockedPicture['reason']): LockedPicture => ({ picture: pictureOf(listingEntry(1, `/P/${name}.JPG`)), reason })

describe('lock texts', () => {
	// spec: XMP-008.3, XMP-008.5
	it.each([
		['readOnly', 'Not changed: you may only read this folder'],
		['noVersions', 'Not changed: this folder keeps no versions'],
		['refused', 'Not changed: a sidecar of this photo was refused; see Details of the last write'],
	] as const)('names why one photo was not changed (%s)', (reason, text) => {
		expect(lockedText([locked('A', reason)])).toBe(text)
	})

	// spec: XMP-008.9
	it('counts the photos not changed and names the first reason in the order of the reasons', () => {
		const both = [locked('A', 'refused'), locked('B', 'noVersions')]

		expect(lockedText(both)).toBe('2 photos not changed: the folder keeps no versions')
		expect(lockedText([locked('A', 'refused'), locked('B', 'readOnly')])).toBe('2 photos not changed: you may only read the folder')
		expect(lockedText([locked('A', 'refused'), locked('B', 'refused')])).toBe('2 photos not changed: a sidecar was refused; see Details of the last write')
	})

	// spec: XMP-008.9
	it('adds the photos not changed to what a step changed, and nothing when every photo was changed', () => {
		expect(partialText('Rejected IMG_2', [locked('A', 'readOnly'), locked('B', 'readOnly')])).toBe('Rejected IMG_2; 2 photos not changed: you may only read the folder')
		expect(partialText('Rejected IMG_2', [locked('A', 'readOnly')])).toBe('Rejected IMG_2; 1 photo not changed: you may only read the folder')
		expect(partialText('Rejected IMG_2', [])).toBe('Rejected IMG_2')
	})

	// spec: XMP-008.9
	it('details each photo not changed with its reason', () => {
		expect(lockDetails([locked('A', 'readOnly'), locked('B', 'refused')])).toEqual([
			'A: you may only read the folder',
			'B: a sidecar was refused; see Details of the last write',
		])
	})
})
