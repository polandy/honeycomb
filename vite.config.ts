// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createAppConfig } from '@nextcloud/vite-config'

// Each entry injects its own CSS; the hash worker is built next to the entries in js/.
export default createAppConfig({ main: 'src/main.ts', similarity: 'src/similarity-main.ts' }, {
	inlineCSS: { relativeCSSInjection: true },
	config: { worker: { format: 'es', rollupOptions: { output: { entryFileNames: 'js/[name]-[hash].mjs' } } } },
})
