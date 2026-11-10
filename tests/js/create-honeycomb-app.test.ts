// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ILogger } from '@nextcloud/logger'

import { describe, expect, it, vi } from 'vitest'
import { createHoneycombApp } from '../../src/create-honeycomb-app.ts'

function fakeLogger(): ILogger & { error: ReturnType<typeof vi.fn> } {
	return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}

describe('createHoneycombApp', () => {
	it('logs an error that reaches Vue as an error with its cause', () => {
		const logger = fakeLogger()
		const error = new Error('render failed')

		createHoneycombApp(logger).config.errorHandler?.(error, null, 'render function')

		expect(logger.error).toHaveBeenCalledWith('Unhandled error in the honeycomb UI', { error, info: 'render function' })
	})
})
