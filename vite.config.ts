// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin } from 'vite'

import { createAppConfig } from '@nextcloud/vite-config'

/** Writes `js/scripts.php`, the built script name of each entry, which the pages add (ADR 0033). */
function scriptMap(): Plugin {
	return {
		name: 'honeycomb-script-map',
		generateBundle(_options, bundle) {
			const names = Object.values(bundle).flatMap((chunk) => (chunk.type === 'chunk' && chunk.isEntry ? [`'${chunk.name}' => '${chunk.fileName.replace(/^js\/(.+)\.mjs$/, '$1')}'`] : []))
			this.emitFile({ type: 'asset', fileName: 'js/scripts.php', source: `<?php\n\nreturn [${names.join(', ')}];\n` })
		},
	}
}

// Each entry injects its own CSS; the hash worker is built next to the entries in js/.
// Entry names carry their content hash, so a new build busts the browser cache (ADR 0033).
export default createAppConfig({ main: 'src/app/main.ts', similarity: 'src/hashes/similarity-main.ts', statistics: 'src/statistics/statistics-main.ts', 'orphaned-sidecars': 'src/trash/orphaned-sidecars-main.ts' }, {
	inlineCSS: { relativeCSSInjection: true },
	config: {
		plugins: [scriptMap()],
		build: { rollupOptions: { output: { entryFileNames: 'js/honeycomb-[name]-[hash].mjs' } } },
		worker: { format: 'es', rollupOptions: { output: { entryFileNames: 'js/[name]-[hash].mjs' } } },
	},
})
