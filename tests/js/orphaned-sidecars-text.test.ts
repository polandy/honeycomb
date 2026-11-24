// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { OrphanedSidecarSkip } from '../../src/logic/orphaned-sidecars.ts'

import { describe, expect, it } from 'vitest'
import { folderText, moveText, reportText, skipReason, totalText } from '../../src/trash/orphaned-sidecars-text.ts'

describe('orphaned sidecar texts', () => {
	// spec: XMP-009.11
	it('counts the sidecars in the total, a folder and the confirmation', () => {
		expect(totalText(1, 2048)).toContain('1 orphaned sidecar,')
		expect(totalText(3, 2048)).toContain('3 orphaned sidecars,')
		expect(folderText('/Photos', 2, 2048)).toContain('/Photos – 2 sidecars,')
		expect(moveText(1)).toBe('Move 1 sidecar to trash')
		expect(moveText(3)).toBe('Move 3 sidecars to trash')
	})

	// spec: XMP-009.12
	it('reports what moved and what was skipped', () => {
		expect(reportText(2, 1)).toBe('2 moved to the trash bin, 1 skipped')
	})

	// spec: XMP-009.12
	it.each<[OrphanedSidecarSkip, string]>([
		['notOrphaned', 'A photo or video it belongs to is in its folder now'],
		['notFound', 'File is gone; find orphaned sidecars again'],
		['changed', 'File changed since the scan; find orphaned sidecars again'],
		['notPermitted', 'You may not delete this file'],
		['locked', 'File is locked (another process is writing to it)'],
		['notSent', 'Not sent, because a request failed'],
	])('says why a %s sidecar stayed', (reason, text) => {
		expect(skipReason(reason)).toBe(text)
	})

	// spec: XMP-009.12
	it('words the trash bin reasons like the delete flow and falls back for any other', () => {
		expect(skipReason('noTrashBin')).not.toBe('')
		expect(skipReason('tooLarge')).not.toBe('')
		expect(skipReason('other' as OrphanedSidecarSkip)).toBe('Could not move the file to the trash bin')
	})
})
