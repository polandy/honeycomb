// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SidecarFailureReason } from '../../src/logic/sidecar-sync.ts'

import { describe, expect, it } from 'vitest'
import { notWrittenText, sidecarFailureReason, writtenText } from '../../src/sidecar-text.ts'

const REASONS: SidecarFailureReason[] = ['malformed', 'not-utf-8', 'doctype', 'conflict', 'not-xmp', 'notFound', 'tooLarge', 'notPermitted', 'locked', 'changed', 'unreachable', 'failed']

describe('sidecar texts', () => {
	// spec: XMP-003.13
	it('names each reason a sidecar was not written in its own words', () => {
		const texts = REASONS.map(sidecarFailureReason)

		expect(new Set(texts).size).toBe(REASONS.length)
		expect(sidecarFailureReason('failed')).toBe('The server could not write the sidecar')
	})

	it('counts sidecars and photos', () => {
		expect(notWrittenText(1)).toBe('Could not write 1 sidecar')
		expect(writtenText(1200)).toBe('Wrote the decisions of 1,200 photos to sidecars')
	})
})
