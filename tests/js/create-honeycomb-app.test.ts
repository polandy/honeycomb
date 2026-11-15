// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ILogger } from '@nextcloud/logger'

import { describe, expect, it, vi } from 'vitest'
import { createHoneycombApp, versionsAppOf } from '../../src/create-honeycomb-app.ts'

function fakeLogger() {
	return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn<ILogger['error']>(), fatal: vi.fn() }
}

describe('createHoneycombApp', () => {
	// spec: APP-001.5
	it('logs an error that reaches Vue as an error with its cause', () => {
		const logger = fakeLogger()
		const error = new Error('render failed')

		createHoneycombApp(logger, true).config.errorHandler?.(error, null, 'render function')

		expect(logger.error).toHaveBeenCalledWith('Unhandled error in the honeycomb UI', { error, info: 'render function' })
	})

	// spec: SETTINGS-001.26
	it('reads whether the Versions app is on from the page, on unless it says off', () => {
		const root = (value?: string) => {
			const element = document.createElement('div')
			if (value !== undefined) {
				element.dataset.versionsApp = value
			}
			return element
		}

		expect([versionsAppOf(root('false')), versionsAppOf(root('true')), versionsAppOf(root()), versionsAppOf(null)]).toEqual([false, true, true, true])
		expect(createHoneycombApp(fakeLogger(), false)._props).toEqual({ versionsApp: false })
	})
})
