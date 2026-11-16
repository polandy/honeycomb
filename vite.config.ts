// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createAppConfig } from '@nextcloud/vite-config'

// Each entry injects its own CSS; the hash worker is built next to the entries in js/.
// Entry names carry their hash, read by PHP from the manifest, so a new build busts the browser cache (ADR 0033).
export default createAppConfig({ main: 'src/main.ts', similarity: 'src/similarity-main.ts' }, {
	inlineCSS: { relativeCSSInjection: true },
	config: {
		build: { manifest: 'js/manifest.json', rollupOptions: { output: { entryFileNames: 'js/honeycomb-[name]-[hash].mjs' } } },
		worker: { format: 'es', rollupOptions: { output: { entryFileNames: 'js/[name]-[hash].mjs' } } },
	},
})
