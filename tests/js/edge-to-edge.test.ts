// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { optInToEdgeToEdge } from '../../src/shared/edge-to-edge.ts'

const viewport = () => document.head.querySelector('meta[name="viewport"]')?.getAttribute('content')

function setViewport(content: string): void {
	const meta = document.createElement('meta')
	meta.name = 'viewport'
	meta.content = content
	document.head.replaceChildren(meta)
}

describe('optInToEdgeToEdge', () => {
	beforeEach(() => {
		document.head.replaceChildren()
	})

	// spec: APP-001.21
	it('adds viewport-fit=cover to the viewport Nextcloud set', () => {
		setViewport('width=device-width, initial-scale=1.0')

		optInToEdgeToEdge(document)

		expect(viewport()).toBe('width=device-width, initial-scale=1.0, viewport-fit=cover')
	})

	// spec: APP-001.21
	it('adds it once and replaces another viewport-fit', () => {
		setViewport('width=device-width, viewport-fit=auto')

		optInToEdgeToEdge(document)
		optInToEdgeToEdge(document)

		expect(viewport()).toBe('width=device-width, viewport-fit=cover')
	})

	// spec: APP-001.21
	it('creates the viewport when the page has none', () => {
		optInToEdgeToEdge(document)

		expect(viewport()).toBe('width=device-width, viewport-fit=cover')
	})

	// spec: APP-001.21
	it('adds no leading comma to an empty viewport', () => {
		setViewport('')

		optInToEdgeToEdge(document)

		expect(viewport()).toBe('viewport-fit=cover')
	})
})
