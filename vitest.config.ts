// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [vue()],
	test: {
		include: ['tests/js/**/*.test.ts'],
		passWithNoTests: true,
		restoreMocks: true,
		unstubGlobals: true,
		unstubEnvs: true,
		// Lets Vite handle the CSS that @nextcloud/vue imports.
		server: { deps: { inline: ['@nextcloud/vue'] } },
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts', 'src/**/*.vue'],
			// Entry and logger wiring; the e2e case covers them.
			exclude: ['src/app/main.ts', 'src/hashes/similarity-main.ts', 'src/trash/orphaned-sidecars-main.ts', 'src/statistics/statistics-main.ts', 'src/hashes/hash-worker.ts', 'src/shared/logger.ts'],
			reporter: ['text', 'lcov'],
			thresholds: {
				'src/logic/**/*.ts': { lines: 95, branches: 90 },
				'src/{app,cull,folders,grid,hashes,immich,loupe,move,series,settings,shared,sidecars,statistics,trash}/*.ts': { lines: 70, branches: 70, perFile: true },
				'src/**/*.vue': { lines: 70, branches: 70, perFile: true },
			},
		},
	},
})
