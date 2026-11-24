// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { optInToEdgeToEdge } from '../../src/edge-to-edge.ts'

const viewport = () => document.head.querySelector('meta[name="viewport"]')?.getAttribute('content')

describe('optInToEdgeToEdge', () => {
	beforeEach(() => {
		document.head.innerHTML = ''
	})

	// spec: APP-001.21
	it('adds viewport-fit=cover to the viewport Nextcloud set', () => {
		document.head.innerHTML = '<meta name="viewport" content="width=device-width, initial-scale=1.0">'

		optInToEdgeToEdge(document)

		expect(viewport()).toBe('width=device-width, initial-scale=1.0, viewport-fit=cover')
	})

	// spec: APP-001.21
	it('adds it once and replaces another viewport-fit', () => {
		document.head.innerHTML = '<meta name="viewport" content="width=device-width, viewport-fit=auto">'

		optInToEdgeToEdge(document)
		optInToEdgeToEdge(document)

		expect(viewport()).toBe('width=device-width, viewport-fit=cover')
	})

	// spec: APP-001.21
	it('creates the viewport when the page has none', () => {
		optInToEdgeToEdge(document)

		expect(viewport()).toBe('width=device-width, viewport-fit=cover')
	})
})
