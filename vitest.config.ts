// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['tests/js/**/*.test.ts'],
		passWithNoTests: true,
		coverage: {
			provider: 'v8',
			include: ['src/logic/**/*.ts'],
			reporter: ['text', 'lcov'],
			thresholds: {
				'src/logic/**/*.ts': { lines: 95, branches: 90 },
			},
		},
	},
})
