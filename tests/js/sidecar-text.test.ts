// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SidecarFailureReason } from '../../src/logic/sidecar-sync.ts'

import { describe, expect, it } from 'vitest'
import { notWrittenText, sidecarFailureReason, writtenText } from '../../src/sidecar-text.ts'

const REASONS: SidecarFailureReason[] = ['malformed', 'not-utf-8', 'doctype', 'conflict', 'not-xmp', 'notFound', 'tooLarge', 'notPermitted', 'locked', 'changed', 'noSpace', 'unreachable', 'failed']

describe('sidecar texts', () => {
	// spec: XMP-003.13
	it('names each reason a sidecar was not written in its own words', () => {
		const texts = REASONS.map(sidecarFailureReason)

		expect(new Set(texts).size).toBe(REASONS.length)
		expect(sidecarFailureReason('failed')).toBe('The server failed on the sidecar; the Nextcloud log names the cause')
	})

	// spec: XMP-003.33
	it.each(REASONS)('names the reason %s in the toast of a failed write, in its own words', (reason) => {
		expect(notWrittenText([reason])).toBe(`Could not write 1 sidecar. ${sidecarFailureReason(reason)}`)
	})

	// spec: XMP-003.13
	it('names the reason of most failed sidecars and points to Details for the others', () => {
		expect(notWrittenText(['malformed', 'notPermitted', 'notPermitted'])).toBe('Could not write 3 sidecars. You may not change this sidecar or create files in its folder. More reasons in Details.')
		expect(notWrittenText(['locked', 'notFound'])).toBe('Could not write 2 sidecars. The sidecar is locked (another process is writing to it). More reasons in Details.')
	})

	// spec: XMP-002.12
	it('says a sidecar was not written because the storage is full', () => {
		expect(sidecarFailureReason('noSpace')).toBe('No storage space left for the sidecar; free some space or ask the folder\'s owner')
		expect(notWrittenText(['noSpace', 'noSpace'])).toBe('Could not write 2 sidecars. No storage space left for the sidecar; free some space or ask the folder\'s owner')
	})

	it('counts sidecars and photos', () => {
		expect(writtenText(1200)).toBe('Wrote the decisions of 1,200 photos to sidecars')
	})
})
