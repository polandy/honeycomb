// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ILogger } from '@nextcloud/logger'

import { describe, expect, it, vi } from 'vitest'
import { createHoneycombApp } from '../../src/app/create-honeycomb-app.ts'

function fakeLogger() {
	return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn<ILogger['error']>(), fatal: vi.fn() }
}

describe('createHoneycombApp', () => {
	// spec: APP-001.5
	it('logs an error that reaches Vue as an error with its cause', () => {
		const logger = fakeLogger()
		const error = new Error('render failed')

		createHoneycombApp(logger).config.errorHandler?.(error, null, 'render function')

		expect(logger.error).toHaveBeenCalledWith('Unhandled error in the honeycomb UI', { error, info: 'render function' })
	})

	// spec: APP-001.12
	it('logs no error for the focus trap of a dialog that was taken away while it opened, and still logs any other', () => {
		const logger = fakeLogger()
		const handler = createHoneycombApp(logger).config.errorHandler!
		const vanished = new Error('`fallbackFocus` was specified but was not a node, or did not return a node')
		const other = new Error('`initialFocus` was specified but was not a node, or did not return a node')

		handler(vanished, null, 'transition hook')
		handler(other, null, 'transition hook')

		expect(logger.error).toHaveBeenCalledTimes(1)
		expect(logger.error).toHaveBeenCalledWith('Unhandled error in the honeycomb UI', { error: other, info: 'transition hook' })
		expect(logger.debug).toHaveBeenCalledWith('A dialog was closed while it opened, its focus trap is skipped', { error: vanished })
	})
})
